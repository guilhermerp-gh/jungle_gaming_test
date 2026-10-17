# 📄 Fase 4: Concorrência Massiva & Resiliência de Idempotência (v0.4.0)

> Especificação técnica da **Fase 4** do Desafio Técnico Jungle Gaming. Validação e blindagem do processador financeiro contra condições de corrida (*race conditions*), *double spending* e tempestades de concorrência massiva através de testes de estresse em nível de casos de uso e API REST contra o PostgreSQL real.

---

## 📌 Metadados

| Campo | Valor |
|-------|-------|
| **Versão** | v1.0 |
| **Data** | 17/10/2026 |
| **Autor** | Guilherme |
| **Status** | Concluído |
| **Prioridade** | Alta |
| **Tipo** | Feature / Concorrência & Resiliência |
| **Versão Alvo** | `0.4.0` |
| **Referência Mestre** | [docs/specs/2026-10-16-distributed-wagering-processor.md](file:///Users/guilherme/testes/jungle_gaming_test/docs/specs/2026-10-16-distributed-wagering-processor.md) |

---

## 📝 Resumo

Implementar uma suíte exaustiva de testes de alta concorrência e estresse no diretório `test/concurrency/`, validando a eficácia e a integridade do lock pessimista por linha (`SELECT ... FOR UPDATE`), da restrição única de idempotência (`UNIQUE(idempotency_key)`), da trava de versão otimista (`version`) e da integridade física do PostgreSQL (`CHECK (balance >= 0.00)`). A suíte deve submeter o motor transacional a cenários de disputa simultânea de saldo (cenário 100/80/80 e esgotamento com 100 threads), replays concorrentes com a mesma `Idempotency-Key` (50x a 100x em paralelo), operações mistas de crédito/débito e transações em carteiras independentes em paralelo, comprovando a ausência de deadlocks e a perfeita reconciliação contábil (`consistent: true`).

---

## 📦 Escopo

### ✅ Incluído
- **Suíte de Testes de Concorrência (`test/concurrency/concurrency.test.ts`):**
  - **Cenário 100/80/80 (Disputa Concorrente Limítrofe):** Carteira com saldo de R$ 100,00 recebe 2 apostas simultâneas de R$ 80,00 disparadas via `Promise.allSettled`. Exatamente 1 transação aprovada (`201 Created`), exatamente 1 rejeitada (`422 INSUFFICIENT_FUNDS`), saldo final R$ 20,00 e exatamente 1 lançamento `DEBIT` no ledger.
  - **Cenário de Idempotência Massiva (50x a 100x requisições simultâneas com a mesma chave):** Disparo concorrente em massa com a mesma `Idempotency-Key` e mesmo payload contra a mesma carteira. Exatamente 1 transação criada (`201 Created`), todas as outras retornam replay idêntico (`200 OK` com `idempotentReplay: true`), saldo debitado apenas uma vez e exatamente 1 entrada no ledger.
  - **Cenário de Hot Wallet / Esgotamento Massivo (100 apostas simultâneas de R$ 1,00):** Carteira com saldo de R$ 50,00 recebe 100 requisições simultâneas de R$ 1,00 com chaves distintas. Exatamente 50 transações aprovadas (`201`), exatamente 50 rejeitadas (`422`), saldo final rigorosamente R$ 0,00, sem saldo negativo e com reconciliação contábil perfeita (`POST /wallets/:id/reconciliation` retorna `consistent: true`).
  - **Cenário de Concorrência Mista (Apostas e Prêmios Simultâneos):** Disparo de múltiplos débitos (`BET`) e créditos (`WIN`) concorrentes na mesma carteira. Saldo final converge com a soma algébrica das operações concluídas e auditoria contábil 100% consistente.
  - **Cenário de Paralelismo em Carteiras Distintas (Isolamento de Lock):** Múltiplas carteiras processando transações simultâneas em paralelo, comprovando que o lock é granular por linha na carteira (`SELECT ... FOR UPDATE`) e não introduz serialização global ou deadlocks no banco.
  - **Cenário de Corrida de Idempotência com Payload Divergente:** Disparos concorrentes com a mesma `Idempotency-Key` mas corpos distintos. Uma requisição processada com sucesso e as concorrentes divergentes rejeitadas com `409 IDEMPOTENCY_CONFLICT`.
- **Tratamento de Concorrência e Resiliência na API HTTP:**
  - Garantir tratamento gracioso de corrida em `UNIQUE(idempotency_key)` e `UNIQUE(provider_id, external_transaction_id)` caso duas transações concorrentes tentem inserir antes de uma finalizar o commit.
  - Garantir tratamento de `ConcurrencyConflictError` mapeado para `503 Service Unavailable` com cabeçalho `Retry-After: 1` e flag `retryable: true`.
- **Automação no Pipeline de Testes:**
  - Inclusão do passo `test:concurrency` no script `test:pipeline` em `package.json`.
  - Execução validada pelo workflow piramidal fail-fast (`.agent/workflows/run-tests.md`).

### ❌ Fora do Escopo
- Worker em background do Transactional Outbox Publisher com lock `SKIP LOCKED` (Fase 5).
- Consumidor SQS FIFO com deduplicação, inbox e DLQ (Fase 6).
- Worker de Pending Reference Resolver para reversões órfãs com TTL (Fase 7).
- Orquestrador multi-processo `Bun.spawn` subindo 3 instâncias de servidor HTTP em portas distintas (Fase 8).
- Testes de carga sintética contínua com k6 ou Autocannon (Fase 10).

---

## 🔄 Fluxos Principais

### Fluxo 1: Cenário 100/80/80 (Disputa de Saldo Concorrente)
1. **Estado Inicial:** Carteira criada com saldo `100.00 BRL`.
2. **Disparo Concorrente:** Duas requisições HTTP `POST /transactions` com `kind: BET`, `amount: 80.00` e chaves distintas (`key-1`, `key-2`) disparadas em paralelo via `Promise.allSettled`.
3. **Mecanismo de Concorrência:**
   - Ambas iniciam transação no PostgreSQL e tentam `SELECT ... FOR UPDATE` no registro da carteira.
   - O PostgreSQL concede o lock para a primeira requisição; a segunda fica bloqueada na fila de lock por linha.
   - A primeira lê saldo `100.00`, aplica aposta, debita `80.00`, gera ledger `100.00 -> 20.00`, atualiza carteira para `20.00` (`version: 2`) e efetua commit, liberando o lock.
   - A segunda adquire o lock, lê saldo atualizado `20.00`, avalia `WageringPolicy` que detecta saldo insuficiente, marca transação como `REJECTED (INSUFFICIENT_FUNDS)` e comita sem alterar saldo.
4. **Resultado Esperado:**
   - 1 resposta HTTP `201 Created` (`PROCESSED`, saldo pós: `20.00`).
   - 1 resposta HTTP `422 Unprocessable Entity` (`code: INSUFFICIENT_FUNDS`).
   - Saldo final da carteira: `20.00 BRL`.
   - Lançamentos no ledger: exatamente 2 (1 `OPENING` de `100.00` e 1 `DEBIT` de `80.00`).
   - Reconciliação contábil: `consistent: true`.

---

### Fluxo 2: Idempotência sob Tempestade Paralela (50x a 100x Mesma Chave)
1. **Estado Inicial:** Carteira com saldo `500.00 BRL`.
2. **Disparo Concorrente:** 50 a 100 requisições simultâneas com rigorosamente a **mesma `Idempotency-Key`**, mesmo payload (`kind: BET`, `amount: 10.00`, mesmo `externalTransactionId`).
3. **Mecanismo de Idempotência Concorrente:**
   - A primeira transação a obter o lock da carteira processa o débito, persiste a transação com a chave única e efetua o commit.
   - As demais transações subsequentes adquirem o lock da carteira, encontram a transação já existente via `findByIdempotencyKey`, comparam o `payloadHash` e retornam imediatamente o snapshot como replay.
   - Se ocorrer colisão simultânea de inserção na constraint única do banco antes do lock, a camada de persistência captura a violação de chave única e re-executa a leitura para responder com replay idempotente `200 OK`.
4. **Resultado Esperado:**
   - Exatamente 1 resposta HTTP `201 Created` (`idempotentReplay: false`).
   - Exatamente 49 (ou 99) respostas HTTP `200 OK` (`idempotentReplay: true`).
   - Saldo final debitado apenas uma vez: `490.00 BRL`.
   - Exatamente 1 registro na tabela `wager_transactions` para essa chave.
   - Exatamente 1 lançamento `DEBIT` de `10.00` no ledger.

---

### Fluxo 3: Hot Wallet — 100 Requisições Concorrentes com Esgotamento
1. **Estado Inicial:** Carteira com saldo `50.00 BRL`.
2. **Disparo Concorrente:** 100 requisições simultâneas disparadas em paralelo (`Promise.allSettled`), cada uma debitando `1.00 BRL` com chaves de idempotência e external IDs únicos (`bet-1` até `bet-100`).
3. **Mecanismo de Fila de Lock:**
   - Todas as 100 transações enfileiram no lock pessimista da linha da carteira no PostgreSQL.
   - As primeiras 50 transações aprovam sucessivamente o débito de `1.00`, incrementando a versão da carteira de 1 até 51.
   - As 50 transações seguintes encontram saldo `0.00` e são rejeitadas de forma determinística por `INSUFFICIENT_FUNDS`.
4. **Resultado Esperado:**
   - Exatamente 50 requisições com status `201 Created`.
   - Exatamente 50 requisições com status `422 Unprocessable Entity`.
   - Saldo final da carteira: exatamente `0.00 BRL`.
   - Reconciliação contábil (`POST /wallets/:id/reconciliation`): `consistent: true`, `difference: 0.00`, `checkedEntries: 51`.

---

### Fluxo 4: Operações Mistas Concorrentes (BET e WIN)
1. **Estado Inicial:** Carteira com saldo `100.00 BRL`.
2. **Disparo Concorrente:** 40 transações disparadas simultaneamente:
   - 20 requisições de `BET` de `5.00 BRL` (total previsto de débito: `100.00 BRL`).
   - 20 requisições de `WIN` de `2.50 BRL` (total previsto de crédito: `50.00 BRL`).
3. **Execução:** Devido ao lock pessimista por linha, os créditos e débitos intercalam-se sem perda de atualizações (*lost updates*).
4. **Resultado Esperado:**
   - Todas as 40 transações completam com sucesso (`201 Created`).
   - Saldo final esperado: `100.00 - 100.00 + 50.00 = 50.00 BRL`.
   - Reconciliação contábil confirma integridade absoluta de saldo e ledger.

---

### Fluxo 5: Concorrência entre Múltiplas Carteiras Independentes
1. **Estado Inicial:** 10 carteiras distintas criadas, cada uma com saldo `100.00 BRL`.
2. **Disparo Concorrente:** 10 requisições simultâneas por carteira (total de 100 requisições simultâneas).
3. **Mecanismo:**
   - O lock pessimista é adquirido por `wallet_id` individual (`WHERE id = :id FOR UPDATE`).
   - Carteiras distintas progridem sem disputar o mesmo lock de linha.
   - Nenhuma transação sofre deadlock cruzado.
4. **Resultado Esperado:**
   - Todas as 100 operações são processadas com sucesso.
   - Cada uma das 10 carteiras atinge seu saldo previsto de forma independente.

---

## 📐 Regras e Restrições

### Regras de Negócio e Concorrência
- **Lock Pessimista por Linha (`SELECT ... FOR UPDATE`):** O lock deve ser sempre escopado exclusivamente ao registro da carteira envolvida. É proibido qualquer lock de tabela inteira ou bloqueio compartilhado que impeça o paralelismo de carteiras distintas.
- **Barreira Múltipla contra Saldo Negativo:**
  1. *Camada de Domínio:* `Wallet.debit()` valida `balance >= amount`.
  2. *Camada de Persistência:* `WalletRepository.saveBalance()` valida `version = loadedVersion`.
  3. *Camada de Banco de Dados:* Constraint física `CHECK (balance_amount >= 0.00)`.
- **Precisão Financeira Estrita:** Proibido uso de tipos numéricos flutuantes (`number`, `float`) em qualquer cálculo ou comparação financeira. Apenas `Money` e `Decimal.js` com escala fixa 2.
- **Resiliência a Conflito de Chave Única:** Se duas requisições concorrentes com a mesma chave tentarem inserir antes da finalização de uma delas, a violação de constraint no banco deve ser tratada sem lançar erro 500, respondendo o replay correspondente ou conflito limpo.
- **Gestão do Pool de Conexões:** O pool de conexões do PostgreSQL deve suportar o pico de conexões concorrentes da suíte de testes sem exaustão ou vazamento de clientes.

---

## ✅ Critérios de Aceite

- [x] Cenário 100/80/80 executado com concorrência real: exatamente 1 transação aprovada (`201`), 1 rejeitada (`422 INSUFFICIENT_FUNDS`), saldo final `20.00` e 1 lançamento `DEBIT`.
- [x] Cenário de 50x e 100x requisições simultâneas com a mesma `Idempotency-Key` resulta em exatamente 1 débito, 1 transação criada (`201`) e todas as demais respondendo replay (`200 OK` com `idempotentReplay: true`).
- [x] Disparo de 100 apostas simultâneas de R$ 1,00 em carteira de R$ 50,00 resulta em exatamente 50 aprovadas, 50 rejeitadas, saldo final `0.00` e reconciliação contábil `consistent: true`.
- [x] Concorrência mista (20 BETs + 20 WINs simultâneos) finaliza com cálculo exato do saldo contábil sem divergências.
- [x] Processamento simultâneo em 10 carteiras distintas executa sem interferência mútua e sem ocorrência de deadlocks.
- [x] Tentativa simultânea de reuso de mesma chave com payload alterado rejeita a alteração com `409 IDEMPOTENCY_CONFLICT`.
- [x] Arquivo `test/concurrency/concurrency.test.ts` implementado cobrindo todos os cenários com assertions determinísticas.
- [x] Script `bun run test:concurrency` criado/validado no `package.json`.
- [x] Script `bun run test:pipeline` atualizado para incluir `test:concurrency` e executando 100% verde.

---

## 🧩 Impacto Técnico

### Módulos / Camadas Impactadas
- **Camada de Testes:** `test/concurrency/concurrency.test.ts` criado com setup contra banco isolado `wager_test`.
- **Camada de Aplicação / Persistência:** Ajustes no `ProcessWagerTransactionUseCase` e `MikroOrmUnitOfWork` caso necessário para captura e retry de corridas de constraint única.
- **Configuração:** `package.json` (`test:concurrency` e `test:pipeline`).

### Arquivos Prováveis
- `test/concurrency/concurrency.test.ts` *(novo)*
- `src/application/use-cases/process-wager-transaction.use-case.ts` *(refinamento de idempotência concorrente sob colisão de chave se necessário)*
- `package.json` *(atualização do script `test:pipeline`)*
- `test/helpers/db.ts` *(reutilização do harness de banco isolado)*

### Dependências
- Sem dependências externas adicionais (utiliza `bun:test`, `@nestjs/testing` e o harness existente).

---

## 🧭 Plano de Implementação

1. **Passo 1 — Análise e Harness de Teste de Concorrência:**
   - Criar `test/concurrency/concurrency.test.ts` utilizando o helper `setupTestDb` para provisionar o banco isolado `wager_test` e subir a aplicação NestJS ou instanciar os casos de uso com conexões concorrentes reais.
2. **Passo 2 — Implementar Cenário 100/80/80 e Hot Wallet (50x de 1.00 em 50.00):**
   - Escrever testes com `Promise.allSettled` garantindo que nenhuma condição de corrida permita saldo negativo.
3. **Passo 3 — Implementar Cenário de Idempotência Paralela Extrema (50x a 100x mesma chave):**
   - Submeter o endpoint/caso de uso a 50 requisições disparadas simultaneamente com a mesma chave.
   - Validar se a colisão na constraint única do PostgreSQL é tratada com elegância ou se o lock da carteira já serializa com perfeição.
4. **Passo 4 — Implementar Cenários de Operações Mistas e Múltiplas Carteiras:**
   - Testar concorrência intercalada de BET e WIN na mesma carteira.
   - Testar concorrência em 10 carteiras distintas em paralelo para comprovar ausência de lock global e de deadlocks.
5. **Passo 5 — Atualizar Scripts e Validar no Pipeline:**
   - Atualizar `test:pipeline` no `package.json` para incluir a etapa `bun run test:concurrency`.
   - Executar a suíte completa com `bun run test:pipeline` e verificar aprovação de 100% dos testes.

---

## 🧪 Testes Esperados

- [x] `100/80/80`: duas apostas de 80.00 concorrentes em saldo de 100.00 -> 1 sucesso (201), 1 rejeitada (422), saldo final 20.00.
- [x] `50x Idempotency Storm`: 50 requisições idênticas simultâneas -> 1 sucesso (201), 49 replays (200), 1 débito único.
- [x] `Hot Wallet 100 Bets`: 100 apostas de 1.00 concorrentes em saldo de 50.00 -> exatamente 50 aprovadas, 50 rejeitadas, saldo final 0.00.
- [x] `Mixed BET + WIN`: 20 apostas e 20 prêmios concorrentes -> saldo final bate com a fórmula matemática e reconciliação retorna `consistent: true`.
- [x] `Multi-Wallet Parallelism`: 10 carteiras distintas com 10 requisições simultâneas cada -> 100 sucessos sem bloqueio mútuo.
- [x] `Idempotency Conflict Under Race`: 2 requisições concorrentes com mesma chave e payloads divergentes -> 1 processada, 1 conflito 409.

---

## 🤖 Instruções para IA

### Objetivo Operacional
> Implemente somente o que está dentro do escopo desta spec (Fase 4). Em caso de dúvida, pergunte antes de assumir.

### O que a IA deve entregar
- Arquivo `test/concurrency/concurrency.test.ts` implementado com todos os cenários de alta concorrência.
- Pipeline `bun run test:pipeline` executando Lint Money, Typecheck, Unit, Integration e Concurrency com 100% de aprovação.
- Resumo claro e objetivo das validações realizadas.

### Observações específicas desta spec
- **NÃO FAZER COMMIT** sem permissão explícita do usuário.
- **NÃO RODAR MIGRATION MANUALMENTE** sem permissão (os testes de concorrência usam o banco isolado `wager_test` gerado e destruído via harness).
- **NÃO USAR `number`** para valores monetários.
- Testes devem usar paralelismo real com `Promise.all` ou `Promise.allSettled` contra instâncias reais do PostgreSQL no Docker.

---

## 📁 Pós-execução da Spec

Quando o usuário pedir para executar esta spec, assim que todas as instruções forem concluídas e validadas com testes, mova o arquivo desta spec para a pasta `docs/executed/2026-10-17-phase-04-concurrency-resilience.md`.
