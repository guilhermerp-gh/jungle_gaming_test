---
name: run-tests
description: >-
  Executa a pipeline completa de testes em ordem piramidal Fail-Fast (Lint Money -> Typecheck -> Unit -> Integration -> Concurrency -> Multi-Instance) com diagnóstico automático para o sistema de carteira e processamento distribuído. Use quando o usuário solicitar execução de testes, validação da suíte, conferência de integridade ou execução de /run-tests.
---

# Skill: Pipeline Completa de Testes (Fail-Fast)

Esta skill executa a esteira piramidal de testes automatizados do projeto, priorizando feedback rápido (*fail-fast*): etapas mais rápidas e rigorosas rodam primeiro, abortando a execução imediatamente caso haja qualquer violação.

---

## 🏗️ Pirâmide de Execução (Fail-Fast)

```
           ▲
          / \     [Etapa 6] Multi-Instance & Resiliência (Timeout 60s)
         /   \    [Etapa 5] Alta Concorrência (Stress & Hot Wallet)
        /     \   [Etapa 4] Integração (Postgres, SQS FIFO LocalStack, NestJS)
       /       \  [Etapa 3] Testes Unitários de Domínio, Casos de Uso & Workers
      /_________\ [Etapa 2] Typecheck Estrito TypeScript
     /___________\ [Etapa 1] Guarda Financeira (lint:money - sem floats)
```

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
- **Objetivo**: Garantir que nenhum tipo `number`, `float` ou função `parseFloat` foi introduzido em cálculos monetários, assegurando precisão com `Money` / `Decimal`.
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
- **Objetivo**: Validar regras de negócio puras, invariantes de domínio, `Money`, `Wallet`, `WageringPolicy` (`DEPOSIT`, `BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK`), `payloadHash`, adapter SQS FIFO, `WagerTransactionsConsumerWorker`, `PendingReferenceResolverWorker`, `ResolvePendingReferencesUseCase`, métricas Prometheus (`WageringMetrics`), contexto `CorrelationContext`, validação Zod e casos de uso em memória.
- **Comando**:
  ```bash
  bun test test/unit
  ```
- **Comportamento em Falha**: Aponta o caso de teste violado, detalhes da asserção e interrompe.

---

### Etapa 4: Testes de Integração (`test:integration`)
- **Objetivo**: Validar persistência no PostgreSQL real com locks pessimistas (`SELECT ... FOR UPDATE`), triggers de imutabilidade, endpoints HTTP NestJS (`POST /wallets/:id/deposit` com replay idempotente), Transactional Outbox Publisher contra SQS FIFO real no LocalStack (`wallet-events.fifo`), Inbox Consumer (`wager-transactions.fifo`), Pending Reference Resolver e suíte de Observabilidade (`/metrics`, `X-Correlation-Id`, contadores Prometheus).
- **Comando**:
  ```bash
  bun test test/integration --concurrency 1
  ```
  *(Nota: `--concurrency 1` garante isolamento serial de tabelas no banco de testes).*
- **Comportamento em Falha**: Aponta o erro de banco de dados, fila SQS ou API HTTP e interrompe.

---

### Etapa 5: Testes de Alta Concorrência (`test:concurrency`)
- **Objetivo**: Stress tests e cenários de concorrência massiva paralela (cenário 100/80/80, tempestades de idempotência, hot wallet sob 100 threads, operações mistas, isolamento entre carteiras e tempestade de replay em depósitos).
- **Comando**:
  ```bash
  bun test test/concurrency --concurrency 1
  ```
- **Comportamento em Falha**: Reporta divergência contábil, deadlock não tratado ou falha de isolamento e interrompe.

---

### Etapa 6: Testes Multi-Instância e Recuperação Distribuída (`test:multi-instance`)
- **Objetivo**: Validar cluster distribuído com 3 processos Bun independentes gerenciados via `Bun.spawn`, concorrência entre nós distintos, failover durante replay idempotente, tempestade distribuída de requisições idênticas, recuperação pós-crash commit/ack no consumidor SQS e renovação de lease no outbox e resolver de pendências.
- **Comando**:
  ```bash
  bun test test/multi-instance --timeout 60000
  ```
- **Comportamento em Falha**: Reporta falha no nó distribuído ou cenário de recuperação não atendido e interrompe.

---

## 📊 Relatório Final Consolidado

Ao concluir todas as etapas com sucesso, apresente uma tabela estruturada:

| Etapa | Verificação | Comando | Status | Tempo |
|---|---|---|:---:|:---:|
| 1 | Guarda Financeira | `bun run lint:money` | ✅ Aprovado | Xs |
| 2 | Checagem de Tipos | `bun run typecheck` | ✅ Aprovado | Xs |
| 3 | Testes Unitários | `bun test test/unit` | ✅ Aprovado | Xs |
| 4 | Testes de Integração | `bun test test/integration` | ✅ Aprovado | Xs |
| 5 | Alta Concorrência | `bun test test/concurrency` | ✅ Aprovado | Xs |
| 6 | Multi-Instância | `bun test test/multi-instance` | ✅ Aprovado | Xs |

- **Total de Testes**: Quantidade total de testes executados e aprovados.
- **Status Geral**: Pipeline Aprovada com Sucesso 🎉
