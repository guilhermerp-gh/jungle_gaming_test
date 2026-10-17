# 🎰 Distributed Wagering Processor

Serviço financeiro distribuído de processamento de apostas (`BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK`) com ledger imutável, garantia de idempotência persistente, concorrência segura por carteira e arquitetura orientada a eventos (Transactional Outbox e Inbox Pattern via SQS FIFO).

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

4. **Documentação Interativa Swagger / OpenAPI:**
   Com o servidor ativo, acesse pelo navegador para explorar e testar todos os endpoints visualmente:
   👉 **http://localhost:3000/api/docs**

   #### 🕹️ Ordem de Execução Recomendada (Passo a Passo Interativo):
   1. **`POST /wallets`**: Crie uma carteira com saldo inicial (ex.: R$ 100,00). Copie o `id` da carteira retornado.
   2. **`GET /wallets/{id}`**: Consulte a carteira pelo `id` para ver o saldo e a versão inicial.
   3. **`POST /transactions`**: Faça uma aposta `BET` de R$ 30,00 informando um `Idempotency-Key` (ex.: `req-001`). O saldo restante passará para R$ 70,00 (`201 Created`).
   4. **`POST /transactions` (Idempotência)**: Clique em *Execute* novamente sem alterar nada (mesma chave e mesmo corpo). O retorno será `200 OK` com `"idempotentReplay": true`, sem debitar a carteira novamente!
   5. **`POST /transactions`**: Credite um prêmio `WIN` de R$ 50,00 com nova chave (`req-002`), elevando o saldo para R$ 120,00.
   6. **`GET /wallets/{id}/ledger`**: Obtenha o extrato contábil paginado com o histórico de todos os lançamentos.
   7. **`POST /wallets/{id}/reconciliation`**: Dispare a reconciliação matemática da carteira para comprovar que `consistent: true` e `difference: "0.00"`.

---

## 🧪 Como Rodar os Testes

O projeto conta com validações estritas de tipagem, regras financeiras e testes automatizados organizados em pirâmide fail-fast:

### 🚀 Validação Completa de Ponta a Ponta (Recomendado)
Executa a validação completa em ordem Fail-Fast: **Lint Money $\rightarrow$ Typecheck $\rightarrow$ Todos os 76 Testes Automatizados**:
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

* **1. Testes de Integração (PostgreSQL Real e API HTTP):**
  Executa 28 testes cobrindo locks pessimistas (`SELECT ... FOR UPDATE`), triggers de imutabilidade do ledger, integridade de saldo, reversão única e endpoints HTTP E2E:
  ```bash
  bun run test:integration
  ```

* **2. Testes de Alta Concorrência e Idempotência Massiva (Fase 4):**
  Executa 7 testes de estresse (290 asserções) cobrindo cenário 100/80/80, tempestade de idempotência (50x a 100x requisições simultâneas com a mesma chave), esgotamento de saldo (*hot wallet* com 100 threads), concorrência mista (BETs + WINs) e isolamento em múltiplas carteiras sem deadlocks:
  ```bash
  bun run test:concurrency
  ```

* **3. Testes Unitários de Domínio e Casos de Uso:**
  Executa 41 testes de regras de negócio, casos de uso de aplicação, máquina de estados das transações, cálculo de hash de idempotência e aritmética do objeto `Money`:
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
