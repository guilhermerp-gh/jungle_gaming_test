# 🎰 Distributed Wagering Processor

Serviço financeiro distribuído de processamento de apostas (`BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK`, `DEPOSIT`) com ledger imutável, garantia de idempotência persistente, concorrência segura por carteira, arquitetura orientada a eventos (Transactional Outbox e Inbox Pattern via SQS FIFO) e tolerância a falhas multi-instância com recuperação automática de workers.

> 📖 **Documentação Técnica & Arquitetura Completa:**
> * 🏛️ [**`ARCHITECTURE.md`**](ARCHITECTURE.md): Princípios de Clean Architecture, modelo contábil sem float, estratégias contra hot-wallets, outbox/inbox e autenticação Keycloak/OIDC.
> * 🧪 [**`docs/TESTING.md`**](docs/TESTING.md): Guia Completo de Testes (manual da pirâmide fail-fast, concorrência, multi-instância e suíte de carga Fase 10).
> * 📊 [**`docs/BENCHMARKS.md`**](docs/BENCHMARKS.md): Relatório de benchmarks de performance (p50/p90/p95/p99), vazão (até 1.000 RPS) e resiliência sob carga da Fase 10.
> * 🗄️ [**`docs/DATABASE_SCHEMA.md`**](docs/DATABASE_SCHEMA.md): Diagrama Entidade-Relacionamento (ERD), catálogo de tabelas, dicionário de dados, constraints financeiras e triggers no PostgreSQL.

---

## 📋 Pré-requisitos

Antes de iniciar, certifique-se de ter instalado em sua máquina:

1. **[Bun](https://bun.sh/)** (versão `>= 1.1`):
   ```bash
   # Instalação (macOS/Linux):
   curl -fsSL https://bun.sh/install | bash
   ```
   *Certifique-se de que o Bun está no seu `PATH` (`export PATH="$HOME/.bun/bin:$PATH"`).*

2. **[Docker](https://www.docker.com/)** e **Docker Compose**:
   * Necessário para rodar o PostgreSQL 16 e o LocalStack (simulador AWS SQS).

---

## 🚀 Instalação e Configuração

1. **Instale as dependências:**
   ```bash
   bun install
   ```

2. **Variáveis de Ambiente:**
   Copie o arquivo de exemplo caso deseje personalizar configurações locais:
   ```bash
   cp .env.example .env
   ```
   *(Inclui suporte a `INSTANCE_ID=local` para identificação de nós e rastreabilidade em logs).*

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   bun run dev
   ```

4. **Portais Web e Documentação Interativa:**
   Com o servidor ativo, acesse pelo navegador:
   * 🏠 **Portal Principal de Navegação:** 👉 **http://localhost:3000/**
   * 📚 **API Documentation & Explorer (Glassmorphic):** 👉 **http://localhost:3000/docs**
   * ⚡ **Swagger UI Clássico (OpenAPI 3.0):** 👉 **http://localhost:3000/api/docs**
   * 📊 **Dashboard de Métricas & Observabilidade em Tempo Real:** 👉 **http://localhost:3000/dashboard** *(ou /metrics)*

   #### 🕹️ Ordem de Execução Recomendada (Passo a Passo Interativo):
   1. **`POST /wallets`**: Crie uma carteira informando um `playerId` (UUID válido, ex.: `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`), moeda `currency: "BRL"` e saldo inicial `initialBalance: "20.00"`. Copie o `id` da carteira retornado.
   2. **`GET /wallets/{id}`**: Consulte a carteira pelo `id` para ver o saldo e a versão inicial.
   3. **`POST /wallets/{id}/deposit`**: Faça um depósito de fundos (`{"amount": "50.00"}`) com header `Idempotency-Key` (ex.: `dep-001`). O saldo sobe para R$ 70,00 (`201 Created`), gerando lançamento `CREDIT` no ledger e evento Outbox. Replays com a mesma chave retornam `200 OK` com `"idempotentReplay": true` e mensagem informativa sem creditar novamente!
   4. **`POST /wagering/transactions`** *(ou `/transactions`)*: Faça uma aposta `BET` de R$ 10,00 informando `Idempotency-Key: req-001`, `providerId: "evolution"`, `externalTransactionId: "tx-ext-001"`, `kind: "BET"`, `money: { "amount": "10.00", "currency": "BRL" }` (ou formato plano `amount`/`currency`), `roundId: "round-1"`, `gameId: "roulette"` e o `walletId`/`playerId`. O saldo passará para R$ 60,00 (`201 Created`), retornando tanto `transactionId` quanto `balance: { amount, currency }`.
   5. **`POST /wagering/transactions` (Idempotência / Replay)**: Clique em *Execute* novamente sem alterar nada (mesma chave e mesmo corpo). O retorno será `200 OK` com `"idempotentReplay": true` e a mensagem explicativa `"Replay de Idempotência: esta aposta já foi processada anteriormente. O saldo não foi debitado novamente."`, sem alterar o saldo ou duplicar lançamentos.
   6. **`POST /wagering/transactions` (Estorno ou Prêmio)**:
      * **Estorno (`REFUND`)**: Estorne a aposta com `kind: "REFUND"` de R$ 10,00 referenciando `referenceExternalTransactionId: "tx-ext-001"` (saldo retorna para R$ 70,00). Se repetir a mesma requisição, recebe `200 OK` de replay com aviso claro. Se tentar realizar um *novo* estorno para a mesma aposta, o sistema bloqueia com `422 Unprocessable Entity` (`ALREADY_REVERSED`) acompanhado de metadados de auditoria em `details` (ID do estorno original, data e valor).
      * **Prêmio (`WIN`)**: Ou credite um prêmio `kind: "WIN"` de R$ 50,00 com nova chave (`req-002`), elevando o saldo para R$ 110,00.
   7. **`GET /wallets/{id}/ledger`**: Obtenha o extrato contábil paginado com o histórico de todos os lançamentos.
   8. **`POST /wallets/{id}/reconciliation`**: Dispare a reconciliação matemática da carteira para comprovar que `consistent: true` e `difference: "0.00"`.
   9. **`GET /dashboard`**: Acesse o painel de métricas para conferir os eventos entregues no SQS FIFO (`events_published_total`), o lag da outbox zerado (`outbox_lag_seconds`), as mensagens consumidas pelo worker SQS FIFO com Inbox deduplication (`sqs_messages_consumed_total`) e o monitoramento do Pending Reference Resolver (`pending_references_active_gauge`, `pending_references_resolved_total`).

---

## 📌 Guia de Endpoints da API

| Método | Endpoint | Idempotency-Key | Descrição |
| :--- | :--- | :---: | :--- |
| `POST` | `/wallets` | Não | Criação de carteira para um jogador (`playerId`, `currency`, `initialBalance` em string ou objeto `{ amount, currency }`) |
| `GET` | `/wallets/:id` | Não | Consulta de saldo e metadados da carteira |
| `POST` | `/wallets/:id/deposit` | **Sim** | Depósito de saldo com lock pessimista, ledger `CREDIT` e garantia de idempotência estrita |
| `POST` | `/wallets/:id/reconciliation` | Não | Reconciliação matemática do saldo armazenado contra o somatório auditável do ledger |
| `GET` | `/wallets/:id/ledger` | Não | Extrato contábil imutável com paginação baseada em cursor base64 (`limit`, `cursor`) |
| `POST` | `/wagering/transactions` *(alias: `/transactions`)* | **Sim** | Processamento de transações (`BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK`) com suporte a `money: { amount, currency }` ou campos planos |
| `GET` | `/wagering/transactions/:transactionId` *(alias: `/transactions/:id`)* | Não | Consulta de transação por identificador interno UUID |
| `GET` | `/providers/:providerId/wagering/transactions/:externalTransactionId` | Não | Rota canônica Jungle Gaming de consulta por provedor e ID externo (alias legado: `/transactions/external/:providerId/:externalId`) |
| `GET` | `/health/live` | Não | Liveness probe do serviço HTTP |
| `GET` | `/metrics` / `/dashboard` | Não | Painel de telemetria e métricas Prometheus / HTML em tempo real |
| `GET` | `/docs` | Não | Documentação interativa moderna da API com console de testes |
| `GET` | `/api/docs` | Não | Swagger UI OpenAPI 3.0 |

> 💡 **Rastreabilidade de Ponta a Ponta:** Todos os endpoints suportam o header opcional `X-Correlation-Id`. Se omitido, a aplicação gera automaticamente um UUID v7 e o retorna no header da resposta, associando-o a toda a árvore de logs estruturados em JSON.

---

## 📊 Observabilidade, Métricas Prometheus & Logs

### Métricas Padronizadas (`GET /metrics`)

O serviço exporta métricas Prometheus oficiais para coletores e scrapers automáticos:

* `wager_transactions_total{status, kind}`: Contagem de operações por status (`PROCESSED`, `REJECTED`, `PENDING_REFERENCE`, `FAILED`) e tipo (`BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK`, `DEPOSIT`, `OPENING`).
* `idempotent_replays_total{kind, source}`: Contagem de replays de idempotência atendidos sem efeito financeiro duplicado.
* `retries_total{operation}`: Retentativas executadas por workers de outbox, resolver ou retries de concorrência.
* `lock_conflicts_total{resource}`: Conflitos de lock pessimista mitigados na carteira (`ConcurrencyConflictError`).
* `outbox_lag_seconds`: Gauge da defasagem temporal entre o evento não publicado mais antigo e o momento atual.
* `processing_duration_seconds{operation, status}`: Histograma de latência das operações contábeis.
* `reconciliation_mismatch_total`: Contador de inconsistências contábeis identificadas na reconciliação de carteiras.
* `sqs_messages_consumed_total{consumer, status}`: Mensagens consumidas da fila SQS via Inbox Pattern.
* `dlq_messages_total{consumer, reason}`: Mensagens inválidas/envenenadas encaminhadas para a DLQ.

### Logs Estruturados JSON via Pino

Os logs da aplicação são emitidos em formato JSON no `stdout`, incluindo sistematicamente `correlationId`, `instanceId`, `walletId`, `transactionId` e `providerId`, mantendo sanitização estrita para proteger payloads financeiros.

---

## 🧪 Como Rodar os Testes

> 📖 **Guia Passo a Passo & Tutorial Completo:** Consulte o documento [**`docs/TESTING.md`**](docs/TESTING.md) para o tutorial aprofundado cobrindo a pirâmide fail-fast, cenários de concorrência, recuperação multi-instância e a suíte de carga da Fase 10.

O projeto conta com validações estritas de tipagem, regras financeiras e testes automatizados organizados em pirâmide fail-fast:

### 🚀 Validação Completa de Ponta a Ponta (Recomendado)
Executa a validação completa em ordem Fail-Fast: **Lint Money $\rightarrow$ Typecheck $\rightarrow$ Todos os 142 Testes Automatizados**:
```bash
bun run test:all
```
*(Você também pode usar o alias `bun run test:pipeline` ou o comando `/run-tests` no chat).*

---

### 🧪 Execuções Segmentadas

* **Executar Apenas as Suítes de Teste (sem lint/typecheck):**
  ```bash
  bun run test:suites
  ```

* **1. Testes de Integração (PostgreSQL Real, API HTTP, LocalStack SQS FIFO, Pending Reference Resolver e Observabilidade):**
  Executa 50 testes cobrindo locks pessimistas (`SELECT ... FOR UPDATE`), triggers de imutabilidade do ledger, integridade de saldo, persistência de `DEPOSIT`, endpoints HTTP E2E (incluindo `POST /wallets/:id/deposit`), Transactional Outbox Publisher (`wallet-events.fifo`), SQS Consumer Worker com Inbox Pattern (`wager-transactions.fifo`, deduplicação atômica, poison pill com DLQ e graceful shutdown), o **Pending Reference Resolver** (resolução fora de ordem de `WIN` e `REFUND` que chegam antes da `BET`, múltiplos resolvers em paralelo com `FOR UPDATE SKIP LOCKED`, expiração de pendências e proteção contra dupla reversão `ALREADY_REVERSED`) e a suíte de **Observabilidade** (endpoint `/metrics` no padrão Prometheus text, propagação de `X-Correlation-Id`, incrementos de `wager_transactions_total`, `idempotent_replays_total`, `lock_conflicts_total` e `reconciliation_mismatch_total`):
  ```bash
  bun run test:integration
  ```

* **2. Testes de Alta Concorrência e Idempotência Massiva (Fase 4):**
  Executa 9 testes de estresse (340 asserções) cobrindo cenário 100/80/80, tempestade de idempotência (50x a 100x requisições simultâneas com a mesma chave), esgotamento de saldo (*hot wallet* com 100 threads), concorrência mista (BETs + WINs), isolamento em múltiplas carteiras sem deadlocks e concorrência/replay storms de depósitos via `POST /wallets/:id/deposit`:
  ```bash
  bun run test:concurrency
  ```

* **3. Testes de Multi-instância e Recuperação (Fase 8):**
  Inicia três processos Bun independentes contra o banco de teste compartilhado, envia tráfego a nós distintos e substitui uma instância no meio de um replay idempotente. Requer PostgreSQL e LocalStack ativos; os processos usam `APP_ROLE=api`, portas efêmeras e são encerrados automaticamente ao fim da suíte.
  ```bash
  bun run test:multi-instance
  ```

* **4. Testes Unitários de Domínio, Casos de Uso, Mensageria, Consumers, Resolvers e Observabilidade:**
  Executa 76 testes de regras de negócio (`WageringPolicy` para `DEPOSIT`, `BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK`), casos de uso de aplicação (incluindo `DepositUseCase`), máquina de estados das transações, publicador SQS FIFO, consumidor SQS com Inbox Pattern e DLQ, worker e use case de resolução de pendências de referência com backoff exponencial e jitter, expiração por 10 tentativas / TTL de 15 minutos, métricas do Prometheus (`WageringMetrics`), rastreamento com `CorrelationContext` e aritmética do objeto `Money`:
  ```bash
  bun run test
  ```

* **5. Validação Estrita de Valores Monetários (Lint Money):**
  Garante que nenhum `number`, `float` ou `parseFloat` seja utilizado para valores financeiros:
  ```bash
  bun run lint:money
  ```

* **6. Checagem de Tipagem Estrita (Typecheck):**
  Executa a validação de tipos do TypeScript (`strict: true`, `noUncheckedIndexedAccess`):
  ```bash
  bun run typecheck
  ```

* **7. Checagem Completa de Qualidade (Lint Geral + Money + Types + Testes):**
  ```bash
  bun run check
  ```

* **8. Testes de Carga & Benchmarking de Performance (Fase 10):**
  Submete a aplicação a testes de alta vazão e estresse concorrente via `autocannon`, medindo throughput (RPS), latência percentilar (**p50, p90, p97.5, p99**) e auditoria contábil pós-estresse com tolerância zero em 4 cenários (Alta Dispersão, Hot-Wallet Saturation, Avalanche de Replays e Carga Mista). *(Requer a aplicação em execução via `bun run dev` ou `docker compose up`)*:
  ```bash
  bun run test:load
  ```
  *(Opções suportadas: `--duration <segundos>`, `--connections <n>`, `--quick` ou `--ci`).*

---

## 🗄️ Banco de Dados e Migrações

### Aplicar Migrações no PostgreSQL
Para criar as tabelas, triggers e constraints no banco:
```bash
bun run migration:up
```

Para reverter a última migração:
```bash
bun run migration:down
```

### Conexão Externa (Postico, DBeaver, TablePlus)
Com o PostgreSQL ativo via Docker, conecte-se utilizando:
* **URL:** `postgres://wager:wager@localhost:5432/wager`
* **Host:** `localhost` | **Porta:** `5432`
* **Usuário / Senha:** `wager` / `wager`
* **Database:** `wager`

---

## 💻 Como Rodar o Projeto

### Opção 1: Desenvolvimento Local

1. **Inicie o servidor da aplicação:**
   ```bash
   bun run dev
   ```
   *A aplicação iniciará na porta `3000` (definida via `PORT` no `.env`).*

2. **Verifique se o serviço está ativo:**
   Em outro terminal, execute:
   ```bash
   curl http://localhost:3000/health/live
   ```
   **Resposta esperada:**
   ```json
   {"status":"ok"}
   ```

---

### Opção 2: Subindo a Infraestrutura com Docker

Para subir o banco de dados e os serviços de fila locais:

1. **Subir apenas Postgres e LocalStack:**
   ```bash
   docker compose up -d postgres localstack
   ```
   * **PostgreSQL:** Porta `5432` (`wager:wager`, banco `wager`).
   * **LocalStack:** Porta `4566` (com filas FIFO `wager-transactions.fifo`, `wallet-events.fifo` e a DLQ `wager-transactions-dlq.fifo` criadas automaticamente).

2. **Subir toda a aplicação (Postgres + LocalStack + 3 réplicas do App):**
   ```bash
   docker compose up --build
   ```
   * As réplicas do app serão expostas nas portas `3000`, `3001` e `3002`.

---

## 📁 Estrutura do Projeto

```text
src/
├── domain/                  # Domínio puro (Typescript sem dependências externas)
│   ├── money/               # Value Object Money (sem tipo number)
│   ├── wallet/              # Aggregate Wallet
│   ├── wagering/            # WagerTransaction, WageringPolicy, PayloadHash
│   ├── ledger/              # WalletLedgerEntry (livro-razão imutável)
│   ├── messaging/           # InboxMessage e OutboxMessage
│   ├── events/              # Eventos de integração de domínio
│   └── errors/              # Catálogo de FailureCode e erros de domínio
├── application/             # Casos de uso e portas de entrada/saída (Hexagonal)
├── infrastructure/          # Config, MikroORM, Postgres, SQS e Observabilidade
├── interfaces/              # Controllers HTTP, Consumers SQS e Workers
└── main.ts                  # Ponto de entrada do NestJS com seleção de APP_ROLE

test/
├── unit/                    # Testes unitários de domínio e aplicação (76 testes)
├── integration/             # Testes de integração Postgres, HTTP, SQS e Resolver (50 testes)
├── concurrency/             # Testes de alta concorrência e estresse (9 testes)
├── multi-instance/          # Testes multi-instância e recuperação distribuída (7 testes)
├── fixtures/                # Fixtures para testes de falha determinísticos
└── helpers/                 # Harness de Bun.spawn, healthcheck e utilitários de banco
```
