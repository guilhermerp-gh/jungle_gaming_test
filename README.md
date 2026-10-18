# 🎰 Distributed Wagering Processor

Serviço financeiro distribuído de processamento de apostas (`BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK`, `DEPOSIT`) com ledger imutável, garantia de idempotência persistente, concorrência segura por carteira e arquitetura orientada a eventos (Transactional Outbox e Inbox Pattern via SQS FIFO).

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
   1. **`POST /wallets`**: Crie uma carteira com saldo inicial (ex.: R$ 20,00). Copie o `id` da carteira retornado.
   2. **`GET /wallets/{id}`**: Consulte a carteira pelo `id` para ver o saldo e a versão inicial.
   3. **`POST /wallets/{id}/deposit`**: Faça um depósito de fundos (ex.: R$ 50,00) com header `Idempotency-Key` (ex.: `dep-001`). O saldo sobe para R$ 70,00 (`201 Created`), gerando lançamento `CREDIT` no ledger e evento Outbox. Replays com a mesma chave retornam `200 OK` com `"idempotentReplay": true` e mensagem informativa sem creditar novamente!
   4. **`POST /transactions`**: Faça uma aposta `BET` de R$ 10,00 informando um `Idempotency-Key` (ex.: `req-001`). O saldo restante passará para R$ 60,00 (`201 Created`). Os eventos contábeis são gerados na outbox e despachados para a fila SQS FIFO.
   5. **`POST /transactions` (Idempotência / Replay)**: Clique em *Execute* novamente sem alterar nada (mesma chave e mesmo corpo). O retorno será `200 OK` com `"idempotentReplay": true` e a mensagem explicativa `"Replay de Idempotência: esta aposta já foi processada anteriormente. O saldo não foi debitado novamente."`, sem alterar o saldo ou duplicar lançamentos.
   6. **`POST /transactions` (Estorno ou Prêmio)**:
      * **Estorno (`REFUND`)**: Estorne a aposta com `REFUND` de R$ 10,00 referenciando a aposta (saldo retorna para R$ 70,00). Se repetir a mesma requisição, recebe `200 OK` de replay com aviso claro. Se tentar realizar um *novo* estorno para a mesma aposta, o sistema bloqueia com `422 Unprocessable Entity` (`ALREADY_REVERSED`) acompanhado de metadados de auditoria em `details` (ID do estorno original, data e valor).
      * **Prêmio (`WIN`)**: Ou credite um prêmio `WIN` de R$ 50,00 com nova chave (`req-002`), elevando o saldo para R$ 110,00.
   7. **`GET /wallets/{id}/ledger`**: Obtenha o extrato contábil paginado com o histórico de todos os lançamentos.
   8. **`POST /wallets/{id}/reconciliation`**: Dispare a reconciliação matemática da carteira para comprovar que `consistent: true` e `difference: "0.00"`.
   9. **`GET /dashboard`**: Acesse o painel de métricas para conferir os eventos entregues no SQS FIFO (`events_published_total`), o lag da outbox zerado (`outbox_lag_seconds`), as mensagens consumidas pelo worker SQS FIFO com Inbox deduplication (`sqs_messages_consumed_total`) e o monitoramento do Pending Reference Resolver (`pending_references_active_gauge`, `pending_references_resolved_total`).

---

## 📌 Guia de Endpoints da API

| Método | Endpoint | Idempotency-Key | Descrição |
| :--- | :--- | :---: | :--- |
| `POST` | `/wallets` | Não | Criação de carteira para um jogador (`playerId`, `currency`, `initialBalance`) |
| `GET` | `/wallets/:id` | Não | Consulta de saldo e metadados da carteira |
| `POST` | `/wallets/:id/deposit` | **Sim** | Depósito de saldo com lock pessimista, ledger `CREDIT` e garantia de idempotência estrita |
| `POST` | `/wallets/:id/reconciliation` | Não | Reconciliação matemática do saldo armazenado contra o somatório auditável do ledger |
| `GET` | `/wallets/:id/ledger` | Não | Extrato contábil imutável com paginação baseada em cursor base64 (`limit`, `cursor`) |
| `POST` | `/transactions` | **Sim** | Processamento de transações (`BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK`) |
| `GET` | `/transactions/:id` | Não | Consulta de transação por identificador interno UUID |
| `GET` | `/transactions/external/:providerId/:externalId` | Não | Consulta de transação por provedor e ID externo |
| `GET` | `/health/live` | Não | Liveness probe do serviço HTTP |
| `GET` | `/metrics` / `/dashboard` | Não | Painel de telemetria e métricas Prometheus / HTML em tempo real |
| `GET` | `/docs` | Não | Documentação interativa moderna da API com console de testes |
| `GET` | `/api/docs` | Não | Swagger UI OpenAPI 3.0 |

---

## 🧪 Como Rodar os Testes

O projeto conta com validações estritas de tipagem, regras financeiras e testes automatizados organizados em pirâmide fail-fast:

### 🚀 Validação Completa de Ponta a Ponta (Recomendado)
Executa a validação completa em ordem Fail-Fast: **Lint Money $\rightarrow$ Typecheck $\rightarrow$ Todos os 118 Testes Automatizados**:
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

* **1. Testes de Integração (PostgreSQL Real, API HTTP, LocalStack SQS FIFO e Pending Reference Resolver):**
  Executa 44 testes cobrindo locks pessimistas (`SELECT ... FOR UPDATE`), triggers de imutabilidade do ledger, integridade de saldo, persistência de `DEPOSIT`, endpoints HTTP E2E (incluindo `POST /wallets/:id/deposit`), Transactional Outbox Publisher (`wallet-events.fifo`), SQS Consumer Worker com Inbox Pattern (`wager-transactions.fifo`, deduplicação atômica, poison pill com DLQ e graceful shutdown) e o **Pending Reference Resolver** (resolução fora de ordem de `WIN` e `REFUND` que chegam antes da `BET`, múltiplos resolvers em paralelo com `FOR UPDATE SKIP LOCKED`, expiração de pendências e proteção contra dupla reversão `ALREADY_REVERSED`):
  ```bash
  bun run test:integration
  ```

* **2. Testes de Alta Concorrência e Idempotência Massiva (Fase 4):**
  Executa 9 testes de estresse (340 asserções) cobrindo cenário 100/80/80, tempestade de idempotência (50x a 100x requisições simultâneas com a mesma chave), esgotamento de saldo (*hot wallet* com 100 threads), concorrência mista (BETs + WINs), isolamento em múltiplas carteiras sem deadlocks e concorrência/replay storms de depósitos via `POST /wallets/:id/deposit`:
  ```bash
  bun run test:concurrency
  ```

* **3. Testes Unitários de Domínio, Casos de Uso, Mensageria, Consumers e Resolvers:**
  Executa 65 testes de regras de negócio (`WageringPolicy` para `DEPOSIT`, `BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK`), casos de uso de aplicação (incluindo `DepositUseCase`), máquina de estados das transações, publicador SQS FIFO, consumidor SQS com Inbox Pattern e DLQ, worker e use case de resolução de pendências de referência com backoff exponencial e jitter, expiração por 10 tentativas / TTL de 15 minutos e aritmética do objeto `Money`:
  ```bash
  bun run test
  ```

* **4. Validação Estrita de Valores Monetários (Lint Money):**
  Garante que nenhum `number`, `float` ou `parseFloat` seja utilizado para valores financeiros:
  ```bash
  bun run lint:money
  ```

* **5. Checagem de Tipagem Estrita (Typecheck):**
  Executa a validação de tipos do TypeScript (`strict: true`, `noUncheckedIndexedAccess`):
  ```bash
  bun run typecheck
  ```

* **6. Checagem Completa de Qualidade (Lint Geral + Money + Types + Testes):**
  ```bash
  bun run check
  ```

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
```
