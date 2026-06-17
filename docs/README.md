# Documentação — Projeto ZUP

**ZUP (Zeladoria Urbana Participativa)** é uma plataforma cívica para centralização de
reclamações e solicitações urbanas com geolocalização, contextualizada no município de
**Videira, Santa Catarina**. Esta pasta reúne a documentação de engenharia do projeto,
organizada conforme o guia de documentação da entrega.

> **Escopo deste repositório:** aqui mora **apenas o backend** (API REST Node.js + Express +
> PostgreSQL/PostGIS). O frontend (React + react-leaflet) vive em repositório separado — por
> isso a seção de frontend é majoritariamente especificação de intenção, marcada com
> `⚠️ A confirmar`.

## Como ler

A documentação foi escrita a partir da **leitura do código-fonte** deste repositório
(`src/controllers`, `src/services`, `src/models`, `src/routes`, `src/middlewares`, `src/utils`,
`openapi.json` e os scripts de `db/`). Sempre que o código **não** confirma uma regra prevista
no modelo de negócio, o ponto é sinalizado com `> ⚠️ A confirmar:` em vez de ser afirmado como
implementado.

Convenção de identificadores para rastreabilidade:

- `RN-xx` — Regra de Negócio
- `RF-xx` — Requisito Funcional
- `RNF-xx` — Requisito Não Funcional
- `ADR-xx` — Registro de Decisão de Arquitetura

## Índice

| # | Documento | Prioridade | Conteúdo |
|---|-----------|------------|----------|
| 1 | [Regras de Negócio](./01-regras-de-negocio.md) | **Prioritário** | `RN-xx`, máquina de estados, geofencing, anti-duplicidade, reabertura, janela de edição |
| 2 | [Requisitos Funcionais e Não Funcionais](./02-requisitos.md) | **Prioritário** | `RF-xx`, `RNF-xx`, rastreabilidade requisito → endpoint |
| 3 | [Plano de Projeto](./03-plano-de-projeto.md) | **Prioritário** | Escopo, cronograma (Gantt), marcos, estado atual, roadmap |
| 4 | [Perfis e Permissões](./04-perfis-e-permissoes.md) | **Prioritário** | Papéis, matriz de permissões, como a autorização é aplicada |
| 5 | [Documentação Técnica do Backend](./05-backend.md) | Importante | Camadas, API, autenticação, variáveis de ambiente, ADRs |
| 6 | [Documentação Técnica do Frontend](./06-frontend.md) | Importante | Telas, navegação, mapa, identidade visual (especificação) |
| 7 | [Modelo de Dados](./07-modelo-de-dados.md) | Importante | Diagrama ER, decisões geoespaciais, integridade referencial |
| 8 | [Diagramas](./08-diagramas.md) | Apoio | Casos de uso, ER, estados, sequência, arquitetura |

> **Como rodar o projeto:** ver o [`README.md`](../README.md) na raiz (pré-requisitos,
> variáveis de ambiente, seed do banco, Docker, Swagger/OpenAPI).

## Divergências conhecidas entre o modelo de negócio idealizado e o código atual

O modelo de negócio do ZUP prevê alguns recursos que **ainda não existem no código**. Eles
estão documentados como **roadmap** (ver [Plano de Projeto](./03-plano-de-projeto.md)) e
marcados com `⚠️ A confirmar` ao longo dos documentos. Resumo:

| Previsto no modelo de negócio | Situação no código |
|---|---|
| Papel **Validador** (cidadão elegível) | ❌ Não existe. Papéis reais: `citizen`, `agent`, `admin`. |
| **Validação comunitária** com elegibilidade por bairro / sorteio de validadores | ❌ Lógica não implementada. O estado `awaiting_validation → validated` existe, mas é uma transição livre. |
| Tabela **`neighborhood_adjacency`** | ✅ **Existe no schema** (PK composta + CHECK + FKs CASCADE), mas **nenhum código a usa** — modelagem pronta, lógica pendente. |
| **Votação para priorização** de demandas | ⚠️ Há upvote/downvote (`evaluations`) e `score`, mas o score não alimenta nenhuma fila de priorização automática. |
| **Geofencing como bloqueio** ao território de Videira | ⚠️ O geofencing existe, mas só **deriva o bairro** do ponto; não **bloqueia** ocorrências fora do município. |
| Papel `agent` com permissões operacionais | ⚠️ O papel existe no enum, mas **nenhuma rota** exige `agent`; ele se comporta como `citizen`. |
