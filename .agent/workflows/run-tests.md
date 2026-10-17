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

4. **Etapa 3: Testes Unitários de Domínio, Casos de Uso, Mensageria e Consumers (`test:unit`)**
   - **Objetivo:** Testar regras de negócio, `Money`, `Wallet`, `WageringPolicy`, `payloadHash`, adapter de mensageria SQS FIFO, worker consumidor de transações (`WagerTransactionsConsumerWorker`), validação com Zod, classificação de falhas (negócio vs poison pills), retentativas com backoff exponencial e todos os casos de uso de aplicação na memória.
   - **Comando:**
     ```bash
     bun test test/unit
     ```
   - **Comportamento em Falha:** Reporta a regra de negócio/aplicação violada e interrompe.

5. **Etapa 4: Testes de Integração de Persistência, HTTP, Outbox e SQS Consumer Worker (`test:integration`)**
   - **Objetivo:** Testar transações no PostgreSQL real (locks pessimistas `SELECT ... FOR UPDATE`, triggers de imutabilidade, restrições e índices parciais), endpoints HTTP E2E no NestJS, o **Transactional Outbox Publisher** contra o AWS SQS FIFO real no LocalStack (`wallet-events.fifo`) e o **SQS Consumer Worker com Inbox Pattern** (`wager-transactions.fifo`), cobrindo processamento ponta a ponta, rejeição contábil, deduplicação em reentregas pós-commit, roteamento de poison pills para DLQ (`wager-transactions-dlq.fifo`) e graceful shutdown.
   - **Comando:**
     ```bash
     bun test test/integration
     ```
   - **Comportamento em Falha:** Mostra o erro do banco de dados, da fila SQS, da API ou asserção não atendida e interrompe.

6. **Etapa 5: Testes de Alta Concorrência (`test:concurrency`)**
   - **Objetivo:** Stress tests e cenários de concorrência massiva paralela (cenário 100/80/80, tempestades de idempotência, hot wallet com 100 threads, operações mistas e isolamento entre carteiras).
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
