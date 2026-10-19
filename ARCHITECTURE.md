# 🏛️ Arquitetura do Distributed Wagering Processor

> Documento técnico de referência do sistema **Distributed Wagering Processor**, especificando princípios de design, decisões contábeis, estratégias de concorrência, tolerância a falhas multi-instância, mensageria e o desenho de integração com provedores de identidade.
> 
> 🧠 **Registro Aprofundado de Decisões (ADR):** Para aprofundamento detalhado em cada decisão estrutural, alternativas descartadas e justificativas contábeis, consulte [**`docs/TECHNICAL_DECISIONS.md`**](docs/TECHNICAL_DECISIONS.md).

---

## 📑 Sumário

1. [Visão Geral & Princípios Arquiteturais](#1-visão-geral--princípios-arquiteturais)
2. [Garantias Financeiras & Modelo Contábil](#2-garantias-financeiras--modelo-contábil)
3. [Estratégia de Concorrência & Hot-Wallets](#3-estratégia-de-concorrência--hot-wallets)
4. [Idempotência Persistente de Dois Níveis](#4-idempotência-persistente-de-dois-níveis)
5. [Mensageria & Resiliência Assíncrona (Outbox/Inbox)](#5-mensageria--resiliência-assíncrona-outboxinbox)
6. [Resolução Fora de Ordem (Pending Reference Resolver)](#6-resolução-fora-de-ordem-pending-reference-resolver)
7. [Autenticação & Desenho de Identidade (Keycloak/OIDC)](#7-autenticação--desenho-de-identidade-keycloakoidc)
8. [Observabilidade, Métricas & Logs Estruturados](#8-observabilidade-métricas--logs-estruturados)
9. [Trade-offs & Limitações Conhecidas](#9-trade-offs--limitações-conhecidas)

---

## 1. Visão Geral & Princípios Arquiteturais

O **Distributed Wagering Processor** é um motor financeiro de alta resiliência projetado para processar operações de apostas (`BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK`, `DEPOSIT`) originadas de múltiplos provedores de jogos de azar via HTTP REST e filas AWS SQS FIFO.

### 📐 Clean Architecture / Hexagonal (Ports & Adapters)

O sistema segue uma separação rigorosa de responsabilidades dividida em camadas concêntricas:

```
src/
├── domain/                  # Domínio Puro (Zero dependências de framework/ORM)
│   ├── money/               # Value Object Money (escala 2 fixa, sem floating-point)
│   ├── wallet/              # Agregado Wallet e invariantes de saldo
│   ├── wagering/            # Entidade WagerTransaction, Policy e máquina de estados
│   ├── ledger/              # Entidade WalletLedgerEntry (imutável)
│   ├── messaging/           # Entidades InboxMessage e OutboxMessage
│   └── events/              # Eventos de integração transacionais
├── application/             # Casos de Uso & Portas de Entrada/Saída
│   ├── use-cases/           # ProcessWagerTransaction, Reconcile, Outbox, Resolver
│   ├── ports/               # Repositórios, UnitOfWork, MessagePublisher
│   └── dto/                 # Contratos de entrada e saída
├── infrastructure/          # Adaptadores Técnicos & Tecnologias
│   ├── persistence/         # MikroORM, PostgreSQL, Migrations, Mappers
│   ├── sqs/                 # Adaptador AWS SQS SDK v3
│   ├── observability/       # Métricas Prometheus (prom-client) e Logs Pino
│   └── config/              # Configuração tipada validada com Zod
└── interfaces/              # Entradas do Sistema (Drivers)
    ├── http/                # Controllers NestJS, Filters, Swagger, Dashboard
    └── workers/             # Consumidor SQS FIFO, Outbox Publisher, Resolver
```

### 🎯 Princípios Fundamentais:
1. **Domínio Puro e Agnóstico:** O domínio (`src/domain/`) não contém decorators do NestJS nem do MikroORM. Toda hidratação é feita via factories explícitas e mappers de infraestrutura.
2. **Stateless Nodes (Escalabilidade Horizontal):** As instâncias do serviço não mantêm estado crítico em memória nem sincronizam locks locais; a integridade e coordenação distribuída são delegadas às garantias ACID do PostgreSQL.
3. **Papeis por Processo (`APP_ROLE`):** A mesma imagem e binário suporta papéis especializados (`all`, `api`, `consumer`, `outbox`, `resolver`), viabilizando escalonamento assimétrico de containers.
4. **Dual-Compatibility & Conformidade Estrita (Seções 9 e 10):** A camada de interface HTTP e mensageria implementa compatibilidade dupla. Suporta aliases `@Controller(["wagering/transactions", "transactions"])`, rota canônica de provedor `GET /providers/:providerId/wagering/transactions/:externalTransactionId`, envelopes de mensagem SQS `{ type: "WagerTransactionRequested", data: { ... } }` e envelope híbrido de resposta (`transactionId` + `id`, `balance` + `resultBalance`), mantendo 100% de retrocompatibilidade com a suíte de testes existente.

---

## 2. Garantias Financeiras & Modelo Contábil

### 💰 O Value Object `Money` (Sem Floating-Point)

A representação de dinheiro em sistemas de apostas e contabilidade exige precisão absoluta. O JavaScript nativo utiliza IEEE 754 (ponto flutuante de precisão dupla), o que induz a erros clássicos como `0.10 + 0.20 = 0.30000000000000004`.

* **Encapsulamento com `decimal.js`:** A classe `Money` encapsula valores monetários como strings imutáveis, normalizadas rigorosamente para duas casas decimais (`^\d+\.\d{2}$`).
* **Regras de Validação Estritas:** Rejeita na raiz `NaN`, `Infinity`, valores negativos, strings vazias, notação científica e frações menores que centavos.
* **Mapeamento em Banco:** Persistido no PostgreSQL como `NUMERIC(20,2)` acompanhado da coluna de moeda `CHAR(3)`. O driver `pg` está configurado para retornar `NUMERIC` como string pura, garantindo que nenhum número seja convertido para float no trânsito rede-memória.

### 📜 Ledger Contábil Imutável (Double-Entry Inspired)

Todo movimento que altera o saldo da carteira produz obrigatoriamente um registro na tabela `wallet_ledger_entries`.

* **Estrutura Contábil:**
  - `balance_before`: Saldo imediatamente anterior à mutação.
  - `amount`: Valor absoluto da movimentação (sempre positivo).
  - `direction`: `CREDIT` ou `DEBIT`.
  - `balance_after`: Saldo resultante pós-movimentação.
  - `seq`: Sequenciador global monotônico crescente (`BIGSERIAL`), utilizado como cursor opaco para paginação estável.
* **Imutabilidade Física no Banco:** Triggers SQL instalados na tabela disparam exceções imediatas (`RAISE EXCEPTION`) perante qualquer tentativa de `UPDATE` ou `DELETE`. Apenas inserções (`INSERT`) são permitidas.
* **Restrição Matemática por CHECK:**
  ```sql
  CHECK (
    (direction = 'CREDIT' AND balance_after = balance_before + amount) OR
    (direction = 'DEBIT'  AND balance_after = balance_before - amount)
  )
  ```
* **Reconciliação Auditável (`/wallets/:id/reconciliation`):** Compara em tempo real `wallet.balance` com `Σ(CREDIT) - Σ(DEBIT)`. Qualquer divergência é tratada como anomalia grave (`reconciliation_mismatch_total`).

> 📖 **Documentação Completa do Banco de Dados:** Para o diagrama ERD, catálogo minucioso de cada coluna, tipos, constraints e triggers de todas as tabelas (`wallets`, `wager_transactions`, `wallet_ledger_entries`, `outbox_messages`, `inbox_messages`), consulte [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md).

---

## 3. Estratégia de Concorrência & Hot-Wallets

### 🔒 Por que Lock Pessimista por Carteira?

Em plataformas de jogos, um jogador pode realizar apostas ultrarrápidas em múltiplas abas, jogos simultâneos ou receber estornos concorrentes na mesma carteira (*hot-wallet*).

| Abordagem | Vantagem | Desvantagem em Hot-Wallets | Veredito |
|---|---|---|---|
| **Lock Otimista (`version`)** | Sem travas prévias em leituras | Sob alta concorrência de apostas (ex.: 50 req/s), dezenas de transações falham com `OptimisticLockException`, gerando tempestades de retentativas (*retry storms*), consumo brutal de CPU e latência degradada. | ❌ Inadequado |
| **Lock Distribuído (Redis)** | Rápido em memória | Adiciona complexidade operacional de consenso (Redlock), risco de *split-brain* e perda de atomicidade entre o lock e a transação SQL. | ❌ Desnecessário |
| **Lock Pessimista por Linha (`FOR UPDATE`)** | Determinístico, escopado à carteira, serialização pontual no banco | Aguarda brevemente a transação concorrente da mesma carteira finalizar. | ✅ **Adotado** |

### 🛡️ Implementação e Escopo:

1. Apenas a linha específica da carteira é travada:
   ```sql
   SELECT * FROM wallets WHERE id = :walletId FOR UPDATE;
   ```
2. **Sem Bloqueio Global:** Carteiras distintas progridem com paralelismo total e independente.
3. **Cinto e Suspensório:** A atualização final de saldo verifica a versão (`UPDATE wallets SET balance_amount=?, version=version+1 WHERE id=? AND version=?`) e o banco protege contra saldo negativo via `CHECK (balance_amount >= 0)`.

---

## 4. Idempotência Persistente de Dois Níveis

O processador garante que requisições idênticas repetidas (quedas de rede, retentativas de clientes ou reentregas de filas) nunca produzam duplo débito ou duplo crédito.

### Nível 1: Chave de Idempotência do Cliente (`Idempotency-Key`)
* Chave fornecida no header HTTP pelo cliente/provedor.
* Armazenada em coluna com restrição `UNIQUE(idempotency_key)`.

### Nível 2: Identificador do Provedor (`providerId` + `externalTransactionId`)
* Índice único composto: `UNIQUE(provider_id, external_transaction_id)`.
* Impede que o provedor reenvie a mesma aposta externa usando uma chave de idempotência diferente.

### 🔍 Diferenciação Canônica de Replay vs Conflito & Dual-Compatibility:

O payload é transformado em um **JSON Canônico** (chaves ordenadas lexicograficamente de forma recursiva) e seu hash SHA-256 é computado:
* **Normalização Canônica (Dual-Compatibility):** A camada de DTOs normaliza tanto requisições com o objeto monetário `money: { amount, currency }` (Seção 9 Jungle Gaming) quanto o formato plano legado (`amount`, `currency`) para a mesma estrutura interna canônica antes do cálculo do hash. Isso garante que submeter a mesma aposta em formatos sintáticos distintos sob a mesma `Idempotency-Key` gere exatamente o mesmo SHA-256, sendo atendida como replay válido (`200 OK`) sem falso conflito.
* **Mesma Chave + Mesmo Payload Hash:** **Replay Válido (`200 OK`).** O snapshot persistido da transação é retornado (`idempotentReplay: true`), refletindo o saldo e status da época sem alterar nada.
* **Mesma Chave + Payload Hash Divergente:** **Conflito de Idempotência (`409 Conflict`).** Rejeição imediata sem efeitos colaterais.

---

## 5. Mensageria & Resiliência Assíncrona (Outbox/Inbox)

### 📤 Transactional Outbox Pattern (Publisher com Lease)

Para evitar inconsistências em que a transação no banco é commitada mas o evento no broker falha (ou vice-versa), adotamos o padrão Transactional Outbox:

1. O evento (`WalletBalanceChanged`, `WagerTransactionProcessed`, etc.) é inserido na tabela `outbox_messages` dentro da mesma transação SQL que altera a carteira e o ledger.
2. O **Outbox Publisher Worker** roda periodicamente, reivindicando mensagens pendentes com:
   ```sql
   SELECT * FROM outbox_messages
   WHERE published_at IS NULL AND next_attempt_at <= now()
   ORDER BY occurred_at
   FOR UPDATE SKIP LOCKED LIMIT 50;
   ```
3. O worker aplica um *lease* temporal (`locked_until = now() + 30s`) e commita a reivindicação.
4. O evento é despachado para a fila AWS SQS FIFO `wallet-events.fifo` com `MessageDeduplicationId = event.id` e `MessageGroupId = event.aggregateId`.
5. Se o worker cair após publicar mas antes de registrar `published_at`, o lease expira e outro worker republica; a fila SQS FIFO e os consumidores deduplicam pelo `eventId`, mantendo a semântica **At-Least-Once**.

### 📥 Inbox Pattern & Envelope Flexível (Consumidor SQS FIFO)

1. **Envelope Jungle Gaming & Compatibilidade Dupla:** O consumidor SQS aceita tanto o envelope oficial de eventos da Jungle Gaming `{ type: "WagerTransactionRequested", data: { ... } }` quanto payloads planos diretos. O parser extrai e normaliza `data.money` e infere a `idempotencyKey` caso omitida (`providerId:externalTransactionId`).
2. Mensagens de transação recebidas de `wager-transactions.fifo` registram um envelope na tabela `inbox_messages` (`PRIMARY KEY(consumer_name, message_id)`).
3. Se a mensagem já existir e estiver marcada como processada, o consumidor faz `DeleteMessage` imediatamente (ack) sem reprocessar a lógica contábil.
4. Se um nó for desligado bruscamente (`SIGKILL` ou crash) após commitar no banco mas antes do ack no SQS, a mensagem reentregue pelo LocalStack é absorvida silenciosamente pela idempotência persistente e pelo inbox.

### 💀 Dead Letter Queue (DLQ) & Poison Pills:

* Mensagens com JSON quebrado, schema corrompido ou IDs malformados são classificadas como *poison pills*.
* O consumidor encaminha a mensagem imediatamente para `wager-transactions-dlq.fifo` e a deleta da fila principal, evitando travamento da fila FIFO.

---

## 6. Resolução Fora de Ordem (Pending Reference Resolver)

Em arquiteturas distribuídas e filas concorrentes, transações dependentes podem chegar invertidas:
* Exemplo: Uma premiação (`WIN`), cancelamento (`ROLLBACK`) ou estorno (`REFUND`) chega antes do registro da aposta inicial (`BET`).

### Máquina de Estados e Ciclo de Vida:

```
[Chegada da Requisição]
          │
          ▼
   Referência existe?
    ├── SIM ──► Avalia Política Contábil ──► [PROCESSED] ou [REJECTED]
    └── NÃO
          │
          ▼
   [PENDING_REFERENCE] (HTTP 202 Accepted)
          │
          ├────────────────────────────────────────┐
          ▼ (Fast-Path)                            ▼ (Worker Agendado)
   [BET de referência chega]              [Varredura a cada 1s com SKIP LOCKED]
          │                                        │
          ▼                                        ▼
   Reavalia e aplica imediatamente        Referência chegou?
                                           ├── SIM ──► [PROCESSED] / [REJECTED]
                                           └── NÃO
                                                 ├── attempts < 10 && TTL < 15m ──► Reagenda (Backoff + Jitter)
                                                 └── Expirou ──► [REJECTED: REFERENCE_NOT_FOUND]
```

### ⏱️ Justificativa dos Limites de Tolerância (10 Tentativas / TTL 15 min):
* **Por que 15 minutos?** Cobre folgadamente latências assimétricas e janelas de indisponibilidade transitória entre provedores externos de jogos (Live Casino, Slots).
* **Por que 10 tentativas com Backoff Exponencial e Jitter?** O algoritmo `min(1s * 2^attempts, 60s) + jitter(0..1000ms)` evita sincronização de retentativas (*thundering herd*) e alivia a pressão sobre o banco enquanto aguarda a referência.

---

## 7. Autenticação & Desenho de Identidade (Keycloak/OIDC)

### Estado Atual: Ponto de Extensão No-Op
O projeto implementa o contrato `AuthGuard` e a porta `ProviderIdentityPort`. Em ambiente de desenvolvimento e testes locais, o guard opera em modo pass-through (no-op), permitindo que a avaliação foque na correção financeira e concorrência sem dependência de um servidor de autenticação pesado.

### 🏢 Desenho Arquitetural de Produção com Keycloak

Para ambiente produtivo, a integração com Keycloak / OIDC segue a seguinte especificação:

```
┌─────────────────┐       1. POST /token (client_id, client_secret)      ┌──────────────────┐
│  Game Provider  │ ───────────────────────────────────────────────────► │  Keycloak (IdP)  │
│  (ex: Evolution)│ ◄─────────────────────────────────────────────────── │  Realm: Wagering │
└─────────────────┘             2. JWT Bearer Token (RS256)              └──────────────────┘
         │
         │ 3. POST /transactions (Header: Authorization: Bearer <token>)
         ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ Distributed Wagering Processor                                                           │
│                                                                                           │
│  ┌──────────────┐    4. Valida assinatura via JWKS (/certs)   ┌────────────────────────┐  │
│  │  AuthGuard   │ ──────────────────────────────────────────► │ Keycloak Public Key Ctx│  │
│  └──────────────┘                                             └────────────────────────┘  │
│         │                                                                                 │
│         │ 5. Provider Binding Validation:                                                 │
│         │    jwt.claims.provider_id === request.body.providerId                          │
│         ▼                                                                                 │
│  ┌──────────────┐                                                                         │
│  │ Use Case     │                                                                         │
│  └──────────────┘                                                                         │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Especificação Técnica do JWT:
1. **Flow:** OAuth 2.0 Client Credentials Grant (`grant_type=client_credentials`).
2. **Assinatura:** Chave assimétrica RS256 com rotação de certificados via endpoint `/.well-known/openid-configuration` e `certs`.
3. **Claims Requeridas:**
   - `sub`: Identificador único da credencial do provedor.
   - `provider_id`: Código normalizado do provedor (ex.: `"evolution"`, `"pragmatic"`).
   - `roles`: `["wager:write", "wager:read"]`.
4. **Proteção Anti-Impersonation (Provider Binding):** O `AuthGuard` valida que o `providerId` submetido no corpo da transação confere obrigatoriamente com a claim `provider_id` do token JWT. Um provedor jamais consegue submeter ou reverter apostas em nome de outro.

---

## 8. Observabilidade, Métricas & Logs Estruturados

### 📊 Métricas Prometheus Padronizadas (`prom-client`)

O serviço expõe métricas no formato padrão do Prometheus através do endpoint `/metrics`:

| Métrica | Tipo | Labels | Descrição |
|---|---|---|---|
| `wager_transactions_total` | Counter | `status`, `kind` | Total de transações contábeis discriminadas por desfecho e tipo. |
| `idempotent_replays_total` | Counter | `kind`, `source` | Total de requisições de replay servidas sem novo débito. |
| `retries_total` | Counter | `operation` | Retentativas executadas por workers ou mitigação de concorrência. |
| `lock_conflicts_total` | Counter | `resource` | Conflitos de lock pessimista mitigados na carteira. |
| `outbox_lag_seconds` | Gauge | — | Idade do evento pendente mais antigo na tabela `outbox_messages`. |
| `processing_duration_seconds` | Histogram | `operation`, `status` | Latência de processamento de operações contábeis. |
| `reconciliation_mismatch_total` | Counter | — | Divergências contábeis identificadas na reconciliação de saldo. |
| `sqs_messages_consumed_total` | Counter | `consumer`, `status` | Mensagens processadas da fila SQS via Inbox Pattern. |
| `dlq_messages_total` | Counter | `consumer`, `reason` | Mensagens envenenadas (poison pills) enviadas à DLQ. |
| `pending_references_active_gauge` | Gauge | — | Volume instantâneo de transações em `PENDING_REFERENCE`. |

### 📝 Logs Estruturados JSON via Pino

Todos os logs são emitidos em formato JSON estrito para `stdout`, compatíveis com Datadog, Grafana Loki e CloudWatch.

* **Rastreabilidade Distribuída (`CorrelationContext`):** Utiliza `AsyncLocalStorage` nativo do runtime Bun/Node para propagar `correlationId` (extraído de `X-Correlation-Id` ou gerado via UUID v7), `instanceId`, `walletId`, `transactionId` e `providerId` por todas as camadas da execução assíncrona.
* **Sanitização de Dados:** Payloads financeiros brutos desestruturados nunca são logados diretamente; registram-se apenas metadados de negócio e auditoria.

### 🖥️ Dashboard Operacional & Separação OLTP vs. OLAP em Produção

Para fins de avaliação local do desafio técnico e inspeção interativa de mensagens e transações financeiras, o serviço expõe uma interface visual em `/dashboard` acompanhada do endpoint de consulta (`GET /api/dashboard/operations`). Esse endpoint lê sob demanda as operações registradas no banco relacional (`WagerTransactionRecord`, `OutboxMessageRecord`, `InboxMessageRecord`), protegido por limite rígido (`LIMIT 25`) e cache em memória no cliente para não gerar sobrecarga.

**Evolução Arquitetural para Produção de Alta Escala:**
* **Isolamento de Carga (Read Replicas):** Em ambientes produtivos com milhares de apostas por segundo, consultas analíticas e painéis operacionais jamais devem concorrer diretamente com o nó escritor primário (OLTP). Tais leituras são obrigatoriamente roteadas para **Read Replicas** dedicadas com replicação assíncrona, preservando 100% da CPU, buffer pool e I/O do nó primário para o processamento financeiro e locks pessimistas (`SELECT ... FOR UPDATE`).
* **CQRS com Banco Analítico / Colunar (ClickHouse / OpenSearch):** Para auditorias em escala de bilhões de transações e dashboards analíticos de backoffice (Grafana, Retool, Metabase), os eventos publicados no stream (SQS/Kafka) alimentam bancos colunares ou de busca (ex: ClickHouse, OpenSearch, Snowflake). Consultas com ordenação temporal e filtros de agregados são executadas em milissegundos sem tocar no banco relacional transacional.
* **Retenção e Archival do Outbox/Inbox:** As tabelas transacionais de mensageria (`outbox_messages` e `inbox_messages`) operam como filas efêmeras. Em produção, adota-se particionamento temporal ou workers periódicos de arquivamento (ex: retenção de 7 dias para registros com `publishedAt IS NOT NULL`), evitando *table bloat* de MVCC no PostgreSQL.

---

## 9. Trade-offs & Limitações Conhecidas

1. **Reversões Parciais:** Não são permitidas nesta versão. Cancelamentos (`ROLLBACK`) e estornos (`REFUND`) devem referenciar o valor total da aposta original.
2. **Moeda Fixada em `BRL`:** Embora a modelagem de domínio do Value Object `Money` seja agnóstica e suporte qualquer moeda de 3 letras (ISO 4217), as transações correntes operam em `BRL` sem conversão cambial em tempo real (*FX rate*).
3. **Escopo de Locks no Banco:** A coordenação de concorrência é inteiramente dependente do PostgreSQL. Caso o cluster do PostgreSQL fique indisponível, o serviço responde `503 Service Unavailable` com header `Retry-After`.
4. **Entrega At-Least-Once:** Tanto o Outbox Publisher quanto o consumidor SQS operam com garantia de entrega ao menos uma vez. Clientes e subsistemas a jusante devem desduplicar eventos utilizando o `eventId` ou `idempotencyKey`.
5. **Isolamento OLTP em Produção:** Na demonstração local do desafio, o dashboard administrativo consulta o banco relacional sob demanda com paginação `LIMIT 25` e cache local. Em produção de alta volumetria, essa leitura é desacoplada via Read Replicas ou ingestão analítica via ClickHouse/OpenSearch para blindar o nó master OLTP.

---

## 10. Benchmarks, Capacidade de Vazão & Resiliência sob Carga (Fase 10)

O serviço foi submetido a baterias exaustivas de testes de estresse e benchmarking via `autocannon` (`bun run test:load`), documentadas detalhadamente em [`docs/BENCHMARKS.md`](docs/BENCHMARKS.md).

### 📊 Resumo dos Resultados Empíricos Medidos:

| Cenário de Teste | Vazão (RPS) | Latência p50 | Latência p99 | Auditoria Contábil (Ledger vs Saldo) |
| :--- | :---: | :---: | :---: | :---: |
| **Alta Dispersão (Baseline Throughput)** | **803 RPS** | **27 ms** | **81 ms** | **✔ 100% Íntegro (Zero divergências)** |
| **Hot-Wallet Saturation (Concorrência Limítrofe)** | **397 RPS** | **39 ms** | **155 ms** | **✔ 100% Íntegro (Saldo exato R$ 0,00)** |
| **Idempotency Replay Storm (Avalanche)** | **999 RPS** | **20 ms** | **77 ms** | **✔ 100% Íntegro (Saldo imutável)** |
| **Carga Mista Dinâmica (Cassino)** | **766 RPS** | **29 ms** | **65 ms** | **✔ 100% Íntegro (Zero desvios)** |

### 🛡️ Comportamento Observado sob Estresse:
* **Concorrência Granular por Linha:** Quando as operações são dispersas entre carteiras diferentes, a vazão atinge ~800 RPS por instância com p99 inferior a 85 ms, sem que nenhuma transação interfira ou bloqueie outra.
* **Resiliência de Hot-Wallet:** Sob 1.500+ requisições simultâneas disputando uma carteira limítrofe de R$ 50,00, o lock pessimista (`SELECT ... FOR UPDATE`) manteve fila ordenada: exatamente 50 transações debitaram R$ 1,00, as restantes foram recusadas com elegância (`422 INSUFFICIENT_FUNDS`), e o saldo final terminou rigorosamente em R$ 0,00 sem permitir *double-spending* ou saldo negativo.
* **Bypass de Idempotência:** A leitura direta do snapshot persistido (`idempotentReplay: true`) entrega quase 1.000 RPS com latência mediana de 20 ms, blindando o banco contra tempestades de retentativas.
* **Integridade Absoluta:** Em todos os cenários, 100% das carteiras afetadas foram reconciliadas matematicamente via `POST /wallets/:id/reconciliation`, atestando conformidade com a fórmula fundamental `wallet.balance == SUM(ledger.credits) - SUM(ledger.debits)`.
