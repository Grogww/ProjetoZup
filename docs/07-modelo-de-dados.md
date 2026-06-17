# 7. Modelo de Dados

> O schema é restaurado a partir de `db/init/zup_backup.backup` (dump binário) e foi verificado via
> `pg_restore --schema-only`. Recomenda-se ainda versionar o DDL em texto (`db/schema.sql`) para
> auditar constraints e índices sem depender do dump (R-09).

## 7.1 Diagrama ER

```mermaid
erDiagram
    users ||--o{ occurrences : "author_id"
    users ||--o{ evaluations : "user_id"
    users ||--o{ occurrence_media : "uploaded_by"
    users }o--|| neighborhoods : "neighborhood_id"
    users ||--o{ occurrence_status_history : "changed_by"
    users ||--o{ occurrence_reopens : "reopened_by"

    neighborhoods ||--o{ occurrences : "neighborhood_id"

    categories ||--o{ subcategories : "category_id"
    categories ||--o{ occurrences : "category_id"
    subcategories ||--o{ occurrences : "subcategory_id"
    organizations ||--o{ occurrences : "assigned_organization_id"

    neighborhoods ||--o{ neighborhood_adjacency : "neighborhood_id"
    neighborhoods ||--o{ neighborhood_adjacency : "neighbor_id"

    occurrences ||--o{ occurrence_media : "occurrence_id"
    occurrences ||--o{ evaluations : "occurrence_id"
    occurrences ||--o{ occurrence_status_history : "occurrence_id"
    occurrences ||--o{ occurrences : "parent/root (reabertura)"
    occurrences ||--o{ occurrence_reopens : "original/new"

    users {
        integer id PK
        text name
        text email UK
        text cpf UK "sensível, não retornado"
        text password_hash "bcrypt, não retornado"
        user_role role "citizen|agent|admin"
        text avatar_url
        integer neighborhood_id FK
        boolean is_active
        timestamptz email_verified_at
        text reset_token "hash SHA-256, não retornado"
        timestamptz reset_token_expires_at
        text refresh_token "não retornado"
        timestamptz created_at
        timestamptz updated_at
    }

    occurrences {
        integer id PK
        text title
        text description
        geometry location "Point SRID 4326"
        text address
        integer category_id FK
        integer subcategory_id FK
        integer neighborhood_id FK
        integer author_id FK
        integer assigned_organization_id FK
        occurrence_status status
        int upvote_count
        int downvote_count
        int score
        int reopen_count
        integer parent_occurrence_id FK
        integer root_occurrence_id FK
        timestamp resolved_at
        timestamp closed_at
        timestamp created_at
        timestamp updated_at
    }

    occurrence_media {
        integer id PK
        integer occurrence_id FK
        text storage_key
        text original_name
        text mime_type
        integer size_bytes
        integer uploaded_by FK
        timestamptz created_at
    }

    occurrence_status_history {
        integer id PK
        integer occurrence_id FK
        occurrence_status old_status "null no estado inicial"
        occurrence_status new_status
        integer changed_by FK
        timestamptz created_at
    }

    occurrence_reopens {
        integer id PK
        integer original_occurrence_id FK
        integer new_occurrence_id FK
        integer root_occurrence_id FK
        integer reopened_by FK
        text reason
        occurrence_status previous_status
        int reopen_sequence
        timestamptz created_at
    }

    evaluations {
        integer id PK
        integer occurrence_id FK
        integer user_id FK
        vote_type vote_type "up|down"
        timestamptz created_at
    }

    categories {
        integer id PK
        text name
        text slug UK
        text description
        text icon
        text color "#RRGGBB"
        boolean is_active
    }

    subcategories {
        integer id PK
        integer category_id FK
        text name
        text slug
        text description
        text icon
        boolean is_active
    }

    neighborhoods {
        integer id PK
        text name
        int population_estimate
        geometry boundary "Polygon/MultiPolygon SRID 4326"
        geometry center_point "Point SRID 4326"
        timestamp created_at
        timestamp updated_at
    }

    organizations {
        integer id PK
        text name
        text description
        text contact_email
        text contact_phone
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    neighborhood_adjacency {
        integer neighborhood_id PK_FK
        integer neighbor_id PK_FK
    }
```

**Constraints confirmadas no DDL** (extraído do dump): chaves `integer`; `users.email`,
`users.cpf`, `categories.name`, `categories.slug` e `neighborhoods.name` **únicos**;
`evaluations` com **UNIQUE `(occurrence_id, user_id)`** (`uq_evaluations_occurrence_user`);
`subcategories` único por `(category_id, name)` e `(category_id, slug)`;
`occurrence_reopens.new_occurrence_id` único; `neighborhood_adjacency` com PK composta
`(neighborhood_id, neighbor_id)` e CHECK `neighborhood_id <> neighbor_id`. Geometrias tipadas:
`occurrences.location geometry(Point,4326) NOT NULL`, `neighborhoods.boundary
geometry(MultiPolygon,4326)`, `neighborhoods.center_point geometry(Point,4326)`.

> 📌 **`neighborhood_adjacency` existe no schema** (PK `(neighborhood_id, neighbor_id)`, CHECK de
> não-reflexividade, ambas as FKs `ON DELETE CASCADE` para `neighborhoods`), mas **nenhum código
> a utiliza**. Era a base da validação comunitária por adjacência prevista originalmente; como o
> projeto passou a adotar **validação/priorização por votação** (RN-16), esta tabela ficou
> **reservada** — pode ser reaproveitada no futuro, mas não é mais pré-requisito de nenhuma regra
> ativa.

> ⚠️ **Tabelas de staging no dump:** o backup ainda contém `bairros_raw` e `staging_bairros_sc`
> (geometria `MultiPolygon,4326`, com índice GiST) — resíduos do ETL de importação dos bairros de
> Santa Catarina. **Recomenda-se removê-las do backup público** (não fazem parte do schema de
> runtime). A extensão `uuid-ossp` também está presente, embora as PKs sejam `integer` sequenciais.

## 7.2 Tabelas centrais

| Tabela | Papel |
|--------|-------|
| `users` | Cidadãos/agentes/admins. Login por `cpf`; campos sensíveis nunca retornados. |
| `occurrences` | Núcleo do domínio: relato georreferenciado, status, contadores de voto, cadeia de reabertura. |
| `occurrence_media` | Mídias (imagens) por ocorrência; arquivos no disco + metadados. |
| `occurrence_status_history` | Trilha de auditoria das transições de status (base do tempo de resposta). |
| `occurrence_reopens` | Auditoria de reaberturas (reincidência) com motivo e sequência. |
| `evaluations` | Votos (up/down) únicos por usuário/ocorrência; alimentam `upvote_count`/`downvote_count`/`score`. |
| `categories` / `subcategories` | Taxonomia das ocorrências (slug, ícone, cor, ativação). |
| `neighborhoods` | Bairros de Videira com fronteira, ponto central e estimativa populacional (per capita no analytics). |
| `organizations` | Órgãos responsáveis por atender ocorrências. |
| `neighborhood_adjacency` | Pares de bairros adjacentes (grafo de vizinhança). **Existe no schema, mas ainda não usada por código** — reservada; a validação passou a usar relevância por votação (RN-16). |

### Enums (PostgreSQL)

- `user_role`: `citizen | agent | admin`.
- `occurrence_status`: `pending | awaiting_validation | validated | in_analysis | in_progress |
  resolved | resolution_rejected | resolution_validated | closed` (+ `reopened` **legado/
  descontinuado**, ver [Regras §RN-05](./01-regras-de-negocio.md)).
- `vote_type`: `up | down`.

### Views de analytics (no banco)

- **`v_occurrence_metrics`** — uma linha por ocorrência, com os campos da própria `occurrences`
  (categoria, subcategoria, bairro, órgão, status, datas, `score`, `location` etc.) acrescidos de:
  - `problem_id = COALESCE(root_occurrence_id, id)` — agrupa a cadeia de reaberturas num único
    problema lógico;
  - flags canônicas `is_resolved`, `is_open` e `is_closed_unresolved`;
  - `first_response_at` — primeira transição **saindo de** `pending` (menor `created_at` em
    `occurrence_status_history` com `old_status IS NOT NULL`);
  - `response_seconds` — segundos entre a criação (ajustada para `America/Sao_Paulo`) e a primeira
    resposta;
  - `resolution_seconds` — segundos entre a criação e `resolved_at`.
- **`v_heatmap_points`** — projeção sobre `v_occurrence_metrics` para o mapa de calor: `id`,
  `lat`/`lng` (de `ST_Y`/`ST_X` da geometria), `status`, `category_id`, `subcategory_id`,
  `neighborhood_id`, `is_open`, `is_resolved`, `score`, `created_at` e `location`.

DDL das views (aplicado no banco; recomenda-se versioná-lo em `db/analytics_views.sql` — R-11):

```sql
CREATE OR REPLACE VIEW public.v_occurrence_metrics AS
 SELECT o.id,
    o.root_occurrence_id,
    o.parent_occurrence_id,
    o.category_id,
    o.subcategory_id,
    o.neighborhood_id,
    o.assigned_organization_id,
    o.status,
    o.created_at,
    o.resolved_at,
    o.closed_at,
    o.reopen_count,
    o.score,
    o.location,
    COALESCE(o.root_occurrence_id, o.id) AS problem_id,
    o.resolved_at IS NOT NULL AS is_resolved,
    o.resolved_at IS NULL AND o.closed_at IS NULL AS is_open,
    o.closed_at IS NOT NULL AND o.resolved_at IS NULL AS is_closed_unresolved,
    fr.first_response_at,
    CASE
        WHEN fr.first_response_at IS NOT NULL
        THEN EXTRACT(epoch FROM fr.first_response_at - (o.created_at AT TIME ZONE 'America/Sao_Paulo'))
        ELSE NULL::numeric
    END AS response_seconds,
    CASE
        WHEN o.resolved_at IS NOT NULL
        THEN EXTRACT(epoch FROM o.resolved_at - o.created_at)
        ELSE NULL::numeric
    END AS resolution_seconds
   FROM occurrences o
   LEFT JOIN LATERAL (
        SELECT min(h.created_at) AS first_response_at
          FROM occurrence_status_history h
         WHERE h.occurrence_id = o.id AND h.old_status IS NOT NULL
   ) fr ON true;

CREATE OR REPLACE VIEW public.v_heatmap_points AS
 SELECT id,
    st_y(location) AS lat,
    st_x(location) AS lng,
    status,
    category_id,
    subcategory_id,
    neighborhood_id,
    is_open,
    is_resolved,
    score,
    created_at,
    location
   FROM v_occurrence_metrics m;
```

## 7.3 Decisões geoespaciais

- **SRID 4326 (WGS84)** para todas as geometrias — compatível com GeoJSON e OSM (ver
  [ADR-01](./05-backend.md#56-decisões-técnicas-adrs-leves)).
- **`geometry` para armazenar/topologia, `geography` só para distância** (ADR-02): `ST_Contains`/
  `ST_Intersects`/`ST_MakeEnvelope` em `geometry`; `ST_DWithin`/`ST_Distance` com *cast*
  `::geography` para metros reais.
- **Ponto central do bairro** (`center_point`) usado para posicionar agregados no mapa.
  > ⚠️ A confirmar: se foi gerado por `ST_PointOnSurface` (garante ponto **dentro** do polígono)
  > ou `ST_Centroid` (pode cair fora em polígonos côncavos). Recomendado `ST_PointOnSurface`.
  > *(Não é determinável pelo DDL — depende do passo de ETL que populou a coluna.)*
- **Geofencing** por `ST_Contains(boundary, ponto)` com desempate `ORDER BY id` (ADR-03).
- **Saída como GeoJSON** via `ST_AsGeoJSON(...)::json`.

**Índices espaciais confirmados no DDL:** GiST em `occurrences.location`
(`idx_occurrences_location`), `neighborhoods.boundary` (`idx_neighborhoods_boundary`) e
`neighborhoods.center_point` (`idx_neighborhoods_center`) — além de btree em `status`,
`category_id`, `neighborhood_id`, `created_at DESC` etc. (RNF-01 atendido).

> 📌 **Origem dos bairros:** as fronteiras vieram do **IBGE** em **SIRGAS 2000 (EPSG:4674)** e foram
> **reprojetadas para WGS84 (4326)** com as funções do PostGIS na importação — por isso todas as
> geometrias no banco já estão em 4326. As tabelas de staging `bairros_raw`/`staging_bairros_sc`
> são resíduos desse ETL. Recomenda-se versionar o script de importação para registrar o passo de
> reprojeção.

## 7.4 Integridade referencial (ações de FK confirmadas no DDL)

| FK | Referencia | `ON DELETE` | Efeito |
|----|------------|-------------|--------|
| `occurrences.author_id` | `users` | **CASCADE** | Excluir um usuário **apaga suas ocorrências**. |
| `occurrences.neighborhood_id` | `neighborhoods` | **SET NULL** | Confirma a regra de negócio: reimportações de bairros **devem ser aditivas** (uma remoção zera o vínculo). |
| `occurrences.category_id` | `categories` | **RESTRICT** | Categoria em uso não pode ser removida (daí o **409** em `DELETE /categories/:id`). |
| `occurrences.subcategory_id` | `subcategories` | **RESTRICT** | Idem para subcategoria. |
| `occurrences.assigned_organization_id` | `organizations` | **SET NULL** | Remover órgão desatribui as ocorrências. |
| `occurrences.parent_occurrence_id` / `root_occurrence_id` | `occurrences` | **SET NULL** | A cadeia de reabertura sobrevive à remoção de um elo (vínculo vira `null`). |
| `occurrence_media.occurrence_id` | `occurrences` | **CASCADE** | Apaga as linhas; os **arquivos em disco** são removidos pelo service (RN-13). |
| `occurrence_media.uploaded_by` | `users` | *(sem ação / NO ACTION)* | Não permite remover o usuário enquanto houver mídia dele. |
| `evaluations.occurrence_id` / `user_id` | `occurrences` / `users` | **CASCADE** | Votos somem com a ocorrência ou o usuário. |
| `occurrence_status_history.occurrence_id` | `occurrences` | **CASCADE** | Histórico some com a ocorrência. |
| `occurrence_status_history.changed_by` | `users` | **SET NULL** | Preserva o histórico mesmo se o autor da mudança for removido. |
| `occurrence_reopens.new_occurrence_id` | `occurrences` | **CASCADE** | — |
| `occurrence_reopens.original_occurrence_id` / `root_occurrence_id` / `reopened_by` | `occurrences` / `users` | **SET NULL** | Auditoria de reabertura sobrevive à remoção dos envolvidos. |
| `subcategories.category_id` | `categories` | **CASCADE** | Remover categoria apaga subcategorias (na prática barrado antes por `occurrences.category_id RESTRICT` se houver uso). |
| `users.neighborhood_id` | `neighborhoods` | **SET NULL** | — |
| `neighborhood_adjacency.*` | `neighborhoods` | **CASCADE** | Adjacências somem com o bairro. |

> ✅ Todas as ⚠️ anteriores desta seção foram **confirmadas** lendo o DDL extraído do dump
> (`pg_restore --schema-only`). Em particular: `occurrences.neighborhood_id` é de fato
> **`ON DELETE SET NULL`**, e `category_id`/`subcategory_id` são **`RESTRICT`**.
>
> **Recomendação (R-09):** versionar esse DDL em `db/schema.sql` (sem as tabelas de staging) para
> tornar as garantias auditáveis sem depender do dump binário.
