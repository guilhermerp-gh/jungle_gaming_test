# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [0.10.0] - 19-10-2026

### Resumo Executivo

A versão 0.10.0 comprova a capacidade do sistema em operar sob volumes massivos de apostas sem qualquer lentidão perceptível ou erro financeiro. Mesmo nos momentos de pico mais intensos do cassino — com milhares de jogadores apostando, recebendo prêmios e solicitando estornos simultaneamente na mesma carteira —, o saldo exibido permanece 100% exato e imune a travamentos ou cobranças indevidas.

Além disso, a plataforma agora conta com garantias auditadas de estabilidade extrema: todas as requisições duplicadas enviadas pela rede são reconhecidas instantaneamente sem reprocessar cobranças, e todo o volume movimentado durante situações de sobrecarga é confrontado e validado em tempo real com o extrato da conta, garantindo zero divergência no saldo do jogador.

### ✨ Adicionado
- Suíte automatizada de testes de carga e benchmarking com `autocannon` em `scripts/load-test.ts` cobrindo 4 cenários extremos (alta dispersão, hot-wallet sob contenção de lock pessimista, tempestade de idempotência e carga mista de cassino).
- Relatório técnico completo de benchmarks de performance em [`docs/BENCHMARKS.md`](./docs/BENCHMARKS.md) com análise detalhada de Throughput (RPS), latências percentilares (p50/p90/p95/p99), taxa de erro e defasagem da outbox.
- Guia unificado de execução e tutorial de testes em [`docs/TESTING.md`](./docs/TESTING.md) cobrindo a ordem Fail-Fast de toda a pirâmide de testes do projeto.
- Verificação mandatória de reconciliação contábil pós-estresse garantindo 100% de consistência entre saldo persistido e extrato do ledger.

### 🔄 Modificado
- Adição do comando `"test:load": "bun run scripts/load-test.ts"` no `package.json` para validação de estresse reprodutível.
- Atualização do [`README.md`](./README.md) e [`ARCHITECTURE.md`](./ARCHITECTURE.md) com documentação de carga, contenção e benchmarks.

### 🧪 Sugestões de Testes
- Executar os testes de carga automatizados: `bun run test:load`.
- Validar integridade da suíte completa de testes: `bun run test:all`.
- Consultar métricas de transações durante a carga: `curl -s http://localhost:3000/metrics | grep wager_transactions_total`.

📄 [Notas detalhadas da versão](./docs/releases/00.10/00.10.00.md)

---

## [0.9.0] - 18-10-2026

### Resumo Executivo

A versão 0.9.0 eleva a transparência e a confiabilidade de todas as movimentações financeiras da plataforma. O painel operacional agora oferece explicações visuais claras e intuitivas sobre cada evento da carteira — como apostas, depósitos, estornos e prêmios —, permitindo que operadores e usuários compreendam instantaneamente o status e as garantias de cada transação sem qualquer complexidade técnica.

Além disso, cada operação realizada na plataforma passa a contar com um código de identificação único que acompanha a transação de ponta a ponta. Isso torna o atendimento de suporte muito mais rápido e preciso caso o jogador tenha dúvidas sobre uma aposta ou depósito. O sistema também ganha monitoramento contínuo de estabilidade e velocidade, prevenindo lentidões e assegurando que o saldo exibido ao usuário reflita sempre seu histórico contábil com exatidão e segurança inegociáveis.

### ✨ Adicionado
- Infraestrutura unificada de métricas Prometheus com `prom-client` em `src/infrastructure/observability/wagering-metrics.ts` monitorando transações por status, replays idempotentes, conflitos de concorrência, retentativas e divergências contábeis.
- Exposição de telemetria via endpoints `GET /metrics` (scrape oficial de texto Prometheus) e `GET /api/metrics` (JSON estruturado).
- Rastreabilidade distribuída ponta a ponta com injeção automática de `X-Correlation-Id` e propagação de contexto assíncrono via `AsyncLocalStorage` (`CorrelationContext`).
- Logging estruturado JSON via Pino (`AppLogger`) com atributos obrigatórios (`correlationId`, `instanceId`, `walletId`, `transactionId`, `providerId`) e sanitização estrita de payloads financeiros.
- Painel visual interativo em `/dashboard` enriquecido com cartões em tempo real, gavetas de histórico persistido e badges explicativos `ℹ` com popovers glassmorphism contextuais.
- Documento formal de decisões técnicas [`ARCHITECTURE.md`](./ARCHITECTURE.md) cobrindo as 8 dimensões arquiteturais, concorrência pessimista, invariantes e integração Keycloak/OIDC.
- Especificação formal do banco de dados em [`docs/DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md) com diagrama ERD Mermaid, dicionário de campos e triggers.
- Suíte automatizada de testes de observabilidade (`test/unit/observability.test.ts` e `test/integration/observability.integration.test.ts`).

### 🔄 Modificado
- Instrumentação contábil e de latência em `ProcessWagerTransactionUseCase` e disparo de alarmes em `ReconcileWalletUseCase`.
- Filtro global de exceções (`HttpExceptionFilter`) capturando conflitos de concorrência (`ConcurrencyConflictError`) e alimentando `lock_conflicts_total`.
- Scripts de execução no `package.json` atualizados para isolamento serial de banco (`--concurrency 1`), garantindo 100% de estabilidade nos testes.
- Documentação do `README.md` atualizada com o catálogo de observabilidade e métricas expostas.

### 🐛 Corrigido
- Prevenção de conflito e drop concorrente do banco de testes através do isolamento sequencial de suítes no script de validação.
- Isolamento de clique com `stopPropagation()` no ícone informativo `ℹ` do dashboard para evitar colapso acidental de linhas.

### 🧪 Sugestões de Testes
- Executar a pipeline completa de validação: `bun run test:all` (142 testes passando com 100% de sucesso).
- Validar conformidade financeira e tipagem estrita: `bun run lint:money && bun run typecheck`.
- Acessar `http://localhost:3000/metrics` e verificar a saída formatada do Prometheus.
- Acessar `http://localhost:3000/dashboard` e testar os tooltips informativos `ℹ` na tabela de eventos.

📄 [Notas detalhadas da versão](./docs/releases/00.09/00.09.00.md)

---

## [0.8.0] - 18-10-2026

### Resumo Executivo

A versão 0.8.0 traz um salto significativo na confiabilidade e estabilidade contínua do sistema, assegurando que o saldo, depósitos, apostas e prêmios dos jogadores permaneçam 100% seguros e precisos mesmo em situações de instabilidade severa de servidores, quedas temporárias de energia ou reinicializações inesperadas da infraestrutura.

Com a nova arquitetura de tolerância a falhas distribuída, nenhuma aposta é cobrada em duplicidade e nenhum prêmio é perdido caso uma máquina falhe ou seja reiniciada no meio de um processamento. Outras máquinas assumem a tarefa automaticamente e sem qualquer interrupção na experiência do usuário, garantindo uma jogabilidade contínua, justa e com integridade financeira absoluta.

### ✨ Adicionado
- Harness de orquestração multi-processo em `test/helpers/multi-instance.ts` gerenciando 3 processos Bun independentes com memória isolada, portas dinâmicas e captura em tempo real de logs estruturados.
- Suíte completa de testes distribuídos em `test/multi-instance/multi-instance-recovery.test.ts` cobrindo 7 cenários: hot wallet concorrente entre nós distintos, persistência de replay idempotente após substituição de nó, tempestade de idempotência distribuída, isolamento horizontal entre carteiras, recuperação de crash no consumidor SQS pós-commit / pré-ack, recuperação de outbox após lease expirado e reinicialização forçada do pending reference resolver sob pendências fora de ordem.
- Ganchos determinísticos de injeção de falhas (`src/infrastructure/testing/failure-injection.ts`) para reprodução de cenários de crash distribuído nos workers de mensageria.

### 🔄 Modificado
- Suporte à identificação de réplicas via variável `INSTANCE_ID` no schema de configuração e emissão no log estruturado de bootstrap (`src/main.ts`).
- Parametrização por variáveis de ambiente de intervalos e tempos de expiração: `OUTBOX_LEASE_MS`, `OUTBOX_POLL_INTERVAL_MS`, `RESOLVER_POLL_INTERVAL_MS`, `SQS_CONSUMER_VISIBILITY_TIMEOUT` e `SQS_CONSUMER_WAIT_TIME_SECONDS`.
- Script dedicado `test:multi-instance` no `package.json` e inclusão automática na execução do pipeline `test:all`.
- Documentação do `README.md` atualizada com o harness e cenários da Fase 8.

### 🐛 Corrigido
- Prevenção de disputa concorrente por filas SQS FIFO entre instâncias de teste e instâncias de desenvolvimento locais através da geração dinâmica de filas dedicadas por ciclo de teste.
- Eliminação de race conditions na propagação assíncrona do LocalStack SQS com configuração de tempo de espera explícito no fixture do consumidor.

### 🧪 Sugestões de Testes
- Executar a nova suíte de resiliência distribuída: `bun run test:multi-instance`.
- Executar a pipeline completa de validação: `bun run test:all` (131 testes passando).
- Validar conformidade de tipagem e integridade monetária: `bun run lint:money && bun run typecheck`.

📄 [Notas detalhadas da versão](./docs/releases/00.08/00.08.00.md)

---

## [0.7.1] - 18-10-2026

### Resumo Executivo

A versão 0.7.1 aprimora a agilidade e a confiabilidade na liberação de prêmios e estornos pendentes de apostas. O processamento agora garante que ganhos associados a apostas que chegam fora de ordem sejam creditados de forma imediata na mesma carteira do jogador, eliminando qualquer atraso na atualização do saldo disponível.

Além disso, a estabilidade interna na resolução de transações simultâneas foi fortalecida para evitar conflitos ou tentativas redundantes, assegurando que o jogador veja seu saldo sempre consistente e em tempo real, mesmo durante momentos de alto volume de apostas.

### ✨ Adicionado
- Resolução atômica Fast-Path em `ProcessWagerTransactionUseCase` para liquidação imediata na mesma transação de banco de transações dependentes (`PENDING_REFERENCE`) da mesma carteira.
- Reagendamento prioritário imediato (`next_attempt_at = now()`) para pendências vinculadas a carteiras distintas.
- Logs Pino estruturados completos com atributos de auditoria contábil e métricas Prometheus (`pending_references_active_gauge`, `pending_references_resolved_total`, `pending_reference_resolution_duration_seconds`, `pending_reference_errors_total`).

### 🔄 Modificado
- Reivindicação atômica individual com `FOR UPDATE SKIP LOCKED` e `findByIdForUpdate` em `ResolvePendingReferencesUseCase`, mantendo o lock exclusivo durante toda a transação de resolução.
- Função pura `calculateBackoffDelayMs(attempts, jitterGenerator)` com injeção de gerador para testes determinísticos.
- Método `Wallet.markSaved()` chamado após persistência de saldo no repositório MikroORM, evitando falso positivo de `ConcurrencyConflictError` em múltiplas alterações na mesma sessão.

### 🐛 Corrigido
- Eliminação da liberação prematura de locks pessimistas no worker do resolver.
- Refatoração dos testes de integração para evitar mascaramento do fast-path e comprovar concorrência real entre resolvers no PostgreSQL com zero colisões.

### 🧪 Sugestões de Testes
- Executar `bun run check` para validar a suíte completa com 124 testes.
- Testar concorrência do resolver no banco: `bun test test/integration/pending-reference-resolver.integration.test.ts`.
- Validar fluxo manual no Swagger (`http://localhost:3000/api/docs`) com envio de `WIN` seguido de `BET` e verificar crédito instantâneo via Fast-Path.

📄 [Notas detalhadas da versão](./docs/releases/00.07/00.07.01.md)

---

## [0.7.0] - 18-10-2026

### Resumo Executivo

A versão 0.7.0 traz uma experiência ainda mais fluida e segura para o saldo dos jogadores, introduzindo a funcionalidade de depósitos diretos com confirmação imediata e garantindo que prêmios ou estornos sejam creditados corretamente na carteira mesmo quando chegarem antes da aposta correspondente por oscilações de conexão. Além disso, o sistema ganhou avisos claros e transparentes que informam quando uma aposta ou depósito já foi computado, evitando qualquer dúvida de duplicidade.

No visual, o console de testes e documentação foi aprimorado para carregar de forma mais limpa e organizada, com seções recolhidas por padrão e botões rápidos para expandir ou recolher tudo de uma só vez, além de correções visuais nas caixas de ajuda que agora aparecem completas e sem cortes.

### ✨ Adicionado
- Mecanismo completo do Pending Reference Resolver (`ResolvePendingReferencesUseCase`) para resolução assíncrona e eventual de transações fora de ordem (`WIN`, `REFUND`, `ROLLBACK` recebidos antes da respectiva `BET`).
- Background worker agendado `PendingReferenceResolverWorker` com varredura a cada 1s, travas `FOR UPDATE SKIP LOCKED`, *backoff* exponencial com *jitter* e expiração por 10 tentativas / TTL de 15 minutos (`APP_ROLE=all|resolver`).
- Otimização Fast-Path em `ProcessWagerTransactionUseCase` para resolução instantânea de pendências assim que a aposta de referência for processada.
- Métricas Prometheus dedicadas (`PendingReferenceMetrics`): `pending_references_active_gauge`, `pending_references_resolved_total{outcome}`, `pending_reference_resolution_duration_seconds` e `pending_reference_errors_total`.
- Endpoint e caso de uso de depósitos financeiros `POST /wallets/:id/deposit` com garantia estrita de idempotência persistente, lock pessimista e lançamento imutável `CREDIT` no ledger contábil.
- Retorno de auditoria enriquecido (`details`) em respostas `422 Unprocessable Entity` para o erro `ALREADY_REVERSED` (identificador da reversão original, data e valor).
- Novos controles globais na barra de filtros do console `/docs`: botões `📂 Expandir Todos` e `📁 Recolher Todos`.
- Banners dinâmicos de alerta e mensagens explicativas amigáveis em replays idempotentes (`message`).
- 21 novos testes automatizados (testes unitários de use cases, workers, integração Postgres real e alta concorrência com tempestades de depósito), expandindo a suíte para 118 testes e 769 asserções.

### 🔄 Modificado
- Inicialização da página `/docs` 100% recolhida por padrão, evitando poluição visual ao atualizar a tela.
- Padronização dos valores padrão de teste para `10.00` em toda a documentação interativa e Swagger.
- [README.md](./README.md) e workflow `run-tests.md` atualizados com as funcionalidades da Fase 7 e depósitos.
- Versão do projeto atualizada para `0.7.0` em `package.json`.

### 🐛 Corrigido
- Correção do contexto de empilhamento CSS (`z-index: 100`) na barra de Idempotency-Key Global, eliminando o corte do tooltip explicativo sobre o Guia de Testes.
- Garantia de resposta instantânea `200 OK` com snapshot nos replays de depósito idempotente com mesma chave e payload.

### 🧪 Sugestões de Testes
- Executar a suíte completa de validação: `bun run test:all` (Lint Money + Typecheck + 118 testes automatizados).
- Executar os testes de integração do Pending Reference Resolver: `bun test test/integration/pending-reference-resolver.integration.test.ts`.
- Executar os testes de estresse e concorrência: `bun test test/concurrency/concurrency.test.ts`.
- Acessar o Portal Principal em `http://localhost:3000/` e testar os presets do console `/docs` (incluindo depósito e resolução fora de ordem).

📄 [Notas detalhadas da versão](./docs/releases/00.07/00.07.00.md)

---

## [0.6.0] - 17-10-2026

### Resumo Executivo

A versão 0.6.0 traz processamento de apostas ainda mais confiável e protegido em segundo plano, garantindo que mesmo em picos de jogos ou oscilações de conexão nenhuma aposta se perca e nenhum valor seja cobrado duas vezes. O sistema agora conta com um receptor inteligente que reconhece transações repetidas instantaneamente e isola apostas com dados inválidos para manter a fila sempre rápida e fluida para os demais jogadores. Além disso, a versão estreia uma Central de Navegação completa e um novo Console de Testes com visual moderno no navegador, facilitando a visualização dos recursos e a experimentação das operações com respostas e tempos de execução em tempo real.

### ✨ Adicionado
- Consumidor SQS FIFO em background `WagerTransactionsConsumerWorker` para ingestão assíncrona de apostas da fila `wager-transactions.fifo` (`APP_ROLE=all|consumer`).
- Implementação do Inbox Pattern com `MessageProcessingContext` e deduplicação atômica no `ProcessWagerTransactionUseCase`, protegendo contra reentregas pós-commit.
- Detecção e isolamento de mensagens corrompidas (*poison pills*) com envio automático para a Dead Letter Queue (`wager-transactions-dlq.fifo`).
- Métricas Prometheus de consumo SQS (`SqsConsumerMetrics`): `sqs_messages_consumed_total`, `sqs_processing_duration_seconds` e `dlq_messages_total`.
- Central de Navegação Web (`GET /`) e Console Interativo de Testes de API (`GET /docs`) desenvolvidos em arquitetura Glassmorphic.
- Guia rápido retrátil no Swagger UI (`GET /api/docs`) e botão Authorize enriquecido com tooltip informativo.
- 11 novos testes automatizados (6 unitários e 5 de integração ponta a ponta com PostgreSQL e LocalStack SQS reais), expandindo a suíte para 97 testes.

### 🔄 Modificado
- Extração da configuração Swagger do bootstrap da aplicação para o módulo dedicado `src/interfaces/http/swagger/swagger.config.ts`, tornando `main.ts` enxuto.
- Padronização das interfaces visuais da camada HTTP com o sufixo arquitetural `.view.ts` (`api-docs.view.ts`, `metrics-dashboard.view.ts`, `portal-landing.view.ts`).
- [README.md](./README.md) e workflow `run-tests.md` atualizados com as rotas dos portais web e os 97 testes automatizados.
- Versão do projeto atualizada para `0.6.0` em `package.json`.

### 🐛 Corrigido
- Tratamento de rejeições contábeis de negócio (`INSUFFICIENT_FUNDS`, etc.): confirmação (`ack`) no SQS para evitar loops infinitos de retentativa para transações já auditadas.
- Desligamento gracioso (*Graceful Shutdown*): devolução de visibilidade imediata (`VisibilityTimeout: 0`) para mensagens não concluídas durante a drenagem do worker em `SIGTERM`.

### 🧪 Sugestões de Testes
- Executar a validação completa de qualidade: `bun run check` (Lint Money + Typecheck + ESLint + 97 testes).
- Executar os testes de integração do consumidor SQS: `bun test test/integration/sqs-consumer.integration.test.ts`.
- Acessar o Portal Principal em `http://localhost:3000/` e navegar entre o Console de Docs (`/docs`), Swagger UI (`/api/docs`) e o Dashboard de Métricas (`/dashboard`).

📄 [Notas detalhadas da versão](./docs/releases/00.06/00.06.00.md)

---

## [0.5.0] - 17-10-2026

### Resumo Executivo

A versão 0.5.0 introduz o publicador transacional de eventos e o monitoramento em tempo real de mensageria, assegurando que toda movimentação de aposta e saldo seja comunicada a serviços externos de forma garantida e ordenada, sem perdas mesmo em caso de falhas temporárias de rede ou reinicializações do servidor. As transações financeiras agora são despachadas assincronamente para filas de alta confiabilidade com garantia de entrega exata, proteção contra duplicidades e recuperação automática pós-interrupção. Além disso, a versão estreia um painel visual moderno no navegador para acompanhamento instantâneo de métricas, permitindo verificar a velocidade de entrega dos eventos e a saúde do sistema sem esforço técnico.

### ✨ Adicionado
- Caso de uso `PublishOutboxMessagesUseCase` com consumo em lote (`claimBatch`), concorrência com travas de linha `SELECT ... FOR UPDATE SKIP LOCKED` e leasing de 30s (`locked_until`).
- Publicação de eventos financeiros na fila AWS SQS FIFO (`wallet-events.fifo`) com ordenação estrita causal por carteira (`MessageGroupId`) e deduplicação nativa de 5 minutos da AWS (`MessageDeduplicationId`).
- Agendamento de retentativas com *backoff* exponencial ($1s \to 2s \to 4s \dots \max 60s$) e liberação imediata do lock em falhas transitórias.
- Background worker `OutboxPublisherWorker` periódico controlado por `APP_ROLE=all|outbox` com suporte a *Graceful Shutdown* (`SIGTERM`).
- Porta `MessagePublisherPort` desacoplada e adaptador `SqsMessagePublisher` via `@aws-sdk/client-sqs` (compatível com AWS e LocalStack).
- Métricas Prometheus de mensageria (`OutboxMetrics`): `outbox_lag_seconds`, `events_published_total` e `outbox_publish_errors_total`.
- Dashboard visual interativo Glassmorphic em tempo real em `/metrics` e `/dashboard` com atualização automática a cada 1.5s via `/api/metrics`.
- Testes automatizados de mensageria: 6 novos testes unitários e 4 testes de integração de ponta a ponta conectando PostgreSQL e LocalStack SQS reais (totalizando 86 testes).

### 🔄 Modificado
- Swagger UI (`/api/docs`) atualizado para a versão `v0.5.0` com nova tag `observability` e passo 8 no guia interativo.
- `MikroOrmOutboxRepository` enriquecido com `getOldestPendingOccurredAt()` para consulta otimizada do evento pendente mais antigo via índice parcial.
- [README.md](./README.md) e workflow `run-tests.md` atualizados com os novos 86 testes automatizados e pré-requisitos do LocalStack.

### 🐛 Corrigido
- Resolução de injeção de dependências no NestJS via decorador `@Optional()` para parâmetros de configuração do worker no runtime Bun.
- Isolamento de falhas por mensagem no lote para evitar que erro em um evento impeça a confirmação dos eventos já publicados com sucesso.

### 🧪 Sugestões de Testes
- Executar `bun run check` (validação completa: lint de dinheiro, tipagem estrita, ESLint e 86 testes).
- Executar os testes de integração de mensageria: `bun test test/integration/outbox-publisher.integration.test.ts`.
- Acessar o Dashboard Visual no navegador: `http://localhost:3000/metrics` e testar uma aposta no Swagger para observar o incremento ao vivo.

📄 [Notas detalhadas da versão](./docs/releases/00.05/00.05.00.md)

---

## [0.4.0] - 17-10-2026

### Resumo Executivo

A versão 0.4.0 traz proteções avançadas contra concorrência extrema e disputas simultâneas de saldo, blindando a experiência do jogador contra cobranças indevidas ou duplicações em momentos de pico. Agora, mesmo sob tempestades de requisições enviadas ao mesmo tempo pelo cassino ou em cenários de instabilidade de conexão, cada aposta é processada com exatidão matemática, o saldo nunca fica negativo e requisições repetidas são reconhecidas instantaneamente sem descontar valores a mais. A documentação interativa também foi enriquecida com orientações passo a passo para facilitar a integração e testes por provedores de jogos.

### ✨ Adicionado
- Suíte de alta concorrência e estresse com 7 cenários automatizados e 290 asserções (`test/concurrency/concurrency.test.ts`).
- Cobertura exaustiva de corrida: cenário 100/80/80 (anti-gasto duplo), tempestades de idempotência (50x a 100x com mesma chave), hot wallet com 100 threads, operações mistas BET+WIN e paralelismo de 10 carteiras sem locks globais.
- Endpoint de prontidão `GET /health/ready` (readiness probe) para orquestração de contêineres e Kubernetes.
- Roteiro passo a passo interativo no Swagger UI (`/api/docs`) guiando a ordem recomendada de execução dos endpoints.

### 🔄 Modificado
- Resiliência contra colisões concorrentes de chave única no PostgreSQL (`code: 23505`) no caso de uso, evitando erros 500 não tratados sob alta disputa.
- Documentação OpenAPI enriquecida com mapeamento do status HTTP `503 Service Unavailable` (`Retry-After: 1`, `retryable: true`).
- Scripts de teste em `package.json` unificados: `bun run test:all` agora valida `lint:money`, `typecheck` e todas as 3 suítes (76 testes) em paralelo em ~2.3s.
- [README.md](./README.md) e workflow `run-tests.md` atualizados com a pirâmide de testes de 5 etapas consolidadas.

### 🐛 Corrigido
- Eliminação de campo duplicado do header `Idempotency-Key` no portal visual Swagger UI via padronização de nomenclatura.

### 🧪 Sugestões de Testes
- Executar `bun run test:all` (validação de ponta a ponta com 76 testes verdes).
- Executar especificamente a suíte de alta concorrência: `bun run test:concurrency`.
- Acessar `http://localhost:3000/api/docs` e seguir a ordem recomendada de teste no topo da página.

📄 [Notas detalhadas da versão](./docs/releases/00.04/00.04.00.md)

---

## [0.3.0] - 17-10-2026

### Resumo Executivo

A versão 0.3.0 disponibiliza a API REST do processador de apostas, acompanhada de documentação interativa completa via Swagger/OpenAPI. Ela permite que provedores de jogos e sistemas de gestão criem carteiras de jogadores e realizem transações de apostas, ganhos, cancelamentos e estornos com segurança total. A nova interface impede cobranças duplicadas em conexões instáveis através de confirmação inteligente de transações já recebidas, oferece extrato detalhado para consulta de histórico, conta com auditoria contínua para certificar que o saldo dos jogadores esteja rigorosamente correto e disponibiliza um portal interativo no navegador para visualização e testes em tempo real de todos os recursos.

### ✨ Adicionado
- Documentação interativa Swagger / OpenAPI acessível via navegador em `/api/docs`.
- Endpoints de gerenciamento de carteiras:
  - `POST /wallets`: criação atômica de carteiras e lançamento contábil `OPENING` se houver saldo inicial.
  - `GET /wallets/:id`: consulta de dados cadastrais e saldo da carteira.
  - `GET /wallets/:id/ledger`: extrato de lançamentos com paginação por cursor (`base64` do `seq`).
  - `POST /wallets/:id/reconciliation`: auditoria contábil matemática comparando saldo e ledger.
- Endpoints de processamento de transações:
  - `POST /transactions`: processamento de apostas (`BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK`) com lock pessimista e idempotência persistente.
  - Retornos HTTP de ciclo de vida: `201 Created` para nova transação, `200 OK` para replay idêntico, `202 Accepted` para referência pendente e `422 Unprocessable Entity` para rejeições de negócio.
  - `GET /transactions/:id`: consulta de transação por identificador interno.
  - `GET /transactions/external/:providerId/:externalId`: consulta de transação por chave externa do provedor.
- Camada de aplicação com 6 Casos de Uso integrados ao `UnitOfWork`.
- DTOs tipados com validação estrita via esquemas Zod.
- Filtro global de exceções (`HttpExceptionFilter`) padronizando o envelope `{ error: { code, message, retryable } }`.
- Suíte de 10 testes unitários de casos de uso e 15 testes de integração E2E da API HTTP.

### 🔄 Modificado
- `src/main.ts` atualizado para inicializar o `HttpModule`, registrar o filtro global de exceções e montar o Swagger em `/api/docs`.
- Controladores (`WalletsController`, `TransactionsController` e `HealthController`) enriquecidos com anotações OpenAPI.
- [README.md](./README.md) atualizado com link e instruções de acesso ao Swagger UI.
- `FailureCode` estendido com `WALLET_ALREADY_EXISTS` e `TRANSACTION_NOT_FOUND`.
- Adicionado pacote `@nestjs/swagger` às dependências.

### 🐛 Corrigido
- Reordenação da persistência no caso de uso para garantir que a transação de aposta seja inserida antes do registro de livro-razão correspondente, respeitando a chave estrangeira relacional.

### 🧪 Sugestões de Testes
- Acessar `http://localhost:3000/api/docs` e testar chamadas interativas pelo navegador.
- Executar `bun run test:pipeline` (41 testes unitários e 28 de integração contra banco real).
- Validar criação de carteira, aposta, replay idempotente e reconciliação contábil via API REST.

📄 [Notas detalhadas da versão](./docs/releases/00.03/00.03.00.md)

---

## [0.2.0] - 17-10-2026

### Resumo Executivo

A versão 0.2.0 introduz a camada de persistência financeira em banco de dados relacional com garantias rígidas de integridade. A partir desta versão, todas as operações de carteira contam com bloqueio seguro contra saldo negativo, histórico de extrato contábil imutável (à prova de adulterações ou exclusões acidentais) e mecanismo anti-duplicação que impede que apostas ou estornos sejam cobrados mais de uma vez, mesmo em situações de requisições simultâneas.

### ✨ Adicionado
- Camada de persistência relacional com MikroORM e PostgreSQL.
- Schemas relacionais desacoplados (`EntitySchema`) para `wallets`, `wager_transactions`, `wallet_ledger_entries`, `inbox_messages` e `outbox_messages`.
- Mappers bidirecionais preservando o isolamento do domínio puro através do método `rehydrate`.
- Triggers PostgreSQL de segurança em PL/pgSQL:
  - `trg_ledger_entries_immutable`: bloqueia qualquer tentativa de `UPDATE` ou `DELETE` no livro-razão.
  - `trg_wager_tx_terminal_state`: impede alterações em transações com status terminal (`PROCESSED`, `REJECTED`, `FAILED`).
- Índice único parcial `ux_single_reversal` para garantir que apostas sejam revertidas no máximo uma vez.
- Implementação de `UnitOfWork` com suporte a lock pessimista (`SELECT ... FOR UPDATE`) e `SKIP LOCKED`.
- Script nativo de migrações em Bun (`scripts/migrate.ts`) e comandos `bun run migration:up` / `bun run migration:down`.
- Workflow de automação de testes fail-fast (`.agent/workflows/run-tests.md`) e script `bun run test:pipeline`.
- Suíte de testes de integração com 13 cenários em banco de dados real (`test/integration/persistence.test.ts`).

### 🔄 Modificado
- Adicionados getters de leitura na entidade `WalletLedgerEntry` para acesso rápido a dados contábeis.
- [README.md](./README.md) atualizado com instruções de migrações de banco e acesso via clientes visuais (Postico, DBeaver).
- Incremento da versão do projeto para `0.2.0` no `package.json`.

### 🐛 Corrigido
- Resolução de incompatibilidade do CLI do MikroORM com versões legadas do Node.js através de runner nativo Bun.

### 🧪 Sugestões de Testes
- Executar `bun run test:pipeline` (todas as etapas devem passar em < 1s).
- Aplicar migrações com `bun run migration:up` e verificar tabelas no Postico 2.

📄 [Notas detalhadas da versão](./docs/releases/00.02/00.02.00.md)

---

## [0.1.0] - 17-10-2026

### Resumo Executivo

Primeira versão funcional do núcleo de processamento financeiro. Implementa toda a lógica de regras de apostas, controle de saldos de carteiras de jogadores e proteção contra arredondamentos incorretos em memória, servindo como a base de domínio do sistema.

### ✨ Adicionado
- Setup inicial do projeto em Bun com TypeScript estrito (`strict: true`, `noUncheckedIndexedAccess`).
- Value Object `Money` com aritmética decimal de alta precisão (escala 2) e proibição de tipo primitivo `number`.
- Regras de negócio de apostas `WageringPolicy` para operações `BET`, `WIN`, `LOSS`, `REFUND` e `ROLLBACK`.
- Máquina de estados de `WagerTransaction` e eventos de integração de domínio.
- Entidade imutável de livro-razão `WalletLedgerEntry`.
- Cálculo determinístico de hash canônico de idempotência (`payloadHash`).
- Script de segurança `lint-money.sh` contra vazamento de tipos numéricos.
- Infraestrutura base com Docker Compose (PostgreSQL 16 e LocalStack com filas SQS FIFO).
- Servidor NestJS inicial com verificação de integridade `/health/live`.
- Suíte inicial com 31 testes unitários cobrindo o domínio puro.
