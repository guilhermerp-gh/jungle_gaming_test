# 📄 Distributed Wagering Processor — Desafio Técnico Jungle Gaming

> Spec do desafio [junglegaming/backend-challenge](https://github.com/junglegaming/backend-challenge). Serviço financeiro distribuído que processa transações de apostas (BET / WIN / LOSS / REFUND / ROLLBACK) vindas de múltiplos provedores, via HTTP e SQS, com correção financeira sob concorrência, idempotência persistente, inbox/outbox e recuperação de falhas.

---

## 📌 Metadados

| Campo | Valor |
|-------|-------|
| **Versão** | v1.0 |
| **Data** | 16/10/2026 |
| **Autor** | Guilherme |
| **Status** | Rascunho |
| **Prioridade** | Alta |
| **Tipo** | Feature (greenfield) |
| **Repositório** | `guilhermerp-gh/jungle_gaming_test` (privado) |

---

## 📝 Resumo

Construir do zero um serviço em **Bun + NestJS + TypeScript estrito + PostgreSQL + SQS (LocalStack)** que mantém wallets de jogadores e aplica operações de apostas com **ledger imutável**, **idempotência persistente**, **concorrência segura entre múltiplas instâncias** e **eventos publicados via Transactional Outbox**. A avaliação foca em correção financeira, concorrência, idempotência e mensageria — não em CRUD. O resultado esperado é um repositório executável com `docker compose up`, testes reais de integração/concorrência e documentação (`README.md` + `ARCHITECTURE.md`) justificando as decisões.

---

## 📦 Escopo

### ✅ Incluído
- Value Object `Money` (decimal string, escala 2, multi-moeda, sem `number`).
- Aggregates/Entidades: `Wallet`, `WagerTransaction`, `WalletLedgerEntry`, `InboxMessage`, `OutboxMessage`, `IntegrationEvent` (abstrata) + 4 eventos concretos.
- API HTTP: criar wallet, consultas (wallet, ledger paginado por cursor, transação por id interno e por id externo), submeter transação, reconciliação, health live/ready, `/metrics`.
- Consumidor SQS `wager-transactions.fifo` + DLQ `wager-transactions-dlq.fifo`, reutilizando o mesmo use case do HTTP.
- Workers: **Outbox Publisher** e **Pending Reference Resolver** (ambos multi-instância com `FOR UPDATE SKIP LOCKED`).
- Schema PostgreSQL com constraints, índices e triggers que garantem as invariantes no banco.
- Migrations MikroORM versionadas e reversíveis (`up`/`down`).
- Logs estruturados JSON, métricas Prometheus, health checks.
- Testes de unidade, integração (Postgres + LocalStack reais) e concorrência (paralelismo real, ≥ 3 processos).
- Docker Compose (app ×3, postgres, localstack) + scripts `bun run ...`.
- `README.md` e `ARCHITECTURE.md`.
- Autenticação: **ponto de extensão no-op** (`AuthGuard` + `ProviderIdentityPort`) e desenho documentado (Keycloak/OIDC client credentials).

### ❌ Fora do Escopo
- Implementação real de IdP (Keycloak/Zitadel) — opcional, só se sobrar tempo (não vale pontos).
- Reversão parcial de valores.
- Conversão de moedas (modelo é multi-moeda, operação usa `BRL`).
- Ledger de partidas dobradas (diferencial opcional — fase extra).
- Dashboard/OpenTelemetry (opcional).
- Frontend de qualquer tipo.
- Teste de carga (`bun run test:load`) — diferencial, apenas se sobrar tempo (Fase 10).

---

## 🔄 Fluxo 1: Criar Wallet

### Comportamento Atual
Projeto greenfield — repositório vazio.

### Fluxo Proposto
1. `POST /wallets` com `playerId` e `initialBalance`.
2. Validação do DTO (`Money.from` rejeita inválidos/negativos).
3. Em **uma única transação SQL**: insere `wallets` (`version = 1`); se saldo > 0, insere `wager_transactions` kind `OPENING` (`PROCESSED`, provider `internal`) + `wallet_ledger_entries` `CREDIT` (`0.00 → saldo`) + outbox `WalletBalanceChanged`.
4. Retorna `201` com `{ id, playerId, balance, version }`.

### Fluxos Alternativos
- `playerId + currency` já existente → violação de `UNIQUE` → `409 WALLET_ALREADY_EXISTS`.
- Payload inválido → `400 INVALID_PAYLOAD`.

---

## 🔄 Fluxo 2: Processar Transação de Aposta (HTTP e SQS — mesmo use case)

### Fluxo Proposto (`ProcessWagerTransactionUseCase`)
1. Entrada: comando normalizado (`idempotencyKey`, `providerId`, `externalTransactionId`, `playerId`, `walletId`, `roundId`, `gameId`, `kind`, `money`, `referenceExternalTransactionId?`) + contexto (`correlationId`, `messageId?`, `consumerName?`).
2. Rejeitar `kind = OPENING` vindo de fora (`400`).
3. Calcular `payloadHash` = SHA-256 do **JSON canônico** (chaves ordenadas recursivamente) do subconjunto de negócio: `providerId, externalTransactionId, playerId, walletId, roundId, gameId, kind, money{amount,currency}, referenceExternalTransactionId`.
4. `em.transactional()`:
   1. (SQS) inserir inbox `(consumerName, messageId)` com `ON CONFLICT DO NOTHING`; se já existia processada → retornar resultado sem efeito (ack).
   2. `SELECT ... FROM wallets WHERE id = :walletId FOR UPDATE` (**lock pessimista por wallet** — serializa só a wallet, nunca global). Wallet inexistente → `404 WALLET_NOT_FOUND` (não persiste, sem FK possível).
   3. Buscar `wager_transactions` por `idempotency_key`:
      - existe e `payloadHash` igual → **replay**: retorna snapshot original (`status`, `result_balance`, `idempotentReplay: true`);
      - existe e hash diferente → **`409 IDEMPOTENCY_CONFLICT`** (não é replay);
      - `(providerId, externalTransactionId)` já usado com outra key → `409`.
   4. Criar `WagerTransaction.create(...)` (`PENDING`) e aplicar regras de domínio (tabela da seção Regras):
      - sucesso → `wallet.debit/credit` gera `WalletLedgerEntry`; tx `markProcessed`; grava `result_balance`;
      - violação → tx `reject(failureCode)`; sem ledger; saldo intacto;
      - referência ausente → `markPendingReference()`, agenda `next_attempt_at`.
   5. `UPDATE wallets SET balance_amount=?, version=version+1, updated_at=now() WHERE id=? AND version=?` (somente se saldo mudou; checagem de `version` como cinto-e-suspensório).
   6. Inserir eventos na outbox (`WagerTransactionProcessed` / `Rejected` / `PendingReference` / `WalletBalanceChanged`).
   7. (SQS) marcar inbox `processed_at`.
5. Commit → só então resposta HTTP / `DeleteMessage` no SQS.

### Fluxos Alternativos
- Corrida de duas requisições com mesma key: o lock da wallet serializa; a segunda vê a primeira já gravada → replay. Se ainda assim ocorrer `unique_violation` em `idempotency_key` → retry da transação (1×) que cai no caminho de replay.
- Erro transitório (conexão DB, serialization failure, lock timeout) → rollback total; HTTP `503` com `Retry-After`; SQS não faz ack (retry com backoff via `ChangeMessageVisibility`).
- Deadlock/lock timeout → métrica `lock_conflicts_total` + retry limitado (3×, jitter).

---

## 🔄 Fluxo 3: Referências Fora de Ordem (Pending Reference Resolver)

1. Worker agendado (a cada 1s) seleciona `status='PENDING_REFERENCE' AND next_attempt_at <= now()` com `FOR UPDATE SKIP LOCKED LIMIT N`.
2. Para cada uma, reexecuta a aplicação de regras dentro da mesma transação (lock da wallet → resolve referência por `(providerId, referenceExternalTransactionId)`).
3. Referência encontrada e `PROCESSED` → aplica; referência ainda ausente → `attempts++`, `next_attempt_at = now + min(1s·2^attempts, 60s)` com jitter.
4. Esgotado o limite (**10 tentativas ou TTL de 15 min**, o que vier primeiro — justificar no `ARCHITECTURE.md`) → `REJECTED` com `REFERENCE_NOT_FOUND` + evento `WagerTransactionRejected`.
5. Otimização: ao processar uma transação, disparar resolução imediata das pendentes que a referenciam (índice por `(provider_id, reference_external_transaction_id)`).

---

## 🔄 Fluxo 4: Consumidor SQS

1. Long polling (`WaitTimeSeconds=20`, `MaxNumberOfMessages=10`, `VisibilityTimeout=30s`) em `wager-transactions.fifo`; `MessageGroupId = walletId` (otimização de ordenação, não garantia).
2. Parse/validação do envelope. Inválido/não parseável → **permanente** → envia para DLQ e deleta.
3. Executa o use case com `consumerName='wager-transactions-consumer'` e `messageId`.
4. Classificação:
   - sucesso / rejeição de negócio / replay → **ack** (delete) após commit;
   - transitório → sem ack, `ChangeMessageVisibility` com backoff exponencial;
   - `ApproximateReceiveCount > 5` → redrive policy envia para DLQ (métrica `dlq_messages_total`).
5. `SIGTERM`: parar polling, aguardar mensagens em andamento (timeout 20s), devolver visibilidade (`ChangeMessageVisibility 0`) das não concluídas.

---

## 🔄 Fluxo 5: Transactional Outbox Publisher

1. Em transação curta: `SELECT ... FROM outbox_messages WHERE published_at IS NULL AND next_attempt_at <= now() ORDER BY occurred_at FOR UPDATE SKIP LOCKED LIMIT 50`; seta `locked_until = now()+30s` (lease) e commita.
2. Publica no SQS `wallet-events.fifo` (`MessageDeduplicationId = eventId`, `MessageGroupId = aggregateId`).
3. Sucesso → `published_at = now()`; falha → `scheduleRetry` (`attempts++`, backoff).
4. Crash após publicar e antes de marcar → lease expira → outra instância republica → **seguro**, pois consumidores deduplicam por `eventId` (at-least-once documentado).
5. Métrica `outbox_lag_seconds` = `now - min(occurred_at)` das pendentes.

---

## 🔄 Fluxo 6: Reconciliação

1. `POST /wallets/:walletId/reconciliation`.
2. Em transação `REPEATABLE READ` (ou `FOR SHARE` na wallet): lê `balance` armazenado e calcula `Σ CREDIT − Σ DEBIT` do ledger (em `NUMERIC`, no banco), conta entradas, verifica também `balance_after` do último lançamento.
3. Retorna `{ storedBalance, calculatedBalance, difference, consistent, checkedEntries }`.
4. Divergência → **nunca corrige**: log `error` estruturado + métrica `reconciliation_mismatch_total` + `consistent: false`.

---

## 📐 Regras e Restrições

### Regras de Negócio

| Operação | Saldo | Ledger | Regra |
|---|---|---|---|
| `BET` | débito | 1 `DEBIT` | rejeita `INSUFFICIENT_FUNDS` se saldo < valor |
| `WIN` | crédito | 1 `CREDIT` | referência à `BET` da rodada opcional; se informada, valida |
| `LOSS` | — | — | registra `PROCESSED` sem mover saldo (gera `WagerTransactionProcessed`) |
| `REFUND` | crédito | 1 `CREDIT` | só referencia `BET` `PROCESSED`, uma única vez |
| `ROLLBACK` | inverso da referência | 1 invertido | referencia `BET`/`WIN`/`REFUND` `PROCESSED`, uma única vez |

- `REFUND`/`ROLLBACK` exigem `referenceExternalTransactionId`; referência deve ter mesmo **provider, player, wallet, moeda e rodada** (`REFERENCE_MISMATCH`).
- Valor da reversão **igual** ao da referência (`AMOUNT_MISMATCH`).
- Reversão que deixaria saldo negativo → `REVERSAL_INSUFFICIENT_FUNDS` (distinto de `INSUFFICIENT_FUNDS`).
- `REJECTED` não altera saldo nem gera ledger, mas é **persistida e auditável**; replay retorna a mesma rejeição.
- Replay retorna o resultado original, inclusive o saldo da época (`result_balance_amount`).
- `OPENING` é interno, nunca aceito por API/fila.
- `walletId` deve pertencer ao `playerId` informado (`WALLET_PLAYER_MISMATCH`); moeda igual à da wallet (`CURRENCY_MISMATCH`).
- **Interpretação adotada (documentar):** uma referência pode ser revertida **no máximo uma vez no total** (REFUND *ou* ROLLBACK), evitando crédito duplo por REFUND + ROLLBACK da mesma BET. Exceção: ROLLBACK de um REFUND é uma nova referência (o REFUND).
- Referência existente porém `REJECTED`/`FAILED` → `REFERENCE_NOT_PROCESSED`; referência ainda `PENDING_REFERENCE` → permanece pendente.

**Taxonomia de `failureCode`** (estável, documentada com ação esperada do provedor):

| Código | Categoria | Provedor deve |
|---|---|---|
| `INVALID_PAYLOAD` | validação | corrigir payload |
| `IDEMPOTENCY_CONFLICT` | conflito | não reenviar com mesma key |
| `WALLET_NOT_FOUND` | negócio | corrigir |
| `WALLET_PLAYER_MISMATCH` | negócio | corrigir |
| `CURRENCY_MISMATCH` | negócio | corrigir |
| `INSUFFICIENT_FUNDS` | negócio | desistir |
| `REVERSAL_INSUFFICIENT_FUNDS` | negócio | escalar/operacional |
| `REFERENCE_REQUIRED` | validação | corrigir |
| `REFERENCE_NOT_FOUND` | negócio (após TTL) | investigar |
| `REFERENCE_MISMATCH` | negócio | corrigir |
| `INVALID_REFERENCE_KIND` | negócio | corrigir |
| `REFERENCE_NOT_PROCESSED` | negócio | desistir |
| `ALREADY_REVERSED` | negócio | desistir |
| `AMOUNT_MISMATCH` | negócio | corrigir |
| `INFRASTRUCTURE_PERMANENT_FAILURE` | infra (`FAILED`) | contatar suporte |

**Mapeamento HTTP (consistente em todos endpoints):**

| Situação | Status |
|---|---|
| Processada (novo) | `201` |
| Replay idêntico | `200` (`idempotentReplay: true`) |
| Aceita, pendente de referência | `202` |
| Payload inválido / header ausente | `400` |
| Recurso inexistente | `404` |
| Conflito de idempotência / wallet duplicada | `409` |
| Rejeição de regra de negócio (persistida) | `422` + `failureCode` |
| Falha transitória de infra | `503` + `Retry-After` |

Corpo de erro padrão: `{ "error": { "code", "message", "retryable" } }`.

### Restrições Técnicas / Funcionais (invioláveis)
- **Nunca** `number`/`float` para dinheiro: domínio usa `decimal.js` encapsulado em `Money`; banco usa `NUMERIC(20,2)`; driver configurado para retornar `NUMERIC` como string.
- Idempotência **somente persistente** (constraints no Postgres), nunca cache em memória.
- SQS FIFO é otimização; o banco garante invariantes.
- Evento só via outbox, **dentro** da transação financeira; publicação após commit.
- Ledger: sem `UPDATE`/`DELETE` (trigger que lança exceção + `REVOKE` para o usuário da app).
- Lock **por wallet** (`SELECT ... FOR UPDATE`), nunca global.
- Proibido `read → calculate → update` sem lock.
- Correto com **≥ 3 instâncias** (`docker compose up --scale app=3`).
- Domínio sem dependência de NestJS/MikroORM (sem decorators no domínio); mapeamento via `EntitySchema`/records + mappers na infraestrutura usando `rehydrate`.
- TypeScript `strict: true`, `noUncheckedIndexedAccess`.
- **Migrations não devem ser executadas pela IA sem permissão do usuário.**

### Schema do Banco (garantias no schema)

```sql
-- wallets
id UUID PK, player_id UUID NOT NULL, currency CHAR(3) NOT NULL,
balance_amount NUMERIC(20,2) NOT NULL CHECK (balance_amount >= 0),
version INT NOT NULL CHECK (version >= 1), created_at, updated_at,
UNIQUE (player_id, currency)

-- wager_transactions
id UUID PK, provider_id TEXT, external_transaction_id TEXT, idempotency_key TEXT,
payload_hash CHAR(64), wallet_id UUID FK, player_id UUID, round_id TEXT, game_id TEXT,
kind wager_kind, amount NUMERIC(20,2) CHECK (amount > 0), currency CHAR(3),
reference_external_transaction_id TEXT NULL, reference_transaction_id UUID NULL FK,
status wager_status, failure_code TEXT NULL, result_balance_amount NUMERIC(20,2) NULL,
attempts INT DEFAULT 0, next_attempt_at TIMESTAMPTZ NULL, processed_at, created_at, updated_at,
UNIQUE (idempotency_key),
UNIQUE (provider_id, external_transaction_id),
CHECK (kind NOT IN ('REFUND','ROLLBACK') OR reference_external_transaction_id IS NOT NULL),
CHECK (status NOT IN ('REJECTED','FAILED') OR failure_code IS NOT NULL),
CHECK (status <> 'PROCESSED' OR processed_at IS NOT NULL)
-- reversão única por referência
UNIQUE INDEX ux_single_reversal ON (reference_transaction_id)
  WHERE kind IN ('REFUND','ROLLBACK') AND status = 'PROCESSED'
INDEX ix_pending_ref ON (next_attempt_at) WHERE status = 'PENDING_REFERENCE'
INDEX ix_ref_lookup ON (provider_id, reference_external_transaction_id)
TRIGGER: impede mudança de status a partir de estado terminal

-- wallet_ledger_entries (imutável)
id UUID PK, seq BIGSERIAL UNIQUE (cursor), wallet_id FK, transaction_id FK,
direction ledger_direction, amount NUMERIC(20,2) CHECK (amount > 0), currency CHAR(3),
balance_before NUMERIC(20,2) CHECK (>= 0), balance_after NUMERIC(20,2) CHECK (>= 0), created_at,
UNIQUE (transaction_id, wallet_id),
CHECK ((direction='CREDIT' AND balance_after = balance_before + amount)
    OR (direction='DEBIT'  AND balance_after = balance_before - amount))
TRIGGER BEFORE UPDATE OR DELETE → RAISE EXCEPTION
INDEX (wallet_id, seq)

-- inbox_messages
consumer_name TEXT, message_id TEXT, payload_hash CHAR(64), received_at, processed_at NULL,
PRIMARY KEY (consumer_name, message_id)

-- outbox_messages
id UUID PK (= eventId), aggregate_id, event_type, payload JSONB, occurred_at,
attempts INT DEFAULT 0, next_attempt_at TIMESTAMPTZ, locked_until TIMESTAMPTZ NULL, published_at NULL
INDEX ix_outbox_pending ON (next_attempt_at) WHERE published_at IS NULL
```

---

## ✅ Critérios de Aceite

- [ ] Quando `docker compose up` for executado, postgres, localstack (filas criadas) e **3 instâncias** da app sobem saudáveis (`/health/ready` = 200).
- [ ] Quando 2 BETs de `80.00` forem processadas simultaneamente numa wallet com `100.00`, deve haver exatamente 1 `PROCESSED`, 1 `REJECTED/INSUFFICIENT_FUNDS`, saldo `20.00` e **1** lançamento `DEBIT`.
- [ ] Quando a mesma BET for enviada 50× em paralelo, deve existir 1 transação, 1 débito e 49 respostas de replay idênticas.
- [ ] Quando a mesma `Idempotency-Key` vier com payload diferente, a API deve retornar `409` sem efeito.
- [ ] Quando um `REFUND`/`ROLLBACK` chegar antes da referência, deve ficar `PENDING_REFERENCE` (`202`) e ser aplicado automaticamente quando a referência chegar; após TTL, `REJECTED/REFERENCE_NOT_FOUND`.
- [ ] Quando uma referência já tiver sido revertida, nova reversão deve ser `REJECTED/ALREADY_REVERSED`.
- [ ] Quando a mensagem SQS for reentregue (inclusive após crash pós-commit/pré-ack), nenhum efeito deve ser duplicado.
- [ ] Quando o processo morrer após commit e antes de publicar o evento, outra instância deve publicá-lo.
- [ ] Quando dois publishers rodarem sobre a mesma outbox, cada evento deve ser publicado ao menos uma vez e sem loop infinito de duplicatas.
- [ ] Quando mensagens falharem além do limite, devem ir para a DLQ.
- [ ] Quando houver tentativa de `UPDATE`/`DELETE` no ledger ou saldo negativo via SQL direto, o banco deve recusar.
- [ ] Ao final de **todo** teste: `wallet.balance == saldo reconstruído pelo ledger`.
- [ ] Nenhum `number` usado para dinheiro (verificável por lint/grep e testes de `Money`).
- [ ] `README.md` com setup/comandos e `ARCHITECTURE.md` com decisões, trade-offs e limitações.

---

## 🧩 Impacto Técnico

### Módulos / Camadas
- **Domain** (puro TS): `Money`, `Wallet`, `WagerTransaction`, `WalletLedgerEntry`, `InboxMessage`, `OutboxMessage`, eventos, erros de domínio, `FailureCode`, `WageringPolicy` (regras por kind).
- **Application**: use cases (`CreateWallet`, `ProcessWagerTransaction`, `ResolvePendingReferences`, `PublishOutbox`, `ReconcileWallet`, queries), portas (`WalletRepository`, `WagerTransactionRepository`, `LedgerRepository`, `InboxRepository`, `OutboxRepository`, `UnitOfWork`, `MessagePublisher`, `Clock`, `IdGenerator`, `ProviderIdentityPort`).
- **Infrastructure**: MikroORM (PostgreSQL), mappers, migrations, SQS client (`@aws-sdk/client-sqs`), Prometheus, Pino.
- **Interfaces**: HTTP controllers (NestJS), SQS consumer, workers agendados, `AuthGuard` no-op.

### Estrutura de Pastas Proposta
```
src/
  domain/{money,wallet,wagering,ledger,messaging,events,errors}/
  application/{use-cases,ports,dto}/
  infrastructure/{persistence/{mikro-orm,schemas,mappers,repositories,migrations},sqs,observability,config}/
  interfaces/{http/{controllers,filters,guards,pipes},sqs,workers}/
  main.ts            # APP_ROLE=all|api|consumer|outbox|resolver
test/{unit,integration,concurrency,helpers}/
docker/{localstack-init.sh}
docker-compose.yml
ARCHITECTURE.md  README.md
```

### Dependências
- `@nestjs/*`, `@mikro-orm/core`, `@mikro-orm/postgresql`, `@mikro-orm/migrations`, `@mikro-orm/nestjs`
- `decimal.js`, `uuid` (v7), `zod` (validação de DTO e config)
- `@aws-sdk/client-sqs`
- `nestjs-pino` / `pino`, `prom-client`, `@nestjs/terminus`
- Dev: `bun test`, `eslint` (+ regra custom/grep contra `number` em money), `typescript`

---

## 🧭 Plano de Implementação

> Ordem pensada para garantir primeiro os itens de maior peso (correção financeira 20, concorrência 20, idempotência 15, mensageria 15).

1. **Fase 0 — Setup**: `bun init`, NestJS, tsconfig estrito, ESLint, `docker-compose.yml` (postgres 16, localstack com script criando filas FIFO + DLQ com redrive `maxReceiveCount=5`, app com `--scale`), config validada por zod, `APP_ROLE`.
2. **Fase 1 — Domínio puro + testes de unidade**: `Money` (validação via regex `^\d+(\.\d{1,2})?$` na entrada → normaliza para 2 casas; rejeita NaN/Infinity/notação científica/vazio/>2 casas/negativo), `Wallet`, `WagerTransaction` (máquina de estados), `WalletLedgerEntry` (aritmética validada na factory), `WageringPolicy`, Inbox/Outbox, `IntegrationEvent` + 4 eventos, `payloadHash` canônico.
3. **Fase 2 — Persistência**: schema + migrations reversíveis (constraints, índices parciais, triggers), `EntitySchema`/mappers, repositórios, `UnitOfWork` com `em.transactional()` e `LockMode.PESSIMISTIC_WRITE` / `PESSIMISTIC_PARTIAL_WRITE` (SKIP LOCKED). Testes de integração de constraints.
4. **Fase 3 — Use cases + HTTP**: `CreateWallet`, `ProcessWagerTransaction`, consultas (cursor opaco = base64 de `seq`), reconciliação, exception filter com mapeamento HTTP, `AuthGuard` no-op.
5. **Fase 4 — Concorrência e idempotência**: testes 50× paralelo, cenário 100/80/80, wallets distintas em paralelo; retry limitado para erros transitórios.
6. **Fase 5 — Outbox Publisher**: lease + SKIP LOCKED, backoff, métrica de lag; testes com 2 publishers e crash antes de marcar publicado.
7. **Fase 6 — SQS Consumer**: inbox, classificação de erros, DLQ, graceful shutdown; testes de redelivery, crash pós-commit/pré-ack, DLQ.
8. **Fase 7 — Pending Reference Resolver**: worker, backoff, TTL, resolução imediata; testes fora de ordem.
9. **Fase 8 — Multi-instância e recuperação**: harness que sobe **3 processos Bun** (`Bun.spawn`) contra o mesmo Postgres/LocalStack; teste de restart com verificação de consistência final.
10. **Fase 9 — Observabilidade + Documentação**: métricas (`wager_transactions_total{status}`, `idempotent_replays_total`, `retries_total`, `dlq_messages_total`, `lock_conflicts_total`, `outbox_lag_seconds`, `processing_duration_seconds`, `reconciliation_mismatch_total`), logs com `correlationId/messageId/transactionId/walletId/providerId` (sem payload financeiro completo), `README.md`, `ARCHITECTURE.md`.
11. **Fase 10 (opcional)** — `bun run test:load` (autocannon/k6) com p50/p95/p99, taxa de erro, conflitos e outbox lag; double-entry; Keycloak real.

### Scripts `package.json`
`dev`, `start`, `build`, `lint`, `typecheck`, `migration:create`, `migration:up`, `migration:down`, `test` (unit), `test:integration`, `test:concurrency`, `test:all`, `test:load` (opcional).

### Decisões Técnicas / Pontos em Aberto
- **ORM: MikroORM** (preferencial) — UoW explícito, `transactional()`, `LockMode`, SKIP LOCKED nativo.
- **Concorrência: lock pessimista por wallet** (`FOR UPDATE`) + `version` como checagem extra + `CHECK (balance >= 0)` como última barreira. Justificativa: hot wallet com retries otimistas gera tempestade de conflitos; lock por linha é simples, determinístico e escopado à unidade de concorrência.
- **Idempotência**: `UNIQUE(idempotency_key)` + `UNIQUE(provider_id, external_transaction_id)` + snapshot do resultado na própria transação.
- **Money no banco**: `NUMERIC(20,2)` + `CHAR(3)` em colunas separadas; driver `pg` com type parser de `NUMERIC` → string.
- **Auth**: não implementar IdP; `AuthGuard` no-op + `ProviderIdentityPort`; documentar desenho com Keycloak (client credentials por provedor, `providerId` do token deve bater com o do payload).
- **Testes de integração**: usar os serviços do `docker compose` (Postgres + LocalStack reais); avaliar `testcontainers` se funcionar bem no Bun.
- ⚠️ **Em aberto**: compatibilidade de NestJS/MikroORM com Bun (decorators metadata) — validar na Fase 0; fallback documentado.
- ⚠️ **Em aberto**: confirmar interpretação "uma reversão por referência no total" (vs. por tipo).
- ⚠️ **Em aberto**: limites de TTL/tentativas do resolver (proposta: 10 tentativas / 15 min).

---

## 🧪 Testes Esperados

### Unidade
- [ ] `Money`: escala fixa 2, soma/subtração exatas (`0.10 + 0.20 = 0.30`), entradas inválidas (`NaN`, `Infinity`, `1e3`, `""`, `1.234`, `-1.00`), conflito de moeda, imutabilidade.
- [ ] `Wallet`: saldo nunca negativo, `version` inicia em 1 e só incrementa quando saldo muda, moeda divergente.
- [ ] Regras `BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK` (incluindo referência inválida, valor divergente, reversão dupla, reversão com saldo insuficiente).
- [ ] Transições de `WagerTransaction` (terminal não transiciona).
- [ ] `WalletLedgerEntry` rejeita aritmética inconsistente.
- [ ] `payloadHash` canônico estável (ordem de chaves) e idempotency key com payload divergente.

### Integração (Postgres + LocalStack reais)
- [ ] Migrations `up`/`down` e constraints (unique, check saldo, ledger imutável, reversão única).
- [ ] Atomicidade wallet + ledger + inbox + outbox (falha forçada no meio → nada persiste).
- [ ] Inbox e redelivery.
- [ ] Publishers concorrentes na mesma outbox.
- [ ] Retry e DLQ.
- [ ] Recuperação após reinicialização.

### Concorrência (paralelismo real)
- [ ] Mesma aposta 50× em paralelo → 1 débito.
- [ ] Cenário 100.00 / 2×80.00.
- [ ] Wallets distintas em paralelo (sem serialização global).
- [ ] ≥ 3 processos simultâneos.
- [ ] Worker morto depois do commit e antes do ack.
- [ ] Dois publishers sobre a mesma outbox.
- [ ] `ROLLBACK`/`REFUND` antes da referência.
- [ ] Reinício do serviço com consistência final comprovada.
- [ ] **Todos** finalizam com `assertLedgerConsistent(walletId)`.

---

## 🤖 Instruções para IA

### Objetivo Operacional
> Implemente somente o que está dentro do escopo desta spec, **fase a fase**, validando cada fase com testes antes de seguir. Em caso de dúvida (especialmente nos pontos em aberto), pergunte antes de assumir.

### O que a IA deve entregar
- Código implementado e funcional por fase
- Testes executados (unit, integração, concorrência) com saída verde
- `README.md` e `ARCHITECTURE.md` atualizados
- Resumo claro das alterações ao final de cada fase

### Observações específicas desta spec
- **Não fazer commit** sem permissão explícita do usuário.
- **Não rodar migrations** sem permissão explícita do usuário (pode criá-las).
- Não usar browser para debug visual.
- Qualquer `number` ligado a dinheiro é falha eliminatória — revisar antes de concluir cada fase.
- Testes não podem mockar Postgres/SQS nos níveis de integração e concorrência.

---

## 📁 Pós-execução da Spec

Quando o usuário pedir para executar uma spec, assim que todas as instruções da spec em questão forem concluídas, mova o arquivo da spec para a pasta `docs/executed/`.
