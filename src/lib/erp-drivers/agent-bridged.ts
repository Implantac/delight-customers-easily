/**
 * Adapter "agent-bridged" para bancos legados (MySQL, SQL Server, Firebird, Oracle).
 *
 * Realidade da plataforma: o runtime de servidor (Cloudflare Workers) NÃO suporta
 * drivers nativos TCP/ODBC desses bancos. A ponte oficial é o **ERP Connect Agent**
 * (binário desktop on-premise) que lê do ERP local e faz push direto nas tabelas-espelho
 * via `/api/public/hooks/erp-agent-push`.
 *
 * Estes adapters existem para:
 *  1. Registrar o driver na UI (`/integrations/connect`) com instruções claras
 *  2. Validar que a integração está saudável (último push recente)
 *  3. Falhar de forma explícita se alguém tentar pull direto no cloud
 */
import type { ErpDriver, ErpDriverConfig, ErpPullResult, ErpCustomerDTO, ErpSalesRepDTO, ErpSalesOrderDTO } from "./types";

type Flavor = "mysql" | "sqlserver" | "firebird" | "oracle";

const LABEL: Record<Flavor, string> = {
  mysql: "MySQL",
  sqlserver: "SQL Server",
  firebird: "Firebird",
  oracle: "Oracle",
};

function notSupported(flavor: Flavor): never {
  throw new Error(
    `Driver ${LABEL[flavor]} on-premise requer o ERP Connect Agent. ` +
    `Pulls diretos não são suportados no runtime de cloud. ` +
    `Instale o agente em uma máquina com acesso ao ERP e configure-o para fazer push em /api/public/hooks/erp-agent-push.`,
  );
}

function makeAgentDriver(flavor: Flavor): ErpDriver {
  return {
    id: `${flavor}-agent`,

    async testConnection(_cfg: ErpDriverConfig) {
      // O "teste" real é: existe ao menos um token ativo do agente para esta integração?
      // O Sync Engine valida isso no nível de health checks (último push < 24h).
      return {
        latency_ms: 0,
        note: `${LABEL[flavor]} via ERP Connect Agent. Saúde monitorada por timestamp do último push do agente.`,
      };
    },

    async pullCustomers(_cfg: ErpDriverConfig): Promise<ErpPullResult<ErpCustomerDTO>> {
      notSupported(flavor);
    },
    async pullSalesReps(_cfg: ErpDriverConfig): Promise<ErpPullResult<ErpSalesRepDTO>> {
      notSupported(flavor);
    },
    async pullSalesHistory(_cfg: ErpDriverConfig): Promise<ErpPullResult<ErpSalesOrderDTO>> {
      notSupported(flavor);
    },
  };
}

export const mysqlAgentDriver = makeAgentDriver("mysql");
export const sqlserverAgentDriver = makeAgentDriver("sqlserver");
export const firebirdAgentDriver = makeAgentDriver("firebird");
export const oracleAgentDriver = makeAgentDriver("oracle");
