/**
 * Driver: Sankhya (Gateway REST).
 * Implementa ErpDriver consumindo o gateway /service.sbr do Sankhya.
 *
 * Autenticação: token Bearer (obtido via /login do gateway pelo cliente,
 * já armazenado em cfg.app_secret). Base URL em cfg.app_key.
 *
 * Apenas leitura comercial — clientes, vendedores, cabeçalhos de pedido.
 * Nada de estoque, fiscal, NFe, compras, contábil.
 */
import type {
  ErpCustomerDTO, ErpCustomerPushInput, ErpDriver, ErpDriverConfig,
  ErpPullResult, ErpPushResult, ErpSalesOrderDTO, ErpSalesRepDTO,
} from "./types";

type SankhyaResp = {
  status: string;
  responseBody?: {
    entities?: {
      entity?: Array<Record<string, { $: string } | string>>;
    };
  };
  statusMessage?: string;
};

function flat(row: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v && typeof v === "object" && "$" in v ? String(v.$ ?? "") : String(v ?? "");
  }
  return out;
}

async function sankhyaCall(cfg: ErpDriverConfig, serviceName: string, body: Record<string, unknown>): Promise<SankhyaResp> {
  if (!cfg.app_key || !cfg.app_secret) {
    throw new Error("Sankhya requer app_key (base URL do gateway) e app_secret (Bearer token).");
  }
  const base = cfg.app_key.replace(/\/$/, "");
  const res = await fetch(`${base}/gateway/v1/mge/service.sbr?serviceName=${encodeURIComponent(serviceName)}&outputType=json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.app_secret}`,
    },
    body: JSON.stringify({ serviceName, requestBody: body }),
  });
  const text = await res.text();
  let parsed: any; try { parsed = JSON.parse(text); } catch { parsed = { status: "0", statusMessage: text }; }
  if (!res.ok || parsed?.status === "0") {
    throw new Error(parsed?.statusMessage || `Sankhya HTTP ${res.status}`);
  }
  return parsed;
}

function listEntities(r: SankhyaResp): Record<string, any>[] {
  const ent = r.responseBody?.entities?.entity;
  if (!ent) return [];
  return (Array.isArray(ent) ? ent : [ent]).map(flat);
}

async function loadRecords(cfg: ErpDriverConfig, name: string, fields: string[], where: string, pageStart: number, pageSize: number) {
  const r = await sankhyaCall(cfg, "CRUDServiceProvider.loadRecords", {
    dataSet: {
      rootEntity: name,
      includePresentationFields: "S",
      offsetPage: String(pageStart),
      limit: String(pageSize),
      entity: { fieldset: { list: fields.join(",") } },
      criteria: where ? { expression: { $: where } } : undefined,
    },
  });
  return listEntities(r);
}

export const sankhyaDriver: ErpDriver = {
  id: "sankhya",

  async testConnection(cfg) {
    const t0 = Date.now();
    await loadRecords(cfg, "Parceiro", ["CODPARC"], "this.CLIENTE = 'S'", 0, 1);
    return { latency_ms: Date.now() - t0 };
  },

  async pullCustomers(cfg, cursor, limit) {
    const page = Number((cursor?.page as number) ?? 0);
    const rows = await loadRecords(
      cfg, "Parceiro",
      ["CODPARC", "NOMEPARC", "RAZAOSOCIAL", "CGC_CPF", "EMAIL", "TELEFONE", "ENDERECO", "CIDADE", "UF", "CEP", "ATIVO", "DTCAD"],
      "this.CLIENTE = 'S'", page, limit,
    );
    const dtos: ErpCustomerDTO[] = rows.map((r) => ({
      external_id: r.CODPARC,
      legal_name: r.RAZAOSOCIAL || null,
      trade_name: r.NOMEPARC || null,
      document: r.CGC_CPF || null,
      email: r.EMAIL || null,
      phone: r.TELEFONE || null,
      address: r.ENDERECO || null,
      city: r.CIDADE || null,
      state: r.UF || null,
      zip: r.CEP || null,
      segment: null,
      is_active: r.ATIVO !== "N",
      last_purchase_at: null,
      credit_limit: null,
      credit_status: null,
      extra: { codparc: r.CODPARC },
    }));
    return {
      rows: dtos,
      next_cursor: dtos.length === limit ? { page: page + 1 } : null,
      has_more: dtos.length === limit,
    };
  },

  async pullSalesReps(cfg, cursor, limit) {
    const page = Number((cursor?.page as number) ?? 0);
    const rows = await loadRecords(
      cfg, "Vendedor",
      ["CODVEND", "APELIDO", "EMAIL", "TELEFONE", "ATIVO"],
      "", page, limit,
    );
    const dtos: ErpSalesRepDTO[] = rows.map((r) => ({
      external_id: r.CODVEND,
      name: r.APELIDO || `Vendedor ${r.CODVEND}`,
      email: r.EMAIL || null,
      phone: r.TELEFONE || null,
      region: null,
      is_active: r.ATIVO !== "N",
      extra: { codvend: r.CODVEND },
    }));
    return {
      rows: dtos,
      next_cursor: dtos.length === limit ? { page: page + 1 } : null,
      has_more: dtos.length === limit,
    };
  },

  async pullSalesHistory(cfg, cursor, limit, sinceIso) {
    const page = Number((cursor?.page as number) ?? 0);
    const where: string[] = ["this.TIPMOV = 'V'"];
    if (sinceIso) where.push(`this.DTNEG >= TO_DATE('${sinceIso.slice(0, 10)}','YYYY-MM-DD')`);
    const rows = await loadRecords(
      cfg, "CabecalhoNota",
      ["NUNOTA", "NUMNOTA", "CODPARC", "CODVEND", "DTNEG", "VLRNOTA", "STATUSNOTA"],
      where.join(" AND "), page, limit,
    );
    const dtos: ErpSalesOrderDTO[] = rows.map((r) => ({
      external_id: r.NUNOTA,
      external_customer_id: r.CODPARC,
      external_rep_id: r.CODVEND || null,
      order_date: r.DTNEG ? new Date(r.DTNEG).toISOString() : new Date().toISOString(),
      total_value: Number(r.VLRNOTA) || 0,
      items_count: null,
      status: r.STATUSNOTA || null,
      extra: { numnota: r.NUMNOTA },
    }));
    return {
      rows: dtos,
      next_cursor: dtos.length === limit ? { page: page + 1 } : null,
      has_more: dtos.length === limit,
    };
  },

  async pushCustomer(cfg, input: ErpCustomerPushInput): Promise<ErpPushResult> {
    const fields: Record<string, string> = {};
    if (input.legal_name) fields.RAZAOSOCIAL = input.legal_name;
    if (input.trade_name) fields.NOMEPARC = input.trade_name;
    if (input.document) fields.CGC_CPF = input.document.replace(/\D/g, "");
    if (input.email) fields.EMAIL = input.email;
    if (input.phone) fields.TELEFONE = input.phone;
    fields.CLIENTE = "S";

    const body: Record<string, unknown> = {
      serviceName: "CRUDServiceProvider.saveRecord",
      requestBody: {
        dataSet: {
          rootEntity: "Parceiro",
          includePresentationFields: "N",
          dataRow: {
            ...(input.external_id ? { key: { CODPARC: { $: input.external_id } } } : {}),
            localFields: Object.fromEntries(
              Object.entries(fields).map(([k, v]) => [k, { $: v }]),
            ),
          },
          entity: { fieldset: { list: "CODPARC" } },
        },
      },
    };
    const resp = await sankhyaCall(cfg, "CRUDServiceProvider.saveRecord", body);
    if (resp.status !== "1") {
      throw new Error(resp.statusMessage || "Sankhya rejeitou saveRecord");
    }
    const ent = resp.responseBody?.entities?.entity?.[0] as Record<string, any> | undefined;
    const id = ent ? flat(ent).CODPARC : input.external_id ?? "";
    if (!id) throw new Error("Sankhya não retornou CODPARC.");
    return { external_id: id, note: input.external_id ? "atualizado" : "criado" };
  },
};
