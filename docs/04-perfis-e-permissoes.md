# 4. Perfis e Permissões

## 4.1 Perfis (papéis)

O papel é o enum `user_role` na coluna `users.role`. O cadastro cria sempre `citizen`; a troca de
papel é feita por admin via `PATCH /users/:id/role`.

| Papel | Descrição |
|-------|-----------|
| **`citizen`** (Cidadão) | Padrão no cadastro. Registra ocorrências, anexa mídias, vota, edita/exclui as próprias ocorrências (dentro da janela), acompanha status e dashboards públicos. |
| **`agent`** (Agente público) | Existe no enum. **Pretende** atuar na triagem e no andamento operacional das ocorrências. ⚠️ Ver observação abaixo. |
| **`admin`** (Administrador) | Acesso total: gerencia categorias/subcategorias, usuários e papéis, e acessa analytics restritos de órgãos. É também "super-editor" de qualquer ocorrência. |

> ⚠️ **A confirmar — o papel `agent` não tem permissões próprias no código.** Nenhuma rota usa
> `requireRole('agent')`. Na prática, um `agent` tem exatamente as mesmas permissões que um
> `citizen`. A diferenciação operacional do agente é **roadmap** (R-03).

> ⚠️ **A confirmar — papel "Validador".** O modelo de negócio prevê um papel de **Validador**
> (cidadão elegível que confirma ocorrências do seu bairro). **Ele não existe** no enum `user_role`
> nem na lógica de autorização. Note que a **modelagem de adjacência de bairros já existe** no
> banco (tabela `neighborhood_adjacency`), então a base de dados para a elegibilidade por
> vizinhança está pronta — falta o papel e a lógica. É roadmap (R-01) e depende do critério de
> elegibilidade (RN-17).

## 4.2 Matriz de permissões (estado atual do código)

Legenda: ✓ permitido · ✗ negado · 👤 só o **autor** do recurso · 🌐 público (sem autenticação).
A coluna reflete **exatamente** o que os middlewares (`auth`, `requireRole`) e os controllers
aplicam hoje.

| Ação | Endpoint | Público | Cidadão | Agente | Admin |
|------|----------|:-------:|:-------:|:------:|:-----:|
| Healthcheck | `GET /health` | 🌐 | ✓ | ✓ | ✓ |
| Cadastrar-se / login / refresh | `POST /auth/*` | 🌐 | ✓ | ✓ | ✓ |
| Recuperar senha | `POST /auth/forgot|reset-password` | 🌐 | ✓ | ✓ | ✓ |
| Ver/editar próprio perfil | `GET|PATCH /users/me` | ✗ | ✓ | ✓ | ✓ |
| Listar/detalhar usuários | `GET /users`, `GET /users/:id` | ✗ | ✗ | ✗ | ✓ |
| Alterar papel de usuário | `PATCH /users/:id/role` | ✗ | ✗ | ✗ | ✓ |
| Listar/detalhar ocorrências | `GET /occurrences`, `/:id`, `/nearby` | 🌐 | ✓ | ✓ | ✓ |
| Registrar ocorrência | `POST /occurrences` | ✗ | ✓ | ✓ | ✓ |
| Editar ocorrência (janela 24 h) | `PATCH /occurrences/:id` | ✗ | 👤 | 👤 | ✓ |
| **Excluir ocorrência** | `DELETE /occurrences/:id` | ✗ | ✓ ⚠️ | ✓ ⚠️ | ✓ |
| **Transição de status** | `PATCH /occurrences/:id/status` | ✗ | ✓ ⚠️ | ✓ ⚠️ | ✓ ⚠️ |
| Anexar/remover mídia | `POST|DELETE /occurrences/:id/media` | ✗ | 👤 | 👤 | ✓ |
| Reabrir ocorrência | `POST /occurrences/:id/reopen` | ✗ | ✓ | ✓ | ✓ |
| Ver histórico de status / reaberturas | `GET …/status-history`, `…/reopens` | 🌐 | ✓ | ✓ | ✓ |
| Votar / remover voto | `POST …/upvote|downvote`, `DELETE …/vote` | ✗ | ✓ | ✓ | ✓ |
| Listar votos da ocorrência | `GET /occurrences/:id/evaluations` | ✗ | ✓ | ✓ | ✓ |
| Listar bairros / geofencing | `GET /neighborhoods*` | 🌐 | ✓ | ✓ | ✓ |
| Listar/detalhar categorias/subcategorias | `GET /categories*`, `/subcategories*` | 🌐 | ✓ | ✓ | ✓ |
| Criar/editar/excluir categorias/subcategorias | `POST|PATCH|DELETE /categories*`, `/subcategories*` | ✗ | ✗ | ✗ | ✓ |
| Listar órgãos | `GET /organizations` | 🌐 | ✓ | ✓ | ✓ |
| Analytics públicos | `GET /analytics/overview|by-neighborhood|heatmap|response-time` | 🌐 | ✓ | ✓ | ✓ |
| Analytics por órgão | `GET /analytics/by-organization` | ✗ | ✗ | ✗ | ✓ |

**⚠️ Pontos sinalizados na matriz (divergências/gaps de autorização):**

- **`DELETE /occurrences/:id`** exige apenas `auth` e **não** checa autor nem papel — qualquer
  usuário autenticado pode excluir **qualquer** ocorrência. Inconsistente com a edição (que é
  restrita a autor/admin). → roadmap **R-04**.
- **`PATCH /occurrences/:id/status`** exige apenas `auth` — **qualquer autenticado** dispara
  **qualquer** transição, inclusive os estados operacionais que deveriam ser do órgão/admin. →
  roadmap **R-03**.
- **`POST /occurrences`** aceita `status` e `assigned_organization_id` no corpo de qualquer
  autenticado (um cidadão poderia criar uma ocorrência já "resolvida" ou atribuída a um órgão). →
  roadmap **R-05**.

### Matriz-alvo (modelo de negócio, roadmap)

Para referência, a matriz **pretendida** segregaria os estados operacionais e a validação:

| Ação | Cidadão | Validador | Órgão (`agent`) | Admin |
|------|:------:|:---------:|:---------------:|:-----:|
| Registrar ocorrência | ✓ | ✓ | ✓ | ✓ |
| Validar existência (comunidade) | ✗ | ✓ | ✗ | ✓ |
| Alterar status operacional | ✗ | ✗ | ✓ | ✓ |
| Validar/rejeitar resolução | ✓¹ | ✓ | ✗ | ✓ |
| Excluir ocorrência | 👤 | 👤 | ✗ | ✓ |
| Acessar dashboards de gestão | ✗ | ✗ | ✓ | ✓ |
| Gerenciar usuários/categorias | ✗ | ✗ | ✗ | ✓ |

> ¹ ⚠️ A confirmar: se a validação da resolução cabe ao autor, à comunidade elegível, ou a ambos.

## 4.3 Como a autorização é aplicada

A autorização é feita por **middlewares de rota** (Express), na ordem em que são encadeados:

1. **`auth`** (`src/middlewares/auth.js`) — exige um JWT **válido do tipo `access`** no header
   `Authorization: Bearer <token>`. Decodifica e injeta `req.user = { id, name, email, role }`.
   Sem token / token inválido / expirado → **401**.
   - Atalho de desenvolvimento: se `USE_MOCK_AUTH=true`, `auth` delega para
     `mockAuth`, que injeta um **usuário admin fake** sem exigir token. **Nunca usar em produção.**
2. **`optionalAuth`** (`src/middlewares/optionalAuth.js`) — popula `req.user` **se** houver token,
   mas **não bloqueia** rotas públicas. Usado em `GET /occurrences/:id` para informar `voted_user`.
3. **`requireRole(...papéis)`** (`src/middlewares/requireRole.js`) — exige `req.user` e que
   `req.user.role` esteja na lista; senão **403 `Forbidden`** (ou **401** se não autenticado).
   No código atual, é usado **apenas com `'admin'`**.
4. **Autorização de recurso (ownership)** — feita no **service**, não em middleware: por exemplo
   `occurrencesService.assertCanEdit` permite editar somente se `author_id === user.id` **ou**
   `role === 'admin'`.

## 4.4 Critério de elegibilidade (promoção a Validador)

> ⚠️ **A confirmar / roadmap.** Não há, no código, nenhum critério que promova um cidadão a
> "Validador" nem que selecione validadores elegíveis. O modelo de negócio prevê elegibilidade
> por **bairro** e **adjacência** — e a tabela **`neighborhood_adjacency` já existe** no schema
> (PK `(neighborhood_id, neighbor_id)`, sem uso por código ainda) — com um **quórum** de
> confirmações a definir. Falta a lógica de aplicação (ver RN-17, R-01, R-02).
