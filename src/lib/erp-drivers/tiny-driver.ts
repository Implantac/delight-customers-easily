/**
 * Driver: Tiny ERP v3 (REST + OAuth2).
 *
 * Tiny v3 usa OAuth2 com Bearer token. Aqui consumimos APENAS leitura
 * comercial: contatos (clientes), vendedores e pedidos. Sem estoque,
 * sem fiscal, sem compras.
 *
 * cfg.app_key    → access_token OAuth2 do Tiny v3
 * cfg.app_secret → refresh_token (opcional; refresh fica a cargo do
 *                  Sync Engine, fora deste driver)
 */
import type {
  ErpCustomerDTO, ErpCustomerPushInput, ErpDriver, ErpDriverConfig,
  ErpPullResult, ErpPushResult, ErpSalesOrderDTO, ErpSalesRepDTO,
} from "./types";

async function tinyWrite(cfg: ErpDriverConfig, method: "POST" | "PUT", path: string, body: unknown) {
  if (!cfg.app_key) throw new Error("Tiny requer access_token (app_key).");
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
  if (!res.ok) {
    const msg = parsed?.error?.message || parsed?.message || `Tiny HTTP ${res.status}`;
    throw new Error(msg);
  }
  return parsed;
}

const BASE = "https://api.tiny.com.br/public-api/v3";

async function tinyCall(cfg: ErpDriverConfig, path: string, params?: URLSearchParams) {
  if (!cfg.app_key) throw new Error("Tiny requer access_token (app_key).");
  const url = params ? `${BASE}${path}?${params}` : `${BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cfg.app_key}`,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  let body: any; try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || `Tiny HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

export const tinyDriver: ErpDriver = {
  id: "tiny",

  async testConnection(cfg) {
    const t0 = Date.now();
    await tinyCall(cfg, "/contatos", new URLSearchParams({ limit: "1" }));
    return { latency_ms: Date.now() - t0 };
  },

  async pullCustomers(cfg, cursor, limit): Promise<ErpPullResult<ErpCustomerDTO>> {
    const offset = (cursor?.offset as number) ?? 0;
    const lim = Math.min(limit, 100);
    const j = await tinyCall(cfg, "/contatos", new URLSearchParams({
      limit: String(lim),
      offset: String(offset),
      // Tiny filtra clientes via tipo=C
      tipoPessoa: "C",
    }));
    const list: any[] = j?.itens ?? j?.data ?? [];
    const rows: ErpCustomerDTO[] = list.map((c) => ({
      external_id: String(c.id),
      legal_name: c.nome ?? c.razaoSocial ?? null,
      trade_name: c.fantasia ?? c.nome ?? null,
      document: c.cpfCnpj ?? c.cnpj ?? c.cpf ?? null,
      email: c.email ?? null,
      phone: c.telefone ?? c.celular ?? null,
      address: c.endereco?.endereco ?? null,
      city: c.endereco?.municipio ?? c.endereco?.cidade ?? null,
      state: c.endereco?.uf ?? null,
      zip: c.endereco?.cep ?? null,
      segment: null,
      is_active: c.situacao !== "I" && c.ativo !== false,
      last_purchase_at: null,
      credit_limit: c.limiteCredito != null ? Number(c.limiteCredito) : null,
      credit_status: c.bloqueado === true ? "blocked" : "ok",
      extra: {},
    }));
    const hasMore = list.length === lim;
    return {
      rows,
      next_cursor: hasMore ? { offset: offset + lim } : null,
      has_more: hasMore,
    };
  },

  async pullSalesReps(cfg, cursor, limit): Promise<ErpPullResult<ErpSalesRepDTO>> {
    const offset = (cursor?.offset as number) ?? 0;
    const lim = Math.min(limit, 100);
    const j = await tinyCall(cfg, "/vendedores", new URLSearchParams({
      limit: String(lim),
      offset: String(offset),
    }));
    const list: any[] = j?.itens ?? j?.data ?? [];
    const rows: ErpSalesRepDTO[] = list.map((v) => ({
      external_id: String(v.id),
      name: v.nome ?? "—",
      email: v.email ?? null,
      phone: v.telefone ?? null,
      region: null,
      is_active: v.situacao !== "I" && v.ativo !== false,
      extra: {},
    }));
    const hasMore = list.length === lim;
    return {
      rows,
      next_cursor: hasMore ? { offset: offset + lim } : null,
      has_more: hasMore,
    };
  },

  async pullSalesHistory(cfg, cursor, limit, sinceIso): Promise<ErpPullResult<ErpSalesOrderDTO>> {
    const offset = (cursor?.offset as number) ?? 0;
    const lim = Math.min(limit, 100);
    const params = new URLSearchParams({
      limit: String(lim),
      offset: String(offset),
    });
    if (sinceIso) {
      // Tiny aceita ISO yyyy-mm-dd
      params.set("dataInicial", sinceIso.slice(0, 10));
    }
    const j = await tinyCall(cfg, "/pedidos", params);
    const list: any[] = j?.itens ?? j?.data ?? [];
    const rows: ErpSalesOrderDTO[] = list.map((p) => ({
      external_id: String(p.id ?? p.numero),
      external_customer_id: String(p.cliente?.id ?? ""),
      external_rep_id: p.vendedor?.id != null ? String(p.vendedor.id) : null,
      order_date: (p.data ?? p.dataEmissao ?? new Date().toISOString()).slice(0, 10),
      total_value: Number(p.valor ?? p.totalPedido ?? 0),
      items_count: Array.isArray(p.itens) ? p.itens.length : null,
      status: p.situacao ?? null,
      extra: {},
    }));
    const hasMore = list.length === lim;
    return {
      rows,
      next_cursor: hasMore ? { offset: offset + lim } : null,
      has_more: hasMore,
    };
  },

  async pushCustomer(cfg, input): Promise<ErpPushResult> {
    // Apenas dados comerciais — sem fiscal, sem financeiro.
    const payload = {
      nome: input.legal_name ?? input.trade_name ?? "Cliente CRM",
      fantasia: input.trade_name ?? undefined,
      cpfCnpj: input.document ?? undefined,
      email: input.email ?? undefined,
      telefone: input.phone ?? undefined,
      tipoPessoa: "C",
    };
    if (input.external_id) {
      await tinyWrite(cfg, "PUT", `/contatos/${encodeURIComponent(input.external_id)}`, payload);
      return { external_id: input.external_id, note: "Tiny: contato atualizado" };
    }
    const res = await tinyWrite(cfg, "POST", "/contatos", payload);
    const id = String(res?.id ?? res?.data?.id ?? "");
    if (!id) throw new Error("Tiny: resposta sem id");
    return { external_id: id, note: "Tiny: contato criado" };
  },
};
