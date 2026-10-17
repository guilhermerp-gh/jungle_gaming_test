# 📄 Fase 3: Casos de Uso & API HTTP (v0.3.0)

> Especificação técnica da **Fase 3** do Desafio Técnico Jungle Gaming. Implementação da camada de aplicação (Casos de Uso, DTOs e Portas de Identidade) e da camada de interfaces HTTP (Controllers NestJS, Pipes de Validação Zod, Exception Filter padronizado e AuthGuard no-op).

---

## 📌 Metadados

| Campo | Valor |
|-------|-------|
| **Versão** | v1.0 |
| **Data** | 17/10/2026 |
| **Autor** | Guilherme |
| **Status** | Pronto para Desenvolvimento |
| **Prioridade** | Alta |
| **Tipo** | Feature / Casos de Uso & API REST |
| **Versão Alvo** | `0.3.0` |
| **Referência Mestre** | [docs/specs/2026-10-16-distributed-wagering-processor.md](file:///Users/guilherme/testes/jungle_gaming_test/docs/specs/2026-10-16-distributed-wagering-processor.md) |

---

## 📝 Resumo

Implementar os casos de uso do núcleo financeiro e expô-los através de uma API REST completa em NestJS. A API deve gerenciar o ciclo de vida de carteiras (`wallets`), processar apostas e reversões com idempotência persistente (`200` para replay idêntico, `201` para nova transação, `202` para referência pendente e `409` para conflito de payload), disponibilizar extrato paginado por cursor opaco (`base64` do `seq`) e endpoint de auditoria/reconciliação contábil, mantendo o formato de erro e status HTTP padronizados pela especificação.

---

## 📦 Escopo

### ✅ Incluído
- **DTOs com Validação via Zod:**
  - `CreateWalletDto` (`playerId`, `currency`, `initialBalance`).
  - `ProcessTransactionDto` (`providerId`, `externalTransactionId`, `playerId`, `walletId`, `roundId`, `gameId`, `kind`, `amount`, `currency`, `referenceExternalTransactionId?`).
  - `ReconciliationResponseDto`, `WalletResponseDto`, `LedgerPageDto`.
- **Casos de Uso de Aplicação (`src/application/use-cases/`):**
  - `CreateWalletUseCase`: Criação da carteira e lançamento atômico `OPENING` se saldo inicial > 0.
  - `ProcessWagerTransactionUseCase`: Caso de uso unificado (reutilizável por HTTP e SQS) com cálculo canônico de `payloadHash`, lock pessimista, idempotência, aplicação de regras via `WageringPolicy` e geração de eventos outbox.
  - `GetWalletUseCase`: Consulta de dados cadastrais e saldo da carteira.
  - `GetLedgerUseCase`: Consulta do extrato de lançamentos com paginação por cursor (`seq`).
  - `GetTransactionUseCase`: Consulta de transação por ID interno ou por ID externo (`providerId + externalTransactionId`).
  - `ReconcileWalletUseCase`: Auditoria contábil matemática (`saldo armazenado vs somatório do ledger`).
- **Camada HTTP NestJS (`src/interfaces/http/`):**
  - `WalletsController`: `POST /wallets`, `GET /wallets/:id`, `GET /wallets/:id/ledger`, `POST /wallets/:id/reconciliation`.
  - `TransactionsController`: `POST /transactions`, `GET /transactions/:id`, `GET /transactions/external/:providerId/:externalId`.
  - `ZodValidationPipe`: Pipe global de validação estrita com retorno `400 INVALID_PAYLOAD`.
  - `HttpExceptionFilter`: Filtro global formatando erros no padrão `{ "error": { "code", "message", "retryable" } }`.
  - `AuthGuard`: Ponto de extensão de autenticação no-op e porta `ProviderIdentityPort`.
- **Testes:**
  - Testes unitários dos Use Cases.
  - Testes de integração E2E dos endpoints HTTP contra o PostgreSQL real.

### ❌ Fora do Escopo
- Consumidor SQS FIFO e DLQ (Fase 6).
- Workers em background de Outbox e Resolver (Fases 5 e 7).
- Implementação real de Identity Provider externo (Keycloak/OIDC).
- Testes de concorrência massiva paralela (Fase 4).

---

## 🔄 Fluxos Principais

### Fluxo 1: Criar Carteira (`POST /wallets`)
1. **Entrada:** `playerId` (UUID), `currency` (`BRL`), `initialBalance` (string decimal escala 2).
2. **Validação:** Rejeita payload inválido ou valores negativos com `400 INVALID_PAYLOAD`.
3. **Execução Transacional (`UnitOfWork`):**
   - Cria o aggregate `Wallet` (`version = 1`).
   - Se `initialBalance > 0`: cria transação `OPENING` (`PROCESSED`), credita a carteira gerando `WalletLedgerEntry` (`0.00 → initialBalance`) e gera evento `WalletBalanceChanged` no Outbox.
   - Insere os registros atômicos no banco.
4. **Retorno:** HTTP `201 Created` com `{ id, playerId, currency, balance, version }`.
5. **Alternativa:** Se `(playerId, currency)` já existir, retorna `409 WALLET_ALREADY_EXISTS`.

---

### Fluxo 2: Processar Transação de Aposta (`POST /transactions`)
1. **Entrada:** Header `Idempotency-Key` + Payload da aposta (`providerId`, `externalTransactionId`, `playerId`, `walletId`, `roundId`, `gameId`, `kind`, `amount`, `currency`, `referenceExternalTransactionId?`).
2. **Validação Preliminar:** Rejeitar `kind = OPENING` vindo de fora (`400 INVALID_PAYLOAD`).
3. **Hash Canônico:** Calcula `payloadHash` (SHA-256 das chaves ordenadas recursivamente do payload de negócio).
4. **Transação SQL (`UnitOfWork`):**
   1. `wallets.findByIdForUpdate(walletId)`: Obtém lock pessimista por linha. Se carteira não existir $\rightarrow$ `404 WALLET_NOT_FOUND`.
   2. Verifica divergência de jogador (`WALLET_PLAYER_MISMATCH`) ou moeda (`CURRENCY_MISMATCH`).
   3. Busca por `idempotencyKey`:
      - **Se já existe e `payloadHash` idêntico:** Replay idempotente! Retorna snapshot salvo com status HTTP `200 OK` e `{ idempotentReplay: true, ... }`.
      - **Se já existe e `payloadHash` diferente:** Conflito de reutilização de chave! Retorna HTTP `409 IDEMPOTENCY_CONFLICT`.
   4. Busca por `(providerId, externalTransactionId)`:
      - Se já existir sob outra chave $\rightarrow$ HTTP `409 IDEMPOTENCY_CONFLICT`.
   5. Cria `WagerTransaction` (`PENDING`) e executa `WageringPolicy.apply`:
      - **Caso Sucesso (`PROCESSED`):**
        - Executa `wallet.debit` ou `wallet.credit` gerando `WalletLedgerEntry`.
        - Transação é marcada como `PROCESSED`.
        - Carteira tem saldo e versão atualizados (`saveBalance`).
        - Eventos `WagerTransactionProcessed` e `WalletBalanceChanged` inseridos no Outbox.
        - Retorna HTTP `201 Created`.
      - **Caso Rejeição de Negócio (`REJECTED`):**
        - Transação marcada como `REJECTED` com `failureCode` e persistida para auditoria.
        - Saldo e ledger permanecem intactos.
        - Evento `WagerTransactionRejected` inserido no Outbox.
        - Retorna HTTP `422 Unprocessable Entity` com o erro correspondente.
      - **Caso Referência Pendente (`PENDING_REFERENCE`):**
        - Quando `WIN`, `REFUND` ou `ROLLBACK` referencia uma aposta ainda não registrada.
        - Transação marcada como `PENDING_REFERENCE`, agendando `nextAttemptAt`.
        - Evento `WagerTransactionPendingReference` inserido no Outbox.
        - Retorna HTTP `202 Accepted`.

---

### Fluxo 3: Extrato Contábil Paginado (`GET /wallets/:id/ledger`)
1. **Entrada:** `walletId`, query params opcionais: `limit` (default 20, max 100) e `cursor` (string opaca).
2. **Cursor:** O cursor é a codificação em `base64` do `seq` sequencial numérico do ledger.
3. **Consulta:** Busca lançamentos onde `walletId = :walletId AND seq > :cursorSeq ORDER BY seq ASC LIMIT :limit`.
4. **Retorno:**
   ```json
   {
     "items": [
       { "id": "uuid", "transactionId": "uuid", "direction": "DEBIT", "amount": "10.00", "currency": "BRL", "balanceBefore": "100.00", "balanceAfter": "90.00", "createdAt": "..." }
     ],
     "nextCursor": "ey..."
   }
   ```

---

### Fluxo 4: Reconciliação Contábil (`POST /wallets/:id/reconciliation`)
1. **Entrada:** `walletId`.
2. **Execução:**
   - Lê `balance_amount` da carteira.
   - Executa agregação no banco `SUM(CREDIT) - SUM(DEBIT)` e `COUNT(*)` no ledger.
3. **Retorno:**
   ```json
   {
     "walletId": "uuid",
     "storedBalance": "90.00",
     "calculatedBalance": "90.00",
     "difference": "0.00",
     "consistent": true,
     "checkedEntries": 3
   }
   ```
4. Se houver divergência: `consistent: false`, log de erro estruturado (sem corrigir saldo automaticamente).

---

## 📐 Regras e Restrições

### Mapeamento de Códigos de Status HTTP

| Situação | Status HTTP | Detalhe |
|---|---|---|
| Transação Processada com sucesso | **`201 Created`** | Nova aposta concluída e ledger gerado |
| Replay Idempotente idêntico | **`200 OK`** | Resposta idêntica com flag `idempotentReplay: true` |
| Aceita com Referência Pendente | **`202 Accepted`** | Transação salva aguardando referência fora de ordem |
| Payload inválido / Header ausente | **`400 Bad Request`** | Formato de dados ou dinheiro incorreto |
| Carteira ou Transação não encontrada | **`404 Not Found`** | Recurso inexistente |
| Conflito de Idempotência / Wallet Duplicada | **`409 Conflict`** | Mesma key com payload distinto |
| Regra de negócio violada | **`422 Unprocessable Entity`** | Saldo insuficiente, referência inválida, etc. |
| Falha transitória | **`503 Service Unavailable`** | Conexão ou lock temporário (`Retry-After`) |

### Formato Padrão de Erro da API
```json
{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Insufficient funds for operation",
    "retryable": false
  }
}
```

---

## ✅ Critérios de Aceite

- [ ] `POST /wallets` cria carteira e lança `OPENING` atômico se `initialBalance > 0`.
- [ ] `POST /wallets` rejeita jogador duplicado com a mesma moeda retornando `409 WALLET_ALREADY_EXISTS`.
- [ ] `POST /transactions` com `BET` debita saldo e retorna `201 Created`.
- [ ] `POST /transactions` com saldo insuficiente retorna `422 INSUFFICIENT_FUNDS`.
- [ ] Envio da mesma requisição com a mesma `Idempotency-Key` retorna `200 OK` com `idempotentReplay: true`.
- [ ] Envio da mesma `Idempotency-Key` com payload divergente retorna `409 IDEMPOTENCY_CONFLICT`.
- [ ] `REFUND` ou `ROLLBACK` cuja referência não existe retorna `202 Accepted` (`PENDING_REFERENCE`).
- [ ] `GET /wallets/:id/ledger` retorna lista paginada e cursor opaco funcional.
- [ ] `POST /wallets/:id/reconciliation` retorna `consistent: true` quando saldo bate com somatório do ledger.
- [ ] Todos os erros da API seguem o envelope `{ "error": { "code", "message", "retryable" } }`.
- [ ] `bun run test:pipeline` continua 100% verde com inclusão dos novos testes de API.

---

## 🧩 Impacto Técnico

### Módulos / Camadas Impactadas
- **Application:** `src/application/use-cases/` e `src/application/dto/`.
- **Interfaces:** `src/interfaces/http/controllers/`, `filters/`, `pipes/`, `guards/`.
- **Bootstrap:** `src/main.ts` atualizado com registro dos módulos e controllers.

### Arquivos Prováveis
- `src/application/dto/wallet.dto.ts`
- `src/application/dto/transaction.dto.ts`
- `src/application/use-cases/create-wallet.use-case.ts`
- `src/application/use-cases/process-wager-transaction.use-case.ts`
- `src/application/use-cases/get-wallet.use-case.ts`
- `src/application/use-cases/get-ledger.use-case.ts`
- `src/application/use-cases/get-transaction.use-case.ts`
- `src/application/use-cases/reconcile-wallet.use-case.ts`
- `src/interfaces/http/filters/http-exception.filter.ts`
- `src/interfaces/http/pipes/zod-validation.pipe.ts`
- `src/interfaces/http/guards/auth.guard.ts`
- `src/interfaces/http/controllers/wallets.controller.ts`
- `src/interfaces/http/controllers/transactions.controller.ts`
- `src/interfaces/http/http.module.ts`
- `src/main.ts`
- `test/integration/http-api.test.ts`

---

## 🧭 Plano de Implementação

1. **Passo 1 — DTOs com Zod:** Criar esquemas e validadores de entrada/saída em `src/application/dto/`.
2. **Passo 2 — Use Cases:** Implementar os 6 casos de uso integrados ao `UnitOfWork`.
3. **Passo 3 — Infraestrutura HTTP:** Implementar `ZodValidationPipe`, `HttpExceptionFilter` e `AuthGuard` no-op.
4. **Passo 4 — Controllers & Módulo HTTP:** Criar `WalletsController`, `TransactionsController` e `HttpModule`, conectando o NestJS ao MikroORM.
5. **Passo 5 — Testes E2E de API:** Escrever testes de integração HTTP em `test/integration/http-api.test.ts`.
6. **Passo 6 — Validação do Pipeline:** Executar `bun run test:pipeline` e verificar aprovação completa.

---

## 🧪 Testes Esperados

- [ ] Criação de carteira com saldo inicial e validação de ledger gerado.
- [ ] Processamento de `BET` com sucesso (`201`) e rejeição por falta de saldo (`422`).
- [ ] Replay idêntico de transação com status `200` e hash idêntico.
- [ ] Conflito de idempotency key com payload alterado retornando `409`.
- [ ] Extrato paginado com avanço de cursor base64.
- [ ] Reconciliação contábil consistente.

---

## 🤖 Instruções para IA

### Objetivo Operacional
> Implemente somente o que está dentro do escopo desta spec (Fase 3). Em caso de dúvida, pergunte antes de assumir.

### O que a IA deve entregar
- DTOs, Use Cases, Controllers e Filtros HTTP implementados.
- Testes de integração de API HTTP passando com sucesso.
- Resumo claro das alterações efetuadas.

### Observações específicas desta spec
- **NÃO FAZER COMMIT** sem permissão explícita do usuário.
- **NÃO USAR `number`** para valores monetários.
- Preservar o envelope de resposta e mapeamento HTTP estrito.

---

## 📁 Pós-execução da Spec

Quando o usuário pedir para executar esta spec, assim que todas as instruções forem concluídas e validadas com testes, mova o arquivo desta spec para a pasta `docs/executed/2026-10-17-phase-03-use-cases-http.md`.
