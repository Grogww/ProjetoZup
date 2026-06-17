# Documentação — Projeto ZUP

**ZUP (Zeladoria Urbana Participativa)** é uma plataforma cívica para centralização de
reclamações e solicitações urbanas com geolocalização, contextualizada no município de
**Videira, Santa Catarina**. Esta pasta reúne a documentação de engenharia do projeto,
organizada conforme o guia de documentação da entrega.

> **Escopo deste repositório:** aqui mora **apenas o backend** (API REST Node.js + Express +
> PostgreSQL/PostGIS). O frontend (React + react-leaflet) vive em repositório separado, e a seção
> de frontend documenta a aplicação correspondente.

## Como ler

A documentação descreve o **comportamento real** do código deste repositório
(`src/controllers`, `src/services`, `src/models`, `src/routes`, `src/middlewares`, `src/utils`,
`openapi.json` e os scripts de `db/`). Recursos ainda **planejados** (não implementados nesta
etapa) aparecem marcados como *(Roadmap)* e são detalhados no
[Plano de Projeto](./03-plano-de-projeto.md).

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
| 6 | [Documentação Técnica do Frontend](./06-frontend.md) | Importante | Stack, rotas/telas, integração com a API, mapa e identidade visual (repo separado) |
| 7 | [Modelo de Dados](./07-modelo-de-dados.md) | Importante | Diagrama ER, decisões geoespaciais, integridade referencial |
| 8 | [Diagramas](./08-diagramas.md) | Apoio | Casos de uso, ER, estados, sequência, arquitetura |

> **Como rodar o projeto:** ver o [`README.md`](../README.md) na raiz (pré-requisitos,
> variáveis de ambiente, seed do banco, Docker, Swagger/OpenAPI).

## Funcionalidades planejadas (roadmap)

Alguns recursos do produto **ainda serão implementados**. Estão documentados como **roadmap**
(ver [Plano de Projeto](./03-plano-de-projeto.md)) e marcados como *(Roadmap)* ao longo dos
documentos. Resumo do que ainda não está no código:

| Recurso planejado | Situação atual |
|---|---|
| **Validação por relevância (votação)** | A votação (upvote/downvote → `score`) já funciona; falta a regra que promove a ocorrência ao ultrapassar uma taxa aceitável de apoio. Substitui o antigo papel "Validador" e a validação por adjacência de bairros. |
| **Priorização por votação** | O `score` é calculado e exibido, mas ainda não ordena uma fila de prioridade — as listagens ordenam por data. |
| **Geofencing como bloqueio** ao território de Videira | Hoje o geofencing só **deriva o bairro** do ponto (intencional, para testes/visualização); não **bloqueia** ocorrências fora do município. |
| Papel `agent` com permissões operacionais | O papel existe no enum, mas **nenhuma rota** exige `agent`; será desenvolvido junto ao módulo principal (comunidade/registro público), levando consigo a segregação das transições de status. |

> A tabela `neighborhood_adjacency` permanece no schema (modelagem da adjacência de bairros), mas
> ficou **reservada** — a validação passou a usar relevância por votação, não adjacência.
