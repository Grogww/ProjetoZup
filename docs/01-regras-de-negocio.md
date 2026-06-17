# 1. Regras de Negócio

> Cada regra diz **o que** impõe, **por que** existe e **onde** está implementada (arquivo/função).
> As regras refletem o comportamento real de `src/services/`, `src/controllers/`, `src/middlewares/`
> e das funções PostGIS dos `src/models/`. Regras ainda planejadas (não implementadas nesta etapa)
> são marcadas com *(Roadmap)* e detalhadas em [Plano de Projeto](./03-plano-de-projeto.md).

## Índice de regras

| ID | Regra | Onde |
|----|-------|------|
| RN-01 | Login e identidade por CPF válido | `utils/cpf.js`, `services/authService.js` |
| RN-02 | Unicidade de e-mail e CPF no cadastro | `services/authService.js` |
| RN-03 | Geofencing — derivação do bairro pelo ponto | `services/occurrencesService.js`, `models/neighborhoodsModel.js` |
| RN-04 | Prevenção de duplicidade por raio geográfico | `services/occurrencesService.js`, `models/occurrencesModel.js` |
| RN-05 | Máquina de estados da ocorrência | `services/occurrencesService.js` |
| RN-06 | Trilha de auditoria de status (histórico) | `services/occurrencesService.js`, `models/occurrenceStatusHistoryModel.js` |
| RN-07 | Carimbo automático de `resolved_at` / `closed_at` | `models/occurrencesModel.js` |
| RN-08 | Reabertura / recorrência encadeada | `services/occurrencesService.js`, `models/occurrenceReopensModel.js` |
| RN-09 | Janela de edição da ocorrência | `utils/occurrenceEditWindow.js`, `services/occurrencesService.js` |
| RN-10 | Autorização de edição e exclusão (autor ou admin) | `services/occurrencesService.js` |
| RN-11 | Votação (avaliações) e recálculo de score | `services/evaluationsService.js` |
| RN-12 | Bloqueio de voto em ocorrência fechada | `services/evaluationsService.js` |
| RN-13 | Integridade de mídias (allowlist, limites, CASCADE) | `config/storage.js`, `middlewares/upload.js`, `services/occurrenceMediaService.js` |
| RN-14 | Privacidade dos dados do cidadão (sanitização nas respostas) | `services/authService.js`, `utils/cpf.js` |
| RN-15 | Coerência categoria ↔ subcategoria | `services/occurrencesService.js` |
| RN-16 | *(Roadmap)* Relevância e priorização por votação | `services/evaluationsService.js` |

---

## RN-01 — Login e identidade por CPF válido

**O que:** o cadastro e o login usam o **CPF** como identificador de login. O CPF é normalizado
(apenas dígitos) e validado por formato (11 dígitos) e pelos **dois dígitos verificadores**;
sequências repetidas (`000…`, `111…`) são rejeitadas.

**Por que:** o CPF é a chave natural do cidadão perante a administração municipal; validar os
dígitos verificadores reduz cadastros inválidos/fraudulentos antes mesmo de consultar o banco.

**Onde:** `utils/cpf.js` (`normalizeCpf`, `isValidCpf`, `checkDigit`), consumido no fluxo de
`services/authService.js` (`login` busca o usuário por CPF normalizado).

**Comportamento:** CPF pode ser enviado com ou sem máscara. Credenciais inválidas ou usuário
inativo retornam **401 `INVALID_CREDENTIALS`** (mensagem genérica, sem revelar qual campo falhou).

---

## RN-02 — Unicidade de e-mail e CPF no cadastro

**O que:** no `POST /auth/register`, e-mail e CPF não podem já existir.

**Por que:** evita contas duplicadas para o mesmo cidadão.

**Onde:** `services/authService.js → register` (`findByEmail` → `EMAIL_ALREADY_REGISTERED` 409;
`findByCpf` → `CPF_ALREADY_REGISTERED` 409). A senha é protegida com **bcrypt** (`BCRYPT_SALT_ROUNDS`,
padrão 10) antes de persistir.

---

## RN-03 — Geofencing: derivação do bairro a partir do ponto

**O que:** ao criar uma ocorrência, se `neighborhood_id` **não** for informado, o bairro é
derivado da localização por **point-in-polygon** (`ST_Contains(boundary, ponto)`) sobre as
fronteiras dos bairros. Fica `null` se o ponto não cair em nenhum bairro cadastrado.

**Por que:** garante leitura por bairro ("Minha Cidade", analytics por bairro) sem exigir que o
cidadão escolha o bairro manualmente.

**Onde:** `services/occurrencesService.js → createOccurrence` (ramo `else`), apoiado em
`models/neighborhoodsModel.js → findByPoint` (SRID 4326, `ORDER BY id LIMIT 1` para
determinismo sobre divisas compartilhadas). A mesma base atende `GET /neighborhoods/locate`
(`neighborhoodsController.locate`).

> 📌 **Geofencing hoje deriva, ainda não restringe.** Nesta etapa o geofencing apenas **deriva**
> o bairro a partir do ponto (e deixa `null` quando o ponto cai fora dos polígonos cadastrados);
> ele **não bloqueia** o registro fora dos limites de Videira. Essa decisão é intencional para a
> fase de **testes e visualização** — permite exercitar o fluxo com pontos de qualquer origem. A
> **restrição oficial** ao território municipal (rejeitar pontos fora do município) será adicionada
> em uma etapa posterior (ver [Roadmap](./03-plano-de-projeto.md)).

---

## RN-04 — Prevenção de duplicidade por raio geográfico

**O que:** antes de persistir uma ocorrência, o sistema busca ocorrências da **mesma categoria**
num raio de **500 m** que **não estejam finalizadas** (`resolved`/`closed`). Se encontrar, rejeita.

**Por que:** reduz spam e relatos duplicados do mesmo problema.

**Onde:** `services/occurrencesService.js → createOccurrence`
(constante `ANTIDUPLICITY_RADIUS_M = 500`, lista `FINALIZED_STATUSES = ['resolved','closed']`).
A busca geográfica é `models/occurrencesModel.js → findNearby`, que usa
`ST_DWithin(location::geography, ponto::geography, raio)` e ordena por `ST_Distance`.

**Comportamento (bloqueio, não aviso):** em caso de duplicata, lança **409 `OCCURRENCE_DUPLICATE`**
com `details: { duplicate_id, distance_m }`. É um **bloqueio rígido** — a criação é abortada.

- O critério de duplicidade considera **categoria + raio + status não-finalizado**. Categorias
  diferentes no mesmo ponto **não** são duplicata.
- O endpoint `GET /occurrences/nearby` (raio configurável, padrão 500 m, máx. 50 km) usa a mesma
  base e serve a **visualização prévia** de ocorrências próximas no momento do registro.

---

## RN-05 — Máquina de estados da ocorrência

**O que:** o status da ocorrência só transita conforme uma máquina de estados fixa, validada no
servidor. `closed` é terminal.

**Por que:** distingue o ciclo de confirmação/validação do tratamento formal e impede saltos de
estado inválidos.

**Onde:** `services/occurrencesService.js` (`STATUS_TRANSITIONS`, `updateOccurrenceStatus`).
A entrada é validada no `controllers/occurrencesController.js → updateStatus`.

**Transições permitidas:**

```
pending              → awaiting_validation, closed
awaiting_validation  → validated, closed
validated            → in_analysis, closed
in_analysis          → in_progress, closed
in_progress          → resolved, closed
resolved             → resolution_validated, resolution_rejected
resolution_rejected  → in_progress, closed
resolution_validated → closed
closed               → (terminal)
```

> O valor `reopened` existe no enum `occurrence_status` do banco por **legado**, mas foi
> **descontinuado**: não é selecionável nem alvo de transição (a reabertura cria uma nova
> ocorrência — ver RN-08). A lista canônica de status (`OCCURRENCE_STATUSES`) deriva das chaves
> de `STATUS_TRANSITIONS`, então nunca inclui `reopened`.

**Comportamento:** uma transição não prevista lança **409 `INVALID_STATUS_TRANSITION`** com
`details: { from, to, allowed }`.

### Diagrama de estados (obrigatório)

```mermaid
stateDiagram-v2
    [*] --> pending: criação
    pending --> awaiting_validation
    pending --> closed
    awaiting_validation --> validated
    awaiting_validation --> closed
    validated --> in_analysis
    validated --> closed
    in_analysis --> in_progress
    in_analysis --> closed
    in_progress --> resolved
    in_progress --> closed
    resolved --> resolution_validated
    resolved --> resolution_rejected
    resolution_rejected --> in_progress
    resolution_rejected --> closed
    resolution_validated --> closed
    closed --> [*]

    note right of awaiting_validation
        A relevância por votação (RN-16) servirá
        de base para promover esta etapa; a lógica
        de promoção automática ainda será implementada.
    end note
```

> 📌 **Sobre quem dispara cada transição.** A máquina de estados deixa **todas as transições
> válidas disponíveis** a qualquer usuário autenticado nesta etapa — a rota
> `PATCH /occurrences/:id/status` exige apenas `auth`. Isso é proposital enquanto o módulo
> principal (registro público e comunidade) amadurece: facilita exercitar o ciclo de vida completo
> em testes. A segregação por papel — comunidade promovendo a validação e **órgão/admin** conduzindo
> os estados operacionais (`in_analysis → in_progress → resolved`) — será aplicada à medida que o
> grupo do papel `agent` evoluir (ver [Perfis e Permissões](./04-perfis-e-permissoes.md) e
> [Roadmap](./03-plano-de-projeto.md)).

---

## RN-06 — Trilha de auditoria de status

**O que:** toda mudança de status (inclusive o estado inicial `NULL → pending` na criação) é
gravada em `occurrence_status_history` na **mesma transação** da mudança.

**Por que:** rastreabilidade completa do ciclo de vida e base para os indicadores de tempo de
resposta/resolução do módulo de analytics.

**Onde:** `services/occurrencesService.js` (`createOccurrence`, `updateOccurrenceStatus`,
`reopenOccurrence`) + `models/occurrenceStatusHistoryModel.js`. Consultável em
`GET /occurrences/:id/status-history`.

---

## RN-07 — Carimbo automático de `resolved_at` / `closed_at`

**O que:** ao entrar em `resolved`, `resolved_at` recebe `now()` (se ainda nulo); ao entrar em
`closed`, `closed_at` recebe `now()` (se ainda nulo).

**Por que:** marcos temporais confiáveis e idempotentes para SLA e analytics (não são
sobrescritos se o estado for revisitado).

**Onde:** `models/occurrencesModel.js → updateStatus` (`CASE WHEN … AND … IS NULL THEN now()`).

---

## RN-08 — Reabertura e recorrência

**O que:** uma ocorrência **resolvida ou fechada** pode ser reaberta via
`POST /occurrences/:id/reopen`. A reabertura **não altera** o status da original — cria uma
**nova ocorrência** (status `pending`) encadeada à anterior.

**Por que:** registra a **reincidência** de um mesmo problema preservando o histórico do ciclo
anterior, em vez de "ressuscitar" um registro encerrado.

**Onde:** `services/occurrencesService.js → reopenOccurrence`.

**Comportamento:**

1. A original é travada com `SELECT … FOR UPDATE` (serializa reaberturas concorrentes).
2. Só **estados finalizados** são reabríveis (`resolved`/`closed`); senão **409 `OCCURRENCE_NOT_REOPENABLE`**.
3. Só a **ponta da cadeia** pode ser reaberta: se a ocorrência já tem sucessora, retorna
   **409 `OCCURRENCE_ALREADY_REOPENED`** com `details.latest_occurrence_id`.
4. A nova ocorrência copia os dados da original (com overrides opcionais de
   título/descrição/endereço/localização), encadeia via `parent_occurrence_id`, mantém a
   `root_occurrence_id` (raiz do problema recorrente — a própria original, se ela ainda não tinha
   raiz) e incrementa `reopen_count`.
5. `assigned_organization_id` da nova ocorrência fica **nulo de propósito** (a reincidência passa
   por nova triagem).
6. Uma linha de auditoria é gravada em `occurrence_reopens` (`reason` é **obrigatório**).

Tudo (nova ocorrência + auditoria + histórico de status inicial) ocorre numa **única transação**.
O histórico de recorrência é consultável em `GET /occurrences/:id/reopens` (a partir de qualquer
ocorrência da cadeia, resolvido pela `root_occurrence_id`).

---

## RN-09 — Janela de edição da ocorrência

**O que:** os campos de uma ocorrência (e suas mídias) só podem ser alterados dentro de uma
janela de **24 h** a partir de `created_at` (configurável por `OCCURRENCE_EDIT_WINDOW_HOURS`).

**Por que:** depois de aberta e potencialmente em triagem, a ocorrência vira registro histórico;
edições tardias comprometeriam a confiabilidade do acompanhamento.

**Onde:** `utils/occurrenceEditWindow.js` (`isWithinEditWindow`, `assertWithinEditWindow`),
chamado em `services/occurrencesService.js → updateOccurrence` e no serviço de mídias.

**Comportamento:** fora da janela, edição retorna **403 `EDIT_WINDOW_EXPIRED`**.

---

## RN-10 — Autorização de edição e exclusão (autor ou admin)

**O que:** apenas o **autor** da ocorrência ou um **admin** pode editar campos/mídias **ou
excluir** a ocorrência. O autor só pode editar/excluir **dentro da janela de 24 h** (RN-09); o
admin não tem essa restrição de prazo.

**Por que:** preserva a autoria do relato e impede que terceiros removam registros alheios,
mantendo a confiabilidade do acompanhamento.

**Onde:** `services/occurrencesService.js → assertCanEdit` (edição) e `deleteOccurrence`
(exclusão). Ambos retornam **403 `FORBIDDEN`** para quem não é autor nem admin; a edição/exclusão
do autor fora do prazo retorna **403 `EDIT_WINDOW_EXPIRED`**. A exclusão também responde **409
`OCCURRENCE_IN_USE`** quando a ocorrência ainda é referenciada por outros registros.

---

## RN-11 — Votação (avaliações) e recálculo de score

**O que:** cada usuário tem **no máximo um voto** por ocorrência (`up` ou `down`). Votar de novo
no mesmo sentido é idempotente; votar no sentido oposto **troca** o voto. `upvote_count`,
`downvote_count` e `score = upvotes − downvotes` são **recalculados na mesma transação**.

**Por que:** o voto mede a **relevância** de um problema para a comunidade — quantas pessoas são
afetadas e o consideram importante. Após a ocorrência ser validada (deixar de ser apenas um relato
isolado), essa relevância passa a indicar a **prioridade** de atendimento: quanto maior o `score`,
mais alta a demanda na fila. O `score` é, portanto, a **base do sistema de priorização**.

**Onde:** `services/evaluationsService.js` (`voteOnOccurrence`, `removeUserVote`,
`recomputeOccurrenceCounts`; trava a ocorrência com `FOR UPDATE`). Unicidade
usuário×ocorrência garantida no schema de `evaluations`.

> 📌 **Priorização ainda não automatizada.** Hoje o `score` é calculado e exibido, mas os endpoints
> de listagem ainda ordenam por `created_at DESC` — **não há fila/ordenação automática por
> relevância**. A priorização orientada pelo `score` (RN-16) será implementada em etapa futura.

---

## RN-12 — Bloqueio de voto em ocorrência fechada

**O que:** não é possível votar em uma ocorrência com status `closed`.

**Por que:** demandas encerradas não competem mais por priorização/atenção.

**Onde:** `services/evaluationsService.js → voteOnOccurrence` (→ **409 `OCCURRENCE_CLOSED`**).
Observação: o bloqueio é **apenas** para `closed`; ocorrências `resolved` ainda aceitam voto.

---

## RN-13 — Integridade de mídias

**O que:** uploads de mídia passam por **allowlist de mimetypes**
(`image/jpeg,image/png,image/webp,image/gif` por padrão — **SVG fica de fora de propósito**,
risco de XSS), limite de tamanho por arquivo (`MAX_UPLOAD_MB`, padrão 10) e de quantidade
(`MAX_UPLOAD_FILES`, padrão 5). O nome de arquivo é **gerado pelo servidor** (o nome original
nunca entra no caminho de disco).

**Por que:** segurança (evita execução/serving de conteúdo perigoso e path traversal) e controle
de armazenamento.

**Onde:** `config/storage.js`, `middlewares/upload.js` (multer), `services/occurrenceMediaService.js`.
Ao excluir a ocorrência, as linhas de `occurrence_media` caem em **CASCADE** e os **arquivos em
disco** são removidos explicitamente (as chaves são coletadas antes do DELETE). Erros: **413**
(tamanho), **415** (mimetype), **400** (campo inesperado / sem arquivos).

---

## RN-14 — Privacidade dos dados do cidadão

**O que:** `password_hash`, `cpf`, `refresh_token`, `reset_token` e `reset_token_expires_at`
**nunca** são retornados nas respostas da API.

**Por que:** LGPD/privacidade — minimização de exposição de dados pessoais e sensíveis.

**Onde:** `services/authService.js → sanitize` (desestrutura e descarta os campos sensíveis
antes de responder). Há também `utils/cpf.js → maskCpf` para exibição mínima quando estritamente
necessário (`***.***.789-**`). Os endpoints públicos de analytics expõem **apenas agregados**
(sem PII).

---

## RN-15 — Coerência categoria ↔ subcategoria

**O que:** ao criar uma ocorrência com `subcategory_id`, a subcategoria deve **pertencer** à
`category_id` informada.

**Por que:** evita combinações categoria/subcategoria incoerentes.

**Onde:** `services/occurrencesService.js → createOccurrence`
(`SUBCATEGORY_CATEGORY_MISMATCH` → 400; categoria/subcategoria inexistentes → 404).

---

## RN-16 *(Roadmap)* — Relevância e priorização por votação

**O que:** o engajamento da comunidade por votos (RN-11) servirá de base para dois mecanismos
ainda a implementar:

- **Validação por relevância:** em vez de uma validação comunitária por elegibilidade/quórum de
  validadores, a promoção de uma ocorrência (`awaiting_validation → validated`) usará a **relevância
  apurada por upvotes e downvotes**. Ao ultrapassar uma **taxa aceitável** de apoio, a ocorrência é
  considerada validada.
- **Priorização:** o `score` (upvotes − downvotes) das ocorrências já validadas definirá a **ordem
  de prioridade** de atendimento (fila/ordenação por relevância).

**Por que:** aproveita um sinal que o sistema já coleta de forma consistente (o voto) para refletir
o real interesse da população, sem depender de um papel "Validador" e de regras de elegibilidade
por bairro/adjacência — simplificando o modelo originalmente previsto.

**Estado no código atual:** a votação e o cálculo de `score` **já funcionam** (RN-11), mas a
**lógica que liga relevância → validação → priorização ainda não foi implementada**: a transição
`awaiting_validation → validated` continua livre (ver RN-05) e as listagens ordenam por
`created_at DESC`. Os parâmetros (taxa de aprovação para validar, fórmula da fila de prioridade)
serão definidos e implementados sobre a base de votos já existente (ver
[Roadmap](./03-plano-de-projeto.md)).

> **Nota:** a tabela `neighborhood_adjacency` (grafo de vizinhança entre bairros) permanece no
> schema e pode ser reaproveitada futuramente, mas **deixou de ser pré-requisito** desta regra —
> o caminho adotado é a relevância por votação, não a validação por adjacência.
