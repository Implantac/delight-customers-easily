/**
 * Driver: TOTVS Protheus (REST API publicada via Advpl/Tlpp).
 *
 * Convenção: cliente expõe endpoints REST padrão TOTVS via Application Server.
 *   cfg.app_key   → base URL (ex.: https://protheus.cliente.com/rest)
 *   cfg.app_secret → Bearer token (obtido via /api/oauth2/v1/token externamente)
 *
 * Apenas leitura comercial — SA1 (clientes), SA3 (vendedores), SC5/SC6 (pedidos).
 * Nada de estoque (SB*), fiscal, financeiro (SE*), compras (SC7).
 */
import type {
  ErpCustomerDTO, ErpCustomerPushInput, ErpDriver, ErpDriverConfig,
  ErpPullResult, ErpPushResult, ErpSalesOrderDTO, ErpSalesRepDTO,
} from "./types";

async function pWrite(cfg: ErpDriverConfig, path: string, method: "POST" | "PUT", payload: unknown) {
  if (!cfg.app_key || !cfg.app_secret) {
    throw new Error("Protheus requer app_key (base URL) e app_secret (Bearer token).");
  }
  const base = cfg.app_key.replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.app_secret}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body: any; try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) throw new Error(body?.errorMessage || body?.message || `Protheus HTTP ${res.status}`);
  return body;
}

async function pGet(cfg: ErpDriverConfig, path: string, query: Record<string, string | number> = {}) {
  if (!cfg.app_key || !cfg.app_secret) {
    throw new Error("Protheus requer app_key (base URL) e app_secret (Bearer token).");
  }
  const base = cfg.app_key.replace(/\/$/, "");
  const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();
  const res = await fetch(`${base}${path}${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${cfg.app_secret}`, Accept: "application/json" },
  });
  const text = await res.text();
  let body: any; try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) throw new Error(body?.errorMessage || body?.message || `Protheus HTTP ${res.status}`);
  return body;
}

function brOrIso(s: string | null | undefined): string {
  if (!s) return new Date().toISOString();
  // Protheus geralmente devolve "YYYYMMDD" ou "YYYY-MM-DD"
  if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  return s;
}

export const protheusDriver: ErpDriver = {
  id: "protheus",

  async testConnection(cfg) {
    const t0 = Date.now();
    await pGet(cfg, "/api/framework/v1/customers", { pageSize: 1, page: 1 });
    return { latency_ms: Date.now() - t0 };
  },

  async pullCustomers(cfg, cursor, limit) {
    const page = Number((cursor?.page as number) ?? 1);
    const body = await pGet(cfg, "/api/framework/v1/customers", { pageSize: limit, page });
    const list: any[] = body?.items ?? body?.customers ?? body?.data ?? [];
    const dtos: ErpCustomerDTO[] = list.map((c: any) => ({
      external_id: String(c.code ?? c.id ?? c.A1_COD ?? ""),
      legal_name: c.legalName ?? c.A1_NREDUZ ?? c.name ?? null,
      trade_name: c.tradeName ?? c.A1_NOME ?? c.name ?? null,
      document: c.document ?? c.A1_CGC ?? c.cnpj ?? null,
      email: c.email ?? c.A1_EMAIL ?? null,
      phone: c.phone ?? c.A1_TEL ?? null,
      address: c.address ?? c.A1_END ?? null,
      city: c.city ?? c.A1_MUN ?? null,
      state: c.state ?? c.A1_EST ?? null,
      zip: c.zipCode ?? c.A1_CEP ?? null,
      segment: null,
      is_active: (c.A1_MSBLQL ?? c.blocked ?? "2") !== "1",
      last_purchase_at: null,
      credit_limit: c.creditLimit != null ? Number(c.creditLimit) : (c.A1_LC != null ? Number(c.A1_LC) : null),
      credit_status: c.A1_MSBLQL === "1" ? "blocked" : "ok",
      extra: {},
    }));
    const hasMore = (body?.hasNext ?? body?.has_more ?? (dtos.length === limit)) === true;
    return {
      rows: dtos,
      next_cursor: hasMore ? { page: page + 1 } : null,
      has_more: hasMore,
    };
  },

  async pullSalesReps(cfg, cursor, limit) {
    const page = Number((cursor?.page as number) ?? 1);
    const body = await pGet(cfg, "/api/framework/v1/salespersons", { pageSize: limit, page });
    const list: any[] = body?.items ?? body?.salespersons ?? body?.data ?? [];
    const dtos: ErpSalesRepDTO[] = list.map((v: any) => ({
      external_id: String(v.code ?? v.A3_COD ?? v.id ?? ""),
      name: v.name ?? v.A3_NOME ?? `Vendedor ${v.code ?? v.A3_COD}`,
      email: v.email ?? v.A3_EMAIL ?? null,
      phone: v.phone ?? v.A3_TEL ?? null,
      region: v.region ?? v.A3_REGIAO ?? null,
      is_active: (v.A3_MSBLQL ?? "2") !== "1",
      extra: {},
    }));
    const hasMore = (body?.hasNext ?? (dtos.length === limit)) === true;
    return {
      rows: dtos,
      next_cursor: hasMore ? { page: page + 1 } : null,
      has_more: hasMore,
    };
  },

  async pullSalesHistory(cfg, cursor, limit, sinceIso) {
    const page = Number((cursor?.page as number) ?? 1);
    const q: Record<string, string | number> = { pageSize: limit, page };
    if (sinceIso) q.dateFrom = sinceIso.slice(0, 10);
    const body = await pGet(cfg, "/api/framework/v1/salesOrders", q);
    const list: any[] = body?.items ?? body?.salesOrders ?? body?.data ?? [];
    const dtos: ErpSalesOrderDTO[] = list.map((p: any) => ({
      external_id: String(p.orderNumber ?? p.C5_NUM ?? p.id ?? ""),
      external_customer_id: String(p.customerCode ?? p.C5_CLIENTE ?? ""),
      external_rep_id: p.salespersonCode ?? p.C5_VEND1 ?? null,
      order_date: brOrIso(p.issueDate ?? p.C5_EMISSAO),
      total_value: Number(p.totalValue ?? p.C5_VALOR ?? 0),
      items_count: p.itemsCount != null ? Number(p.itemsCount) : null,
      status: p.status ?? p.C5_NOTA ?? null,
      extra: {},
    }));
    const hasMore = (body?.hasNext ?? (dtos.length === limit)) === true;
    return {
      rows: dtos,
      next_cursor: hasMore ? { page: page + 1 } : null,
      has_more: hasMore,
    };
  },

  async pushCustomer(cfg, input: ErpCustomerPushInput): Promise<ErpPushResult> {
    const payload: Record<string, unknown> = {
      legalName: input.legal_name,
      tradeName: input.trade_name,
      document: input.document,
      email: input.email,
      phone: input.phone,
    };
    if (input.external_id) {
      await pWrite(cfg, `/api/framework/v1/customers/${encodeURIComponent(input.external_id)}`, "PUT", payload);
      return { external_id: input.external_id, note: "atualizado" };
    }
    const body = await pWrite(cfg, "/api/framework/v1/customers", "POST", payload);
    const id = String(body?.code ?? body?.id ?? body?.A1_COD ?? "");
    if (!id) throw new Error("Protheus não retornou código do cliente criado.");
    return { external_id: id, note: "criado" };
  },
};
