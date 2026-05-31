import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================================
// Catálogo de ERPs suportados
// ============================================================================

export type ErpProviderCatalog = {
  id: "omie" | "bling" | "tiny" | "sap" | "protheus" | "custom";
  name: string;
  description: string;
  methods: Array<"api" | "db" | "agent" | "csv" | "xml">;
  status: "active" | "beta" | "soon";
  docsUrl?: string;
  category: "cloud" | "on-premise" | "generic";
};

export const ERP_CATALOG: ErpProviderCatalog[] = [
  {
    id: "omie",
    name: "Omie",
    description: "Sincronize Contatos e Empresas como Clientes no Omie.",
    methods: ["api"],
    status: "active",
    docsUrl: "https://developer.omie.com.br/my-apps/",
    category: "cloud",
  },
  {
    id: "bling",
    name: "Bling",
    description: "ERP cloud com API REST. Sincroniza contatos, produtos e pedidos.",
    methods: ["api"],
    status: "active",
    docsUrl: "https://developer.bling.com.br/",
    category: "cloud",
  },
  {
    id: "tiny",
    name: "Tiny ERP",
    description: "ERP cloud popular para PMEs. API REST disponível.",
    methods: ["api"],
    status: "soon",
    docsUrl: "https://tiny.com.br/info-api",
    category: "cloud",
  },
  {
    id: "sap",
    name: "SAP Business One",
    description: "Integração via API REST ou Service Layer.",
    methods: ["api", "db"],
    status: "soon",
    category: "on-premise",
  },
  {
    id: "protheus",
    name: "TOTVS Protheus",
    description: "Integração via REST adapter ou agente local de leitura SQL.",
    methods: ["api", "db", "agent"],
    status: "soon",
    category: "on-premise",
  },
  {
    id: "custom",
    name: "ERP customizado",
    description: "Importação CSV/XML, webhooks ou endpoint próprio.",
    methods: ["csv", "xml", "api"],
    status: "beta",
    category: "generic",
  },
];

// ============================================================================
// Health Center
// ============================================================================

export type ErpHealthRow = {
  provider: string;
  is_configured: boolean;
  is_active: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  latency_ms: number | null;
  status: "online" | "offline" | "degraded" | "not_configured";
  contacts_synced: number;
  contacts_total: number;
  companies_synced: number;
  companies_total: number;
};

export const getErpHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: integs } = await supabase
      .from("erp_integrations")
      .select("provider,app_key,app_secret,is_active,last_sync_at,last_error")
      .eq("organization_id", data.organization_id);

    const rows: ErpHealthRow[] = [];

    for (const catalog of ERP_CATALOG) {
      const integ = (integs ?? []).find((i: any) => i.provider === catalog.id);

      let latency_ms: number | null = null;
      let status: ErpHealthRow["status"] = "not_configured";

      if (integ && integ.is_active) {
        if (catalog.id === "omie") {
          const t0 = Date.now();
          try {
            const res = await fetch("https://app.omie.com.br/api/v1/geral/clientes/", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                call: "ListarClientes",
                app_key: integ.app_key,
                app_secret: integ.app_secret,
                param: [{ pagina: 1, registros_por_pagina: 1, apenas_importado_api: "N" }],
              }),
            });
            latency_ms = Date.now() - t0;
            const body = await res.text();
            if (!res.ok || body.includes("faultstring")) {
              status = "degraded";
            } else {
              status = latency_ms > 3000 ? "degraded" : "online";
            }
          } catch {
            latency_ms = Date.now() - t0;
            status = "offline";
          }
        } else if (catalog.id === "bling") {
          const t0 = Date.now();
          try {
            const res = await fetch("https://www.bling.com.br/Api/v3/contatos?limite=1", {
              headers: { Authorization: `Bearer ${integ.app_key}`, Accept: "application/json" },
            });
            latency_ms = Date.now() - t0;
            status = res.ok ? (latency_ms > 3000 ? "degraded" : "online") : "degraded";
          } catch {
            latency_ms = Date.now() - t0;
            status = "offline";
          }
        } else {
          status = integ.last_error ? "degraded" : "online";
        }
      } else if (integ) {
        status = "offline";
      }

      // Totais sincronizados (apenas Omie tem colunas omie_id por enquanto)
      let contacts_synced = 0;
      let companies_synced = 0;
      if (catalog.id === "omie") {
        const [{ count: cs }, { count: cos }] = await Promise.all([
          supabase
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", data.organization_id)
            .not("omie_id", "is", null),
          supabase
            .from("companies")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", data.organization_id)
            .not("omie_id", "is", null),
        ]);
        contacts_synced = cs ?? 0;
        companies_synced = cos ?? 0;
      }

      rows.push({
        provider: catalog.id,
        is_configured: !!integ,
        is_active: !!integ?.is_active,
        last_sync_at: integ?.last_sync_at ?? null,
        last_error: integ?.last_error ?? null,
        latency_ms,
        status,
        contacts_synced,
        contacts_total: 0,
        companies_synced,
        companies_total: 0,
      });
    }

    // Totals (uma única query, todos providers iguais)
    const [{ count: contactsTotal }, { count: companiesTotal }] = await Promise.all([
      supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", data.organization_id),
      supabase
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", data.organization_id),
    ]);
    for (const r of rows) {
      r.contacts_total = contactsTotal ?? 0;
      r.companies_total = companiesTotal ?? 0;
    }

    return { rows };
  });
