---
name: geo-intelligence
description: Geointeligência comercial — mapas, sales territory, route optimization, heatmaps, prospecting maps, location intelligence, CNAE mapping. Ler ao mexer em /geo, /geo-rota, /geo-prospeccao, /geo-cobertura, territórios.
---

# Geo Intelligence

Categoria liderada por **Badger Maps, Map My Customers, MapaLeads**. Missão: usar espaço geográfico como dimensão comercial estratégica.

## Casos de uso principais
1. **Rotas otimizadas** para reps de campo (menos deslocamento, mais visitas)
2. **Prospecção** por proximidade e potencial (CNAE, faturamento estimado)
3. **Cobertura territorial** (onde não estamos vendendo)
4. **Cidades silenciosas** (clientes sem atividade recente)
5. **Heatmap de receita/oportunidades** por região
6. **Alocação de territórios** (balanceamento entre reps)

## Dados obrigatórios
- `geo_locations` com lat/lng validados (não confiar em endereço texto)
- Enriquecimento por CEP → CNPJ → CNAE
- Vinculação com `companies` / `erp_customers` / `leads`

## Route Optimization
Algoritmo:
1. Ponto de partida do rep (casa/escritório)
2. Lista de visitas do dia (do CRM + sugestões IA)
3. Restrições: janela horária, prioridade, tempo por visita
4. TSP (Traveling Salesman) com heurística (nearest neighbor + 2-opt) ou API externa (Google Directions)
5. Reordenação por IA considerando: potencial (open_value), tempo sem contato (daysSilent), agrupamento por cidade (`optimizeRouteWithAI` já implementado)

## Prospecting Maps
- Buscar prospects por raio (`find_opportunities_in_radius` já existe)
- Filtrar por CNAE, porte, ausência de deal aberto
- Estimar potencial (ticket médio por segmento × probabilidade de fit)
- Sugerir sequência de abordagem (mais próximo × maior potencial)

## Cobertura territorial
- Grid por cidade/estado
- Métricas: nº clientes ativos, receita, penetração vs mercado (via CNAE base)
- Identificar "buracos" (regiões com prospects mas sem cobertura)

## Sales Territory
Alocação de contas/regiões a reps. Regras:
- Por geografia (CEP, cidade, estado)
- Por segmento (CNAE)
- Por porte
- Por owner explícito (named accounts)

Rebalancear periodicamente com relatório de fairness (contas/receita/potencial por rep).

## Heatmaps
- Receita por região (calor = receita)
- Oportunidades abertas por região
- Densidade de prospects
- Churn risk por região

Usar bins hexagonais ou grid; nunca marker cluster ilegível.

## CNAE Mapping
Base CNAE + IBGE permite:
- Estimar mercado por região (# empresas × faturamento médio por CNAE)
- Segmentar propostas
- Score de fit (ICP baseado em CNAE)

## Location Intelligence avançada
- **Isochronas** (área alcançável em X min de carro)
- **Sobreposição com dados externos** (renda média, densidade populacional)
- **Time-based** (rotas diferentes por dia da semana)

## Mobile (crítico para campo)
- GPS check-in na visita
- Offline-first (baixar rota do dia)
- Voz para notas pós-visita
- Deep link para Waze/Google Maps

## Antipatterns
- Mapa sem cluster/paginação com >1000 pontos (trava)
- Rota "otimizada" sem considerar janela horária do cliente
- Território fixo sem rebalancear (reps ficam sobrecarregados)
- Heatmap sem legenda ou com escala enganosa
