# 📄 Fase 9 — Observabilidade, Métricas Prometheus, Logs Estruturados e Documentação Arquitetural

> Especificação técnica da **Fase 9** do Desafio Técnico Jungle Gaming. Implementação da camada definitiva de observabilidade e documentação: instrumentação de métricas Prometheus padronizadas, logging estruturado em JSON via Pino com rastreabilidade distribuída (`correlationId`, `instanceId`, `walletId`, `transactionId`, `providerId`), consolidação do documento de decisões arquiteturais (`ARCHITECTURE.md`) e atualização final do guia operacional (`README.md`).

---

## 📌 Metadados

| Campo | Valor |
|-------|-------|
| **Versão** | v1.0 |
| **Data** | 18/10/2026 |
| **Autor** | Guilherme |
| **Status** | Concluído |
| **Prioridade** | Alta |
| **Tipo** | Feature / Observabilidade, Métricas e Documentação |
| **Referência Mestre** | [`docs/specs/2026-10-16-distributed-wagering-processor.md`](file:///Users/guilherme/testes/jungle_gaming_test/docs/specs/2026-10-16-distributed-wagering-processor.md) |
| **Versão Alvo** | `0.9.0` |

---

## 📝 Resumo

Implementar a infraestrutura completa de observabilidade e documentação técnica do **Distributed Wagering Processor**, integrando métricas Prometheus padronizadas (`wager_transactions_total`, `idempotent_replays_total`, `retries_total`, `dlq_messages_total`, `lock_conflicts_total`, `outbox_lag_seconds`, `processing_duration_seconds`, `reconciliation_mismatch_total`) aos casos de uso centrais, workers assíncronos e filtros de exceção. A fase estabelece também o padrão corporativo de logs estruturados em JSON via Pino, propagando contexto assíncrono (`correlationId`, `instanceId`, `walletId`, `providerId`) com sanitização estrita para proteger payloads financeiros. Por fim, consolida o repositório com a criação do documento técnico [`ARCHITECTURE.md`](file:///Users/guilherme/testes/jungle_gaming_test/ARCHITECTURE.md) (detalhando todas as decisões, invariantes contábeis, concorrência e o desenho de integração OIDC/Keycloak) e a atualização abrangente do [`README.md`](file:///Users/guilherme/testes/jungle_gaming_test/README.md).

---

## 📦 Escopo

### ✅ Incluído

1. **Métricas Prometheus Padronizadas (`prom-client`):**
   - `wager_transactions_total{status, kind}`: Counter de transações financeiras discriminadas por status (`PROCESSED`, `REJECTED`, `PENDING_REFERENCE`, `FAILED`) e tipo de operação (`BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK`).
   - `idempotent_replays_total{kind, source}`: Counter de replays idempotentes atendidos sem duplicação de saldo via HTTP e SQS.
   - `retries_total{operation}`: Counter de retentativas executadas (workers de outbox, pending reference resolver e retentativas de concorrência transitória).
   - `dlq_messages_total{consumer, reason}`: Counter de mensagens descartadas ou encaminhadas à DLQ após esgotamento de tentativas ou envenenamento (poison pill).
   - `lock_conflicts_total{resource}`: Counter de conflitos de lock pessimista por carteira, deadlocks ou timeouts de serialização capturados.
   - `outbox_lag_seconds`: Gauge monitorando a defasagem temporal entre o evento não publicado mais antigo no outbox e o momento atual.
   - `processing_duration_seconds{operation, status}`: Histogram de latência e tempo de execução de operações contábeis.
   - `reconciliation_mismatch_total`: Counter de divergências contábeis detectadas na reconciliação de saldo vs histórico de ledger.
   - Exposição via endpoint `/metrics` (formato oficial Prometheus scrape para coletores) e `/api/metrics` (formato JSON consumível pelo dashboard).
   - Atualização do dashboard visual (`/dashboard`) com cartões e gráficos das novas métricas contábeis e de concorrência.

2. **Logging Estruturado JSON & Rastreabilidade Distribuída:**
   - Padronização de logs da aplicação em formato JSON estrito para `stdout` via Pino / `nestjs-pino`.
   - Propagação de contexto assíncrono via `AsyncLocalStorage` para rastreamento de requisições:
     - Extração do cabeçalho `X-Correlation-Id` (ou geração automática de UUID v7 se não fornecido).
     - Associação sistemática de `correlationId`, `instanceId` (`INSTANCE_ID`), `messageId` (mensagens SQS), `transactionId`, `walletId`, `providerId` e `externalTransactionId`.
   - **Regra de Sanitização e Segurança:** NUNCA emitir em logs payloads financeiros brutos desestruturados ou dados sensíveis; limitar logs a metadados operacionais, identificadores e desfechos contábeis.

3. **Documentação Arquitetural Detalhada (`ARCHITECTURE.md`):**
   - Criação do documento [`ARCHITECTURE.md`](file:///Users/guilherme/testes/jungle_gaming_test/ARCHITECTURE.md) abordando:
     - **Arquitetura Geral:** Clean Architecture / Hexagonal, isolamento do domínio puro sem dependência de NestJS ou MikroORM, TypeScript estrito.
     - **Garantias Financeiras:** Value Object `Money` (escala 2 fixa, ausência de floating-point, banco `NUMERIC(20,2)` com type parser string), Ledger contábil append-only com trigger de imutabilidade.
     - **Estratégia de Concorrência:** Lock pessimista por carteira (`SELECT ... FOR UPDATE`), serialização por entidade sem bloqueio global, justificativa técnica contra lock otimista em hot-wallets.
     - **Idempotência Persistente:** Índices únicos em `idempotency_key` e `(provider_id, external_transaction_id)`, snapshot do resultado contábil e cálculo de payload hash canônico SHA-256.
     - **Resiliência e Mensageria:** Transactional Outbox Pattern com lease e `FOR UPDATE SKIP LOCKED`, Inbox Pattern para deduplicação em consumidores SQS FIFO, DLQ e graceful shutdown.
     - **Resolução Fora de Ordem:** Pending Reference Resolver agendado, fast-path imediato, backoff exponencial com jitter e justificativa do limite de 10 tentativas / TTL de 15 minutos.
     - **Desenho de Autenticação & Identidade:** Ponto de extensão atual (`AuthGuard` no-op + `ProviderIdentityPort`) e especificação técnica para produção com Keycloak / OIDC (Client Credentials, escopos e amarração estrita entre `providerId` do token e do payload).
     - **Trade-offs e Limitações:** Documentação transparente sobre escopos deliberadamente omitidos (reversões parciais, conversão cambial em tempo real).

4. **Consolidação do Manual Operacional (`README.md`):**
   - Atualização completa do [`README.md`](file:///Users/guilherme/testes/jungle_gaming_test/README.md) integrando visão de ponta a ponta:
     - Instruções de inicialização com Docker Compose (multi-instância x3, PostgreSQL, LocalStack SQS FIFO).
     - Relação de todos os comandos e scripts de teste (`test`, `test:integration`, `test:concurrency`, `test:multi-instance`, `lint:money`, `check`).
     - Tabela detalhada de endpoints da API HTTP com exemplos funcionais de cURL.
     - Documentação das métricas expostas e instrução de consumo no Prometheus / Grafana.

5. **Testes Automatizados de Observabilidade:**
   - Testes unitários para o registro e incremento das novas métricas.
   - Testes de integração validando a emissão de métricas e cabeçalhos em cenários de transação, replay idempotente, concorrência e reconciliação.

### ❌ Fora do Escopo

- Implementação funcional de servidor Keycloak em container ou execução de IdP externo durante os testes locais (mantém-se como especificação e desenho de integração).
- Implementação de trace distribuído com OpenTelemetry / Jaeger / W3C Trace Context (diferencial opcional não obrigatório nesta fase).
- Testes de carga em massa com k6 ou autocannon (reservado para a Fase 10 opcional).
- Alteração no schema do PostgreSQL, migrations ou regras de domínio contábil já homologadas nas fases anteriores.

---

## 🔄 Fluxo Principal

### Comportamento Atual

1. Métricas Prometheus estão dispersas em arquivos isolados (`outbox-metrics.ts`, `pending-reference-metrics.ts`, `sqs-consumer-metrics.ts`), cobrindo apenas outbox, SQS e referências pendentes.
2. Não há métricas dedicadas para transações por status (`wager_transactions_total`), replays idempotentes (`idempotent_replays_total`), conflitos de concorrência (`lock_conflicts_total`) nem inconsistências de reconciliação (`reconciliation_mismatch_total`).
3. O logging utiliza instâncias padrão do NestJS `Logger` e `console.error`, gerando strings mistas e sem injeção padronizada de `correlationId` distribuído em todas as operações HTTP.
4. O repositório ainda não possui o arquivo [`ARCHITECTURE.md`](file:///Users/guilherme/testes/jungle_gaming_test/ARCHITECTURE.md), item obrigatório para a avaliação das decisões de design técnico.

### Fluxo Proposto

#### Fluxo 1: Coleta e Exposição Unificada de Métricas

1. Durante o ciclo de vida da aplicação, o singleton/módulo de observabilidade [`WageringMetrics`](file:///Users/guilherme/testes/jungle_gaming_test/src/infrastructure/observability/wagering-metrics.ts) inicializa e registra as métricas no registro global do Prometheus (`prom-client`).
2. Quando uma transação financeira é executada via HTTP ou SQS:
   - Em caso de processamento novo bem-sucedido: incrementa `wager_transactions_total{status="PROCESSED", kind=...}` e observa a duração em `processing_duration_seconds`.
   - Em caso de replay idempotente idêntico: incrementa `idempotent_replays_total{kind=..., source=...}`.
   - Em caso de referência dependente ausente: incrementa `wager_transactions_total{status="PENDING_REFERENCE", kind=...}`.
   - Em caso de violação de regra de negócio: incrementa `wager_transactions_total{status="REJECTED", kind=...}`.
3. Quando ocorre um conflito de concorrência ou timeout de lock em banco (`ConcurrencyConflictError`):
   - O `HttpExceptionFilter` ou a camada de persistência incrementa `lock_conflicts_total{resource="wallet"}` e `retries_total{operation="wallet_lock"}`.
4. Quando a rota `/wallets/:id/reconciliation` identifica qualquer divergência contábil (`consistent: false`):
   - Incrementa imediatamente `reconciliation_mismatch_total` e emite log com nível `error`.
5. Coletores Prometheus ou navegadores acessam `GET /metrics` e recebem o dump formatado em texto padrão ou a interface interativa do dashboard.

#### Fluxo 2: Rastreabilidade Distribuída e Logging Estruturado

1. Ao receber uma requisição HTTP, o middleware [`CorrelationIdMiddleware`](file:///Users/guilherme/testes/jungle_gaming_test/src/interfaces/http/middlewares/correlation-id.middleware.ts) obtém o header `X-Correlation-Id` ou gera um novo UUID.
2. O contexto da requisição (`correlationId`, `instanceId`, `clientIp`) é armazenado no contexto assíncrono de execução (`AsyncLocalStorage`).
3. O logger configurado com Pino formata cada log como um objeto JSON estruturado:
   ```json
   {
     "level": 30,
     "time": 1729278000000,
     "pid": 1234,
     "instanceId": "instance-1",
     "correlationId": "019280b0-7f24-7000-8000-123456789abc",
     "walletId": "4a89972f-1ac6-4cf8-949f-c8c9605baf27",
     "transactionId": "019280b0-7f24-7000-8000-987654321def",
     "providerId": "evolution",
     "kind": "BET",
     "msg": "Wager transaction processed successfully"
   }
   ```
4. Ao responder a requisição, o cabeçalho `X-Correlation-Id` é devolvido ao cliente para rastreabilidade de ponta a ponta.

#### Fluxo 3: Documentação e Síntese Arquitetural

1. A raiz do repositório passa a conter o arquivo [`ARCHITECTURE.md`](file:///Users/guilherme/testes/jungle_gaming_test/ARCHITECTURE.md), cobrindo diagramas conceituais, decisões de modelagem contábil, concorrência pessimista, tolerância a falhas e o desenho da autenticação Keycloak.
2. O manual [`README.md`](file:///Users/guilherme/testes/jungle_gaming_test/README.md) é atualizado com comandos unificados, descrição clara dos scripts e orientações para testes de observabilidade.

### Fluxos Alternativos

- Se o cabeçalho `X-Correlation-Id` não for enviado pelo cliente HTTP, a aplicação gera automaticamente um UUID v7 e o vincula a toda a árvore de logs da requisição.
- Se a requisição for originada por mensagem SQS FIFO, o `messageId` do SQS é registrado no log como identificador de correlação principal ou secundário.
- Se a rota `/metrics` for acessada com header `Accept: text/html` (navegador padrão) e sem `?raw=true`, o dashboard interativo continua sendo renderizado, exibindo os dados consolidados das novas métricas.

---

## 📐 Regras e Restrições

### Regras de Negócio e Observabilidade

1. **Taxonomia Padronizada de Métricas:**
   - Métricas financeiras e de transação devem utilizar labels padronizados em caixa baixa (`status`, `kind`, `operation`, `consumer`, `reason`).
   - Valores monetários nunca devem ser expostos como float bruto em labels ou métricas de gauge que possam distorcer a precisão contábil.
2. **Imutabilidade e Consistência de Replay:**
   - Replays de transações idempotentes devem contabilizar exclusivamente a métrica `idempotent_replays_total`, sem inflacionar a métrica `wager_transactions_total{status="PROCESSED"}`.
3. **Alarme Contábil:**
   - Qualquer evento onde `reconciliation_mismatch_total > 0` é classificado como anomalia contábil severa (severidade crítica em sistemas de produção), gerando log de nível `error`.

### Restrições Técnicas / Funcionais

1. **Proteção Contra Floating-Point (`Money`):**
   - É terminantemente proibido o uso de `number`/`float` nativo de JavaScript para computação ou transporte de valores monetários. Mantém-se o uso estrito de `Money` e strings com escala decimal 2.
2. **Segurança de Logs e Mascaramento:**
   - É proibido logar payloads financeiros completos, números de contas, tokens ou segredos de autenticação em texto claro.
3. **Padrão de Logs JSON:**
   - Todos os logs emitidos em produção e desenvolvimento estruturado devem ser válidos em formato JSON no `stdout`, viabilizando ingestão direta por agregadores (Datadog, Grafana Loki, CloudWatch).
4. **Isolamento de Domínio:**
   - O core de domínio (`src/domain/`) deve permanecer totalmente puro, sem acoplamento a bibliotecas de observabilidade (`prom-client`, `pino` ou `@nestjs/*`).
5. **Governança de Migrations e Commits:**
   - **Não executar migrations** no banco sem autorização prévia explícita do usuário.
   - **Não efetuar commits git** automáticos sem autorização explícita do usuário.

---

## ✅ Critérios de Aceite

- [x] Quando uma transação de aposta for processada com sucesso (`201 Created`), o contador `wager_transactions_total{status="PROCESSED"}` deve ser incrementado em exatamente 1 e o tempo observado em `processing_duration_seconds`.
- [x] Quando uma transação com mesma chave de idempotência e mesmo payload for reenviada (`200 OK`), o contador `idempotent_replays_total` deve ser incrementado e `wager_transactions_total{status="PROCESSED"}` não deve ser alterado.
- [x] Quando uma transação for rejeitada por regra de negócio (`422 Unprocessable Entity`), `wager_transactions_total{status="REJECTED"}` deve ser incrementado com a identificação do tipo de operação.
- [x] Quando uma transação ficar pendente de referência (`202 Accepted`), `wager_transactions_total{status="PENDING_REFERENCE"}` deve ser incrementado.
- [x] Quando ocorrer um conflito de concorrência ou lock timeout capturado pelo sistema (`ConcurrencyConflictError`), o contador `lock_conflicts_total` deve ser incrementado.
- [x] Quando a reconciliação contábil encontrar uma divergência de saldo, o contador `reconciliation_mismatch_total` deve ser incrementado e um log estruturado de nível `error` deve ser emitido.
- [x] Quando uma requisição HTTP for recebida, a resposta deve conter o header `X-Correlation-Id` e todos os logs gerados durante seu ciclo de vida devem incluir o campo `correlationId`.
- [x] Quando o endpoint `GET /metrics` for consultado via coletor HTTP (`curl /metrics`), deve retornar as métricas registradas em formato de texto compatível com Prometheus.
- [x] O arquivo [`ARCHITECTURE.md`](file:///Users/guilherme/testes/jungle_gaming_test/ARCHITECTURE.md) deve existir na raiz do repositório, documentando a arquitetura geral, garantias financeiras, concorrência, idempotência, mensageria, resiliência e o desenho de autenticação com Keycloak/OIDC.
- [x] O arquivo [`README.md`](file:///Users/guilherme/testes/jungle_gaming_test/README.md) deve estar atualizado com a cobertura completa de todas as fases, comandos de execução, scripts de teste e documentação de observabilidade.
- [x] A pipeline completa de qualidade e testes (`bun run check` ou `bun run test:all`) deve passar com 100% de sucesso.

---

## 🧩 Impacto Técnico

### Módulos / Camadas Impactadas

- **Infrastructure / Observability:** Módulo central de métricas Prometheus e configuração de logging estruturado com Pino.
- **Interfaces / HTTP:** Middleware de `correlationId`, interceptores/filtros para medição de latência e captura de conflitos de concorrência.
- **Application / Use Cases:** Instrumentação discreta em `ProcessWagerTransactionUseCase` e `ReconcileWalletUseCase`.
- **Interfaces / Views:** Atualização do painel interativo de métricas (`metrics-dashboard.view.ts`).
- **Documentação:** Criação de `ARCHITECTURE.md` e revisão de `README.md`.

### Arquivos ou Áreas Prováveis

- `src/infrastructure/observability/wagering-metrics.ts` *(novo ou expandido)*
- `src/infrastructure/observability/logger.config.ts` *(novo)*
- `src/interfaces/http/middlewares/correlation-id.middleware.ts` *(novo)*
- `src/application/use-cases/process-wager-transaction.use-case.ts`
- `src/application/use-cases/reconcile-wallet.use-case.ts`
- `src/interfaces/http/filters/http-exception.filter.ts`
- `src/interfaces/http/controllers/transactions.controller.ts`
- `src/interfaces/http/views/metrics-dashboard.view.ts`
- `src/main.ts`
- `ARCHITECTURE.md` *(novo)*
- `README.md`
- `test/unit/observability.test.ts` *(novo)*
- `test/integration/observability.integration.test.ts` *(novo)*

### Dependências

- `prom-client` (já instalado no projeto)
- `pino` e `nestjs-pino` (já instalados no projeto)
- `@nestjs/common`, `@nestjs/core`

---

## 🧭 Plano de Implementação

1. **Centralização e Expansão de Métricas Prometheus:**
   - Criar [`src/infrastructure/observability/wagering-metrics.ts`](file:///Users/guilherme/testes/jungle_gaming_test/src/infrastructure/observability/wagering-metrics.ts) definindo os contadores e histogramas exigidos pela especificação mestre (`wager_transactions_total`, `idempotent_replays_total`, `retries_total`, `lock_conflicts_total`, `processing_duration_seconds`, `reconciliation_mismatch_total`).
   - Assegurar registro seguro sem duplicidade de nomes no `Registry` padrão do Prometheus.

2. **Instrumentação dos Casos de Uso e Filtros:**
   - Conectar `WageringMetrics` no [`ProcessWagerTransactionUseCase`](file:///Users/guilherme/testes/jungle_gaming_test/src/application/use-cases/process-wager-transaction.use-case.ts) para computar desfechos de transações (sucesso, rejeição de negócio, pendência e replays) e medição de duração.
   - Conectar no [`ReconcileWalletUseCase`](file:///Users/guilherme/testes/jungle_gaming_test/src/application/use-cases/reconcile-wallet.use-case.ts) para incremento de `reconciliation_mismatch_total` caso `consistent: false`.
   - Conectar no [`HttpExceptionFilter`](file:///Users/guilherme/testes/jungle_gaming_test/src/interfaces/http/filters/http-exception.filter.ts) para registrar `lock_conflicts_total` quando capturar `ConcurrencyConflictError`.

3. **Logging Estruturado JSON & Middleware de Correlação:**
   - Implementar [`CorrelationIdMiddleware`](file:///Users/guilherme/testes/jungle_gaming_test/src/interfaces/http/middlewares/correlation-id.middleware.ts) capturando ou gerando o `X-Correlation-Id` e injetando no cabeçalho de resposta.
   - Configurar o logging estruturado em JSON via Pino com metadados obrigatórios (`correlationId`, `instanceId`, `walletId`, `transactionId`, `providerId`).

4. **Atualização do Dashboard Visual de Métricas:**
   - Atualizar a view [`renderMetricsDashboardView`](file:///Users/guilherme/testes/jungle_gaming_test/src/interfaces/http/views/metrics-dashboard.view.ts) para exibir os cartões das novas métricas contábeis, transações por status e monitoramento de concorrência.

5. **Elaboração do Documento Arquitetural (`ARCHITECTURE.md`):**
   - Redigir o documento completo cobrindo todas as 8 seções chave: decisões de domínio, garantias contábeis, concorrência, idempotência, mensageria, resiliência, autenticação Keycloak e trade-offs.

6. **Revisão e Consolidação do `README.md`:**
   - Alinhar todo o manual de operação e desenvolvedor, cobrindo setup, Docker Compose multi-instância, catálogo de APIs, rotas de observabilidade e pipeline de testes.

7. **Validação com Testes Automatizados:**
   - Escrever testes unitários e de integração para validar a emissão de métricas e cabeçalhos de correlação.
   - Executar suíte completa: `bun run lint:money`, `bun run typecheck` e `bun run test:all`.

### Decisões Técnicas / Pontos em Aberto

- **Formato do Correlation ID:** Utilizar UUID v7 ou UUID padrão se não fornecido pelo cliente.
- **Armazenamento de Contexto de Log:** Utilizar `AsyncLocalStorage` nativo do Node.js/Bun para transporte transparente de contexto assíncrono entre controllers e use cases sem poluir assinaturas de métodos de domínio.
- **Desenho de Autenticação Keycloak:** Como o escopo do desafio especifica que IdP real é não pontuado e consome esforço acessório, o sistema manterá o `AuthGuard` no-op em código, e detalhará exaustivamente o desenho de produção com Client Credentials no `ARCHITECTURE.md`.

---

## 🧪 Testes Esperados

- [x] **Métricas Unitárias:** Validar que `WageringMetrics` registra corretamente e incrementa contadores com labels apropriados sem lançar erros no `prom-client`.
- [x] **Instrumentação de Transação (Sucesso & Replay):** Validar via teste de integração que uma nova transação incrementa `wager_transactions_total{status="PROCESSED"}` e que o reenvio com mesma chave incrementa `idempotent_replays_total`.
- [x] **Métrica de Concorrência:** Validar que ao simular um `ConcurrencyConflictError`, a métrica `lock_conflicts_total` é incrementada.
- [x] **Métrica de Reconciliação:** Validar que ao forçar divergência contábil na carteira, `reconciliation_mismatch_total` é incrementado.
- [x] **Cabeçalho de Correlação:** Validar que requisições HTTP retornam o cabeçalho `X-Correlation-Id` e que o valor é preservado quando fornecido na entrada.
- [x] **Formato do Scrape Prometheus:** Validar que a rota `GET /metrics` responde com `Content-Type: text/plain` e contém as métricas exigidas no payload de texto.
- [x] **Validação Documental:** Validar a integridade estrutural e presença de `ARCHITECTURE.md` e `README.md`.

---

## 🤖 Instruções para IA

### Objetivo Operacional

> Implemente estritamente o que está dentro do escopo desta spec para a Fase 9, focando em observabilidade consistente, rastreabilidade e excelência documental. Em caso de dúvidas conceituais, verifique a especificação mestre [`docs/specs/2026-10-16-distributed-wagering-processor.md`](file:///Users/guilherme/testes/jungle_gaming_test/docs/specs/2026-10-16-distributed-wagering-processor.md).

### O que a IA deve entregar

- Módulo de métricas Prometheus unificado e instrumentado.
- Logging estruturado JSON via Pino com rastreabilidade por `correlationId`.
- Documento técnico abrangente [`ARCHITECTURE.md`](file:///Users/guilherme/testes/jungle_gaming_test/ARCHITECTURE.md).
- Manual de operação [`README.md`](file:///Users/guilherme/testes/jungle_gaming_test/README.md) consolidado e atualizado.
- Testes automatizados unitários e de integração cobrindo observabilidade com 100% de sucesso nos checks.

### Observações específicas desta spec

- **NÃO COMMITAR** código sem a permissão explícita do usuário.
- **NÃO RODAR MIGRATIONS** sem a permissão explícita do usuário.
- **NUNCA usar `number` ou `float`** para cálculo ou representação financeira de `Money`.
- Ao finalizar todas as tarefas e comandos, execute:
  `osascript -e 'display notification "Tarefa finalizada" with title "Antigravity" sound name "Glass"'`

---

## 📁 Pós-execução da Spec

Quando o usuário pedir para executar esta spec, assim que todas as instruções e validações forem concluídas, mova este arquivo para a pasta `docs/executed/`.
