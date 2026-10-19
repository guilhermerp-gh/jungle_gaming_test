---
description: Executa a pipeline completa de testes em ordem piramidal Fail-Fast (Lint Money -> Typecheck -> Unit -> Integration -> Concurrency -> Multi-Instance) com diagnóstico automático.
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

4. **Etapa 3: Testes Unitários de Domínio, Casos de Uso, Mensageria, Consumers, Resolvers, DTOs e Observabilidade (`test:unit`)**
   - **Objetivo:** Testar regras de negócio, `Money`, `Wallet`, `WageringPolicy` (incluindo `DEPOSIT`, `BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK`), `payloadHash`, DTOs e schemas com Dual-Compatibility (`ProcessTransactionSchema`, `CreateWalletSchema`, `WagerMessagePayloadSchema`, normalização de `money` e inferência de `idempotencyKey`), adapter de mensageria SQS FIFO, worker consumidor de transações (`WagerTransactionsConsumerWorker`), worker de resolução de pendências (`PendingReferenceResolverWorker`), caso de uso `ResolvePendingReferencesUseCase` (expiração após 10 tentativas ou TTL de 15 min, backoff exponencial com jitter, transições de estado), métricas do Prometheus (`WageringMetrics`), rastreamento com `AsyncLocalStorage` (`CorrelationContext`), validação com Zod, classificação de falhas e todos os casos de uso de aplicação na memória incluindo `DepositUseCase` (84 testes unitários em 13 arquivos).
   - **Comando:**
     ```bash
     bun test test/unit
     ```
   - **Comportamento em Falha:** Reporta a regra de negócio/aplicação violada e interrompe.

5. **Etapa 4: Testes de Integração de Persistência, HTTP, Outbox, SQS Consumer, Pending Reference Resolver, Jungle Gaming Compliance e Observabilidade (`test:integration`)**
   - **Objetivo:** Testar transações no PostgreSQL real (locks pessimistas `SELECT ... FOR UPDATE`, triggers de imutabilidade, restrições, índices parciais e persistência de `DEPOSIT`), endpoints HTTP E2E no NestJS (incluindo `POST /wallets/:id/deposit` com replay 200 OK e detecção de conflito 409), a suíte de **Conformidade de Contrato Jungle Gaming** (`test/integration/jungle-contract-compliance.test.ts` cobrindo rotas `/wagering/transactions`, rota canônica de provedor `/providers/:providerId/wagering/transactions/:externalTransactionId` e envelopes SQS), o **Transactional Outbox Publisher** contra o AWS SQS FIFO real no LocalStack com fila isolada, o **SQS Consumer Worker com Inbox Pattern** (`wager-transactions.fifo`), o **Pending Reference Resolver** (`test/integration/pending-reference-resolver.integration.test.ts`) e a suíte de **Observabilidade** (`test/integration/observability.integration.test.ts`), cobrindo endpoint `/metrics` em formato Prometheus text, propagação de `X-Correlation-Id`, incrementos de `wager_transactions_total`, `idempotent_replays_total`, `lock_conflicts_total` e `reconciliation_mismatch_total` (57 testes de integração em 7 arquivos).
   - **Comando:**
     ```bash
     bun test test/integration --concurrency 1
     ```
   - **Comportamento em Falha:** Mostra o erro do banco de dados, da fila SQS, da API ou asserção não atendida e interrompe.

6. **Etapa 5: Testes de Alta Concorrência (`test:concurrency`)**
   - **Objetivo:** Stress tests e cenários de concorrência massiva paralela (cenário 100/80/80, tempestades de idempotência, hot wallet com 100 threads, operações mistas, isolamento entre carteiras e concorrência/tempestade de replay para depósitos via `POST /wallets/:id/deposit`) (9 testes de alta concorrência).
   - **Comando:**
     ```bash
     bun test test/concurrency --concurrency 1
     ```

7. **Etapa 6: Testes Multi-Instância e Recuperação Distribuída (`test:multi-instance`)**
   - **Objetivo:** Orquestração de cluster distribuído com 3 processos Bun independentes gerenciados via `Bun.spawn`, concorrência de hot wallet entre nós distintos, substituição de nó durante replay idempotente, tempestade distribuída de requisições idênticas, isolamento horizontal de carteiras, recuperação de crash pós-commit / pré-ack no consumidor SQS e recuperação de lease expirado no outbox e pending reference resolver (7 testes multi-instância).
   - **Comando:**
     ```bash
     bun test test/multi-instance --timeout 60000
     ```

8. **🚀 Etapa Opcional: Benchmarking de Carga & Reconciliação Contábil (`test:load`)**
   - **Objetivo:** Medir vazão (RPS) e latência p50/p90/p97.5/p99 em 4 cenários extremos (Baseline, Hot-Wallet, Replay Storm e Carga Mista) com auditoria mandatória de 100% das carteiras afetadas (`difference: "0.00"`).
   - **Comando:**
     ```bash
     bun run test:load --quick
     ```

---

### 📊 Relatório Final:
Ao concluir com sucesso, exibe uma tabela resumida com:
- Total de testes executados e aprovados (**157 testes automatizados**).
- Tempo de execução de cada etapa.
- Status final de aprovação do pipeline.
