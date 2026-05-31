/**
 * Registry de drivers do Connect Universal.
 * Resolve um `ErpDriver` a partir de `erp_integrations.provider` e
 * `erp_integrations.connector_type`.
 *
 * Drivers nativos (cloud runtime): Bling (REST), Postgres direto.
 * Drivers via agente desktop: MySQL, SQL Server, Firebird, Oracle.
 *   (runtime serverless não suporta drivers TCP/ODBC nativos)
 */
import type { ErpDriver } from "./types";
import { blingDriver } from "./bling-driver";
import { postgresDirectDriver } from "./postgres-direct";
import {
  mysqlAgentDriver,
  sqlserverAgentDriver,
  firebirdAgentDriver,
  oracleAgentDriver,
} from "./agent-bridged";

export type DriverKey =
  | "bling"
  | "postgres-direct"
  | "mysql-agent"
  | "sqlserver-agent"
  | "firebird-agent"
  | "oracle-agent"
  // placeholders REST a implementar
  | "omie"
  | "tiny";

const REGISTRY: Partial<Record<DriverKey, ErpDriver>> = {
  bling: blingDriver,
  "postgres-direct": postgresDirectDriver,
  "mysql-agent": mysqlAgentDriver,
  "sqlserver-agent": sqlserverAgentDriver,
  "firebird-agent": firebirdAgentDriver,
  "oracle-agent": oracleAgentDriver,
};

export function resolveDriverKey(provider: string, connectorType: string | null): DriverKey {
  if (provider === "bling") return "bling";
  if (provider === "omie") return "omie";
  if (provider === "tiny") return "tiny";
  // provider="custom" + connector_type → seleciona o adapter certo
  if (connectorType === "postgres") return "postgres-direct";
  if (connectorType === "mysql") return "mysql-agent";
  if (connectorType === "sqlserver") return "sqlserver-agent";
  if (connectorType === "firebird") return "firebird-agent";
  if (connectorType === "oracle") return "oracle-agent";
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

/** Metadados para UI: como cada driver opera. */
export const DRIVER_CAPABILITIES: Record<DriverKey, { mode: "cloud" | "agent" | "todo"; label: string; note: string }> = {
  "bling":            { mode: "cloud", label: "Bling (REST)",           note: "Pull direto do cloud via API REST." },
  "postgres-direct":  { mode: "cloud", label: "Postgres direto",        note: "Conexão TCP direta. Apenas leitura." },
  "mysql-agent":      { mode: "agent", label: "MySQL (via Agent)",      note: "Requer ERP Connect Agent instalado on-premise." },
  "sqlserver-agent":  { mode: "agent", label: "SQL Server (via Agent)", note: "Requer ERP Connect Agent instalado on-premise." },
  "firebird-agent":   { mode: "agent", label: "Firebird (via Agent)",   note: "Requer ERP Connect Agent instalado on-premise." },
  "oracle-agent":     { mode: "agent", label: "Oracle (via Agent)",     note: "Requer ERP Connect Agent instalado on-premise." },
  "omie":             { mode: "todo",  label: "Omie (REST)",            note: "Adapter REST em backlog." },
  "tiny":             { mode: "todo",  label: "Tiny (REST)",            note: "Adapter REST em backlog." },
};

export type { ErpDriver } from "./types";
