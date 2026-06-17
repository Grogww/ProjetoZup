# 8. Diagramas (consolidados)

Todos em Mermaid. Os diagramas de **estados** e **ER** estão detalhados nas suas seções
([Regras §RN-05](./01-regras-de-negocio.md) e [Modelo de Dados §7.1](./07-modelo-de-dados.md));
aqui ficam os de **casos de uso**, **sequência** e **arquitetura**.

## 8.1 Casos de uso (atores × funcionalidades)

```mermaid
flowchart LR
    Cidadao([Cidadão])
    Agente([Agente / Órgão])
    Admin([Administrador])

    subgraph Sistema ZUP
        UC1[Cadastrar-se / autenticar]
        UC2[Registrar ocorrência georreferenciada]
        UC3[Ver ocorrências próximas]
        UC4[Anexar mídia]
        UC5[Votar em ocorrência]
        UC6[Acompanhar status / histórico]
        UC7[Reabrir / registrar recorrência]
        UC8[Consultar dashboards públicos]
        UC9[Editar a própria ocorrência]
        UC10[Transição de status operacional]
        UC11[Gerir categorias / subcategorias]
        UC12[Gerir usuários e papéis]
        UC13[Analytics por órgão]
        UC14[Validação por relevância via votação ⚠️ roadmap]
    end

    Cidadao --> UC1 & UC2 & UC3 & UC4 & UC5 & UC6 & UC7 & UC8 & UC9
    Agente --> UC10
    Admin --> UC10 & UC11 & UC12 & UC13
    Admin --> UC9
    UC5 -. alimenta .-> UC14

    UC2 -. include .-> UC3
```

> ⚠️ Notas de fidelidade ao código: **UC10** (transição de status) hoje é acessível a **qualquer
> autenticado** (não apenas Agente/Admin) — ver [Perfis e Permissões](./04-perfis-e-permissoes.md).
> **UC14** (validação por relevância) é roadmap: será derivada automaticamente da votação dos
> cidadãos (RN-16), sem um papel "Validador" dedicado.

## 8.2 Sequência — registrar ocorrência (com anti-duplicidade e geofencing)

```mermaid
sequenceDiagram
    actor C as Cidadão
    participant R as Router (auth)
    participant Ctrl as occurrencesController
    participant Svc as occurrencesService
    participant M as occurrencesModel / neighborhoodsModel
    participant DB as PostgreSQL+PostGIS

    C->>R: POST /api/occurrences (Bearer token)
    R->>R: auth → req.user
    R->>Ctrl: create(req)
    Ctrl->>Ctrl: valida título, descrição, lat/lng, category_id
    Ctrl->>Svc: createOccurrence(data)
    Svc->>M: categoria/subcategoria existem?
    M->>DB: SELECT
    alt sem neighborhood_id
        Svc->>M: findByPoint(lng,lat)
        M->>DB: ST_Contains(boundary, ponto)
        DB-->>Svc: bairro ou null
    end
    Svc->>M: findNearby(lat,lng,500m)
    M->>DB: ST_DWithin(::geography)
    DB-->>Svc: ocorrências próximas
    alt duplicata (mesma categoria, não finalizada)
        Svc-->>Ctrl: err OCCURRENCE_DUPLICATE
        Ctrl-->>C: 409 { error, details:{duplicate_id, distance_m} }
    else ok
        Svc->>DB: BEGIN
        Svc->>M: INSERT occurrences (status pending)
        Svc->>M: INSERT occurrence_status_history (null→pending)
        Svc->>DB: COMMIT
        Svc-->>Ctrl: ocorrência
        Ctrl-->>C: 201 { ...ocorrência }
    end
```

## 8.3 Sequência — ciclo de vida e reabertura

```mermaid
sequenceDiagram
    actor U as Usuário autenticado
    participant API as API
    participant DB as PostgreSQL

    U->>API: PATCH /occurrences/:id/status {status}
    API->>API: valida transição (STATUS_TRANSITIONS)
    alt transição inválida
        API-->>U: 409 {from,to,allowed}
    else válida
        API->>DB: BEGIN; UPDATE status e carimba resolved_at/closed_at; INSERT histórico; COMMIT
        API-->>U: 200 ocorrência
    end

    Note over U,DB: problema reincide após resolved/closed
    U->>API: POST /occurrences/:id/reopen {reason}
    API->>DB: SELECT ... FOR UPDATE (trava a original)
    alt não finalizada ou já reaberta
        API-->>U: 409 (NOT_REOPENABLE / ALREADY_REOPENED)
    else ok
        API->>DB: BEGIN; INSERT nova ocorrência pending encadeada e incrementa reopen_count; INSERT occurrence_reopens; INSERT histórico; COMMIT
        API-->>U: 201 nova ocorrência
    end
```

## 8.4 Arquitetura geral

```mermaid
flowchart TB
    subgraph Cliente
        FE[Frontend React + react-leaflet<br/>OpenStreetMap tiles<br/>⚠️ repositório separado]
    end

    subgraph Backend["Backend — Node.js + Express (este repo)"]
        direction TB
        RT[routes /api]
        MW[middlewares<br/>auth · optionalAuth · requireRole · upload · rateLimiters]
        CT[controllers]
        SV[services]
        MD[models]
        ST[(uploads/ — mídias)]
        RT --> MW --> CT --> SV --> MD
        CT -. servir estático .-> ST
    end

    subgraph Dados
        PG[(PostgreSQL 17 + PostGIS 3.5<br/>views de analytics)]
    end

    subgraph Externos
        SMTP[(SMTP / Nodemailer<br/>reset de senha)]
    end

    FE -- HTTPS/JSON, JWT --> RT
    FE -- GET /uploads --> ST
    MD -- pg.Pool --> PG
    SV -- e-mail --> SMTP
```

### Arquitetura em camadas (request flow)

```mermaid
flowchart LR
    req[HTTP request] --> router
    router -->|auth/role/upload| controller
    controller -->|valida + traduz erros| service
    service -->|transações + regras| model
    model -->|SQL/PostGIS| db[(PostgreSQL)]
    db --> model --> service --> controller --> res[HTTP JSON]
```

## 8.5 Diagramas referenciados em outras seções

- **Máquina de estados da ocorrência** → [Regras de Negócio §RN-05](./01-regras-de-negocio.md).
- **Diagrama ER do banco** → [Modelo de Dados §7.1](./07-modelo-de-dados.md).
- **Navegação do frontend** → [Frontend §6.3](./06-frontend.md).
