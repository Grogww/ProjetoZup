# 2. Requisitos Funcionais e Não Funcionais

Identificadores: `RF-xx` (funcionais), `RNF-xx` (não funcionais). A coluna **Implementado**
indica a aderência ao código atual: ✅ implementado · 🟡 parcial · ⛔ roadmap (não implementado).

## 2.1 Requisitos Funcionais (RF)

| ID | Requisito | Ator | Critério de aceitação | Endpoint / módulo | Impl. |
|----|-----------|------|-----------------------|-------------------|:-----:|
| RF-01 | Cadastro de usuário | Visitante | Dados válidos (CPF com DV, e-mail único) criam um usuário `citizen`; senha em bcrypt | `POST /auth/register` · `authService.register` | ✅ |
| RF-02 | Login por CPF + senha | Cidadão | Credenciais válidas retornam access + refresh token; inválidas → 401 genérico | `POST /auth/login` · `authService.login` | ✅ |
| RF-03 | Renovação de sessão | Cidadão | `refresh_token` válido e não revogado emite nova sessão | `POST /auth/refresh` | ✅ |
| RF-04 | Recuperação de senha | Cidadão | Solicitação gera token de uso único por e-mail; resposta genérica; rate-limited | `POST /auth/forgot-password`, `POST /auth/reset-password` | ✅ |
| RF-05 | Ver/editar o próprio perfil | Cidadão | `GET/PATCH /users/me` retornam/atualizam perfil sem expor dados sensíveis | `usersController.me/updateMe` | ✅ |
| RF-06 | Registrar ocorrência georreferenciada | Cidadão | Título/descrição/lat/lng/categoria válidos criam ocorrência `pending` | `POST /occurrences` | ✅ |
| RF-07 | Geofencing (bairro pelo ponto) | Sistema | Sem `neighborhood_id`, deriva o bairro por point-in-polygon (`null` se fora) | `occurrencesService.createOccurrence`, `GET /neighborhoods/locate` | 🟡 |
| RF-08 | Visualizar ocorrências próximas no registro | Cidadão | `GET /occurrences/nearby?lat&lng&radius` retorna ocorrências por distância | `occurrencesController.nearby` | ✅ |
| RF-09 | Prevenção de duplicidade | Sistema | Mesma categoria + 500 m + não-finalizada → 409 com `duplicate_id` | `occurrencesService.createOccurrence` | ✅ |
| RF-10 | Anexar mídias à ocorrência | Cidadão (autor) | Upload `multipart` campo `media`, allowlist/limite; nomes gerados pelo servidor | `POST /occurrences/:id/media` | ✅ |
| RF-11 | Editar ocorrência dentro da janela | Autor/Admin | Edição só por autor/admin e dentro de 24 h; senão 403 | `PATCH /occurrences/:id` | ✅ |
| RF-12 | Transição de status | Autenticado | Transições validadas pela máquina de estados; inválida → 409 | `PATCH /occurrences/:id/status` | 🟡 |
| RF-13 | Acompanhar histórico de status | Qualquer | `GET /occurrences/:id/status-history` lista a trilha | `occurrencesController.listStatusHistory` | ✅ |
| RF-14 | Votar em ocorrência | Cidadão | up/down único por usuário; recálculo transacional; voto em `closed` → 409 | `POST /occurrences/:id/upvote`/`downvote`, `DELETE …/vote` | ✅ |
| RF-15 | Listar/filtrar ocorrências | Qualquer | Filtros: status, categoria, subcategoria, bairro, autor, órgão, `limit`/`offset` | `GET /occurrences` | ✅ |
| RF-16 | Detalhar ocorrência | Qualquer (auth opcional) | Inclui `media`; se autenticado, `voted_user` | `GET /occurrences/:id` | ✅ |
| RF-17 | Reabrir/registrar recorrência | Cidadão | Reabre `resolved`/`closed` criando nova ocorrência encadeada; `reason` obrigatório | `POST /occurrences/:id/reopen` | ✅ |
| RF-18 | Consultar recorrência de um problema | Qualquer | `GET /occurrences/:id/reopens` lista a cadeia pela raiz | `occurrencesController.listReopens` | ✅ |
| RF-19 | Visualização por bairro ("Minha Cidade") | Qualquer | `GET /neighborhoods/:id/occurrences` e fronteira/centro em GeoJSON | `neighborhoodsController` | ✅ |
| RF-20 | Gerir categorias/subcategorias | Admin | CRUD com slug, ícone, cor, ativação; remoção em uso → 409 | `/categories`, `/subcategories` | ✅ |
| RF-21 | Listar órgãos | Qualquer | `GET /organizations` lista órgãos responsáveis | `organizationsController.list` | ✅ |
| RF-22 | Gerir usuários e papéis | Admin | Listar/detalhar usuários e alterar `role` | `GET /users`, `GET /users/:id`, `PATCH /users/:id/role` | ✅ |
| RF-23 | Dashboard — KPIs globais | Qualquer | Totais, grupos de status, taxa de resolução, tempos médios, recorrência, top categorias | `GET /analytics/overview` | ✅ |
| RF-24 | Dashboard — por bairro | Qualquer | Pendências/indicadores por bairro (com per capita) | `GET /analytics/by-neighborhood` | ✅ |
| RF-25 | Mapa de calor | Qualquer | Pontos `[{lat,lng,weight}]` por bbox/status/categoria com `limit` | `GET /analytics/heatmap` | ✅ |
| RF-26 | Tempo de resposta/resolução | Qualquer | Média e mediana, com `group_by` (categoria/bairro/mês) e `sample_size` | `GET /analytics/response-time` | ✅ |
| RF-27 | Eficiência por órgão | Admin | Backlog, taxa de resolução, reincidência por órgão | `GET /analytics/by-organization` | ✅ |
| RF-28 | Healthcheck | Qualquer | `GET /health` → `{ status: "ok" }` | `healthRoutes` | ✅ |
| RF-29 | Validação por relevância (votação) | Sistema | Upvotes/downvotes apuram a relevância da ocorrência; ao ultrapassar uma taxa aceitável de apoio, ela é promovida a `validated` | `PATCH /occurrences/:id/status` (futuro) | ⛔ |
| RF-30 | Priorização por votação | Sistema | `score` (upvotes − downvotes) alimenta a fila/ordenação de prioridade das ocorrências validadas | ⚠️ — | ⛔ |
| RF-31 | Geofencing como bloqueio municipal | Sistema | Rejeitar ocorrência fora dos limites de Videira | ⚠️ — | ⛔ |
| RF-32 | Notificações | Cidadão | Notificar autor/seguidores em mudanças de status | ⚠️ — | ⛔ |
| RF-33 | Painel administrativo de gestão pública (UI) | Órgão/Admin | Tela de triagem e andamento | ⚠️ frontend (repo separado) | ⛔ |

### Histórias de usuário (amostra dos RF prioritários)

**RF-06 — Registrar ocorrência georreferenciada**
> *Como* cidadão, *quero* registrar um problema urbano com localização no mapa e foto, *para que*
> a administração tome conhecimento.
> **Critérios de aceitação:**
> - Dado título, descrição, latitude/longitude válidas e uma categoria existente, a ocorrência é
>   criada com status `pending` e devolve **201** com o recurso.
> - Se já houver ocorrência da **mesma categoria** aberta a ≤ 500 m, recebo **409** com o
>   `duplicate_id` e a distância.
> - Se eu não informar o bairro, o sistema o deriva da localização (ou deixa `null` se fora dos
>   bairros cadastrados).

**RF-12 — Transição de status**
> *Como* responsável pelo acompanhamento, *quero* avançar o status da ocorrência, *para que* o
> cidadão acompanhe a evolução.
> **Critérios de aceitação:**
> - Uma transição prevista pela máquina de estados atualiza o status, carimba `resolved_at`/
>   `closed_at` quando aplicável e registra o histórico.
> - Uma transição não prevista retorna **409** com `{ from, to, allowed }`.
> - *Roadmap:* nesta etapa qualquer autenticado pode transicionar; a restrição dos estados
>   operacionais ao papel `agent`/`admin` será aplicada junto à evolução do módulo do agente.

**RF-17 — Reabrir / registrar recorrência**
> *Como* cidadão, *quero* reabrir um problema que voltou a ocorrer, *para que* fique registrado
> que é reincidência e não um caso novo isolado.
> **Critérios de aceitação:**
> - Só ocorrências `resolved`/`closed` podem ser reabertas; senão **409**.
> - A reabertura cria uma **nova** ocorrência `pending` encadeada (`parent`/`root`/`reopen_count`),
>   exige `reason` e grava auditoria em `occurrence_reopens`.
> - Reabrir uma ocorrência que já foi reaberta retorna **409** apontando a última da cadeia.

---

## 2.2 Requisitos Não Funcionais (RNF)

| ID | Categoria | Requisito | Como é atendido |
|----|-----------|-----------|-----------------|
| RNF-01 | Desempenho | Consultas geoespaciais eficientes | `ST_DWithin`/`ST_Contains` sobre `geometry` SRID 4326; conversão para `::geography` só para distância real. ✅ Índices **GiST confirmados** no DDL: `idx_occurrences_location`, `idx_neighborhoods_boundary`, `idx_neighborhoods_center` (+ btree em status/category/neighborhood/created_at). |
| RNF-02 | Desempenho | Pool de conexões ao banco | `pg.Pool` em `config/database.js`; `SELECT NOW()` de verificação no boot. |
| RNF-03 | Desempenho | Limites de paginação e de volume | `GET /occurrences` `limit ≤ 200`; heatmap `limit ≤ 50000`; `nearby` raio ≤ 50 km. |
| RNF-04 | Segurança | Autenticação stateless | JWT (`access`/`refresh`) assinado com `JWT_SECRET`; access carrega `sub,name,email,role,type`. |
| RNF-05 | Segurança | Senhas protegidas | bcrypt (`BCRYPT_SALT_ROUNDS`, padrão 10); senha nunca retornada. |
| RNF-06 | Segurança | Proteção de endpoints sensíveis | `express-rate-limit` em `forgot-password`/`reset-password`; token de reset hasheado (SHA-256) e de uso único. |
| RNF-07 | Segurança | Anti-fraude / anti-duplicidade | CPF com DV validado (RN-01); duplicidade por raio (RN-04). |
| RNF-08 | Segurança | Upload seguro | Allowlist de mimetypes (sem SVG), limite de tamanho/quantidade, nomes gerados pelo servidor, servir somente leitura. |
| RNF-09 | Privacidade | Minimização de dados (LGPD) | `sanitize()` remove `password_hash/cpf/tokens`; analytics público só agregados. |
| RNF-10 | Integridade | Consistência geográfica | SRID 4326 (WGS84) uniforme e **tipado** (`geometry(Point,4326)`, `geometry(MultiPolygon,4326)`); geometria exposta como GeoJSON (`ST_AsGeoJSON`). Os bairros vieram do **IBGE** em **SIRGAS 2000** e foram **reprojetados para SRID 4326** com as funções do PostGIS na importação. |
| RNF-11 | Integridade | Transações atômicas | `BEGIN/COMMIT/ROLLBACK` em criação, transição de status, voto e reabertura; travas `FOR UPDATE`. |
| RNF-12 | Integridade | Fuso horário consistente | Sessão do banco em `America/Sao_Paulo`; cálculos de analytics ajustam o fuso. |
| RNF-13 | Usabilidade | Mensagens de erro padronizadas | JSON `{ error, details? }` com códigos HTTP consistentes (ver [Backend](./05-backend.md)). |
| RNF-14 | Portabilidade/custo | Ferramentas abertas e gratuitas | Node.js, PostgreSQL/PostGIS, OpenStreetMap (no frontend); sem dependência paga. |
| RNF-15 | Portabilidade | Containerização | Docker + Docker Compose (perfis dev/prod); restore automático do dump no primeiro boot. |
| RNF-16 | Manutenibilidade | Arquitetura em camadas | routes → controller → service → model; erros de domínio com `err.code` simbólico. |
| RNF-17 | Manutenibilidade | Documentação de API | OpenAPI 3.0 versionado (`openapi.json`). |
| RNF-18 | Configurabilidade | Parâmetros por ambiente | `.env`/`dotenv` para portas, JWT, SMTP, limites de upload, janela de edição, rate limit. |

> **Próximos passos de RNF (planejados, ainda não implementados):** testes automatizados,
> *migrations* versionadas (o schema hoje é distribuído como dump binário), pipeline de CI/CD e
> cache/TTL nos endpoints públicos de analytics. São recursos já priorizados para as próximas
> iterações — ver [Plano de Projeto → Roadmap](./03-plano-de-projeto.md).
