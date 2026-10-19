---
name: run-tests
description: >-
  Executa a pipeline completa de testes em ordem piramidal Fail-Fast (Lint Money -> Typecheck -> Unit -> Integration -> Concurrency -> Multi-Instance) com diagnóstico automático para o sistema de carteira e processamento distribuído. Use quando o usuário solicitar execução de testes, validação da suíte, conferência de integridade ou execução de /run-tests.
---

# Skill: Pipeline Completa de Testes (Fail-Fast)

Esta skill executa e diagnostica a esteira piramidal de testes automatizados do **Distributed Wagering Processor**, priorizando feedback rápido (*fail-fast*): etapas mais rápidas e rigorosas rodam primeiro, abortando a execução imediatamente caso haja qualquer violação.

---

## 🏗️ Pirâmide de Execução (Fail-Fast)

```text
           ▲
          / \     [Etapa 6] Multi-Instance & Resiliência (Timeout 60s, 7 testes)
         /   \    [Etapa 5] Alta Concorrência (Stress & Hot Wallet, 9 testes)
        /     \   [Etapa 4] Integração (Postgres, SQS FIFO LocalStack, NestJS, 57 testes)
       /       \  [Etapa 3] Testes Unitários de Domínio, Casos de Uso & Workers (84 testes)
      /_________\ [Etapa 2] Typecheck Estrito TypeScript (tsc --noEmit)
     /___________\ [Etapa 1] Guarda Financeira (lint:money - sem floats)
```

**Total de Testes Automatizados**: **157 testes** distribuídos em **22 arquivos**.

---

## 🚀 Passo a Passo da Execução

### 0. Checagem de Pré-requisitos de Infraestrutura
Antes de iniciar os testes que dependem de banco de dados ou mensageria:
```bash
docker compose ps postgres localstack
```
Se algum dos serviços não estiver ativo ou saudável (`healthy`), inicie-os em segundo plano:
```bash
docker compose up -d postgres localstack
```

---

### Etapa 1: Guarda Financeira (`lint:money`)
- **Objetivo**: Garantir que nenhum tipo `number`, `float` ou função `parseFloat` foi introduzido em cálculos monetários, assegurando precisão arbitrária com `Money` / `Decimal`.
- **Comando**:
  ```bash
  bun run lint:money
  ```
- **Comportamento em Falha**: Lista as linhas e arquivos que violaram a guarda financeira e interrompe o pipeline imediatamente.

---

### Etapa 2: Checagem Estática de Tipagem (`typecheck`)
- **Objetivo**: Validar TypeScript estrito (`strict: true`, `noUncheckedIndexedAccess`).
- **Comando**:
  ```bash
  bun run typecheck
  ```
- **Comportamento em Falha**: Reporta erros de tipagem estática e interrompe o pipeline.

---

### Etapa 3: Testes Unitários (`test:unit`)
- **Objetivo**: Validar regras de negócio puras, invariantes de domínio, máquina de estados, hashing determinístico, workers isolados e compatibilidade dupla de contratos (84 testes em 13 arquivos, execução < 600ms).
- **Comando**:
  ```bash
  bun test test/unit
  ```
- **Inventário de Arquivos Unitários (`test/unit/`)**:
  1. `money.test.ts`: Invariantes do Value Object `Money`, aritmética decimal exata, rejeição de NaN/Infinity/floats e formatação.
  2. `wallet.test.ts`: Agregado `Wallet`, débitos, créditos, verificação de saldo e invariantes de moeda.
  3. `policy.test.ts`: Regras de negócio da `WageringPolicy` para `DEPOSIT`, `BET`, `WIN`, `LOSS`, `REFUND` e `ROLLBACK`.
  4. `payload-hash.test.ts`: Hash SHA-256 canônico determinístico para chave de idempotência e ordenação de chaves.
  5. `dtos.test.ts`: Validação de DTOs/schemas Zod com **Dual-Compatibility** (aceita `money: { amount, currency }` ou flat `amount`/`currency`, inferência automática de `idempotencyKey` a partir de `externalTransactionId`, e estabilidade de hash).
  6. `use-cases.test.ts`: Casos de uso de aplicação em memória (`CreateWalletUseCase`, `GetWalletUseCase`, `ProcessWagerTransactionUseCase`, `GetTransactionUseCase`, `DepositUseCase`, reconciliação e replays idempotentes).
  7. `sqs-message-publisher.test.ts`: Adapter SQS FIFO, envelopes de mensageria e MessageGroupId / MessageDeduplicationId.
  8. `wager-transactions-consumer.worker.test.ts`: Worker consumidor com normalização de payloads e envelope Jungle Gaming (`{ type: "WagerTransactionRequested", data: { ... } }`).
  9. `pending-reference-resolver.worker.test.ts`: Agendamento de polling e ciclo de vida do worker de pendências.
  10. `resolve-pending-references.use-case.test.ts`: Algoritmo de resolução fora de ordem (backoff exponencial, jitter, limite de 10 tentativas ou TTL de 15 min).
  11. `publish-outbox-messages.use-case.test.ts`: Processamento de mensagens outbox e renovação de leases em memória.
  12. `observability.test.ts`: Métricas Prometheus (`WageringMetrics`), contadores e medidores de latência.
  13. `config.test.ts`: Schemas de configuração de ambiente e validações de inicialização.
- **Comportamento em Falha**: Aponta o arquivo, teste violado, detalhes da asserção e interrompe.

---

### Etapa 4: Testes de Integração (`test:integration`)
- **Objetivo**: Validar persistência no PostgreSQL real com locks pessimistas (`SELECT ... FOR UPDATE`), triggers de imutabilidade, endpoints HTTP NestJS, suíte de conformidade de contrato Jungle Gaming, SQS FIFO real no LocalStack e observabilidade completa (57 testes em 7 arquivos).
- **Comando**:
  ```bash
  bun test test/integration --concurrency 1
  ```
  *(Nota: O parâmetro `--concurrency 1` garante que os arquivos rodem serialmente, prevenindo concorrência cruzada entre tabelas no banco de dados de testes).*
- **Inventário de Arquivos de Integração (`test/integration/`)**:
  1. `persistence.test.ts`: Locks pessimistas, constraints `CHECK (balance >= 0)`, triggers que proíbem UPDATE/DELETE no ledger e idempotência na base.
  2. `http-api.test.ts`: Suíte de endpoints REST NestJS (`POST /wallets`, `GET /wallets/:id`, `POST /transactions`, `POST /wallets/:id/deposit`, `POST /wallets/:id/reconciliation`, replay `200 OK`, conflito `409` e validação Zod).
  3. `jungle-contract-compliance.test.ts`: **Conformidade Estrita com o Desafio Jungle Gaming**:
     - Rotas `/wagering/transactions` e `/transactions`.
     - Rota canônica de provedor `GET /providers/:providerId/wagering/transactions/:externalTransactionId`.
     - Envelope SQS `{ type: "WagerTransactionRequested", data: { ... } }`.
     - Formato aninhado `money: { amount, currency }` e compatibilidade com flat.
     - Resposta unificada contendo `transactionId` + `id` e `balance: { amount, currency }` + `resultBalance`.
  4. `outbox-publisher.integration.test.ts`: Transactional Outbox Pattern contra SQS FIFO real com fila isolada por suíte, lock `FOR UPDATE SKIP LOCKED` e deduplicação.
  5. `sqs-consumer.integration.test.ts`: SQS Consumer Worker com Inbox Pattern, deduplicação atômica, descarte de mensagens malformadas para DLQ e graceful shutdown.
  6. `pending-reference-resolver.integration.test.ts`: Resolução fora de ordem de transações (`WIN` ou `REFUND` que chegam antes da `BET` correspondente).
  7. `observability.integration.test.ts`: Endpoint `/metrics` Prometheus text format, propagação de cabeçalho `X-Correlation-Id` e métricas contábeis.
- **Comportamento em Falha**: Aponta o erro de banco de dados, fila SQS ou API HTTP e interrompe.

---

### Etapa 5: Testes de Alta Concorrência (`test:concurrency`)
- **Objetivo**: Stress tests e cenários de concorrência massiva paralela com 340+ asserções concorrentes (9 testes em 1 arquivo).
- **Comando**:
  ```bash
  bun test test/concurrency --concurrency 1
  ```
- **Cenários Cobertos (`test/concurrency/concurrency.test.ts`)**:
  - **Cenário 100/80/80**: Duas apostas simultâneas de R$ 80,00 sobre saldo de R$ 100,00 (exatamente 1 é aprovada e 1 é rejeitada por saldo insuficiente).
  - **Tempestade de Idempotência**: 50 a 100 requisições paralelas com a mesma chave (exatamente 1 processa e as demais recebem replay idêntico 200 OK).
  - **Hot-Wallet Saturation**: 100 threads disputando débito concorrente em carteira até saldo exato de R$ 0,00 sem permitir saldo negativo.
  - **Escalabilidade Horizontal**: 10 carteiras recebendo 10 transações simultâneas sem deadlocks nem contenção global.
  - **Conflito sob Condição de Corrida**: Rejeição com 409 Conflict para payloads divergentes com mesma chave.
  - **Concorrência de Depósitos**: 10 depósitos paralelos convergem matematicamente no saldo e tempestade de replay em depósitos.
- **Comportamento em Falha**: Reporta divergência contábil, deadlock não tratado ou falha de isolamento e interrompe.

---

### Etapa 6: Testes Multi-Instância e Recuperação Distribuída (`test:multi-instance`)
- **Objetivo**: Validar cluster distribuído com 3 processos Bun independentes gerenciados via `Bun.spawn`, concorrência entre nós distintos e recuperação de falhas (7 testes em 1 arquivo).
- **Comando**:
  ```bash
  bun test test/multi-instance --timeout 60000
  ```
- **Cenários Cobertos (`test/multi-instance/multi-instance-recovery.test.ts`)**:
  - Processamento de hot wallet por nós distintos sem dupla cobrança.
  - Replay idempotente persistente quando uma instância é crashada/substituída.
  - Tempestade de idempotência distribuída entre os três nós.
  - Carteiras independentes em paralelo através dos três nós.
  - Redelivery de SQS após crash pós-commit / pré-ack sem duplicar saldo ou ledger.
  - Recuperação de lease expirado no outbox preservando o mesmo `eventId`.
  - Resolução de pendências fora de ordem após restart do worker.
- **Comportamento em Falha**: Reporta falha no nó distribuído ou cenário de recuperação não atendido e interrompe.

---

### 🚀 Etapa Complementar: Testes de Carga & Benchmarks (`test:load` - Opcional)
- **Objetivo**: Submeter o sistema a alta vazão (RPS) com `autocannon` em 4 cenários operacionais (Baseline ~800 RPS, Hot-Wallet Saturation, Replay Storm ~1.000 RPS e Carga Mista) com auditoria mandatória de 100% das carteiras afetadas (`difference: "0.00"`).
- **Pré-requisito**: Aplicação rodando em segundo plano (`bun run dev` ou container).
- **Comandos**:
  ```bash
  # Modo rápido (2s por cenário):
  bun run test:load --quick

  # Modo oficial completo (5s por cenário, 25 conexões):
  bun run test:load
  ```

---

## 🛠️ Comandos de Execução Focada (Receitas Rápidas)

| Necessidade | Comando |
|---|---|
| **Pipeline Completo (Check Geral)** | `bun run check` ou `bun run test:all` |
| **Apenas Validação Estática** | `bun run lint:money && bun run typecheck` |
| **Apenas Testes Unitários** | `bun test test/unit` |
| **Apenas Testes de Integração** | `bun test test/integration --concurrency 1` |
| **Apenas Alta Concorrência** | `bun test test/concurrency --concurrency 1` |
| **Apenas Multi-Instância** | `bun test test/multi-instance --timeout 60000` |
| **Um Único Arquivo de Teste** | `bun test test/integration/jungle-contract-compliance.test.ts` |
| **Filtrar Testes por Nome** | `bun test -t "Dual-Compatibility"` |

---

## 🔍 Guia de Diagnóstico e Resolução de Problemas

1. **Erro de conexão com PostgreSQL / LocalStack:**
   - Execute: `docker compose ps`
   - Se algum estiver `unhealthy` ou parado: `docker compose restart postgres localstack`
2. **Mensagens antigas retidas em filas SQS FIFO:**
   - O LocalStack pode reter mensagens se testes anteriores foram interrompidos com Ctrl+C.
   - Purgar filas do LocalStack:
     ```bash
     docker compose restart localstack
     ```
3. **Flakiness em testes de integração concorrentes:**
   - Sempre certifique-se de usar `--concurrency 1` nos testes de integração e concorrência para que cada arquivo de teste execute de forma serial.

---

## 📊 Relatório Final Consolidado

Ao concluir todas as etapas com sucesso, apresente uma tabela estruturada:

| Etapa | Verificação | Comando | Status | Qtd Testes |
|---|---|---|:---:|:---:|
| 1 | Guarda Financeira | `bun run lint:money` | ✅ Aprovado | — |
| 2 | Checagem de Tipos | `bun run typecheck` | ✅ Aprovado | — |
| 3 | Testes Unitários | `bun test test/unit` | ✅ Aprovado | 84 testes (13 arquivos) |
| 4 | Testes de Integração | `bun test test/integration --concurrency 1` | ✅ Aprovado | 57 testes (7 arquivos) |
| 5 | Alta Concorrência | `bun test test/concurrency --concurrency 1` | ✅ Aprovado | 9 testes (1 arquivo) |
| 6 | Multi-Instância | `bun test test/multi-instance --timeout 60000` | ✅ Aprovado | 7 testes (1 arquivo) |

- **Total de Testes Automatizados**: **157 testes** executados e aprovados com 100% de sucesso.
- **Status Geral**: Pipeline Aprovada com Sucesso 🎉
