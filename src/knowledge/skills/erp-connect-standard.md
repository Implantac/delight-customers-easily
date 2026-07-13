---
name: erp-connect-standard
description: Padrão do ConnectHub e integrações ERP no USE CRM. Use ao trabalhar em conectores, sincronização, mapeamento, drivers ERP ou fluxos de importação.
---

# ERP Connect — padrão

O **ConnectHub é módulo de integração, não operacional**. Missão: conectar, validar, sincronizar, mapear, monitorar.

## Conectores suportados
Cloud REST (Bling, Omie, Tiny, Sankhya, ContaAzul, Protheus, SAP B1, Senior) e bancos
(Postgres direto; MySQL/SQL Server/Firebird/Oracle via Agent local). Registry em
`src/lib/erp-drivers/index.ts` — estender lá, não criar paralelo.

## O que importar do ERP
Apenas dados **comerciais**:
- Clientes, representantes
- Histórico de vendas, última compra, frequência, ticket médio
- Limite e status financeiro comercial (somente leitura/consulta)

## O que NUNCA importar
Estoque, compras, fiscal (NFe/NCM/CFOP), produção, RH, contabilidade, plano de contas.
Se aparecer em requisito → recusar; pertence ao ERP.

## Sincronização
- Padrão: **ERP → CRM**.
- CRM → ERP: só quando explicitamente configurado, sempre com fila, auditoria, logs, resolução de conflitos (`erp_sync_conflicts`, `erp_outbox`).
- Wizard leigo-friendly: escolher provider → credenciais → validar → mapear campos → agendar.

## Dados importados alimentam apenas
Carteira Comercial, Customer 360, IA Comercial, Geointeligência, Relatórios Comerciais.
