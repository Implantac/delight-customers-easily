/**
 * Driver: Omie (REST).
 * Implementa ErpDriver consumindo a API pública do Omie.
 *
 * Convenção Omie: todo endpoint é POST com body
 *   { call, app_key, app_secret, param: [ { ... } ] }
 *
 * Apenas leitura comercial — sem estoque, sem fiscal, sem compras.
 * cfg.app_key  → APP KEY do Omie
 * cfg.app_secret → APP SECRET do Omie
 */
import type {
  ErpCustomerDTO, ErpCustomerPushInput, ErpDriver, ErpDriverConfig, ErpPullResult,
  ErpPushResult, ErpSalesOrderDTO, ErpSalesRepDTO,
} from "./types";

const BASE = "https://app.omie.com.br/api/v1";

async function omieCall(cfg: ErpDriverConfig, path: string, call: string, param: Record<string, unknown>) {
  if (!cfg.app_key || !cfg.app_secret) {
    throw new Error("Omie requer app_key e app_secret.");
  }
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      call,
      app_key: cfg.app_key,
      app_secret: cfg.app_secret,
      param: [param],
    }),
  });
  const text = await res.text();
  let body: any; try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok || body?.faultstring) {
    throw new Error(body?.faultstring || `Omie HTTP ${res.status}`);
  }
  return body;
}

// dd/mm/yyyy → ISO
function brToIso(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
// ISO → dd/mm/yyyy
function isoToBr(s: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export const omieDriver: ErpDriver = {
  id: "omie",

  async testConnection(cfg) {
    const t0 = Date.now();
    await omieCall(cfg, "/geral/clientes/", "ListarClientes", {
      pagina: 1, registros_por_pagina: 1, apenas_importado_api: "N",
    });
    return { latency_ms: Date.now() - t0 };
  },

  async pullCustomers(cfg, cursor, limit): Promise<ErpPullResult<ErpCustomerDTO>> {
    const pagina = (cursor?.pagina as number) ?? 1;
    const registros = Math.min(limit, 50); // Omie cap
    const j = await omieCall(cfg, "/geral/clientes/", "ListarClientes", {
      pagina, registros_por_pagina: registros, apenas_importado_api: "N",
    });
    const list: any[] = j?.clientes_cadastro ?? [];
    const rows: ErpCustomerDTO[] = list.map((c) => ({
      external_id: String(c.codigo_cliente_omie),
      legal_name: c.razao_social ?? c.nome_fantasia ?? null,
      trade_name: c.nome_fantasia ?? c.razao_social ?? null,
      document: c.cnpj_cpf ?? null,
      email: c.email ?? null,
      phone: c.telefone1_numero
        ? `${c.telefone1_ddd ?? ""}${c.telefone1_numero}`
        : null,
      address: c.endereco ?? null,
      city: c.cidade ?? null,
      state: c.estado ?? null,
      zip: c.cep ?? null,
      segment: c.tags?.[0]?.tag ?? null,
      is_active: c.inativo !== "S",
      last_purchase_at: null, // só vem em sales_history
      credit_limit: c.valor_limite_credito != null ? Number(c.valor_limite_credito) : null,
      credit_status: c.bloqueado === "S" ? "blocked" : "ok",
      extra: {},
    }));
    const totalPaginas = Number(j?.total_de_paginas ?? pagina);
    const hasMore = pagina < totalPaginas;
    return {
      rows,
      next_cursor: hasMore ? { pagina: pagina + 1 } : null,
      has_more: hasMore,
    };
  },

  async pullSalesReps(cfg, cursor, limit): Promise<ErpPullResult<ErpSalesRepDTO>> {
    const pagina = (cursor?.pagina as number) ?? 1;
    const registros = Math.min(limit, 50);
    const j = await omieCall(cfg, "/geral/vendedores/", "ListarVendedores", {
      pagina, registros_por_pagina: registros, apenas_importado_api: "N",
    });
    const list: any[] = j?.cadastro ?? [];
    const rows: ErpSalesRepDTO[] = list.map((v) => ({
      external_id: String(v.codigo),
      name: v.nome ?? "—",
      email: v.email ?? null,
      phone: null,
      region: null,
      is_active: v.inativo !== "S",
      extra: {},
    }));
    const totalPaginas = Number(j?.total_de_paginas ?? pagina);
    const hasMore = pagina < totalPaginas;
    return {
      rows,
      next_cursor: hasMore ? { pagina: pagina + 1 } : null,
      has_more: hasMore,
    };
  },

  async pullSalesHistory(cfg, cursor, limit, sinceIso): Promise<ErpPullResult<ErpSalesOrderDTO>> {
    const pagina = (cursor?.pagina as number) ?? 1;
    const registros = Math.min(limit, 50);
    const param: Record<string, unknown> = {
      pagina, registros_por_pagina: registros, apenas_importado_api: "N",
    };
    const since = isoToBr(sinceIso);
    if (since) {
      param.filtrar_por_data_de = since;
    }
    const j = await omieCall(cfg, "/produtos/pedido/", "ListarPedidos", param);
    const list: any[] = j?.pedido_venda_produto ?? [];
    const rows: ErpSalesOrderDTO[] = list.map((p) => {
      const cab = p?.cabecalho ?? {};
      const tot = p?.total_pedido ?? {};
      const det: any[] = p?.det ?? [];
      const info = p?.informacoes_adicionais ?? {};
      return {
        external_id: String(cab.numero_pedido ?? cab.codigo_pedido ?? ""),
        external_customer_id: String(cab.codigo_cliente ?? ""),
        external_rep_id: info.codigo_vendedor != null ? String(info.codigo_vendedor) : null,
        order_date: brToIso(cab.data_previsao ?? cab.etapa) ?? new Date().toISOString().slice(0, 10),
        total_value: Number(tot.valor_total_pedido ?? 0),
        items_count: det.length || null,
        status: cab.etapa ?? null,
        extra: {},
      };
    });
    const totalPaginas = Number(j?.total_de_paginas ?? pagina);
    const hasMore = pagina < totalPaginas;
    return {
      rows,
      next_cursor: hasMore ? { pagina: pagina + 1 } : null,
      has_more: hasMore,
    };
  },

  async pushCustomer(cfg, input): Promise<ErpPushResult> {
    // Mapeia para payload Omie. Apenas campos comerciais — sem fiscal/estoque.
    const param: Record<string, unknown> = {
      razao_social: input.legal_name ?? input.trade_name ?? "Cliente CRM",
      nome_fantasia: input.trade_name ?? input.legal_name ?? null,
      cnpj_cpf: input.document ?? "",
      email: input.email ?? "",
    };
    if (input.phone) {
      const digits = input.phone.replace(/\D/g, "");
      param.telefone1_ddd = digits.slice(0, 2);
      param.telefone1_numero = digits.slice(2);
    }
    if (input.external_id) {
      param.codigo_cliente_omie = Number(input.external_id);
      const j = await omieCall(cfg, "/geral/clientes/", "AlterarCliente", param);
      return { external_id: String(j?.codigo_cliente_omie ?? input.external_id), note: "updated" };
    }
    // Sem external_id ainda → criação. Usa codigo_cliente_integracao = UUID temporário.
    param.codigo_cliente_integracao = `crm-${Date.now().toString(36)}`;
    const j = await omieCall(cfg, "/geral/clientes/", "IncluirCliente", param);
    const id = j?.codigo_cliente_omie;
    if (!id) throw new Error("Omie não retornou codigo_cliente_omie");
    return { external_id: String(id), note: "created" };
  },
};
