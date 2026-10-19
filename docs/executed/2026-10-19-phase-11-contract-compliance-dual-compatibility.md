# 📄 Fase 11: Conformidade de Contrato HTTP/SQS & Dual-Compatibility

> **Especificação técnica (spec-simples)** para adequação rigorosa de contratos de API e mensageria às Seções 9 e 10 do desafio oficial Jungle Gaming ([junglegaming/backend-challenge](https://github.com/junglegaming/backend-challenge)), preservando 100% de retrocompatibilidade com a suíte de testes existente.

---

## 📌 Metadados

| Campo | Valor |
|---|---|
| **Versão** | v1.0 |
| **Data** | 19/10/2026 |
| **Autor** | Guilherme |
| **Status** | Concluído |
| **Prioridade** | Alta |
| **Tipo** | Refatoração / Ajuste de Contrato |

---

## 📝 Resumo

Implementar **Dual-Compatibility (compatibilidade dupla)** nas camadas de interfaces HTTP, DTOs e mensageria SQS para alinhar o serviço aos contratos estritos exigidos pelas Seções 9 e 10 do teste oficial da Jungle Gaming. A mudança garante que avaliadores externos ou robôs de correção automática (test graders) que enviem requisições nas rotas `/wagering/transactions`, com estruturas aninhadas `money: { amount, currency }` ou envelopes de evento SQS `{ type: "WagerTransactionRequested", data: { ... } }`, recebam as respostas exatas esperadas, sem qualquer quebra nos 142 testes automatizados e testes de carga existentes.

---

## 📦 Escopo

### ✅ Incluído
- **Roteamento HTTP Duplo (Aliases):**
  - Expor `@Controller(["wagering/transactions", "transactions"])` para suportar tanto `POST /wagering/transactions` quanto `POST /transactions`.
  - Expor rotas de consulta por ID interno em ambos os prefixos (`GET /wagering/transactions/:transactionId` e `GET /transactions/:id`).
  - Implementar a rota canônica do provedor: `GET /providers/:providerId/wagering/transactions/:externalTransactionId` mantendo o alias legado `GET /transactions/external/:providerId/:externalId`.
- **Preprocessamento de DTOs de Entrada (Zod):**
  - `ProcessTransactionSchema`: aceitar tanto o objeto aninhado `money: { amount, currency }` quanto os atributos planos `amount` e `currency`.
  - `CreateWalletSchema`: aceitar `initialBalance` como objeto `{ amount, currency }` ou como valor decimal plano com moeda na raiz.
- **Envelope Unificado de Resposta HTTP:**
  - `TransactionResponseDto`: retornar tanto `transactionId` quanto `id`, e tanto o objeto monetário `balance: { amount, currency }` quanto `resultBalance: string`.
  - `WalletResponseDto`: retornar tanto `balance: { amount, currency }` quanto o campo plano legado.
- **Deduplicação e Normalização de Hash de Idempotência:**
  - O cálculo do hash canônico SHA-256 deve operar sobre os dados já normalizados, assegurando equivalência semântica independentemente do formato da requisição.
- **Envelope SQS Flexível no Worker:**
  - `WagerMessagePayloadSchema` no worker de mensageria SQS: reconhecer tanto o envelope padrão de evento da Jungle `{ type: "WagerTransactionRequested", data: { ... } }` quanto payloads planos diretos.
- **Suíte de Testes de Integração de Contrato:**
  - Adicionar testes de integração cobrindo expressamente as rotas e formatos da Seção 9 e 10 do teste da Jungle.

### ❌ Fora do Escopo
- Alterações em schemas ou migrations do banco PostgreSQL (as tabelas `wallets`, `wager_transactions`, `wallet_ledger` permanecem intactas).
- Modificações nas regras do núcleo de domínio (`Money`, `Wallet`, `WagerTransaction`, locks pessimistas e invariantes).
- Modificação na infraestrutura SQS LocalStack existente.

---

## 🔄 Fluxo Principal

### Comportamento Atual
1. A API HTTP escuta apenas em `POST /transactions`, `GET /transactions/:id` e `GET /transactions/external/:providerId/:externalId`.
2. O payload exige atributos planos `amount: "25.00"` e `currency: "BRL"`. Se um avaliador submeter `money: { amount: "25.00", currency: "BRL" }`, o Zod lança `400 Bad Request`.
3. A resposta de transação entrega `{ id: "...", resultBalance: "975.00", ... }`, sem a chave `transactionId` e sem o objeto estruturado `balance: { amount, currency }`.
4. O worker SQS espera campos planos na raiz do JSON. Mensagens no padrão `{ type: "WagerTransactionRequested", data: { ... } }` são rejeitadas como `InvalidSchema` e descartadas/enviadas para a DLQ.

### Fluxo Proposto

#### 🔄 Fluxo 1: Submissão de Transação via HTTP Oficial
1. Cliente envia `POST /wagering/transactions` com header `Idempotency-Key` e corpo:
   ```json
   {
     "providerId": "evolution",
     "externalTransactionId": "tx-100",
     "playerId": "0192f28f-5dc0-7d58-bdb2-814ad6a0f4a1",
     "walletId": "0192f291-27dd-7d3f-8071-5f8685deef37",
     "roundId": "round-01",
     "gameId": "roulette",
     "kind": "BET",
     "money": { "amount": "25.00", "currency": "BRL" }
   }
   ```
2. O Pipe de validação com Zod pré-processa o corpo da requisição: detecta o nó `money` e o converte internamente para `amount: "25.00"` e `currency: "BRL"`.
3. O caso de uso `ProcessWagerTransactionUseCase` é executado com os locks pessimistas e ledger imutável.
4. A API devolve `201 Created` (ou `200 OK` em replay) com o envelope híbrido:
   ```json
   {
     "transactionId": "0192f298-345e-7e38-af88-e43f851a819d",
     "id": "0192f298-345e-7e38-af88-e43f851a819d",
     "status": "PROCESSED",
     "balance": { "amount": "975.00", "currency": "BRL" },
     "resultBalance": "975.00",
     "idempotentReplay": false,
     "failureCode": null,
     "providerId": "evolution",
     "externalTransactionId": "tx-100",
     "walletId": "0192f291-27dd-7d3f-8071-5f8685deef37",
     "playerId": "0192f28f-5dc0-7d58-bdb2-814ad6a0f4a1",
     "roundId": "round-01",
     "gameId": "roulette",
     "kind": "BET",
     "amount": "25.00",
     "currency": "BRL",
     "createdAt": "2026-10-19T03:00:00.000Z",
     "processedAt": "2026-10-19T03:00:00.050Z"
   }
   ```

#### 🔄 Fluxo 2: Consulta Canônica do Provedor
1. Cliente envia `GET /providers/:providerId/wagering/transactions/:externalTransactionId`.
2. O controller roteia para o caso de uso `GetTransactionUseCase` buscando por `(providerId, externalTransactionId)`.
3. Retorna os dados completos da transação com status HTTP `200 OK`.

#### 🔄 Fluxo 3: Consumo de Mensagem SQS Envelope Jungle
1. Mensagem recebida na fila `wager-transactions.fifo`:
   ```json
   {
     "messageId": "msg-123",
     "type": "WagerTransactionRequested",
     "occurredAt": "2026-10-19T03:00:00.000Z",
     "data": {
       "providerId": "provider-a",
       "externalTransactionId": "tx-sqs-001",
       "idempotencyKey": "provider-a:tx-sqs-001",
       "playerId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
       "walletId": "4a89972f-1ac6-4cf8-949f-c8c9605baf27",
       "roundId": "round-01",
       "gameId": "fortune-tiger",
       "kind": "BET",
       "money": { "amount": "50.00", "currency": "BRL" }
     }
   }
   ```
2. O parser Zod verifica se existe a propriedade `data`. Caso exista, extrai os campos de dentro de `data` e normaliza `money.amount` e `money.currency`.
3. Caso a mensagem venha no formato plano legado, o parser valida diretamente sem erros.
4. O `ProcessWagerTransactionUseCase` é acionado normalmente, registrando o inbox e executando a transação financeira de forma atômica.

---

## 📐 Regras e Restrições

### Regras de Negócio
- O hash canônico de idempotência deve ser rigorosamente determinístico. Enviar `money: { amount: "25.00", currency: "BRL" }` ou `amount: "25.00", currency: "BRL"` com a mesma `Idempotency-Key` deve gerar o mesmo hash, caracterizando replay idêntico e não conflito.
- A criação de carteira (`POST /wallets`) com `initialBalance: { amount: "100.00", currency: "BRL" }` deve gerar a transação contábil `OPENING` idêntica à versão plana.

### Restrições Técnicas
- **Zero Breaking Changes:** A suíte de 142 testes (`test/unit`, `test/integration`, `test/concurrency`, `test/multi-instance`) e o script de carga `scripts/load-test.ts` devem continuar 100% íntegros e passando sem necessidade de refatoração forçada.
- **Zero Regressão de Tipos:** TypeScript estrito com Zod, garantindo que `ProcessTransactionDto` continue fortemente tipado.
- **Sem Migrations Adicionais:** A modelagem de dados no PostgreSQL e as entidades MikroORM já estão em conformidade e não sofrem alteração.

---

## ✅ Critérios de Aceite

- [x] Quando `POST /wagering/transactions` for chamado com `money: { amount, currency }`, a resposta deve ser `201 Created` contendo `transactionId` e `balance: { amount, currency }`.
- [x] Quando `POST /transactions` for chamado com o formato plano legado (`amount`, `currency`), deve manter o funcionamento idêntico e passar em todos os testes existentes.
- [x] Quando `GET /wagering/transactions/:id` for chamado, deve retornar a transação com `200 OK`.
- [x] Quando `GET /providers/:providerId/wagering/transactions/:externalId` for chamado, deve consultar e retornar a transação do provedor com `200 OK`.
- [x] Quando `POST /wallets` for chamado com `initialBalance: { amount: "100.00", currency: "BRL" }`, a carteira deve ser criada com saldo `100.00 BRL` e lançamento `OPENING` no ledger.
- [x] Quando uma mensagem SQS for postada com o envelope `{ type: "WagerTransactionRequested", data: { ... } }`, o worker deve consumir, processar e dar `DeleteMessage` com sucesso.
- [x] Quando a suíte completa de testes (`bun run check`) for executada, todos os testes (unitários, integração, concorrência e multi-instância) devem passar com 0 falhas.
- [x] Quando o benchmark de carga (`bun run test:load`) for executado, deve atingir 0% de erros 5xx e 100% de consistência contábil.

---

## 🧩 Impacto Técnico

### Módulos / Camadas Impactadas
- **Camada de Aplicação / DTOs (`src/application/dto/`):**
  - [`src/application/dto/transaction.dto.ts`](file:///Users/guilherme/testes/jungle_gaming_test/src/application/dto/transaction.dto.ts): Preprocessador Zod para suportar `money` ou `amount/currency` e unificação do `TransactionResponseDto`.
  - [`src/application/dto/wallet.dto.ts`](file:///Users/guilherme/testes/jungle_gaming_test/src/application/dto/wallet.dto.ts): Preprocessador Zod para `initialBalance` em formato objeto ou string e `WalletResponseDto`.
- **Camada de Interfaces HTTP (`src/interfaces/http/controllers/`):**
  - [`src/interfaces/http/controllers/transactions.controller.ts`](file:///Users/guilherme/testes/jungle_gaming_test/src/interfaces/http/controllers/transactions.controller.ts): Aliases de rota `@Controller(["wagering/transactions", "transactions"])` e rota de provedor.
  - [`src/interfaces/http/controllers/providers-transactions.controller.ts`](file:///Users/guilherme/testes/jungle_gaming_test/src/interfaces/http/controllers/providers-transactions.controller.ts): Rota canônica `GET /providers/:providerId/wagering/transactions/:externalTransactionId`.
- **Camada de Workers SQS (`src/interfaces/workers/`):**
  - [`src/interfaces/workers/wager-transactions-consumer.worker.ts`](file:///Users/guilherme/testes/jungle_gaming_test/src/interfaces/workers/wager-transactions-consumer.worker.ts): Suporte a envelope `{ type, data }`.
- **Testes de Integração (`test/integration/`):**
  - Criação ou expansão de testes para validar explicitamente os novos caminhos e payloads canônicos da Jungle Gaming.

---

## 🧭 Plano de Implementação

1. **Ajustar DTOs de Entrada e Saída:**
   - Criar `z.preprocess` no `ProcessTransactionSchema` e `CreateWalletSchema` para normalizar payloads aninhados e planos.
   - Expandir `TransactionResponseDto` e `WalletResponseDto` com os campos de conveniência (`transactionId`, `balance`).
2. **Atualizar Controladores HTTP:**
   - Adicionar decoradores de rotas múltiplas no `TransactionsController`.
   - Adicionar método/rota para `@Get("providers/:providerId/wagering/transactions/:externalId")`.
3. **Atualizar Consumer SQS:**
   - Ajustar `WagerMessagePayloadSchema` para aceitar mensagens empacotadas no envelope `data` com nó `money`.
4. **Adicionar Testes de Conformidade Jungle Gaming:**
   - Criar arquivo `test/integration/jungle-contract-compliance.test.ts` testando de ponta a ponta as rotas `/wagering/transactions` e payloads da Seção 9 e 10.
5. **Executar Verificação de Qualidade:**
   - Rodar `bun run lint:money`, `bun run typecheck`, `bun test`, `bun run test:all`.
   - Rodar `bun run test:load` para revalidar a performance.

---

## 🧪 Testes Esperados

- [x] `POST /wagering/transactions` com `money: { amount: "25.00", currency: "BRL" }` retorna `201 Created` e `balance: { amount: "...", currency: "BRL" }`.
- [x] `GET /wagering/transactions/:transactionId` retorna a transação correta.
- [x] `GET /providers/:providerId/wagering/transactions/:externalId` retorna a transação correspondente.
- [x] `POST /wallets` com `initialBalance: { amount: "500.00", currency: "BRL" }` cria carteira e credita `OPENING`.
- [x] Consumo SQS de mensagem com formato `{ type: "WagerTransactionRequested", data: { ... } }` processa com sucesso.
- [x] Replay idempotente na rota `/wagering/transactions` retorna `200 OK` e `idempotentReplay: true`.
- [x] Validação piramidal completa (`bun run check`) sem regressões.

---

## 🤖 Instruções para IA

### Objetivo Operacional
Implementar estritamente o suporte de retrocompatibilidade e conformidade de contrato especificado acima, sem quebrar nenhuma suíte de teste existente.

### O que a IA deve entregar
- DTOs, Controllers e Worker atualizados com Dual-Compatibility.
- Novo teste de integração validando a conformidade oficial do desafio Jungle Gaming.
- Execução de `bun run check` e `bun run test:load` com 100% de sucesso.
