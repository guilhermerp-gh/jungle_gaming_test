---
description: Executa a pipeline completa de testes em ordem piramidal Fail-Fast (Lint Money -> Typecheck -> Unit -> Integration -> Concurrency) com diagnóstico automático.
---

## 🧪 Pipeline de Testes (Fail-Fast)

Este workflow garante a integridade de todas as camadas do sistema seguindo a pirâmide de testes: os testes mais rápidos e rigorosos executam primeiro, abortando a execução se houver qualquer divergência.

---

### Passo a Passo de Execução:

1. **Checagem de Pré-requisitos de Infraestrutura:**
   - Verifica se o container do PostgreSQL está rodando:
     ```bash
     docker compose ps postgres
     ```
   - Se não estiver ativo ou não estiver saudável (`healthy`), inicia o serviço automaticamente:
     ```bash
     docker compose up -d postgres
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

4. **Etapa 3: Testes Unitários de Domínio e Casos de Uso (`test:unit`)**
   - **Objetivo:** Testar regras de negócio, `Money`, `Wallet`, `WageringPolicy`, `payloadHash` e todos os casos de uso de aplicação (`CreateWallet`, `ProcessWagerTransaction`, `GetLedger`, `ReconcileWallet`, etc.) na memória.
   - **Comando:**
     ```bash
     bun test test/unit
     ```
   - **Comportamento em Falha:** Reporta a regra de negócio/aplicação violada e interrompe.

5. **Etapa 4: Testes de Integração de Persistência e API HTTP (`test:integration`)**
   - **Objetivo:** Testar transações no PostgreSQL real (locks pessimistas `SELECT ... FOR UPDATE`, triggers de imutabilidade, restrições e índices parciais) e endpoints HTTP E2E no NestJS com ciclo de vida, idempotência e reconciliação.
   - **Comando:**
     ```bash
     bun test test/integration
     ```
   - **Comportamento em Falha:** Mostra o erro do banco de dados, da API ou asserção não atendida e interrompe.

5. **Etapa 5: Testes de Alta Concorrência (`test:concurrency`)**
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
