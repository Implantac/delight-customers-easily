/**
 * ERP Driver Abstraction — Connect Universal Layer.
 *
 * Cada conector de ERP implementa esta interface. O Sync Engine
 * (`erp-sync-engine.server.ts`) consome jobs de `erp_sync_jobs` e
 * delega para o driver correto via `getDriver()`.
 *
 * Regra absoluta: drivers só importam dados COMERCIAIS
 *   (clientes, representantes, histórico de vendas, métricas comerciais,
 *    limite e status financeiro de CONSULTA).
 *
 * Nunca: estoque, compras, fiscal, NFe, produção, RH, contabilidade.
 */

export type ErpResource =
  | "customers"
  | "sales_reps"
  | "sales_history"
  | "customer_credit_status";

export type ErpCustomerDTO = {
  external_id: string;
  legal_name: string | null;
  trade_name: string | null;
  document: string | null;          // CNPJ/CPF
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  segment: string | null;
  is_active: boolean;
  last_purchase_at: string | null;  // ISO
  credit_limit: number | null;
  credit_status: "ok" | "blocked" | "overdue" | null;
  extra: Record<string, unknown>;
};

export type ErpSalesRepDTO = {
  external_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  region: string | null;
  is_active: boolean;
  extra: Record<string, unknown>;
};

export type ErpSalesOrderDTO = {
  external_id: string;
  external_customer_id: string;
  external_rep_id: string | null;
  order_date: string;                // ISO
  total_value: number;
  items_count: number | null;
  status: string | null;
  extra: Record<string, unknown>;
};

export type ErpPullResult<T> = {
  rows: T[];
  next_cursor: Record<string, unknown> | null;
  /** Inclua somente quando o driver souber distinguir o restante; senão null. */
  has_more: boolean | null;
};

export type ErpDriverConfig = {
  /** `erp_integrations.app_key` — token, host ou DSN, conforme o driver. */
  app_key: string;
  /** `erp_integrations.app_secret` — senha ou refresh token, opcional. */
  app_secret: string | null;
  /** `erp_integrations.settings` — bag livre por driver. */
  settings: Record<string, unknown>;
};

export interface ErpDriver {
  /** Identificador estável do driver, ex.: "bling", "postgres-direct". */
  readonly id: string;

  /** Faz um ping/health check rápido. Lança em caso de falha. */
  testConnection(cfg: ErpDriverConfig): Promise<{ latency_ms: number; note?: string }>;

  /** Pull paginado de clientes. */
  pullCustomers(cfg: ErpDriverConfig, cursor: Record<string, unknown> | null, limit: number): Promise<ErpPullResult<ErpCustomerDTO>>;

  /** Pull paginado de representantes. */
  pullSalesReps(cfg: ErpDriverConfig, cursor: Record<string, unknown> | null, limit: number): Promise<ErpPullResult<ErpSalesRepDTO>>;

  /** Pull paginado de histórico comercial (pedidos). */
  pullSalesHistory(cfg: ErpDriverConfig, cursor: Record<string, unknown> | null, limit: number, sinceIso: string | null): Promise<ErpPullResult<ErpSalesOrderDTO>>;
}
