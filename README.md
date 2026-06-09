# ProjetoZup

API REST para **gestão de infraestrutura urbana** — uma plataforma de relato e acompanhamento de problemas urbanos (buracos, iluminação, lixo, etc.) no estilo "cidadão reporta, o poder público resolve". Os cidadãos registram ocorrências georreferenciadas, votam nas que consideram prioritárias e acompanham a evolução do status; órgãos públicos e administradores fazem a triagem, atualizam o andamento e analisam indicadores de eficiência.

Construída em **Node.js + Express 5** sobre **PostgreSQL + PostGIS**, com autenticação JWT, upload de mídias, geolocalização (geofencing e busca por proximidade), máquina de estados de status com histórico e um módulo completo de **analytics/transparência**.

---

## Índice

- [Principais funcionalidades](#principais-funcionalidades)
- [Stack e dependências](#stack-e-dependências)
- [Arquitetura](#arquitetura)
- [Modelo de dados](#modelo-de-dados)
- [Conceitos do domínio](#conceitos-do-domínio)
  - [Perfis de acesso (roles)](#perfis-de-acesso-roles)
  - [Máquina de estados das ocorrências](#máquina-de-estados-das-ocorrências)
  - [Anti-duplicidade e geofencing](#anti-duplicidade-e-geofencing)
  - [Reabertura e recorrência](#reabertura-e-recorrência)
  - [Janela de edição](#janela-de-edição)
- [Como rodar](#como-rodar)
  - [Com Docker (recomendado)](#com-docker-recomendado)
  - [Localmente (sem Docker)](#localmente-sem-docker)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados](#banco-de-dados)
- [Autenticação](#autenticação)
- [Upload de mídias](#upload-de-mídias)
- [Referência da API](#referência-da-api)
- [Formato de erros](#formato-de-erros)
- [Documentação OpenAPI](#documentação-openapi)
- [Licença](#licença)

---

## Principais funcionalidades

- **Cadastro e autenticação de usuários** com login por **CPF** (validado com dígitos verificadores), senha protegida com **bcrypt** e emissão de **JWT** (access + refresh token).
- **Recuperação de senha por e-mail** (SMTP/Nodemailer), com token de uso único, expiração configurável e **rate limiting** nos endpoints sensíveis.
- **Registro de ocorrências georreferenciadas** com título, descrição, localização (lat/lng), endereço, categoria/subcategoria, bairro e órgão responsável.
- **Geolocalização com PostGIS**:
  - **Geofencing**: descoberta automática do bairro a partir do ponto (point-in-polygon).
  - **Busca por proximidade** (`/nearby`) usando distância geográfica real.
  - **Anti-duplicidade**: bloqueia ocorrências semelhantes abertas num raio de 500 m.
- **Máquina de estados de status** com transições validadas e **histórico de auditoria** completo.
- **Reabertura de ocorrências** finalizadas, criando uma nova ocorrência encadeada e rastreando a **recorrência** de um mesmo problema.
- **Upload de mídias** (imagens) por ocorrência, com allowlist de mimetypes, limite de tamanho/quantidade e nomes de arquivo gerados pelo servidor.
- **Avaliações (votos)** de cidadãos: upvote/downvote por ocorrência, com contadores e score recalculados de forma transacional.
- **Categorias e subcategorias** com **slugs** (derivados ou informados), ícone, cor e flag de ativação.
- **Bairros** com fronteiras geográficas, ponto central, estimativa populacional e listagem de ocorrências.
- **Órgãos (organizations)** responsáveis por atender ocorrências.
- **Módulo de Analytics / Transparência**: indicadores globais, recorte por bairro, mapa de calor, tempo de resposta/resolução e eficiência por órgão.
- **Documentação OpenAPI 3.0** versionada (`openapi.json`).
- **Containerização** com Docker e Docker Compose (perfis de desenvolvimento e produção).

---

## Stack e dependências

| Camada            | Tecnologia                                   |
| ----------------- | -------------------------------------------- |
| Runtime           | Node.js 20                                   |
| Framework HTTP    | Express 5                                    |
| Módulos           | CommonJS                                     |
| Banco de dados    | PostgreSQL 17 + PostGIS 3.5                  |
| Driver do banco   | `pg` (pool de conexões)                      |
| Autenticação      | `jsonwebtoken` (JWT) + `bcrypt`              |
| Upload            | `multer`                                     |
| E-mail            | `nodemailer`                                 |
| Rate limiting     | `express-rate-limit`                         |
| CORS              | `cors`                                       |
| Configuração      | `dotenv`                                     |
| Dev               | `nodemon`                                    |
| Containerização   | Docker / Docker Compose                      |

---

## Arquitetura

A aplicação segue uma arquitetura em camadas bem definida: **routes → controller → service → model**.

```
ProjetoZup/
├── server.js                  # Entry point: carrega dotenv, sobe o HTTP server
├── openapi.json               # Especificação OpenAPI 3.0 da API
├── Dockerfile                 # Imagem de produção
├── Dockerfile.dev             # Imagem de desenvolvimento (nodemon)
├── docker-compose.yml         # db (PostGIS) + api
├── docker-compose.dev.yml     # Override de desenvolvimento (hot reload)
├── .env.example               # Modelo de variáveis de ambiente
├── db/
│   ├── _CreateExtensionPostGIS.sql  # Habilita a extensão PostGIS
│   ├── restore.sh                   # Restaura o backup no primeiro boot
│   └── init/zup_backup.backup       # Dump do schema/seed do banco
└── src/
    ├── app.js                 # Cria o app Express, registra middlewares e rotas
    ├── config/
    │   ├── database.js        # Pool de conexões pg
    │   └── storage.js         # Configuração de uploads (paths, limites, mimetypes)
    ├── middlewares/
    │   ├── auth.js            # Exige JWT válido
    │   ├── optionalAuth.js    # Popula req.user se houver token, sem exigir
    │   ├── mockAuth.js        # Usuário fake para desenvolvimento (USE_MOCK_AUTH)
    │   ├── requireRole.js     # Autorização por role
    │   ├── rateLimiters.js    # Limitadores de requisição
    │   └── upload.js          # Middleware multer para mídias de ocorrências
    ├── routes/                # Definição de rotas por recurso
    ├── controllers/           # Validação de entrada e tradução de erros → HTTP
    ├── services/              # Regras de negócio e transações
    ├── models/                # Acesso a dados (SQL)
    └── utils/                 # cpf, slugify, occurrenceEditWindow
```

**Fluxo de uma requisição:** o `router` mapeia o endpoint e aplica os middlewares (auth/role/upload/rate limit); o `controller` valida e normaliza a entrada e traduz erros de domínio em códigos HTTP; o `service` aplica as regras de negócio (transações, validações cruzadas, máquina de estados); o `model` executa o SQL contra o PostgreSQL/PostGIS.

Os erros de domínio são propagados com um `err.code` simbólico (ex.: `OCCURRENCE_DUPLICATE`, `INVALID_STATUS_TRANSITION`), que o controller mapeia para o status HTTP adequado.

---

## Modelo de dados

Principais entidades (o schema é restaurado a partir de `db/init/zup_backup.backup`):

- **users** — `id, name, email, cpf, password_hash, role, avatar_url, neighborhood_id, is_active, email_verified_at, reset_token, reset_token_expires_at, refresh_token, created_at, updated_at`. `role` é um enum `user_role` (`citizen | agent | admin`).
- **occurrences** — `id, title, description, location (geometry/PostGIS), address, category_id, subcategory_id, neighborhood_id, author_id, assigned_organization_id, status (enum occurrence_status), upvote_count, downvote_count, score, reopen_count, parent_occurrence_id, root_occurrence_id, resolved_at, closed_at, created_at, updated_at`.
- **occurrence_media** — `id, occurrence_id, storage_key, original_name, mime_type, size_bytes, uploaded_by, created_at`.
- **occurrence_status_history** — trilha de auditoria das mudanças de status (`old_status, new_status, changed_by, created_at`).
- **occurrence_reopens** — auditoria de reaberturas (`original_occurrence_id, new_occurrence_id, root_occurrence_id, reopened_by, reason, previous_status, reopen_sequence`).
- **evaluations** — votos dos usuários (`occurrence_id, user_id, vote_type` enum `up | down`), únicos por usuário/ocorrência.
- **categories** / **subcategories** — `name, slug, description, icon, color (categorias), is_active`. Subcategoria pertence a uma categoria.
- **neighborhoods** — `id, name, population_estimate, boundary (polígono PostGIS), center_point, created_at, updated_at`.
- **organizations** — `id, name, description, contact_email, contact_phone, is_active, created_at, updated_at`.

A localização das ocorrências e as fronteiras dos bairros usam geometria PostGIS em **SRID 4326** (WGS84). As respostas expõem geometria como **GeoJSON** (`ST_AsGeoJSON`).

---

## Conceitos do domínio

### Perfis de acesso (roles)

| Role      | Descrição                                                                 |
| --------- | ------------------------------------------------------------------------- |
| `citizen` | Cidadão (padrão no cadastro). Cria ocorrências, vota, edita as próprias.   |
| `agent`   | Agente público. Pode atuar na triagem/andamento das ocorrências.          |
| `admin`   | Administrador. Gerencia categorias, usuários, roles e vê analytics de órgãos. |

### Máquina de estados das ocorrências

As transições de status são validadas no servidor. `closed` é um estado terminal — a "reabertura" não muda o status, ela cria uma nova ocorrência encadeada (ver abaixo).

```
pending             → awaiting_validation, closed
awaiting_validation → validated, closed
validated           → in_analysis, closed
in_analysis         → in_progress, closed
in_progress         → resolved, closed
resolved            → resolution_validated, resolution_rejected
resolution_rejected → in_progress, closed
resolution_validated→ closed
closed              → (terminal)
```

Toda transição é gravada em `occurrence_status_history` na mesma transação. Ao entrar em `resolved`/`closed`, os campos `resolved_at`/`closed_at` são carimbados automaticamente. Uma tentativa de transição inválida retorna **409** com `details: { from, to, allowed }`.

### Anti-duplicidade e geofencing

- Ao criar uma ocorrência, o sistema busca ocorrências da **mesma categoria** num raio de **500 m** que **não estejam finalizadas**; se encontrar, rejeita com **409 `OCCURRENCE_DUPLICATE`** e devolve o `duplicate_id` e a distância.
- Se o `neighborhood_id` não for informado, ele é **derivado da localização** por point-in-polygon (`ST_Contains`) sobre as fronteiras dos bairros. Fica `null` se o ponto não cair em nenhum bairro cadastrado.
- `GET /occurrences/nearby` e `GET /neighborhoods/locate` usam a mesma base geográfica.

### Reabertura e recorrência

Quando um problema volta a ocorrer, uma ocorrência **resolvida ou fechada** pode ser reaberta via `POST /occurrences/:id/reopen`. Isso:

1. cria uma **nova ocorrência** (status `pending`) copiando os dados da original (com overrides opcionais de título/descrição/endereço/localização);
2. encadeia via `parent_occurrence_id` e mantém a `root_occurrence_id` (a raiz do problema recorrente) e um `reopen_count` crescente;
3. grava uma linha de auditoria em `occurrence_reopens` com o motivo (`reason`, obrigatório).

Apenas a **ponta da cadeia** pode ser reaberta (reaberturas concorrentes são serializadas com `FOR UPDATE`). O histórico de recorrência de um problema é consultável via `GET /occurrences/:id/reopens`.

### Janela de edição

Os campos de uma ocorrência (e suas mídias) só podem ser alterados pelo **autor ou por um admin** dentro de uma janela de **24 h** a partir da criação (configurável via `OCCURRENCE_EDIT_WINDOW_HOURS`). Após o prazo, a ocorrência fica "congelada" e qualquer edição retorna **403 `EDIT_WINDOW_EXPIRED`**.

---

## Como rodar

### Com Docker (recomendado)

Sobe o banco (PostGIS) e a API já conectados. O banco restaura automaticamente o dump de `db/init/` no primeiro boot.

1. Copie o modelo de variáveis e ajuste os valores:
   ```bash
   cp .env.example .env
   ```
2. Suba os serviços:
   ```bash
   # Produção
   npm run docker:prod          # docker compose up --build

   # Desenvolvimento (hot reload via nodemon + volume montado)
   npm run docker:dev           # docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
   ```
3. A API ficará disponível em `http://localhost:<PORT>` (padrão `3000`). Teste:
   ```
   GET http://localhost:3000/api/health  →  { "status": "ok" }
   ```

No Compose, o serviço `api` recebe automaticamente `DB_HOST=db` e `DB_PORT=5432`; os uploads são persistidos no volume `zup_uploads` e os dados do Postgres no volume `zup_pgdata`.

### Localmente (sem Docker)

Pré-requisitos: **Node.js 20+** e um **PostgreSQL com PostGIS** acessível.

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie o `.env` (veja a seção abaixo) apontando `DB_*` para o seu Postgres.
3. Garanta a extensão PostGIS e restaure o schema/seed (veja [Banco de dados](#banco-de-dados)).
4. Rode:
   ```bash
   npm run dev      # com nodemon (auto-restart)
   npm start        # produção
   ```

---

## Variáveis de ambiente

Configuradas via `.env` (carregado pelo `dotenv`). Veja `.env.example` para o modelo completo.

| Variável | Descrição | Padrão |
| --- | --- | --- |
| `PORT` | Porta HTTP da API | `3000` |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Conexão com o PostgreSQL | — |
| `JWT_SECRET` | Segredo para assinar os JWT (use uma string longa e aleatória) | — |
| `JWT_EXPIRES_IN` | Expiração do access token (formato `jsonwebtoken`: `1h`, `24h`, `7d`…) | `3h` (`24h` se ausente) |
| `JWT_REFRESH_EXPIRES_IN` | Expiração do refresh token | `7d` |
| `BCRYPT_SALT_ROUNDS` | Custo do bcrypt | `10` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | Servidor SMTP para envio de e-mails | `smtp.gmail.com` / `465` / `true` |
| `MAIL_FROM` | Remetente dos e-mails | `SMTP_USER` |
| `APP_NAME` | Nome usado nos e-mails | `ProjetoZup` |
| `FRONTEND_URL` / `FRONTEND_RESET_PATH` | Base e caminho do front para montar o link de reset de senha | `http://localhost:5173` / `/reset-password` |
| `RESET_TOKEN_BYTES` | Tamanho (bytes) do token de reset | `32` |
| `RESET_TOKEN_EXPIRES_MINUTES` | Validade do token de reset (min) | `30` |
| `RATE_LIMITERS_ENABLED` | Liga/desliga os limitadores | `true` |
| `RATE_LIMIT_FORGOT_PASSWORD_WINDOW_MS` / `_MAX` | Janela/limite para `forgot-password` | `900000` / `5` |
| `RATE_LIMIT_RESET_PASSWORD_WINDOW_MS` / `_MAX` | Janela/limite para `reset-password` | `900000` / `10` |
| `UPLOAD_DIR` | Pasta raiz dos uploads (fora de `src/`, em volume no Docker) | `uploads` |
| `PUBLIC_BASE_URL` | Base pública para montar a URL das mídias (vazio = URL relativa) | _vazio_ |
| `MAX_UPLOAD_MB` | Tamanho máximo por arquivo (MB) | `10` |
| `MAX_UPLOAD_FILES` | Máximo de arquivos por requisição | `5` |
| `ALLOWED_MIME_TYPES` | Mimetypes permitidos (CSV) | `image/jpeg,image/png,image/webp,image/gif` |
| `OCCURRENCE_EDIT_WINDOW_HOURS` | Janela de edição da ocorrência (horas) | `24` |
| `USE_MOCK_AUTH` | Se `true`, injeta um usuário admin fake (apenas dev) | _não definido_ |
| `SA_PASSWORD` | Senha de SA do banco (uso opcional de infra) | — |

> **Segurança:** SVG fica de fora da allowlist de mídias de propósito (risco de XSS ao ser servido). `USE_MOCK_AUTH=true` **nunca** deve ser usado em produção.

---

## Banco de dados

O projeto usa **PostgreSQL 17 + PostGIS 3.5**.

- **Via Docker:** nada manual é necessário. No primeiro boot, o container do banco executa `db/_CreateExtensionPostGIS.sql` (habilita PostGIS) e depois `db/restore.sh`, que faz `pg_restore` do dump em `db/init/zup_backup.backup`.
- **Sem Docker:** habilite a extensão e restaure o backup:
  ```sql
  CREATE EXTENSION IF NOT EXISTS postgis;
  ```
  ```bash
  pg_restore --username "$DB_USER" --dbname "$DB_NAME" --no-owner --no-privileges --verbose db/init/zup_backup.backup
  ```

O fuso horário esperado pela sessão do banco é **`America/Sao_Paulo`** (Brasília), relevante para os cálculos de tempo do módulo de analytics.

A conexão usa um **pool** (`pg.Pool`) e, ao iniciar, a aplicação faz um `SELECT NOW()` de teste, logando "Conectado ao PostgreSQL" em caso de sucesso.

---

## Autenticação

- O cadastro (`/auth/register`) cria um usuário `citizen` com senha protegida por **bcrypt**.
- O login (`/auth/login`) é feito por **CPF + senha** e retorna:
  ```json
  {
    "user": { "id": 1, "name": "...", "email": "...", "role": "citizen", "...": "..." },
    "access_token": "<JWT>",
    "refresh_token": "<JWT>",
    "token_type": "Bearer",
    "expires_in": "3h"
  }
  ```
- Envie o access token nas rotas protegidas via header:
  ```
  Authorization: Bearer <access_token>
  ```
- O **access token** carrega `sub, name, email, role, type: "access"`. O **refresh token** (`type: "refresh"`) é persistido no usuário e pode ser trocado por uma nova sessão em `/auth/refresh`; ele é **revogado** ao resetar a senha.
- Dados sensíveis (`password_hash`, `cpf`, tokens) **nunca** são retornados nas respostas.

Middlewares:
- `auth` — exige token válido (401 caso contrário).
- `optionalAuth` — popula `req.user` se houver token, sem bloquear rotas públicas (usado em `GET /occurrences/:id` para informar `voted_user`).
- `requireRole('admin')` — autorização por role.

---

## Upload de mídias

- Endpoint: `POST /api/occurrences/:id/media` (autenticado), `multipart/form-data` com o campo **`media`** (até `MAX_UPLOAD_FILES` arquivos).
- Os arquivos são validados por mimetype (allowlist), têm tamanho máximo por arquivo e recebem **nome aleatório gerado pelo servidor** (a extensão é derivada do mimetype; o nome original nunca entra no caminho de disco).
- Os bytes ficam em `UPLOAD_DIR/occurrences/` e são servidos **somente leitura** em `GET /uploads/...`.
- Ao excluir uma ocorrência, as linhas de mídia caem em CASCADE e os arquivos correspondentes são removidos do disco.
- Erros comuns: **413** (arquivo acima do limite), **415** (mimetype não suportado), **400** (campo inesperado / sem arquivos).

---

## Referência da API

Base: todas as rotas abaixo são prefixadas por **`/api`** (exceto o servir estático `/uploads`). Legenda de acesso: 🟢 público · 🔵 autenticado · 🟠 admin · ⚪ auth opcional.

### Health

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/health` | 🟢 | Healthcheck (`{ "status": "ok" }`) |

### Autenticação

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| POST | `/auth/register` | 🟢 | Cadastra usuário (`name, email, cpf, password`, `neighborhood_id?`) |
| POST | `/auth/login` | 🟢 | Login por `cpf` + `password` → sessão com tokens |
| POST | `/auth/refresh` | 🟢 | Troca `refresh_token` por nova sessão |
| POST | `/auth/forgot-password` | 🟢 ⏱️ | Solicita e-mail de reset (resposta genérica; rate-limited) |
| POST | `/auth/reset-password` | 🟢 ⏱️ | Redefine a senha com `token` + nova `password` (rate-limited) |

### Usuários

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/users/me` | 🔵 | Perfil do usuário autenticado |
| PATCH | `/users/me` | 🔵 | Atualiza o próprio perfil (`name, email, password, avatar_url, neighborhood_id`) |
| GET | `/users` | 🟠 | Lista usuários |
| GET | `/users/:id` | 🟠 | Detalha um usuário |
| PATCH | `/users/:id/role` | 🟠 | Altera a role (`citizen | agent | admin`) |

### Ocorrências

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/occurrences` | 🟢 | Lista com filtros: `status, category_id, subcategory_id, neighborhood_id, author_id, assigned_organization_id, limit (≤200), offset` |
| GET | `/occurrences/nearby` | 🟢 | Busca por proximidade: `lat`, `lng`, `radius` (m, ≤50000; padrão 500) |
| GET | `/occurrences/:id` | ⚪ | Detalha a ocorrência (inclui `media` e, se autenticado, `voted_user`) |
| POST | `/occurrences` | 🔵 | Cria ocorrência (anti-duplicidade + geofencing) |
| PATCH | `/occurrences/:id` | 🔵 | Edita campos (autor/admin, dentro da janela de 24 h) |
| PATCH | `/occurrences/:id/status` | 🔵 | Transição de status (validada pela máquina de estados) |
| DELETE | `/occurrences/:id` | 🔵 | Remove a ocorrência (e suas mídias) |
| GET | `/occurrences/:id/media` | 🟢 | Lista mídias |
| POST | `/occurrences/:id/media` | 🔵 | Envia mídias (`multipart`, campo `media`) |
| DELETE | `/occurrences/:id/media/:mediaId` | 🔵 | Remove uma mídia |
| GET | `/occurrences/:id/reopens` | 🟢 | Histórico de recorrência (cadeia de reaberturas) |
| POST | `/occurrences/:id/reopen` | 🔵 | Reabre (cria nova ocorrência encadeada; `reason` obrigatório) |
| GET | `/occurrences/:id/status-history` | 🟢 | Trilha de auditoria de status |

### Avaliações (votos)

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/occurrences/:id/evaluations` | 🔵 | Lista votos da ocorrência |
| POST | `/occurrences/:id/upvote` | 🔵 | Vota a favor (idempotente por usuário) |
| POST | `/occurrences/:id/downvote` | 🔵 | Vota contra |
| DELETE | `/occurrences/:id/vote` | 🔵 | Remove o próprio voto |

> Não é possível votar em ocorrências `closed` (**409**). Contadores e `score` são recalculados de forma transacional.

### Bairros

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/neighborhoods` | 🟢 | Lista bairros |
| GET | `/neighborhoods/locate` | 🟢 | Geofencing: bairro que contém `lat`/`lng` |
| GET | `/neighborhoods/:id` | 🟢 | Detalha (com `boundary` e `center_point` em GeoJSON) |
| GET | `/neighborhoods/:id/occurrences` | 🟢 | Ocorrências do bairro |

### Categorias

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/categories` | 🟢 | Lista |
| GET | `/categories/:id` | 🟢 | Detalha |
| POST | `/categories` | 🟠 | Cria (`name`, `slug?` derivado do nome, `description?, icon?, color (#RRGGBB)?, is_active?`) |
| PATCH | `/categories/:id` | 🟠 | Atualiza |
| DELETE | `/categories/:id` | 🟠 | Remove (409 se em uso) |

### Subcategorias

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/subcategories` | 🟢 | Lista |
| GET | `/subcategories/:id` | 🟢 | Detalha |
| POST | `/subcategories` | 🟠 | Cria (`category_id`, `name`, `slug?`, `description?, icon?, is_active?`) |
| PATCH | `/subcategories/:id` | 🟠 | Atualiza |
| DELETE | `/subcategories/:id` | 🟠 | Remove (409 se em uso) |

### Órgãos

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/organizations` | 🟢 | Lista órgãos responsáveis |

### Analytics / Transparência

Filtros comuns (query string): `from`, `to` (datas), `category_id`, `subcategory_id`, `neighborhood_id`, e `status` (quando aplicável).

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/analytics/overview` | 🟢 | KPIs globais: totais, por grupo de status, taxa de resolução, tempos médios, recorrência, top categorias |
| GET | `/analytics/by-neighborhood` | 🟢 | Pendências/indicadores por bairro (inclui per capita) |
| GET | `/analytics/heatmap` | 🟢 | Pontos `[{ lat, lng, weight }]` para mapa de calor (`bbox`, `status`, `category_id`, `limit ≤ 50000`) |
| GET | `/analytics/response-time` | 🟢 | Tempo de resposta/resolução (média e mediana), com `group_by` opcional: `category | neighborhood | month` |
| GET | `/analytics/by-organization` | 🟠 | Eficiência por órgão (backlog, taxa de resolução, reincidência) |

> Os endpoints públicos de analytics expõem apenas **agregados** (sem PII). Os tempos de resposta levam em conta o fuso de Brasília e expõem `sample_size` como ressalva de completude.

### Estático

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/uploads/occurrences/<arquivo>` | 🟢 | Bytes das mídias (somente leitura) |

---

## Formato de erros

Erros retornam JSON com a chave `error` e, quando útil, `details`:

```json
{ "error": "status must be one of: pending, awaiting_validation, ..." }
```

```json
{
  "error": "Cannot change status from 'pending' to 'resolved'",
  "details": { "from": "pending", "to": "resolved", "allowed": ["awaiting_validation", "closed"] }
}
```

Códigos HTTP usados: **200/201/204** (sucesso), **400** (validação), **401** (não autenticado), **403** (sem permissão / janela de edição expirada), **404** (não encontrado), **409** (conflito: duplicidade, transição inválida, recurso em uso), **413/415** (upload), **429** (rate limit).

---

## Documentação OpenAPI

A especificação completa está em [`openapi.json`](./openapi.json) (OpenAPI 3.0.3, 37 operações). Você pode:

- importá-la em ferramentas como **Swagger UI**, **Redoc**, **Postman** ou **Insomnia**;
- ou servir uma UI a partir dela durante o desenvolvimento.

O servidor padrão documentado é `http://localhost:3000`.

---

## Scripts npm

| Script | Ação |
| --- | --- |
| `npm start` | Sobe o servidor (produção) |
| `npm run dev` | Sobe com `nodemon` (auto-restart) |
| `npm run docker:dev` | Docker Compose em modo desenvolvimento (hot reload) |
| `npm run docker:prod` | Docker Compose em modo produção |

---

## Licença

Distribuído sob a licença **GNU GPL-3.0**. Veja o arquivo [`LICENSE`](./LICENSE).
