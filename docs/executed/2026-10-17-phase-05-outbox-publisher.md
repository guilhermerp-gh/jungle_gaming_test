# 📄 Fase 5: Transactional Outbox Publisher (v0.5.0)

> Especificação técnica da **Fase 5** do Desafio Técnico Jungle Gaming. Implementação do **Transactional Outbox Publisher**, responsável pelo envio confiável e assíncrono dos eventos de integração do PostgreSQL para a fila FIFO do AWS SQS (`wallet-events.fifo`) com garantia *at-least-once*, *leasing* com `FOR UPDATE SKIP LOCKED`, *backoff* exponencial e métricas de *lag*.

---

## 📌 Metadados

| Campo | Valor |
|-------|-------|
| **Versão** | v1.0 |
| **Data** | 17/10/2026 |
| **Autor** | Guilherme |
| **Status** | Concluído |
| **Prioridade** | Alta |
| **Tipo** | Feature / Mensageria Distribuída & Concorrência |
| **Versão Alvo** | `0.5.0` |
| **Referência Mestre** | [docs/specs/2026-10-16-distributed-wagering-processor.md](file:///Users/guilherme/testes/jungle_gaming_test/docs/specs/2026-10-16-distributed-wagering-processor.md) |

---

## 📝 Resumo

Implementar o componente **Transactional Outbox Publisher** e seu worker em background, viabilizando o desacoplamento assíncrono e a entrega confiável (*at-least-once*) de todos os eventos financeiros gerados pelo processador (`WagerAcceptedEvent`, `WagerSettledEvent`, `WagerRejectedEvent`, `WagerReversedEvent`).

O publisher consome em lotes (*batch*) os registros pendentes da tabela `outbox_messages` utilizando travas de linha `FOR UPDATE SKIP LOCKED` e um mecanismo de *lease* temporal (`locked_until = now() + 30s`), despachando-os para a fila AWS SQS FIFO `wallet-events.fifo`. Em caso de sucesso, marca `published_at = now()`; em caso de erro, aplica *backoff* exponencial até 60s. O sistema garante resiliência contra concorrência entre múltiplos publishers simultâneos e recuperação transparente após interrupção/crash sem perda de dados.

---

## 📦 Escopo

### ✅ Incluído
- **Porta e Adaptador de Mensageria (AWS SQS FIFO):**
  - Definição da porta [MessagePublisherPort](file:///Users/guilherme/testes/jungle_gaming_test/src/application/ports/message-publisher.port.ts).
  - Implementação do adaptador [SqsMessagePublisher](file:///Users/guilherme/testes/jungle_gaming_test/src/infrastructure/sqs/sqs-message-publisher.ts) utilizando `@aws-sdk/client-sqs`.
  - Mapeamento para SQS FIFO:
    - `QueueUrl`: extraído da configuração `EVENTS_QUEUE_URL`.
    - `MessageGroupId`: `aggregateId` (ID da carteira) garantindo ordenação estrita FIFO por carteira.
    - `MessageDeduplicationId`: `eventId` (UUID) assegurando a deduplicação nativa de 5 minutos do SQS.
    - `MessageBody`: serialização canônica JSON contendo metadados e payload do evento.
- **Caso de Uso de Publicação (`PublishOutboxMessagesUseCase`):**
  - Claim de lote (limite default de 50 mensagens) em transação curta com `claimBatch`.
  - Concorrência blindada com `SELECT ... FOR UPDATE SKIP LOCKED` sobre mensagens onde `published_at IS NULL` e `next_attempt_at <= now()` e (`locked_until IS NULL` ou `locked_until <= now()`).
  - Atribuição de *lease* (`locked_until = now() + 30s`) persistido de imediato.
  - Publicação no SQS e atualização de status:
    - Sucesso: `markPublished(now)` (`published_at = now`, limpa `locked_until`).
    - Falha transitória: `scheduleRetry(now)` (incrementa `attempts`, calcula `delayMs = min(1000 * 2^attempts, 60000)`, agenda `next_attempt_at`, limpa `locked_until`).
- **Worker / Background Runner (`OutboxPublisherWorker`):**
  - Loop periódico assíncrono controlado por `APP_ROLE` (`APP_ROLE=all` ou `APP_ROLE=outbox`).
  - Intervalo dinâmico de polling (ex: 200ms sob demanda / backoff quando vazio).
  - *Graceful Shutdown*: tratamento de `SIGTERM`/`SIGINT` aguardando a finalização do lote corrente (timeout de até 20s).
- **Métricas e Observabilidade de Outbox:**
  - Métrica de *lag*: `outbox_lag_seconds` = `now - min(occurred_at)` para eventos pendentes.
  - Métrica de throughput: `events_published_total{event_type}`.
  - Métrica de falhas: `outbox_publish_errors_total{event_type}`.
  - Logs estruturados contendo `eventId`, `eventType`, `aggregateId`, `attempts`, `durationMs`.
- **Suíte de Testes Abrangente:**
  - Testes de unidade do caso de uso, adapter SQS e cálculos de backoff/lease.
  - Testes de integração com **PostgreSQL real** e **LocalStack SQS real**:
    - Fluxo ponta a ponta: persistência no outbox via transação contábil -> publicação no SQS -> validação de mensagem na fila `wallet-events.fifo`.
    - 2 publishers concorrentes rodando em paralelo sobre a mesma tabela outbox (validação de `SKIP LOCKED` e ausência de contenção ou duplicidade em loop).
    - Simulação de crash do publisher após *lease*: expiração do `locked_until` (30s) e republicação segura por nova instância.

### ❌ Fora do Escopo
- Consumo e processamento de mensagens recebidas de filas SQS (Fase 6: SQS Consumer & Inbox Pattern).
- Mecanismo de resolução assíncrona de referências pendentes (Fase 7: Pending Reference Resolver).
- Orquestrador multi-processo `Bun.spawn` subindo 3 nós HTTP simultâneos (Fase 8).
- Testes de carga sintética via autocannon/k6 (Fase 10).

---

## 🔄 Fluxos Principais

### 🔄 Fluxo 1: Ciclo de Polling e Publicação com Sucesso
1. O worker `OutboxPublisherWorker` acorda no seu ciclo de polling.
2. Abre uma transação SQL curta via `UnitOfWork`.
3. Executa `repos.outbox.claimBatch(now, limit=50, leaseMs=30000)`:
   - Seleciona até 50 mensagens onde `published_at IS NULL AND next_attempt_at <= now AND (locked_until IS NULL OR locked_until <= now)` com `FOR UPDATE SKIP LOCKED ORDER BY occurred_at ASC`.
   - Atualiza `locked_until = now + 30s` e commita a transação do lote imediatamente.
4. Para cada mensagem do lote:
   - Formata a mensagem com `MessageGroupId = aggregateId` e `MessageDeduplicationId = eventId`.
   - Envia para a fila SQS `wallet-events.fifo` através do `MessagePublisherPort`.
   - Ao receber confirmação do SQS:
     - Executa `message.markPublished(now)` no domínio.
     - Persiste a atualização no PostgreSQL (`published_at = now`, `locked_until = null`).
     - Incrementa o contador `events_published_total{event_type}`.
5. Coleta e atualiza a métrica `outbox_lag_seconds`.

### 🔄 Fluxo 2: Tratamento de Erro de Rede e Backoff Exponencial
1. Durante o envio ao SQS, ocorre um erro (ex: falha de rede transitória ou *throttling*).
2. O publicador captura o erro sem derrubar o worker.
3. Invoca `message.scheduleRetry(now)`:
   - Incrementa `attempts`.
   - Calcula o intervalo: $delay = \min(1000 \times 2^{attempts}, 60000)$ milissegundos.
   - Atualiza `next_attempt_at = now + delay`.
   - Limpa `locked_until = null` para liberar a mensagem para a próxima janela agendada.
4. Persiste a mensagem no PostgreSQL com o novo `next_attempt_at` e `attempts`.
5. Incrementa a métrica `outbox_publish_errors_total` e emite log estruturado de `warn`.

### 🔄 Fluxo 3: Múltiplos Publishers Concorrentes (Zero Race Condition)
1. Duas instâncias do worker (ou dois nós da aplicação) rodam simultaneamente contra o mesmo banco de dados.
2. A Instância A executa `claimBatch` com `FOR UPDATE SKIP LOCKED` e obtém as mensagens [1..50].
3. Simultaneamente, a Instância B executa `claimBatch` com `FOR UPDATE SKIP LOCKED`. As linhas [1..50] bloqueadas pela Instância A são automaticamente ignoradas (*skipped*), e a Instância B obtém as mensagens [51..100] (ou lote vazio se não houver mais mensagens).
4. Ambas as instâncias publicam seus respectivos lotes de forma independente e simultânea, sem conflito de lock, sem deadlocks e sem duplicação de processamento.

### 🔄 Fluxo 4: Recuperação de Crash e Expiração de Lease
1. A Instância A obtém a mensagem $M_1$ e atualiza `locked_until = now + 30s`.
2. A Instância A sofre um crash abrupto (ou é terminada por `SIGKILL`) após o claim (ou logo após publicar, mas antes de atualizar o banco).
3. A mensagem $M_1$ fica bloqueada temporariamente para outros workers enquanto `now < locked_until`.
4. Após 30 segundos, o lease expira (`locked_until <= now`).
5. A Instância B acorda, localiza $M_1$ como elegível no próximo `claimBatch`, obtém novo lease e publica no SQS.
6. Se $M_1$ já havia sido enviada ao SQS antes do crash, o SQS FIFO reconhece o `MessageDeduplicationId = eventId` e ignora a mensagem dentro da janela de deduplicação de 5 minutos, garantindo semântica *at-least-once* segura.

---

## 📐 Regras e Restrições

### Regras de Negócio
- **Garantia At-Least-Once:** Nenhuma mensagem da outbox pode ser descartada ou ignorada. Em cenários extremos de crash, a republicação é mandatória.
- **Deduplicação Determinística:** Toda mensagem publicada no SQS FIFO deve utilizar obrigatoriamente `MessageDeduplicationId = event.eventId`.
- **Ordenação por Carteira:** Toda mensagem publicada no SQS FIFO deve utilizar obrigatoriamente `MessageGroupId = event.aggregateId` (ID da carteira), preservando a sequência causal de eventos contábeis daquela carteira específica.
- **Backoff Progressivo Limitado:** O atraso entre retentativas deve seguir a progressão exponencial $1s \to 2s \to 4s \to 8s \to 16s \to 32s \to 60s$ (teto de 60 segundos).

### Restrições Técnicas / Funcionais
- **Transações Curtas de Lease:** O comando `claimBatch` com `SKIP LOCKED` deve commitar imediatamente o lock de lease (`locked_until`) no banco antes de iniciar chamadas I/O de rede (SQS), evitando segurar conexões abertas no pool do PostgreSQL durante chamadas remotas.
- **Liberação de Lock em Falhas:** Em caso de falha de envio, `locked_until` deve ser redefinido para `NULL` junto com o novo `next_attempt_at`, impedindo que a mensagem fique presa artificialmente por 30 segundos se o backoff for menor.
- **Desligamento Gracioso (Graceful Shutdown):** O worker deve interceptar os sinais `SIGTERM` e `SIGINT`, parar de puxar novos lotes e aguardar a conclusão do lote em voo por até 20 segundos.
- **Controle por Papel (`APP_ROLE`):** O worker só deve iniciar o agendador se `APP_ROLE` for `"all"` ou `"outbox"`. Em papéis como `"api"`, o worker deve permanecer inativo.
- **Rigor Monetário Absoluto:** Nenhuma manipulação de valores no payload ou métricas pode utilizar tipo `number` primitivo para valores monetários (conformidade com regras do projeto).

---

## ✅ Critérios de Aceite

- [ ] Quando `outbox_messages` possuir registros pendentes e o worker rodar, os eventos devem ser enviados ao SQS com `MessageGroupId = aggregateId` e `MessageDeduplicationId = eventId`.
- [ ] Quando um evento for publicado com sucesso no SQS, seu registro no banco deve ter `published_at` preenchido e `locked_until` nulo.
- [ ] Quando a publicação falhar, o registro deve ter `attempts` incrementado, `next_attempt_at` postergado com backoff exponencial (máximo 60s) e `locked_until` liberado.
- [ ] Quando dois publishers rodarem concorrentemente contra a mesma tabela de outbox, nenhum evento deve ser processado em duplicidade nem ocorrer erro de lock/deadlock (`SKIP LOCKED` comprovado).
- [ ] Quando um publisher travar antes de marcar uma mensagem como publicada, outra instância deve conseguir assumir a mensagem após o término do lease de 30s.
- [ ] O worker deve iniciar quando `APP_ROLE=all` ou `APP_ROLE=outbox`, e não executar quando `APP_ROLE=api`.
- [ ] O encerramento da aplicação via `SIGTERM` deve esperar a finalização do lote em andamento.
- [ ] Métricas `outbox_lag_seconds` e `events_published_total` devem ser registradas e atualizadas.
- [ ] Pipeline completo de testes (`test:all`) passando com 100% de sucesso.

---

## 🧩 Impacto Técnico

### Módulos / Camadas Impactadas
- **Application:**
  - Nova porta [MessagePublisherPort](file:///Users/guilherme/testes/jungle_gaming_test/src/application/ports/message-publisher.port.ts).
  - Novo caso de uso [PublishOutboxMessagesUseCase](file:///Users/guilherme/testes/jungle_gaming_test/src/application/use-cases/publish-outbox-messages.use-case.ts).
- **Infrastructure:**
  - Novo adaptador SQS [SqsMessagePublisher](file:///Users/guilherme/testes/jungle_gaming_test/src/infrastructure/sqs/sqs-message-publisher.ts) utilizando `@aws-sdk/client-sqs`.
  - Módulo ou serviço de métricas em [src/infrastructure/observability/](file:///Users/guilherme/testes/jungle_gaming_test/src/infrastructure/observability/).
- **Interfaces / Workers:**
  - Novo worker [OutboxPublisherWorker](file:///Users/guilherme/testes/jungle_gaming_test/src/interfaces/workers/outbox-publisher.worker.ts).
  - Inicialização condicional no [AppModule](file:///Users/guilherme/testes/jungle_gaming_test/src/main.ts) baseada em `APP_ROLE`.
- **Testes:**
  - Novos testes de unidade em `test/unit/application/` e `test/unit/infrastructure/`.
  - Novos testes de integração com Postgres e LocalStack em `test/integration/outbox-publisher.integration.test.ts`.

### Arquivos ou Áreas Prováveis
- `src/application/ports/message-publisher.port.ts` *(novo)*
- `src/application/use-cases/publish-outbox-messages.use-case.ts` *(novo)*
- `src/infrastructure/sqs/sqs-message-publisher.ts` *(novo)*
- `src/infrastructure/observability/metrics.service.ts` *(novo ou atualizado)*
- `src/interfaces/workers/outbox-publisher.worker.ts` *(novo)*
- `src/interfaces/workers/workers.module.ts` *(novo)*
- `src/main.ts` *(integração do worker e shutdown)*
- `test/unit/application/publish-outbox-messages.use-case.test.ts` *(novo)*
- `test/unit/infrastructure/sqs-message-publisher.test.ts` *(novo)*
- `test/integration/outbox-publisher.integration.test.ts` *(novo)*

### Dependências
- `@aws-sdk/client-sqs` *(já instalado em `package.json`)*
- `prom-client` *(para métricas)*

---

## 🧭 Plano de Implementação

1. **Porta e Adaptador SQS:**
   - Criar `MessagePublisherPort` em [src/application/ports/message-publisher.port.ts](file:///Users/guilherme/testes/jungle_gaming_test/src/application/ports/message-publisher.port.ts).
   - Implementar `SqsMessagePublisher` em [src/infrastructure/sqs/sqs-message-publisher.ts](file:///Users/guilherme/testes/jungle_gaming_test/src/infrastructure/sqs/sqs-message-publisher.ts) formatando mensagens para SQS FIFO com `SendMessageCommand` ou `SendMessageBatchCommand`.
2. **Caso de Uso de Publicação:**
   - Criar `PublishOutboxMessagesUseCase` orquestrando o ciclo: `claimBatch` -> publish via porta -> `markPublished` ou `scheduleRetry` -> `save` -> cálculo de lag.
3. **Métricas de Outbox:**
   - Configurar `outbox_lag_seconds`, `events_published_total` e `outbox_publish_errors_total`.
4. **Worker em Background:**
   - Criar `OutboxPublisherWorker` com controle de ciclo de vida (`OnApplicationBootstrap`, `OnApplicationShutdown`), polling contínuo e tratamento de `APP_ROLE`.
   - Conectar o worker no `AppModule` em [src/main.ts](file:///Users/guilherme/testes/jungle_gaming_test/src/main.ts).
5. **Testes de Unidade:**
   - Cobrir `PublishOutboxMessagesUseCase` (sucessos, retentativas com backoff, lote vazio, métricas).
   - Cobrir `SqsMessagePublisher` (estruturação de payload FIFO, erro do SDK da AWS).
6. **Testes de Integração:**
   - Iniciar o container LocalStack com `docker compose up -d localstack`.
   - Criar `test/integration/outbox-publisher.integration.test.ts`:
     - Teste 1: Publicação ponta a ponta com verificação no LocalStack SQS real (`ReceiveMessageCommand`).
     - Teste 2: Concorrência com 2 publishers simultâneos dividindo o lote de 50 mensagens via `SKIP LOCKED`.
     - Teste 3: Simulação de crash pós-lease e recuperação após 30s.
7. **Validação Final:**
   - Executar o pipeline de testes completo via `bun run test:all`.

### Decisões Técnicas
- **Commit Imediato do Lease:** Para não segurar a transação do banco aberta durante a chamada HTTP/gRPC do SQS, o `claimBatch` já persiste o `locked_until` e commita. O resultado individual (`published_at` ou `retry`) é salvo logo após a resposta da mensageria.
- **Idempotência no SQS:** A garantia de deduplicação é reforçada no SQS pelo `MessageDeduplicationId = eventId`, permitindo que retransmissões acidentais não criem eventos duplicados na fila dentro da janela de 5 minutos da AWS.

---

## 🧪 Testes Esperados

### Unidade
- [ ] `PublishOutboxMessagesUseCase`: publica lote com sucesso, marca `publishedAt` e zera `lockedUntil`.
- [ ] `PublishOutboxMessagesUseCase`: falha na publicação incrementa `attempts` e agenda `nextAttemptAt` com backoff exponencial sem ultrapassar 60 segundos.
- [ ] `PublishOutboxMessagesUseCase`: lote vazio não gera chamadas desnecessárias e calcula lag como zero.
- [ ] `SqsMessagePublisher`: mapeia `eventId` para `MessageDeduplicationId` e `aggregateId` para `MessageGroupId`.

### Integração (PostgreSQL + LocalStack SQS Reais)
- [ ] **Ponta a Ponta:** Evento gerado por `ProcessWagerTransactionUseCase` e gravado na tabela `outbox_messages` é publicado no LocalStack SQS real e marcado como `published_at IS NOT NULL`.
- [ ] **Publishers Concorrentes:** 2 instâncias do worker rodando simultaneamente sobre 50 eventos pendentes processam todos sem conflito e sem duplicatas (`FOR UPDATE SKIP LOCKED`).
- [ ] **Crash e Recuperação:** Mensagem com lease expirado (`locked_until < now`) é recolhida e republicada com sucesso por outra execução do worker.

---

## 🤖 Instruções para IA

### Objetivo Operacional
> Implemente somente o que está dentro do escopo desta spec. Em caso de dúvida, pergunte antes de assumir.
> Cumpra rigorosamente todas as regras de proteção contra comandos destrutivos e a regra inviolável de dinheiro (`Money`).

### O que a IA deve entregar
- Código implementado e funcional de acordo com a arquitetura hexagonal existente.
- Cobertura total de testes unitários e de integração contra PostgreSQL e LocalStack reais.
- Pipeline de testes (`test:all`) executado e com status verde.
- Resumo claro das alterações efetuadas.

---

## 📁 Pós-execução da Spec

Quando o usuário pedir para executar esta spec, assim que todas as instruções forem concluídas e validadas, mova o arquivo da spec para a pasta `docs/executed/2026-10-17-phase-05-outbox-publisher.md`.
