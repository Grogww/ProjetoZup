# 4. Perfis e Permissões

## 4.1 Perfis (papéis)

O papel é o enum `user_role` na coluna `users.role`. O cadastro cria sempre `citizen`; a troca de
papel é feita por admin via `PATCH /users/:id/role`.

| Papel | Descrição |
|-------|-----------|
| **`citizen`** (Cidadão) | Padrão no cadastro. Registra ocorrências, anexa mídias, vota, edita/exclui as próprias ocorrências (dentro da janela), acompanha status e dashboards públicos. |
| **`agent`** (Agente público) | Existe no enum. **Atuará** na triagem e no andamento operacional das ocorrências. 📌 Ver observação abaixo. |
| **`admin`** (Administrador) | Acesso total: gerencia categorias/subcategorias, usuários e papéis, e acessa analytics restritos de órgãos. É também "super-editor" de qualquer ocorrência. |

> 📌 **O papel `agent` ainda não tem permissões próprias no código.** Nenhuma rota usa
> `requireRole('agent')`, então hoje um `agent` tem as mesmas permissões de um `citizen`. Esse papel
> **será desenvolvido** à medida que o módulo principal — voltado à comunidade e ao registro público
> das ocorrências — evoluir; é nessa frente que entram a triagem e a transição dos estados
> operacionais (R-03).

> 📌 **Não há papel "Validador".** O modelo original previa um Validador (cidadão elegível que
> confirma ocorrências do seu bairro, com elegibilidade por adjacência). O projeto **abandonou esse
> caminho** em favor de **validação por relevância via votação** (RN-16): não haverá papel
> Validador; a promoção da ocorrência decorrerá da taxa de upvotes/downvotes. A tabela
> `neighborhood_adjacency` permanece reservada no schema, sem uso.

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
| Excluir ocorrência (autor: janela 24 h) | `DELETE /occurrences/:id` | ✗ | 👤 | 👤 | ✓ |
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

**Notas sobre a matriz:**

- ✅ **`DELETE /occurrences/:id`** já é restrito: apenas o **autor** (dentro da janela de 24 h) ou um
  **admin** podem excluir; terceiros recebem **403**. Alinhado com a edição.
- ✅ **`POST /occurrences`** não aceita mais `status` no corpo — toda ocorrência nasce `pending`. O
  campo `assigned_organization_id` **continua aceito de propósito**: ainda não existe um fluxo que
  defina/troque o órgão responsável, então a atribuição na criação é a única forma disponível hoje
  (R-04 prevê o fluxo dedicado).
- ⚠️ **`PATCH /occurrences/:id/status`** ainda exige apenas `auth` — **qualquer autenticado** dispara
  **qualquer** transição. A segregação dos estados operacionais para órgão/admin acompanhará o
  desenvolvimento do papel `agent` → roadmap **R-03**.

### Matriz-alvo (modelo de negócio, roadmap)

Para referência, a matriz **pretendida** segregaria os estados operacionais, com a validação
decidida por **votação da comunidade** (relevância), não por um papel dedicado:

| Ação | Cidadão | Órgão (`agent`) | Admin |
|------|:------:|:---------------:|:-----:|
| Registrar ocorrência | ✓ | ✓ | ✓ |
| Votar (alimenta a validação por relevância) | ✓ | ✓ | ✓ |
| Validar existência | *por votação (RN-16)* | ✗ | ✓ |
| Alterar status operacional | ✗ | ✓ | ✓ |
| Validar/rejeitar resolução | ✓¹ | ✗ | ✓ |
| Excluir ocorrência | 👤 | ✗ | ✓ |
| Acessar dashboards de gestão | ✗ | ✓ | ✓ |
| Gerenciar usuários/categorias | ✗ | ✗ | ✓ |

> ¹ A validação da resolução tende a combinar o **autor** e a **relevância da comunidade**; a regra
> exata será definida junto com RN-16.

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

## 4.4 Validação por relevância (votação)

> 📌 **Roadmap.** A validação de uma ocorrência não dependerá de um papel "Validador" nem de
> elegibilidade por bairro/adjacência, e sim da **relevância apurada por votação** (RN-16): ao
> ultrapassar uma **taxa aceitável** de upvotes/downvotes, a ocorrência é promovida a `validated`.
> A votação já funciona (RN-11); falta implementar a regra que liga relevância → validação →
> priorização. Os parâmetros (taxa de aprovação, fórmula da fila de prioridade) ainda serão
> definidos (ver R-01, R-02).
