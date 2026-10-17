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

---

## 🧪 Como Rodar os Testes

O projeto conta com validações estritas de tipagem, regras financeiras e testes automatizados:

### 1. Testes Unitários de Domínio
Executa todos os testes de regras de negócio, máquina de estados das transações, cálculo de hash de idempotência e aritmética do objeto `Money`:
```bash
bun test test/unit
# ou
bun test
```

### 2. Validação Estrita de Valores Monetários (Lint Money)
Garante que nenhum `number`, `float` ou `parseFloat` seja utilizado para valores financeiros (regra eliminatória da spec):
```bash
bun run lint:money
```

### 3. Checagem de Tipagem Estrita
Executa a validação de tipos do TypeScript (`strict: true`, `noUncheckedIndexedAccess`):
```bash
bun run typecheck
```

### 4. Linter de Código
Valida formatação e integridade arquitetural (impede que o domínio importe frameworks):
```bash
bun run lint
```

### 5. Demais Suítes (Fases de Integração/Concorrência)
```bash
bun run test:integration  # Testes com Postgres e LocalStack reais
bun run test:concurrency  # Testes de alta concorrência em paralelo
bun run test:all          # Executa todas as suítes
```

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
