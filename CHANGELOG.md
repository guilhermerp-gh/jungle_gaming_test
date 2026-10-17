# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

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
