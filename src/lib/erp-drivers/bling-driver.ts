/**
 * Driver: Bling v3 (REST).
 * Implementa a interface ErpDriver consumindo a API pública do Bling.
 * Apenas leitura comercial — sem estoque, sem fiscal, sem compras.
 */
import type {
  ErpCustomerDTO, ErpCustomerPushInput, ErpDriver, ErpDriverConfig, ErpPullResult,
  ErpPushResult, ErpSalesOrderDTO, ErpSalesRepDTO,
} from "./types";

const BASE = "https://www.bling.com.br/Api/v3";

async function call(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: any; try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) throw new Error(body?.error?.description || `Bling HTTP ${res.status}`);
  return body;
}

export const blingDriver: ErpDriver = {
  id: "bling",

  async testConnection(cfg) {
    const t0 = Date.now();
    await call(cfg.app_key, "/contatos?limite=1");
    return { latency_ms: Date.now() - t0 };
  },

  async pullCustomers(cfg, cursor, limit): Promise<ErpPullResult<ErpCustomerDTO>> {
    const page = (cursor?.page as number) ?? 1;
    const j = await call(cfg.app_key, `/contatos?pagina=${page}&limite=${Math.min(limit, 100)}`);
    const rows: ErpCustomerDTO[] = (j?.data ?? []).map((c: any) => ({
      external_id: String(c.id),
      legal_name: c.nome ?? null,
      trade_name: c.fantasia ?? c.nome ?? null,
      document: c.numeroDocumento ?? null,
      email: c.email ?? null,
      phone: c.telefone ?? c.celular ?? null,
      address: c.endereco?.geral?.endereco ?? null,
      city: c.endereco?.geral?.municipio ?? null,
      state: c.endereco?.geral?.uf ?? null,
      zip: c.endereco?.geral?.cep ?? null,
      segment: null,
      is_active: c.situacao !== "I",
      last_purchase_at: null,
      credit_limit: null,
      credit_status: null,
      extra: {},
    }));
    const hasMore = rows.length === Math.min(limit, 100);
    return { rows, next_cursor: hasMore ? { page: page + 1 } : null, has_more: hasMore };
  },

  async pullSalesReps(cfg, cursor, limit): Promise<ErpPullResult<ErpSalesRepDTO>> {
    const page = (cursor?.page as number) ?? 1;
    const j = await call(cfg.app_key, `/vendedores?pagina=${page}&limite=${Math.min(limit, 100)}`);
    const rows: ErpSalesRepDTO[] = (j?.data ?? []).map((v: any) => ({
      external_id: String(v.id),
      name: v.contato?.nome ?? v.nome ?? "—",
      email: v.contato?.email ?? null,
      phone: v.contato?.telefone ?? null,
      region: null,
      is_active: true,
      extra: {},
    }));
    const hasMore = rows.length === Math.min(limit, 100);
    return { rows, next_cursor: hasMore ? { page: page + 1 } : null, has_more: hasMore };
  },

  async pullSalesHistory(cfg, cursor, limit, sinceIso): Promise<ErpPullResult<ErpSalesOrderDTO>> {
    const page = (cursor?.page as number) ?? 1;
    const since = sinceIso ? new Date(sinceIso).toISOString().slice(0, 10) : undefined;
    const params = new URLSearchParams({ pagina: String(page), limite: String(Math.min(limit, 100)) });
    if (since) params.set("dataInicial", since);
    const j = await call(cfg.app_key, `/pedidos/vendas?${params}`);
    const rows: ErpSalesOrderDTO[] = (j?.data ?? []).map((p: any) => ({
      external_id: String(p.id),
      external_customer_id: String(p.contato?.id ?? ""),
      external_rep_id: p.vendedor?.id ? String(p.vendedor.id) : null,
      order_date: p.data ?? new Date().toISOString(),
      total_value: Number(p.total ?? 0),
      items_count: null,
      status: p.situacao?.valor ?? null,
      extra: {},
    }));
    const hasMore = rows.length === Math.min(limit, 100);
    return { rows, next_cursor: hasMore ? { page: page + 1 } : null, has_more: hasMore };
  },

  async pushCustomer(cfg, input): Promise<ErpPushResult> {
    const payload: Record<string, unknown> = {
      nome: input.legal_name ?? input.trade_name ?? "Cliente CRM",
      fantasia: input.trade_name ?? undefined,
      numeroDocumento: input.document ?? undefined,
      email: input.email ?? undefined,
      telefone: input.phone ?? undefined,
      situacao: "A",
    };
    if (input.external_id) {
      const j = await call(cfg.app_key, `/contatos/${input.external_id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      return { external_id: String(j?.data?.id ?? input.external_id), note: "updated" };
    }
    const j = await call(cfg.app_key, `/contatos`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const id = j?.data?.id;
    if (!id) throw new Error("Bling não retornou data.id");
    return { external_id: String(id), note: "created" };
  },
};
