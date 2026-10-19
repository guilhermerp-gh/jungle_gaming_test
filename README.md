# 🎰 Distributed Wagering Processor

Serviço financeiro distribuído de processamento de apostas (`BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK`, `DEPOSIT`) com ledger imutável, garantia de idempotência persistente, concorrência segura por carteira, arquitetura orientada a eventos (Transactional Outbox e Inbox Pattern via SQS FIFO) e tolerância a falhas multi-instância com recuperação automática de workers.

> 📖 **Documentação Técnica & Arquitetura Completa:**
> * 🏛️ [**`ARCHITECTURE.md`**](ARCHITECTURE.md): Princípios de Clean Architecture, modelo contábil sem float, estratégias contra hot-wallets, outbox/inbox e autenticação Keycloak/OIDC.
> * 🧠 [**`docs/TECHNICAL_DECISIONS.md`**](docs/TECHNICAL_DECISIONS.md): Registro Aprofundado de Decisões Técnicas e Arquiteturais (ADR Compendium detalhado com 15 decisões estruturais, alternativas descartadas e trade-offs).
> * 🧪 [**`docs/TESTING.md`**](docs/TESTING.md): Guia Completo de Testes (manual da pirâmide fail-fast, concorrência, multi-instância e suíte de carga Fase 10).
> * 📊 [**`docs/BENCHMARKS.md`**](docs/BENCHMARKS.md): Relatório de benchmarks de performance (p50/p90/p95/p99), vazão (até 1.000 RPS) e resiliência sob carga da Fase 10.
> * 🗄️ [**`docs/DATABASE_SCHEMA.md`**](docs/DATABASE_SCHEMA.md): Diagrama Entidade-Relacionamento (ERD), catálogo de tabelas, dicionário de dados, constraints financeiras e triggers no PostgreSQL.

---

> 💡 **Execução Rápida via Docker:** Para iniciar todo o ambiente de forma 100% automatizada e isolada (PostgreSQL, LocalStack, Migrations e Aplicação) com um único comando, consulte a seção [Como Rodar o Projeto via Docker (#opção-a-tudo-via-docker-recomendado--zero-click)](#opção-a-tudo-via-docker-recomendado--zero-click).

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
   * 🎮 **Simulador Visual & Laboratório de Concorrência:** 👉 **http://localhost:3000/simulator** *(ou /playground)*
   * 📚 **API Documentation & Explorer (Glassmorphic):** 👉 **http://localhost:3000/docs**
   * ⚡ **Swagger UI Clássico (OpenAPI 3.0):** 👉 **http://localhost:3000/api/docs**
   * 📊 **Dashboard de Métricas & Observabilidade em Tempo Real:** 👉 **http://localhost:3000/dashboard** *(ou /metrics)*

   > 🎮 **Destaque para Avaliação — Simulador Visual e Laboratório Interativo:**
   > Ao acessar **http://localhost:3000/simulator**, você pode testar todo o ciclo financeiro visualmente (criação instantânea de jogador, depósito com normalização decimal, apostas `BET`, prêmios `WIN`, `LOSS`, estornos `REFUND`, `ROLLBACK` técnico e reconciliação contábil do ledger com tolerância zero).
   > O simulador inclui um **Laboratório de Demonstração em 1 Clique** cobrindo os cenários mais críticos do desafio Jungle Gaming:
   > * ⚡ **Cenário 1 (Hot-Wallet 100/80/80 — Seção 8):** Disparo concorrente de duas apostas de R$ 80 em saldo de R$ 100 (1 aprovada, 1 rejeitada por `INSUFFICIENT_FUNDS`, saldo final R$ 20).
   > * 🔁 **Cenário 2 (Tempestade de Replays — Seção 7):** 10 requisições simultâneas com a mesma `Idempotency-Key` (1 criação 201 e 9 replays 200 OK sem débito duplicado).
   > * 💥 **Cenário 3 (Conflito de Idempotência 409 — Seção 6.3):** Mesma chave com payload divergente bloqueada imediatamente com 409 Conflict via hash SHA-256.
   > * ⏳ **Cenário 4 (Ordem Invertida / Pending Reference — Seção 7.1):** Envio de `WIN` antes da `BET` com retenção em `202 Accepted` (`PENDING_REFERENCE`) e resolução automática pós-chegada da aposta.

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
| `GET` | `/simulator` *(alias: `/playground`)* | Não | Simulador visual interativo de jogador, carteira, ledger ao vivo e laboratório de concorrência |
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
Executa a validação completa em ordem Fail-Fast: **Lint Money $\rightarrow$ Typecheck $\rightarrow$ Todos os 157 Testes Automatizados**:
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
  Executa 57 testes cobrindo locks pessimistas (`SELECT ... FOR UPDATE`), triggers de imutabilidade do ledger, integridade de saldo, persistência de `DEPOSIT`, endpoints HTTP E2E (incluindo `POST /wallets/:id/deposit`), Transactional Outbox Publisher (`wallet-events.fifo`), SQS Consumer Worker com Inbox Pattern (`wager-transactions.fifo`, deduplicação atômica, poison pill com DLQ e graceful shutdown), o **Pending Reference Resolver** (resolução fora de ordem de `WIN` e `REFUND` que chegam antes da `BET`, múltiplos resolvers em paralelo com `FOR UPDATE SKIP LOCKED`, expiração de pendências e proteção contra dupla reversão `ALREADY_REVERSED`) e a suíte de **Observabilidade** (endpoint `/metrics` no padrão Prometheus text, propagação de `X-Correlation-Id`, incrementos de `wager_transactions_total`, `idempotent_replays_total`, `lock_conflicts_total` e `reconciliation_mismatch_total`):
  ```bash
  bun run test:integration
  ```

* **2. Testes de Alta Concorrência e Idempotência Massiva (Fase 4):**
  Executa 9 testes de estresse (311 asserções) cobrindo cenário 100/80/80, tempestade de idempotência (50x a 100x requisições simultâneas com a mesma chave), esgotamento de saldo (*hot wallet* com 100 threads), concorrência mista (BETs + WINs), isolamento em múltiplas carteiras sem deadlocks e concorrência/replay storms de depósitos via `POST /wallets/:id/deposit`:
  ```bash
  bun run test:concurrency
  ```

* **3. Testes de Multi-instância e Recuperação (Fase 8):**
  Inicia três processos Bun independentes contra o banco de teste compartilhado, envia tráfego a nós distintos e substitui uma instância no meio de um replay idempotente. Requer PostgreSQL e LocalStack ativos; os processos usam `APP_ROLE=api`, portas efêmeras e são encerrados automaticamente ao fim da suíte.
  ```bash
  bun run test:multi-instance
  ```

* **4. Testes Unitários de Domínio, Casos de Uso, Mensageria, Consumers, Resolvers e Observabilidade:**
  Executa 84 testes de regras de negócio (`WageringPolicy` para `DEPOSIT`, `BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK`), casos de uso de aplicação (incluindo `DepositUseCase`), máquina de estados das transações, publicador SQS FIFO, consumidor SQS com Inbox Pattern e DLQ, worker e use case de resolução de pendências de referência com backoff exponencial e jitter, expiração por 10 tentativas / TTL de 15 minutos, métricas do Prometheus (`WageringMetrics`), rastreamento com `CorrelationContext` e aritmética do objeto `Money`:
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

O projeto oferece suporte de primeira classe a dois modos de execução: **100% via Docker** (Zero-Click, sem depender do runtime da máquina host) ou **via comando Bun diretamente no Host** (desenvolvimento ágil com live-reload):

---

### Opção A: Tudo via Docker (Recomendado / Zero-Click)

Nesta opção, **absolutamente tudo** (PostgreSQL, LocalStack SQS, Migrations automáticas e a Aplicação) roda em containers Docker isolados com 1 único comando:

1. **Subir toda a aplicação e infraestrutura:**
   ```bash
   bun run docker:up
   # ou diretamente com rebuild:
   docker compose up -d --build
   ```
   * **Fluxo 100% Automático:** O Docker Compose aguarda o PostgreSQL ficar saudável (`pg_isready`), executa o container `migration` automaticamente (`bun run migration:up`), e somente após a conclusão com sucesso das migrations inicializa o container `app`.
   * **Persistência de Dados:** O banco utiliza o volume `postgres_data`, preservando tabelas e saldos entre reinicializações.
   * **Porta Exposta:** A aplicação estará disponível imediatamente em [http://localhost:3000](http://localhost:3000).

2. **Derrubar os containers mantendo os dados salvos:**
   ```bash
   bun run docker:down
   # ou:
   docker compose down
   ```

3. **(Opcional) Reset total com limpeza de banco/volumes:**
   ```bash
   docker compose down -v
   ```

4. **Executar a suíte de testes completa dentro do Docker:**
   ```bash
   bun run docker:test
   # ou diretamente via docker compose:
   docker compose run --rm test
   ```

5. **Executar o teste de carga / benchmarks dentro do Docker:**
   ```bash
   bun run docker:load
   # ou:
   docker compose run --rm test bun run test:load --quick
   ```

---

### Opção B: Desenvolvimento Local via Comando Bun (Host)

Nesta opção, a aplicação roda nativamente no seu terminal com live-reload (`--watch`), utilizando o Docker apenas para os serviços de infraestrutura (Postgres e LocalStack):

1. **Subir a infraestrutura de apoio no Docker:**
   ```bash
   bun run docker:infra
   # ou diretamente:
   docker compose up -d postgres localstack
   ```
   * **PostgreSQL:** Porta `5432` (`wager:wager`, banco `wager`).
   * **LocalStack:** Porta `4566` (filas FIFO e DLQ provisionadas automaticamente).

2. **Aplicar as migrations no banco (caso o banco seja novo):**
   ```bash
   bun run migration:up
   ```

3. **Iniciar a aplicação no host (com watch/live-reload):**
   ```bash
   bun run dev
   ```
   *A aplicação iniciará na porta `3000` (definida via `PORT` no `.env`).*

4. **Verificar se o serviço está ativo:**
   ```bash
   curl http://localhost:3000/health/live
   # Resposta esperada: {"status":"ok"}
   ```

5. **Executar testes no host:**
   ```bash
   bun run test:all
   # ou com o pipeline rigoroso de qualidade (lint + typecheck + testes):
   bun run check
   ```

6. **Executar teste de carga no host:**
   ```bash
   bun run test:load --quick
   ```

---

### 📊 Guia Rápido de Comandos: Docker vs Bun

| Tarefa / Operação | 🐳 Via Docker (Container) | ⚡ Via Bun (Host) |
| :--- | :--- | :--- |
| **Subir Aplicação Completa** | `bun run docker:up` *(ou `docker compose up -d --build`)* | `bun run dev` *(requer `bun run docker:infra`)* |
| **Parar Aplicação** | `bun run docker:down` *(ou `docker compose down`)* | `Ctrl + C` no terminal |
| **Aplicar Migrations** | Automático no `docker:up` *(ou `docker compose run --rm migration`)* | `bun run migration:up` |
| **Reverter Migrations** | `docker compose run --rm migration bun run scripts/migrate.ts down` | `bun run migration:down` |
| **Executar Suíte de Testes** | `bun run docker:test` *(ou `docker compose run --rm test`)* | `bun run test:all` |
| **Pipeline Completo (Check)** | `bun run docker:check` | `bun run check` |
| **Teste de Carga (Benchmark)** | `bun run docker:load` | `bun run test:load --quick` |
| **Rebuild de Imagens / Deps** | `bun run docker:build` *(ou `docker compose build`)* | `bun install` |

---

### 🧪 Como funcionam os Testes com Docker?

O projeto oferece suporte de primeira classe a **duas estratégias de teste**, ambas com 100% de cobertura e aprovação:

| Estratégia | Como Executar | Quando Usar | Vantagens |
| :--- | :--- | :--- | :--- |
| **Infra no Docker + Testes no Host** *(Recomendado para Dev)* | `bun run docker:infra`<br>`bun run test:all` | Desenvolvimento ativo local | Feedback instantâneo (~400ms unitários, ~15s pipeline completa), sem rebuild de imagem, facilidade de debugging no editor. |
| **Tudo no Docker (Container de Teste)** *(Recomendado para CI/CD)* | `bun run docker:test`<br>`docker compose run --rm test` | Validação antes de push e pipelines CI/CD | Paridade 100% com ambiente de produção Linux, isolamento completo de dependências do host, sem necessidade de Bun instalado na máquina. |

> **Nota Técnica sobre Multi-Instância:** Os testes de multi-instância (`test/multi-instance`) realizam `Bun.spawn` de múltiplos processos em paralelo, alocando portas dinâmicas e simulando crashes via `SIGTERM`/`SIGKILL`. Esse mecanismo funciona perfeitamente **tanto no host quanto dentro do container Docker**, pois os processos filhos compartilham o network namespace do container e utilizam o loopback `127.0.0.1` internamente enquanto comunicam com `postgres:5432` e `localstack:4566`.



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
├── interfaces/              # Controllers HTTP, Consumers SQS, Workers e Views SSR (/docs, /dashboard, /simulator)
└── main.ts                  # Ponto de entrada do NestJS com seleção de APP_ROLE

test/
├── unit/                    # Testes unitários de domínio e aplicação (84 testes)
├── integration/             # Testes de integração Postgres, HTTP, SQS e Resolver (57 testes)
├── concurrency/             # Testes de alta concorrência e estresse (9 testes)
├── multi-instance/          # Testes multi-instância e recuperação distribuída (7 testes)
├── fixtures/                # Fixtures para testes de falha determinísticos
└── helpers/                 # Harness de Bun.spawn, healthcheck e utilitários de banco
```
