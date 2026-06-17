# 5. Documentação Técnica do Backend

## 5.1 Estrutura de pastas

Arquitetura em camadas: **routes → controller → service → model**.

```
src/
├── app.js                 # Cria o app Express, JSON, CORS, static /uploads e monta as rotas /api
├── config/
│   ├── database.js        # Pool pg (config por DB_*), teste de conexão no boot
│   └── storage.js         # Pastas, limites e allowlist de mimetypes dos uploads
├── middlewares/
│   ├── auth.js            # Exige JWT 'access'; delega a mockAuth se USE_MOCK_AUTH=true
│   ├── optionalAuth.js    # Popula req.user se houver token (não bloqueia)
│   ├── mockAuth.js        # Usuário admin fake (apenas desenvolvimento)
│   ├── requireRole.js     # Autorização por papel (usado só com 'admin')
│   ├── rateLimiters.js    # Limitadores (forgot/reset password)
│   └── upload.js          # multer para mídias de ocorrências
├── routes/                # Uma rota por recurso; aplica auth/role/upload/rate limit
├── controllers/           # Valida/normaliza entrada e traduz err.code → HTTP
├── services/              # Regras de negócio, transações, máquina de estados
├── models/                # Acesso a dados (SQL/PostGIS)
└── utils/                 # cpf, slugify, occurrenceEditWindow
```

**Responsabilidades por camada:**

- **routes** — mapeiam método+caminho e encadeiam middlewares de auth/role/upload.
- **controllers** — validação sintática da entrada (tipos, faixas: lat ∈ [-90,90], lng ∈
  [-180,180], `limit ≤ 200` etc.), e **tradução de erros de domínio** (`err.code`) em status HTTP.
- **services** — regras de negócio: transações (`BEGIN/COMMIT/ROLLBACK`), validações cruzadas,
  máquina de estados, anti-duplicidade, reabertura. Erros saem com `err.code` simbólico.
- **models** — SQL parametrizado contra PostgreSQL/PostGIS; geometria entra como
  `ST_SetSRID(ST_MakePoint(lng,lat),4326)` e sai como GeoJSON (`ST_AsGeoJSON`).

**Fluxo de uma requisição:** `router` (middlewares) → `controller` (valida/normaliza) →
`service` (regras + transação) → `model` (SQL) → resposta JSON.

## 5.2 Documentação da API

A referência completa de endpoints está no **[`README.md`](../README.md#referência-da-api)** da
raiz e na **especificação OpenAPI 3.0** versionada em
[`openapi.json`](../openapi.json) (importável em Swagger UI, Redoc, Postman ou Insomnia).

Resumo dos grupos de rotas (todas sob `/api`, exceto o estático `/uploads`):

| Grupo | Arquivo de rotas | Acesso predominante |
|-------|------------------|---------------------|
| Health | `routes/healthRoutes.js` | público |
| Auth | `routes/authRoutes.js` | público (rate-limited em reset) |
| Usuários | `routes/usersRoutes.js` | autenticado / admin |
| Ocorrências | `routes/occurrenceRoutes.js` | público (leitura) / autenticado (escrita) |
| Avaliações | `routes/evaluationRoutes.js` | autenticado |
| Bairros | `routes/neighborhoods.js` | público |
| Categorias / Subcategorias | `routes/categories.js`, `routes/subcategories.js` | público (leitura) / admin (escrita) |
| Órgãos | `routes/organizations.js` | público |
| Analytics | `routes/analyticsRoutes.js` | público (4) / admin (1) |

Ver a **[matriz de permissões](./04-perfis-e-permissoes.md)** para o detalhamento por papel.

## 5.3 Autenticação e autorização

- **Cadastro:** cria usuário `citizen`, senha em **bcrypt**.
- **Login por CPF + senha:** retorna `{ user, access_token, refresh_token, token_type, expires_in }`.
- **Access token** (JWT): payload `sub, name, email, role, type:'access'`; validade
  `JWT_EXPIRES_IN`. **Refresh token** (`type:'refresh'`): persistido em `users.refresh_token`,
  trocável em `/auth/refresh`; **revogado** ao resetar a senha.
- **Reset de senha:** token aleatório enviado por e-mail, **armazenado hasheado (SHA-256)**, de
  **uso único**, com expiração configurável; endpoints com **rate limiting**.
- **Autorização:** middlewares `auth`/`optionalAuth`/`requireRole` + checagem de *ownership* no
  service (ver [Perfis e Permissões §4.3](./04-perfis-e-permissoes.md)).

### Transição da autenticação (mock → real)

O projeto já opera com **JWT/CPF real**. O `mockAuth` permanece como **atalho de
desenvolvimento**: quando `USE_MOCK_AUTH=true`, `auth` injeta um usuário admin fake e dispensa o
token — útil para testar rotas protegidas sem montar sessão. A transição foi preparada
isolando essa decisão **dentro do middleware `auth`** (um único ponto), de modo que desligar o
mock não exige tocar nas rotas. **`USE_MOCK_AUTH` nunca deve ser `true` em produção** (R-09 prevê
sua remoção).

## 5.4 Variáveis de ambiente

Carregadas via `dotenv`. Lista completa e padrões no
**[`README.md`](../README.md#variáveis-de-ambiente)** e no `.env.example`. Agrupadas por função:

| Grupo | Variáveis |
|-------|-----------|
| Servidor | `PORT` |
| Banco | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` |
| JWT | `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` |
| Senhas | `BCRYPT_SALT_ROUNDS` |
| E-mail (reset) | `SMTP_HOST/PORT/SECURE/USER/PASS`, `MAIL_FROM`, `APP_NAME`, `FRONTEND_URL`, `FRONTEND_RESET_PATH`, `RESET_TOKEN_BYTES`, `RESET_TOKEN_EXPIRES_MINUTES` |
| Rate limit | `RATE_LIMITERS_ENABLED`, `RATE_LIMIT_FORGOT_PASSWORD_WINDOW_MS/_MAX`, `RATE_LIMIT_RESET_PASSWORD_WINDOW_MS/_MAX` |
| Uploads | `UPLOAD_DIR`, `PUBLIC_BASE_URL`, `MAX_UPLOAD_MB`, `MAX_UPLOAD_FILES`, `ALLOWED_MIME_TYPES` |
| Domínio | `OCCURRENCE_EDIT_WINDOW_HOURS` |
| Dev/Infra | `USE_MOCK_AUTH`, `SA_PASSWORD` |

## 5.5 Tratamento de erros

Os erros de domínio carregam um `err.code` simbólico no service; o controller o mapeia para HTTP.
Resposta padrão: `{ "error": "<mensagem>", "details?: {...} }`.

| HTTP | Quando |
|------|--------|
| 200 / 201 / 204 | sucesso (ler / criar / sem conteúdo) |
| 400 | validação de entrada (tipos, faixas, campos obrigatórios) |
| 401 | não autenticado / token inválido ou expirado |
| 403 | sem permissão (`FORBIDDEN`) ou janela de edição expirada (`EDIT_WINDOW_EXPIRED`) |
| 404 | recurso não encontrado |
| 409 | conflito: `OCCURRENCE_DUPLICATE`, `INVALID_STATUS_TRANSITION`, `OCCURRENCE_CLOSED`, `OCCURRENCE_NOT_REOPENABLE`, `OCCURRENCE_ALREADY_REOPENED`, recurso em uso |
| 413 / 415 | upload acima do limite / mimetype não suportado |
| 429 | rate limit |

## 5.6 Decisões técnicas (ADRs leves)

Registros das principais escolhas e o **porquê**.

**ADR-01 — Geometria em SRID 4326 (WGS84) uniforme.** Todas as geometrias (`occurrences.location`,
`neighborhoods.boundary/center_point`) usam SRID 4326, compatível com GeoJSON e com os tiles do
OpenStreetMap no frontend. A geometria é exposta como GeoJSON (`ST_AsGeoJSON`).
*Trade-off:* 4326 é geográfico (graus); medições de distância usam *cast* para `::geography`.

**ADR-02 — `geometry` para armazenar, `geography` só para distância.** O armazenamento e os
testes topológicos (`ST_Contains`, `ST_Intersects`, `ST_MakeEnvelope`) usam `geometry` (rápido,
indexável por GiST). A distância real (anti-duplicidade, `nearby`) faz *cast* para `::geography`
em `ST_DWithin`/`ST_Distance`, obtendo metros sobre o elipsoide.
*Por quê:* `geometry` mantém os índices e a simplicidade; `geography` entrega a precisão métrica
só onde importa.

**ADR-03 — `ST_Contains` para geofencing por bairro.** A descoberta do bairro usa
`ST_Contains(boundary, ponto)` com `ORDER BY id LIMIT 1` para ser **determinístico** quando o
ponto cai exatamente sobre uma divisa compartilhada.
*Alternativa considerada:* `ST_Intersects` (incluiria a borda em ambos os bairros, gerando
ambiguidade). `ST_Contains` + desempate por `id` evita o duplo-match.

**ADR-04 — Anti-duplicidade por raio fixo + categoria + status não-finalizado.** Bloqueio rígido a
500 m, mesma categoria, ignorando ocorrências `resolved`/`closed` (que podem reincidir).
*Por quê:* o problema "duplicado" é o mesmo tipo de problema, no mesmo lugar, ainda aberto. Raio
fixo no service (`ANTIDUPLICITY_RADIUS_M`) facilita ajuste futuro.

**ADR-05 — Reabertura cria nova ocorrência encadeada (em vez de reabrir o registro).** Preserva a
imutabilidade do ciclo encerrado e modela **reincidência** com `parent`/`root`/`reopen_count` e
auditoria em `occurrence_reopens`. `closed` permanece terminal na máquina de estados.

**ADR-06 — Máquina de estados explícita no service.** `STATUS_TRANSITIONS` é a fonte da verdade,
da qual deriva a lista de status válidos dos controllers. Centraliza a regra e descarta o valor
legado `reopened`.

**ADR-07 — Histórico de status na mesma transação.** Toda mudança (incl. estado inicial) grava em
`occurrence_status_history` dentro do `BEGIN/COMMIT`, garantindo trilha completa e servindo de
base ao cálculo de tempo de resposta no analytics.

**ADR-08 — Analytics sobre views regulares, agregação no SQL dos models.** Apenas uma view base
em nível de linha (`v_occurrence_metrics`) e uma de pontos (`v_heatmap_points`); as agregações
ficam nos models (GROUP BY/WHERE) para **preservar os filtros** (from/to, categoria, bairro…),
que uma view não recebe como parâmetro.
*Por quê:* views materializadas dariam *staleness* e não aceitam filtro dinâmico; o custo é
aceitável no volume atual.

**ADR-09 — Nomes de arquivo de mídia gerados pelo servidor + allowlist sem SVG.** A extensão deriva
do mimetype; o nome original nunca toca o disco (evita *path traversal*). SVG é excluído de
propósito (vetor de XSS quando servido).

**ADR-10 — CPF como login, armazenado normalizado e fora das respostas.** Login por CPF (chave
natural do cidadão), validado por DV **antes** de tocar o banco; nunca retornado (privacidade,
RN-14).

**ADR-11 — Token de reset hasheado e de uso único.** Guardado como SHA-256 (não em claro), com
expiração curta e rate limiting, e revogação do refresh token ao concluir o reset.

> ⚠️ **A confirmar — reprojeção SIRGAS 2000 → WGS84.** A importação dos bairros (provavelmente a
> partir de fonte oficial em SIRGAS 2000 / EPSG:4674) deve ter sido reprojetada para 4326. As
> **tabelas de staging `bairros_raw`/`staging_bairros_sc`** (presentes no dump, já em 4326)
> confirmam que **houve um ETL**, mas o SRID de origem e o passo de `ST_Transform` não estão
> versionados — documentar o processo de importação e versionar o DDL/ETL (R-10). *(O DDL de
> tabelas, FKs e índices já foi verificado via `pg_restore --schema-only`.)*
