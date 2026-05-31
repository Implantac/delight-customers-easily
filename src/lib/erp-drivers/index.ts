/**
 * Registry de drivers do Connect Universal.
 * Resolve um `ErpDriver` a partir de `erp_integrations.provider` e
 * `erp_integrations.connector_type`.
 */
import type { ErpDriver } from "./types";
import { blingDriver } from "./bling-driver";
import { postgresDirectDriver } from "./postgres-direct";

export type DriverKey =
  | "bling"
  | "postgres-direct"
  // placeholders — adapters a implementar nos próximos sprints
  | "omie"
  | "tiny"
  | "mysql-direct"
  | "sqlserver-direct"
  | "firebird-direct"
  | "oracle-direct";

const REGISTRY: Partial<Record<DriverKey, ErpDriver>> = {
  bling: blingDriver,
  "postgres-direct": postgresDirectDriver,
};

export function resolveDriverKey(provider: string, connectorType: string | null): DriverKey {
  if (provider === "bling") return "bling";
  if (provider === "omie") return "omie";
  if (provider === "tiny") return "tiny";
  // provider="custom" + connector_type=postgres|mysql|... → driver direto de DB
  if (connectorType === "postgres") return "postgres-direct";
  if (connectorType === "mysql") return "mysql-direct";
  if (connectorType === "sqlserver") return "sqlserver-direct";
  if (connectorType === "firebird") return "firebird-direct";
  if (connectorType === "oracle") return "oracle-direct";
  // fallback REST genérico
  return "bling";
}

export function getDriver(key: DriverKey): ErpDriver {
  const d = REGISTRY[key];
  if (!d) {
    throw new Error(`Driver '${key}' ainda não implementado. Implementado: ${Object.keys(REGISTRY).join(", ")}`);
  }
  return d;
}

export function listImplementedDrivers(): DriverKey[] {
  return Object.keys(REGISTRY) as DriverKey[];
}

export type { ErpDriver } from "./types";
