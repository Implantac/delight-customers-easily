/**
 * Driver: PostgreSQL direto (Connect Universal).
 *
 * Conecta no banco do ERP do cliente (read-only) e materializa as
 * queries SOMENTE COMERCIAIS configuradas em `settings.queries`.
 *
 * settings esperado:
 * {
 *   "ssl": "require" | "prefer" | "disable",
 *   "queries": {
 *     "customers":      "SELECT id::text AS external_id, razao_social AS legal_name, ... FROM clientes WHERE updated_at > $1 ORDER BY updated_at LIMIT $2",
 *     "sales_reps":     "SELECT id::text AS external_id, nome AS name ... FROM representantes LIMIT $1",
 *     "sales_history":  "SELECT id::text AS external_id, cliente_id::text AS external_customer_id, ... FROM pedidos WHERE data >= $1 ORDER BY data LIMIT $2"
 *   }
 * }
 *
 * app_key = connection string (postgres://user:pass@host:5432/db)
 *
 * Regra: queries são fornecidas pelo admin; o driver apenas EXECUTA.
 * Bloqueamos statements perigosos com sanitização básica antes de rodar.
 */
import postgres from "postgres";
import type {
  ErpCustomerDTO, ErpDriver, ErpDriverConfig, ErpPullResult,
  ErpSalesOrderDTO, ErpSalesRepDTO,
} from "./types";

const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|COPY)\b/i;

function assertReadOnly(sql: string) {
  if (FORBIDDEN.test(sql)) {
    throw new Error("Query contém comando de escrita. O driver é somente leitura.");
  }
  if (!/^\s*(WITH|SELECT)\b/i.test(sql)) {
    throw new Error("Apenas SELECT/WITH são permitidos.");
  }
}

function client(cfg: ErpDriverConfig) {
  const dsn = cfg.app_key?.trim();
  if (!dsn) throw new Error("Conexão Postgres ausente (app_key).");
  const settings = cfg.settings ?? {};
  const ssl = (settings as { ssl?: string }).ssl ?? "require";
  return postgres(dsn, {
    ssl: ssl === "disable" ? false : ssl === "prefer" ? "prefer" : "require",
    max: 1,
    idle_timeout: 5,
    connect_timeout: 8,
    prepare: false,
  });
}

function getQuery(cfg: ErpDriverConfig, key: string): string {
  const q = ((cfg.settings as Record<string, unknown>)?.queries as Record<string, string> | undefined)?.[key];
  if (!q) throw new Error(`Query '${key}' não configurada em settings.queries.`);
  assertReadOnly(q);
  return q;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}
function iso(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export const postgresDirectDriver: ErpDriver = {
  id: "postgres-direct",

  async testConnection(cfg) {
    const sql = client(cfg);
    const t0 = Date.now();
    try {
      const r = await sql`SELECT 1 AS ok`;
      return { latency_ms: Date.now() - t0, note: `rows=${r.length}` };
    } finally {
      await sql.end({ timeout: 2 });
    }
  },

  async pullCustomers(cfg, cursor, limit): Promise<ErpPullResult<ErpCustomerDTO>> {
    const q = getQuery(cfg, "customers");
    const sinceIso = (cursor?.since as string) ?? "1970-01-01T00:00:00Z";
    const sql = client(cfg);
    try {
      const rows = await sql.unsafe(q, [sinceIso, limit]);
      const mapped: ErpCustomerDTO[] = rows.map((r) => ({
        external_id: String(r.external_id),
        legal_name: str(r.legal_name),
        trade_name: str(r.trade_name),
        document: str(r.document),
        email: str(r.email),
        phone: str(r.phone),
        address: str(r.address),
        city: str(r.city),
        state: str(r.state),
        zip: str(r.zip),
        segment: str(r.segment),
        is_active: r.is_active == null ? true : Boolean(r.is_active),
        last_purchase_at: iso(r.last_purchase_at),
        credit_limit: num(r.credit_limit),
        credit_status: (r.credit_status as ErpCustomerDTO["credit_status"]) ?? null,
        extra: {},
      }));
      const lastUpdated = rows.length ? iso(rows[rows.length - 1].updated_at) ?? sinceIso : sinceIso;
      return { rows: mapped, next_cursor: rows.length === limit ? { since: lastUpdated } : null, has_more: rows.length === limit };
    } finally {
      await sql.end({ timeout: 2 });
    }
  },

  async pullSalesReps(cfg, _cursor, limit): Promise<ErpPullResult<ErpSalesRepDTO>> {
    const q = getQuery(cfg, "sales_reps");
    const sql = client(cfg);
    try {
      const rows = await sql.unsafe(q, [limit]);
      return {
        rows: rows.map((r) => ({
          external_id: String(r.external_id),
          name: String(r.name ?? ""),
          email: str(r.email),
          phone: str(r.phone),
          region: str(r.region),
          is_active: r.is_active == null ? true : Boolean(r.is_active),
          extra: {},
        })),
        next_cursor: null,
        has_more: false,
      };
    } finally {
      await sql.end({ timeout: 2 });
    }
  },

  async pullSalesHistory(cfg, cursor, limit, sinceIso): Promise<ErpPullResult<ErpSalesOrderDTO>> {
    const q = getQuery(cfg, "sales_history");
    const since = sinceIso ?? (cursor?.since as string) ?? new Date(Date.now() - 365 * 86400_000).toISOString();
    const sql = client(cfg);
    try {
      const rows = await sql.unsafe(q, [since, limit]);
      const mapped: ErpSalesOrderDTO[] = rows.map((r) => ({
        external_id: String(r.external_id),
        external_customer_id: String(r.external_customer_id),
        external_rep_id: str(r.external_rep_id),
        order_date: iso(r.order_date) ?? since,
        total_value: num(r.total_value) ?? 0,
        items_count: num(r.items_count),
        status: str(r.status),
        extra: {},
      }));
      const lastDate = rows.length ? iso(rows[rows.length - 1].order_date) ?? since : since;
      return { rows: mapped, next_cursor: rows.length === limit ? { since: lastDate } : null, has_more: rows.length === limit };
    } finally {
      await sql.end({ timeout: 2 });
    }
  },
};
