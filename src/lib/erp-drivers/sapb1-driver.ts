/**
 * Driver: SAP Business One — Service Layer (OData v4).
 *
 *   cfg.app_key    → base URL do Service Layer (ex.: https://sapb1.cliente.com:50000/b1s/v1)
 *   cfg.app_secret → cookies B1SESSION (string "B1SESSION=...; ROUTEID=...")
 *                    obtidos previamente via POST /Login (fora deste driver).
 *
 * Apenas leitura comercial: BusinessPartners (CardType='cCustomer'),
 * SalesPersons, Orders. Nada de estoque, financeiro, fiscal.
 */
import type {
  ErpCustomerDTO, ErpCustomerPushInput, ErpDriver, ErpDriverConfig,
  ErpPullResult, ErpPushResult, ErpSalesOrderDTO, ErpSalesRepDTO,
} from "./types";

async function slWrite(cfg: ErpDriverConfig, path: string, method: "POST" | "PATCH", payload: unknown) {
  if (!cfg.app_key || !cfg.app_secret) {
    throw new Error("SAP B1 requer app_key (Service Layer URL) e app_secret (cookies de sessão).");
  }
  const base = cfg.app_key.replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Cookie: cfg.app_secret,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body: any; try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) throw new Error(body?.error?.message?.value || body?.error?.message || `SAP B1 HTTP ${res.status}`);
  return body;
}

async function slGet(cfg: ErpDriverConfig, path: string) {
  if (!cfg.app_key || !cfg.app_secret) {
    throw new Error("SAP B1 requer app_key (Service Layer URL) e app_secret (cookies de sessão).");
  }
  const base = cfg.app_key.replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, {
    headers: {
      Cookie: cfg.app_secret,
      Accept: "application/json",
      Prefer: "odata.maxpagesize=100",
    },
  });
  const text = await res.text();
  let body: any; try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) throw new Error(body?.error?.message?.value || body?.error?.message || `SAP B1 HTTP ${res.status}`);
  return body;
}

export const sapb1Driver: ErpDriver = {
  id: "sapb1",

  async testConnection(cfg) {
    const t0 = Date.now();
    await slGet(cfg, "/BusinessPartners?$top=1&$select=CardCode&$filter=CardType eq 'cCustomer'");
    return { latency_ms: Date.now() - t0 };
  },

  async pullCustomers(cfg, cursor, limit) {
    const skip = Number((cursor?.skip as number) ?? 0);
    const top = Math.min(limit, 100);
    const j = await slGet(
      cfg,
      `/BusinessPartners?$filter=CardType eq 'cCustomer'&$top=${top}&$skip=${skip}` +
      `&$select=CardCode,CardName,CardForeignName,FederalTaxID,EmailAddress,Phone1,` +
      `MailAddress,MailCity,MailState,MailZipCode,Valid,CreditLine`,
    );
    const list: any[] = j?.value ?? [];
    const dtos: ErpCustomerDTO[] = list.map((c: any) => ({
      external_id: String(c.CardCode ?? ""),
      legal_name: c.CardForeignName ?? c.CardName ?? null,
      trade_name: c.CardName ?? null,
      document: c.FederalTaxID ?? null,
      email: c.EmailAddress ?? null,
      phone: c.Phone1 ?? null,
      address: c.MailAddress ?? null,
      city: c.MailCity ?? null,
      state: c.MailState ?? null,
      zip: c.MailZipCode ?? null,
      segment: null,
      is_active: c.Valid !== "tNO",
      last_purchase_at: null,
      credit_limit: c.CreditLine != null ? Number(c.CreditLine) : null,
      credit_status: c.Valid === "tNO" ? "blocked" : "ok",
      extra: {},
    }));
    const hasMore = list.length === top;
    return {
      rows: dtos,
      next_cursor: hasMore ? { skip: skip + top } : null,
      has_more: hasMore,
    };
  },

  async pullSalesReps(cfg, cursor, limit) {
    const skip = Number((cursor?.skip as number) ?? 0);
    const top = Math.min(limit, 100);
    const j = await slGet(cfg, `/SalesPersons?$top=${top}&$skip=${skip}&$select=SalesEmployeeCode,SalesEmployeeName,Email,Active`);
    const list: any[] = j?.value ?? [];
    const dtos: ErpSalesRepDTO[] = list.map((v: any) => ({
      external_id: String(v.SalesEmployeeCode ?? ""),
      name: v.SalesEmployeeName ?? `Vendedor ${v.SalesEmployeeCode}`,
      email: v.Email ?? null,
      phone: null,
      region: null,
      is_active: v.Active !== "tNO",
      extra: {},
    }));
    const hasMore = list.length === top;
    return {
      rows: dtos,
      next_cursor: hasMore ? { skip: skip + top } : null,
      has_more: hasMore,
    };
  },

  async pullSalesHistory(cfg, cursor, limit, sinceIso) {
    const skip = Number((cursor?.skip as number) ?? 0);
    const top = Math.min(limit, 100);
    const filters: string[] = [];
    if (sinceIso) filters.push(`DocDate ge ${sinceIso.slice(0, 10)}`);
    const filter = filters.length ? `&$filter=${encodeURIComponent(filters.join(" and "))}` : "";
    const j = await slGet(
      cfg,
      `/Orders?$top=${top}&$skip=${skip}${filter}` +
      `&$select=DocEntry,DocNum,CardCode,SalesPersonCode,DocDate,DocTotal,DocumentStatus`,
    );
    const list: any[] = j?.value ?? [];
    const dtos: ErpSalesOrderDTO[] = list.map((p: any) => ({
      external_id: String(p.DocEntry ?? ""),
      external_customer_id: String(p.CardCode ?? ""),
      external_rep_id: p.SalesPersonCode != null ? String(p.SalesPersonCode) : null,
      order_date: p.DocDate ? new Date(p.DocDate).toISOString() : new Date().toISOString(),
      total_value: Number(p.DocTotal ?? 0),
      items_count: null,
      status: p.DocumentStatus ?? null,
      extra: { docNum: p.DocNum },
    }));
    const hasMore = list.length === top;
    return {
      rows: dtos,
      next_cursor: hasMore ? { skip: skip + top } : null,
      has_more: hasMore,
    };
  },
};
