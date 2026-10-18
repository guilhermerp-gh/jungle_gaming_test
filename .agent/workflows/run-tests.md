---
description: Executa a pipeline completa de testes em ordem piramidal Fail-Fast (Lint Money -> Typecheck -> Unit -> Integration -> Concurrency) com diagnóstico automático.
---

## 🧪 Pipeline de Testes (Fail-Fast)

Este workflow garante a integridade de todas as camadas do sistema seguindo a pirâmide de testes: os testes mais rápidos e rigorosos executam primeiro, abortando a execução se houver qualquer divergência.

---

### Passo a Passo de Execução:

1. **Checagem de Pré-requisitos de Infraestrutura:**
   - Verifica se os containers do PostgreSQL e do LocalStack (SQS) estão rodando:
     ```bash
     docker compose ps postgres localstack
     ```
   - Se não estiverem ativos ou saudáveis (`healthy`), inicia os serviços automaticamente:
     ```bash
     docker compose up -d postgres localstack
     ```

2. **Etapa 1: Guarda Financeira (`lint:money`)**
   - **Objetivo:** Garantir que nenhum `number`, `float` ou `parseFloat` foi introduzido em campos monetários.
   - **Comando:**
     ```bash
     bun run lint:money
     ```
   - **Comportamento em Falha:** Se encontrar ocorrências, lista as linhas e arquivos violados e interrompe o pipeline imediatamente.

3. **Etapa 2: Checagem Estática de Tipagem (`typecheck`)**
   - **Objetivo:** Validar TypeScript estrito (`strict: true`, `noUncheckedIndexedAccess`).
   - **Comando:**
     ```bash
     bun run typecheck
     ```
   - **Comportamento em Falha:** Aponta o arquivo, linha e erro de tipagem e interrompe.

4. **Etapa 3: Testes Unitários de Domínio, Casos de Uso, Mensageria, Consumers e Resolvers (`test:unit`)**
   - **Objetivo:** Testar regras de negócio, `Money`, `Wallet`, `WageringPolicy` (incluindo `DEPOSIT`, `BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK`), `payloadHash`, adapter de mensageria SQS FIFO, worker consumidor de transações (`WagerTransactionsConsumerWorker`), worker de resolução de pendências (`PendingReferenceResolverWorker`), caso de uso `ResolvePendingReferencesUseCase` (expiração após 10 tentativas ou TTL de 15 min, backoff exponencial com jitter, transições de estado), validação com Zod, classificação de falhas e todos os casos de uso de aplicação na memória incluindo `DepositUseCase` (65 testes unitários).
   - **Comando:**
     ```bash
     bun test test/unit
     ```
   - **Comportamento em Falha:** Reporta a regra de negócio/aplicação violada e interrompe.

5. **Etapa 4: Testes de Integração de Persistência, HTTP, Outbox, SQS Consumer e Pending Reference Resolver (`test:integration`)**
   - **Objetivo:** Testar transações no PostgreSQL real (locks pessimistas `SELECT ... FOR UPDATE`, triggers de imutabilidade, restrições, índices parciais e persistência de `DEPOSIT`), endpoints HTTP E2E no NestJS (incluindo `POST /wallets/:id/deposit` com replay 200 OK e detecção de conflito 409), o **Transactional Outbox Publisher** contra o AWS SQS FIFO real no LocalStack (`wallet-events.fifo`), o **SQS Consumer Worker com Inbox Pattern** (`wager-transactions.fifo`) e o **Pending Reference Resolver** (`test/integration/pending-reference-resolver.integration.test.ts`), cobrindo processamento ponta a ponta, resolução fora de ordem (WIN e REFUND antes de BET), expiração por timeout, referência rejeitada, prevenção de dupla reversão (`ALREADY_REVERSED`) e múltiplos resolvers paralelos com `FOR UPDATE SKIP LOCKED` (44 testes de integração).
   - **Comando:**
     ```bash
     bun test test/integration
     ```
   - **Comportamento em Falha:** Mostra o erro do banco de dados, da fila SQS, da API ou asserção não atendida e interrompe.

6. **Etapa 5: Testes de Alta Concorrência (`test:concurrency`)**
   - **Objetivo:** Stress tests e cenários de concorrência massiva paralela (cenário 100/80/80, tempestades de idempotência, hot wallet com 100 threads, operações mistas, isolamento entre carteiras e concorrência/tempestade de replay para depósitos via `POST /wallets/:id/deposit`) (9 testes de alta concorrência).
   - **Comando:**
     ```bash
     bun test test/concurrency
     ```

---

### 📊 Relatório Final:
Ao concluir com sucesso, exibe uma tabela resumida com:
- Total de testes executados e aprovados.
- Tempo de execução de cada etapa.
- Status final de aprovação do pipeline.
