/**
 * Driver: Senior Sistemas (plataforma REST G7 / Senior X).
 *
 *   cfg.app_key    → base URL da plataforma (ex.: https://platform.senior.com.br)
 *   cfg.app_secret → access_token Bearer (OAuth2, gerado externamente).
 *
 * Apenas leitura comercial — clientes, vendedores, pedidos de venda.
 * Nada de estoque, fiscal, contábil, RH.
 */
import type {
  ErpCustomerDTO, ErpDriver, ErpDriverConfig, ErpPullResult,
  ErpSalesOrderDTO, ErpSalesRepDTO,
} from "./types";

async function sCall(cfg: ErpDriverConfig, path: string, body: Record<string, unknown>) {
  if (!cfg.app_key || !cfg.app_secret) {
    throw new Error("Senior requer app_key (base URL) e app_secret (access_token).");
  }
  const base = cfg.app_key.replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.app_secret}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: any; try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }
  if (!res.ok) throw new Error(parsed?.message || parsed?.error || `Senior HTTP ${res.status}`);
  return parsed;
}

export const seniorDriver: ErpDriver = {
  id: "senior",

  async testConnection(cfg) {
    const t0 = Date.now();
    await sCall(cfg, "/t/senior.com.br/bridge/1.0/rest/sapiens/queries/sapiens_Synccom_senior_g5_co_int_cli/queryClientes", {
      offset: 0, size: 1,
    }).catch(async () => {
      // fallback genérico: muitas instalações expõem em /platform/queries
      await sCall(cfg, "/t/senior.com.br/bridge/1.0/rest/platform/queries/findCustomers", { offset: 0, size: 1 });
    });
    return { latency_ms: Date.now() - t0 };
  },

  async pullCustomers(cfg, cursor, limit) {
    const offset = Number((cursor?.offset as number) ?? 0);
    const j = await sCall(
      cfg,
      "/t/senior.com.br/bridge/1.0/rest/sapiens/queries/findCustomers",
      { offset, size: limit },
    );
    const list: any[] = j?.contents ?? j?.items ?? j?.data ?? [];
    const dtos: ErpCustomerDTO[] = list.map((c: any) => ({
      external_id: String(c.codCli ?? c.codigo ?? c.id ?? ""),
      legal_name: c.razaoSocial ?? c.nomCli ?? null,
      trade_name: c.nomCli ?? c.fantasia ?? null,
      document: c.cgcCpf ?? c.document ?? null,
      email: c.email ?? null,
      phone: c.fone ?? c.telefone ?? null,
      address: c.endereco ?? null,
      city: c.cidade ?? null,
      state: c.estado ?? c.uf ?? null,
      zip: c.cep ?? null,
      segment: null,
      is_active: c.sitCli !== "I",
      last_purchase_at: null,
      credit_limit: c.limCred != null ? Number(c.limCred) : null,
      credit_status: c.sitCli === "B" ? "blocked" : "ok",
      extra: {},
    }));
    const hasMore = list.length === limit;
    return {
      rows: dtos,
      next_cursor: hasMore ? { offset: offset + limit } : null,
      has_more: hasMore,
    };
  },

  async pullSalesReps(cfg, cursor, limit) {
    const offset = Number((cursor?.offset as number) ?? 0);
    const j = await sCall(
      cfg,
      "/t/senior.com.br/bridge/1.0/rest/sapiens/queries/findSalespeople",
      { offset, size: limit },
    );
    const list: any[] = j?.contents ?? j?.items ?? [];
    const dtos: ErpSalesRepDTO[] = list.map((v: any) => ({
      external_id: String(v.codRep ?? v.codigo ?? v.id ?? ""),
      name: v.nomRep ?? v.nome ?? `Vendedor ${v.codRep}`,
      email: v.email ?? null,
      phone: v.fone ?? null,
      region: v.regiao ?? null,
      is_active: v.sitRep !== "I",
      extra: {},
    }));
    const hasMore = list.length === limit;
    return {
      rows: dtos,
      next_cursor: hasMore ? { offset: offset + limit } : null,
      has_more: hasMore,
    };
  },

  async pullSalesHistory(cfg, cursor, limit, sinceIso) {
    const offset = Number((cursor?.offset as number) ?? 0);
    const j = await sCall(
      cfg,
      "/t/senior.com.br/bridge/1.0/rest/sapiens/queries/findSalesOrders",
      {
        offset, size: limit,
        ...(sinceIso ? { dateFrom: sinceIso.slice(0, 10) } : {}),
      },
    );
    const list: any[] = j?.contents ?? j?.items ?? [];
    const dtos: ErpSalesOrderDTO[] = list.map((p: any) => ({
      external_id: String(p.numPed ?? p.id ?? ""),
      external_customer_id: String(p.codCli ?? ""),
      external_rep_id: p.codRep != null ? String(p.codRep) : null,
      order_date: p.dtEmissao ? new Date(p.dtEmissao).toISOString() : new Date().toISOString(),
      total_value: Number(p.vlrTotal ?? p.total ?? 0),
      items_count: p.qtdItens != null ? Number(p.qtdItens) : null,
      status: p.sitPed ?? null,
      extra: {},
    }));
    const hasMore = list.length === limit;
    return {
      rows: dtos,
      next_cursor: hasMore ? { offset: offset + limit } : null,
      has_more: hasMore,
    };
  },
};
