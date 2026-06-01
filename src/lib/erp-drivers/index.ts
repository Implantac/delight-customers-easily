/**
 * Registry de drivers do Connect Universal.
 * Resolve um `ErpDriver` a partir de `erp_integrations.provider` e
 * `erp_integrations.connector_type`.
 */
import type { ErpDriver } from "./types";
import { blingDriver } from "./bling-driver";
import { omieDriver } from "./omie-driver";
import { tinyDriver } from "./tiny-driver";
import { sankhyaDriver } from "./sankhya-driver";
import { contaAzulDriver } from "./contaazul-driver";
import { protheusDriver } from "./protheus-driver";
import { sapb1Driver } from "./sapb1-driver";
import { seniorDriver } from "./senior-driver";
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
  | "omie"
  | "tiny"
  | "sankhya"
  | "contaazul"
  | "protheus"
  | "sapb1"
  | "senior";

const REGISTRY: Partial<Record<DriverKey, ErpDriver>> = {
  bling: blingDriver,
  omie: omieDriver,
  tiny: tinyDriver,
  sankhya: sankhyaDriver,
  contaazul: contaAzulDriver,
  protheus: protheusDriver,
  sapb1: sapb1Driver,
  senior: seniorDriver,
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
  if (provider === "sankhya") return "sankhya";
  if (provider === "contaazul") return "contaazul";
  if (provider === "protheus" || provider === "totvs-protheus") return "protheus";
  if (provider === "sapb1" || provider === "sap-b1") return "sapb1";
  if (provider === "senior") return "senior";
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

export const DRIVER_CAPABILITIES: Record<DriverKey, { mode: "cloud" | "agent" | "todo"; label: string; note: string }> = {
  "bling":            { mode: "cloud", label: "Bling (REST)",            note: "Pull direto do cloud via API REST." },
  "postgres-direct":  { mode: "cloud", label: "Postgres direto",         note: "Conexão TCP direta. Apenas leitura." },
  "mysql-agent":      { mode: "agent", label: "MySQL (via Agent)",       note: "Requer ERP Connect Agent instalado on-premise." },
  "sqlserver-agent":  { mode: "agent", label: "SQL Server (via Agent)",  note: "Requer ERP Connect Agent instalado on-premise." },
  "firebird-agent":   { mode: "agent", label: "Firebird (via Agent)",    note: "Requer ERP Connect Agent instalado on-premise." },
  "oracle-agent":     { mode: "agent", label: "Oracle (via Agent)",      note: "Requer ERP Connect Agent instalado on-premise." },
  "omie":             { mode: "cloud", label: "Omie (REST)",             note: "Pull via API REST (app_key + app_secret)." },
  "tiny":             { mode: "cloud", label: "Tiny (REST v3)",          note: "Pull via API REST OAuth2 (access_token)." },
  "sankhya":          { mode: "cloud", label: "Sankhya (Gateway)",       note: "REST via gateway /service.sbr (Bearer token)." },
  "contaazul":        { mode: "cloud", label: "Conta Azul (REST v1)",    note: "Pull via OAuth2 access_token." },
  "protheus":         { mode: "cloud", label: "TOTVS Protheus (REST)",   note: "REST publicado no Application Server (Bearer)." },
  "sapb1":            { mode: "cloud", label: "SAP Business One (SL)",   note: "Service Layer OData v4 com cookies de sessão." },
  "senior":           { mode: "cloud", label: "Senior X / Sapiens",      note: "Plataforma REST G7 (Bearer OAuth2)." },
};

export type { ErpDriver } from "./types";
