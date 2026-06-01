/**
 * Driver: Conta Azul (API v1, OAuth2 Bearer).
 * cfg.app_key  → access_token
 * cfg.app_secret → opcional (refresh_token), não usado aqui (renovação fora)
 *
 * Apenas leitura comercial — clientes, vendedores, vendas.
 * Nada de estoque, financeiro, fiscal, compras.
 */
import type {
  ErpCustomerDTO, ErpCustomerPushInput, ErpDriver, ErpDriverConfig,
  ErpPullResult, ErpPushResult, ErpSalesOrderDTO, ErpSalesRepDTO,
} from "./types";

async function caWrite(cfg: ErpDriverConfig, method: "POST" | "PUT", path: string, body: unknown) {
  if (!cfg.app_key) throw new Error("Conta Azul requer app_key (access_token).");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.app_key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: any; try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }
  if (!res.ok) throw new Error(parsed?.message || parsed?.error || `Conta Azul HTTP ${res.status}`);
  return parsed;
}

const BASE = "https://api.contaazul.com/v1";

async function caGet(cfg: ErpDriverConfig, path: string, query: Record<string, string | number> = {}) {
  if (!cfg.app_key) throw new Error("Conta Azul requer app_key (access_token).");
  const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();
  const url = `${BASE}${path}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${cfg.app_key}`, Accept: "application/json" },
  });
  const text = await res.text();
  let body: any; try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `Conta Azul HTTP ${res.status}`);
  }
  return body;
}

export const contaAzulDriver: ErpDriver = {
  id: "contaazul",

  async testConnection(cfg) {
    const t0 = Date.now();
    await caGet(cfg, "/customers", { size: 1, page: 0 });
    return { latency_ms: Date.now() - t0 };
  },

  async pullCustomers(cfg, cursor, limit) {
    const page = Number((cursor?.page as number) ?? 0);
    const body = await caGet(cfg, "/customers", { size: limit, page });
    const list: any[] = Array.isArray(body) ? body : (body?.content ?? body?.data ?? []);
    const dtos: ErpCustomerDTO[] = list.map((c: any) => ({
      external_id: String(c.id ?? c.uuid ?? ""),
      legal_name: c.business_name ?? c.company_name ?? null,
      trade_name: c.name ?? null,
      document: c.document ?? c.cnpj ?? c.cpf ?? null,
      email: c.email ?? null,
      phone: c.cell_phone ?? c.business_phone ?? null,
      address: c.address?.street ?? null,
      city: c.address?.city?.name ?? c.address?.city ?? null,
      state: c.address?.state ?? c.address?.city?.state ?? null,
      zip: c.address?.zip_code ?? null,
      segment: null,
      is_active: c.status !== "INACTIVE",
      last_purchase_at: null,
      credit_limit: null,
      credit_status: null,
      extra: {},
    }));
    return {
      rows: dtos,
      next_cursor: dtos.length === limit ? { page: page + 1 } : null,
      has_more: dtos.length === limit,
    };
  },

  async pullSalesReps(cfg, cursor, limit) {
    const page = Number((cursor?.page as number) ?? 0);
    // Conta Azul não expõe "vendedores" no padrão — usamos usuários com perfil de venda quando disponíveis.
    const body = await caGet(cfg, "/employees", { size: limit, page }).catch(() => ({ content: [] }));
    const list: any[] = Array.isArray(body) ? body : (body?.content ?? body?.data ?? []);
    const dtos: ErpSalesRepDTO[] = list.map((e: any) => ({
      external_id: String(e.id ?? e.uuid ?? ""),
      name: e.name ?? `Vendedor ${e.id}`,
      email: e.email ?? null,
      phone: e.phone ?? null,
      region: null,
      is_active: e.status !== "INACTIVE",
      extra: {},
    }));
    return {
      rows: dtos,
      next_cursor: dtos.length === limit ? { page: page + 1 } : null,
      has_more: dtos.length === limit,
    };
  },

  async pullSalesHistory(cfg, cursor, limit, sinceIso) {
    const page = Number((cursor?.page as number) ?? 0);
    const query: Record<string, string | number> = { size: limit, page };
    if (sinceIso) query.emission_start = sinceIso.slice(0, 10);
    const body = await caGet(cfg, "/sales", query);
    const list: any[] = Array.isArray(body) ? body : (body?.content ?? body?.data ?? []);
    const dtos: ErpSalesOrderDTO[] = list.map((s: any) => ({
      external_id: String(s.id ?? s.uuid ?? ""),
      external_customer_id: String(s.customer?.id ?? s.customer_id ?? ""),
      external_rep_id: s.seller?.id ? String(s.seller.id) : null,
      order_date: s.emission ?? s.emitted_at ?? new Date().toISOString(),
      total_value: Number(s.total ?? s.total_value ?? 0),
      items_count: Array.isArray(s.products) ? s.products.length : null,
      status: s.status ?? null,
      extra: { number: s.number },
    }));
    return {
      rows: dtos,
      next_cursor: dtos.length === limit ? { page: page + 1 } : null,
      has_more: dtos.length === limit,
    };
  },
};
