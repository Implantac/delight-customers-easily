# ERP Local Agent — Contrato HTTP

Documento técnico para construção do binário desktop (Tauri/Electron) que
roda na rede interna do cliente e conecta o ERP on-premise (Firebird, SQL
Server, Oracle, MySQL, Postgres) ao CRM via Lovable Cloud.

> Este projeto (CRM) **NÃO contém** o código do binário. Apenas expõe a API
> pública que o agente consome. O binário é um projeto separado.

---

## Base URL

- Produção: `https://project--06d45a46-46ff-4225-9d53-858f03173986.lovable.app`
- Preview:  `https://project--06d45a46-46ff-4225-9d53-858f03173986-dev.lovable.app`

Todos os endpoints abaixo vivem sob `/api/public/hooks/`.

---

## 1. Pareamento

O usuário gera um `pairing_code` em `/integrations/agent` (UI do CRM) e
informa esse código no instalador desktop. O agente troca o código por um
`agent_token` de longa duração.

**POST** `/api/public/hooks/erp-local-agent-pair`

```json
// Request body
{
  "pairing_code": "ABC123XYZ...",
  "os": "Windows 11 23H2",
  "version": "0.1.0"
}
```

```json
// 200 OK
{
  "agent_id": "uuid",
  "organization_id": "uuid",
  "agent_token": "<token longo — guardar em local seguro>"
}
```

Erros:
- `400` corpo inválido
- `401` `pairing_code` inexistente
- `403` agente revogado
- `409` `pairing_code` já usado (status = `online`)

**Importante:** O `agent_token` é retornado **apenas uma vez**. Persistir
no keystore do SO (Windows Credential Manager, macOS Keychain, libsecret).

---

## 2. Heartbeat

A cada 60s o agente envia heartbeat. Atualiza `last_seen_at`, `version`, `os`.

**POST** `/api/public/hooks/erp-local-agent-heartbeat`

Headers:
```
Authorization: Bearer <agent_token>
Content-Type: application/json
```

```json
// Body (opcional)
{ "version": "0.2.1", "os": "Windows 11 23H2" }
```

```json
// 200 OK
{ "ok": true, "agent_id": "uuid", "organization_id": "uuid" }
```

Erros: `401` token inválido, `403` revogado.

---

## 3. Push de dados do ERP

O agente lê dados do ERP local (queries SQL) e empurra em lotes.

**POST** `/api/public/hooks/erp-agent-push`

Headers:
```
Authorization: Bearer <agent_token>
Content-Type: application/json
```

```json
{
  "entity": "invoices",          // invoices | sales_orders | products | contacts
  "rows": [
    { "external_id": "NF-123", "total": 1500.00, "issued_at": "2026-06-01T10:00:00Z", "...": "..." }
  ]
}
```

```json
// 200 OK
{ "success": true, "inserted": 42 }
```

Regras:
- Máx. **1000 linhas** por chamada.
- `organization_id` é injetado pelo servidor (não enviar).
- Idempotência sugerida: usar `external_id` único por entidade.

---

## Recomendações para o binário

### Stack sugerida
- **Tauri** (Rust + WebView). Binário pequeno (~10 MB), seguro, multi-OS.
- Alternativa: Electron (mais pesado, mais familiar para devs JS).

### Conectores ERP
Implementar drivers para:
- Firebird (`node-firebird` se Electron, crate `rsfbclient` se Rust/Tauri)
- SQL Server (`tedious` / `tiberius`)
- MySQL/MariaDB (`mysql2` / `sqlx`)
- Oracle (`oracledb` / `oracle` crate)
- PostgreSQL (`pg` / `tokio-postgres`)

### Loop de sincronização
```
loop {
  send_heartbeat();
  for entity in [invoices, sales_orders, products, contacts] {
    let rows = query_erp(entity, since: last_sync[entity]);
    if rows.len() > 0 {
      for chunk in rows.chunks(500) {
        push(entity, chunk);
      }
      last_sync[entity] = now();
    }
  }
  sleep(60s);
}
```

### Segurança
- Token armazenado no keystore do SO, **nunca** em arquivo texto.
- TLS sempre (HTTPS).
- Logs locais não devem imprimir o token.
- Quando revogado pelo CRM, o agente recebe `403` e deve parar e alertar.

### UI mínima do instalador
1. Tela de pareamento (input do `pairing_code`).
2. Tela de seleção de ERP + string de conexão.
3. Tela de status (último heartbeat, última sync, erros).
4. Botão "Sincronizar agora".

---

## Endpoints relacionados (no CRM)

| Caminho                                      | Função                              |
|----------------------------------------------|--------------------------------------|
| `/integrations/agent`                        | UI: gerar/revogar pairing codes      |
| `/api/public/hooks/erp-local-agent-pair`     | Trocar pairing_code por agent_token  |
| `/api/public/hooks/erp-local-agent-heartbeat`| Heartbeat periódico                  |
| `/api/public/hooks/erp-agent-push`           | Push de dados do ERP                 |
| `/api/public/hooks/erp-inbound`              | Webhook ERPs com API REST nativa     |
| `/api/public/hooks/erp-outbox-tick`          | (interno) processa fila CRM→ERP      |

---

## Próximos passos

1. Criar repositório separado `lovable-erp-agent` (Tauri).
2. Implementar conectores Firebird + SQL Server (cobre 80% do mercado BR).
3. Distribuir via release no GitHub + link em `/integrations/agent`.
