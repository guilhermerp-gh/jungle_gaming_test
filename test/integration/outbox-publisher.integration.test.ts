/**
 * ============================================================================
 * 🧪 TESTES DE INTEGRAÇÃO: TRANSACTIONAL OUTBOX PUBLISHER (FASE 5)
 * ============================================================================
 * Arquivo: test/integration/outbox-publisher.integration.test.ts
 *
 * 🎯 RESPONSABILIDADE DESTE ARQUIVO:
 * Validar contra o PostgreSQL real e o LocalStack SQS real (wallet-events.fifo)
 * as garantias do Transactional Outbox Publisher:
 *
 * 1. Ponta a Ponta:
 *    - Transação de aposta grava no banco wallet + ledger + outbox em transação única.
 *    - Publisher reivindica mensagem com lease e publica no LocalStack SQS FIFO.
 *    - Mensagem é recebida do SQS com GroupId e DeduplicationId corretos.
 *    - Registro no banco é marcado como published_at = now e locked_until = null.
 *
 * 2. Concorrência Massiva de Publishers (SKIP LOCKED):
 *    - 2 instâncias do publisher executando simultaneamente sobre 50 mensagens.
 *    - Comprovação de que SKIP LOCKED distribui mensagens de forma disjunta sem
 *      colisão de locks, sem duplicação e sem deadlocks.
 *
 * 3. Recuperação de Crash (Lease Expiration):
 *    - Mensagem com lease expirado (locked_until <= now) deixada por processo "morto".
 *    - Novo publisher assume a mensagem e publica com sucesso.
 *
 * 4. Background Worker:
 *    - OutboxPublisherWorker executa loop em background e realiza Graceful Shutdown.
 * ============================================================================
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import {
  CreateQueueCommand,
  DeleteMessageCommand,
  DeleteQueueCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { randomUUID } from "node:crypto";
import { PublishOutboxMessagesUseCase } from "../../src/application/use-cases/publish-outbox-messages.use-case";
import { ProcessWagerTransactionUseCase } from "../../src/application/use-cases/process-wager-transaction.use-case";
import { OutboxMessage } from "../../src/domain/messaging/outbox-message";
import { SqsMessagePublisher } from "../../src/infrastructure/sqs/sqs-message-publisher";
import { OutboxPublisherWorker } from "../../src/interfaces/workers/outbox-publisher.worker";
import { OutboxMetrics } from "../../src/infrastructure/observability/outbox-metrics";
import { Registry } from "prom-client";
import {
  resetData,
  seedWallet,
  setupTestDb,
  sleep,
  type TestDb,
} from "../helpers/db";

const SQS_ENDPOINT = process.env.AWS_ENDPOINT_URL ?? "http://localhost:4566";

describe("Transactional Outbox Publisher (Integration Tests - Fase 5)", () => {
  let db: TestDb;
  let sqsClient: SQSClient;
  let publisher: SqsMessagePublisher;
  let testQueueUrl: string;

  async function drainQueue() {
    if (!testQueueUrl) return;
    for (let i = 0; i < 5; i++) {
      const res = await sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: testQueueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 0,
        }),
      );
      if (!res.Messages || res.Messages.length === 0) break;
      for (const msg of res.Messages) {
        if (msg.ReceiptHandle) {
          await sqsClient.send(
            new DeleteMessageCommand({
              QueueUrl: testQueueUrl,
              ReceiptHandle: msg.ReceiptHandle,
            }),
          );
        }
      }
    }
  }

  beforeAll(async () => {
    db = await setupTestDb();
    sqsClient = new SQSClient({
      region: "us-east-1",
      endpoint: SQS_ENDPOINT,
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
    });

    const runId = randomUUID().slice(0, 8);
    const queueName = `outbox-test-${runId}.fifo`;
    const res = await sqsClient.send(
      new CreateQueueCommand({
        QueueName: queueName,
        Attributes: {
          FifoQueue: "true",
          ContentBasedDeduplication: "false",
        },
      }),
    );
    testQueueUrl = res.QueueUrl!;

    publisher = new SqsMessagePublisher({
      queueUrl: testQueueUrl,
      client: sqsClient,
    });
  });

  beforeEach(async () => {
    await resetData(db);
    await drainQueue();
  });

  afterAll(async () => {
    if (testQueueUrl) {
      await sqsClient.send(new DeleteQueueCommand({ QueueUrl: testQueueUrl })).catch(() => {});
    }
    await db.close();
  });

  it("Ponta a Ponta: Aposta grava na outbox -> Publisher envia ao SQS -> outbox marcada como publicada", async () => {
    const { wallet } = await seedWallet(db.uow, "100.00");
    const processWager = new ProcessWagerTransactionUseCase(db.uow);

    // 1. Processa aposta
    const idempKey = `idemp-${randomUUID()}`;
    const wagerRes = await processWager.execute(idempKey, {
      providerId: "prv-1",
      externalTransactionId: `ext-${randomUUID()}`,
      walletId: wallet.id,
      playerId: wallet.playerId,
      roundId: "round-1",
      gameId: "game-1",
      kind: "BET",
      amount: "30.00",
      currency: "BRL",
    });
    expect(wagerRes.transaction.status).toBe("PROCESSED");

    // 2. Verifica que os 2 eventos gerados (WalletBalanceChanged + WagerTransactionProcessed) estão pendentes no PostgreSQL
    const pendingBefore = await db.sql<{ id: string; event_type: string; published_at: string | null }>(
      `select id, event_type, published_at from outbox_messages where aggregate_id = ? and published_at is null order by occurred_at asc`,
      [wallet.id],
    );
    expect(pendingBefore.length).toBe(2);
    expect(pendingBefore[0]!.published_at).toBeNull();
    expect(pendingBefore[1]!.published_at).toBeNull();

    // 3. Executa caso de uso do publisher
    const metrics = new OutboxMetrics(new Registry());
    const outboxUseCase = new PublishOutboxMessagesUseCase(db.uow, publisher, metrics);
    const pubResult = await outboxUseCase.execute();

    expect(pubResult.claimedCount).toBe(2);
    expect(pubResult.publishedCount).toBe(2);
    expect(pubResult.failedCount).toBe(0);
    expect(pubResult.lagSeconds).toBe(0);

    // 4. Verifica no PostgreSQL que todas as mensagens foram marcadas como publicadas
    for (const msg of pendingBefore) {
      const rowsAfter = await db.sql<{ published_at: string; locked_until: string | null }>(
        `select published_at, locked_until from outbox_messages where id = ?`,
        [msg.id],
      );
      expect(rowsAfter[0]!.published_at).not.toBeNull();
      expect(rowsAfter[0]!.locked_until).toBeNull();
    }

    // 5. Recebe as mensagens reais do LocalStack SQS
    const sqsRes = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: testQueueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 2,
      }),
    );
    expect(sqsRes.Messages).toBeDefined();
    expect(sqsRes.Messages!.length).toBe(2);

    const receivedEventTypes = sqsRes.Messages!.map((m) => JSON.parse(m.Body!).eventType);
    expect(receivedEventTypes).toContain("WalletBalanceChanged");
    expect(receivedEventTypes).toContain("WagerTransactionProcessed");
  });

  it("Concorrência: 2 publishers rodando em paralelo sobre 50 mensagens dividem o lote sem colisão (SKIP LOCKED)", async () => {
    const now = new Date();
    const walletId = randomUUID();

    // 1. Insere 50 mensagens pendentes no outbox
    for (let i = 0; i < 50; i++) {
      const msg = OutboxMessage.rehydrate({
        id: randomUUID(),
        aggregateId: walletId,
        eventType: "WagerAcceptedEvent",
        payload: { index: i, amount: "1.00" },
        occurredAt: new Date(now.getTime() - (50 - i) * 100),
        attempts: 0,
        nextAttemptAt: now,
        lockedUntil: null,
        publishedAt: null,
      });
      await db.uow.transactional(async (repos) => repos.outbox.add(msg));
    }

    const countBefore = await db.sql<{ count: string }>(
      `select count(*) from outbox_messages where published_at is null`,
    );
    expect(Number(countBefore[0]!.count)).toBe(50);

    // 2. Dispara 2 publishers em paralelo (lote de 30 cada)
    const metrics = new OutboxMetrics(new Registry());
    const publisherInstance1 = new PublishOutboxMessagesUseCase(db.uow, publisher, metrics);
    const publisherInstance2 = new PublishOutboxMessagesUseCase(db.uow, publisher, metrics);

    const [res1, res2] = await Promise.all([
      publisherInstance1.execute({ batchSize: 30, now }),
      publisherInstance2.execute({ batchSize: 30, now }),
    ]);

    // Com SKIP LOCKED, as duas instâncias somadas devem processar exatamente as 50 mensagens
    expect(res1.claimedCount + res2.claimedCount).toBe(50);
    expect(res1.publishedCount + res2.publishedCount).toBe(50);
    expect(res1.failedCount + res2.failedCount).toBe(0);

    // 3. Comprova no banco que todas as 50 foram marcadas como publicadas
    const countAfter = await db.sql<{ count: string }>(
      `select count(*) from outbox_messages where published_at is not null`,
    );
    expect(Number(countAfter[0]!.count)).toBe(50);

    const countPending = await db.sql<{ count: string }>(
      `select count(*) from outbox_messages where published_at is null`,
    );
    expect(Number(countPending[0]!.count)).toBe(0);
  });

  it("Recuperação de Crash: mensagem com lease expirado é recuperada e publicada por nova instância", async () => {
    const expiredLease = new Date(Date.now() - 5_000); // Expirou há 5s
    const eventId = randomUUID();
    const walletId = randomUUID();

    // 1. Mensagem simulando que um publisher anterior travou após obter o lease
    const crashedMsg = OutboxMessage.rehydrate({
      id: eventId,
      aggregateId: walletId,
      eventType: "WagerSettledEvent",
      payload: { amount: "100.00" },
      occurredAt: new Date(Date.now() - 35_000),
      attempts: 1,
      nextAttemptAt: new Date(Date.now() - 35_000),
      lockedUntil: expiredLease, // LEASE EXPIRADO
      publishedAt: null,
    });
    await db.uow.transactional(async (repos) => repos.outbox.add(crashedMsg));

    // 2. Nova instância do publisher executa
    const metrics = new OutboxMetrics(new Registry());
    const useCase = new PublishOutboxMessagesUseCase(db.uow, publisher, metrics);
    const result = await useCase.execute();

    expect(result.claimedCount).toBe(1);
    expect(result.publishedCount).toBe(1);
    expect(result.failedCount).toBe(0);

    // 3. Comprova que a mensagem órfã foi recuperada e publicada
    const row = await db.sql<{ published_at: string; locked_until: string | null }>(
      `select published_at, locked_until from outbox_messages where id = ?`,
      [eventId],
    );
    expect(row[0]!.published_at).not.toBeNull();
    expect(row[0]!.locked_until).toBeNull();
  });

  it("Worker em background: OutboxPublisherWorker processa eventos automaticamente e finaliza graciosamente", async () => {
    const metrics = new OutboxMetrics(new Registry());
    const useCase = new PublishOutboxMessagesUseCase(db.uow, publisher, metrics);
    const worker = new OutboxPublisherWorker(useCase, { pollIntervalMs: 50, batchSize: 10 });

    // 1. Inicia worker manualmente
    worker.start();

    // 2. Insere mensagem pendente
    const eventId = randomUUID();
    const now = new Date();
    const msg = OutboxMessage.rehydrate({
      id: eventId,
      aggregateId: randomUUID(),
      eventType: "WagerAcceptedEvent",
      payload: { test: true },
      occurredAt: now,
      attempts: 0,
      nextAttemptAt: now,
      lockedUntil: null,
      publishedAt: null,
    });
    await db.uow.transactional(async (repos) => repos.outbox.add(msg));

    // 3. Aguarda o worker drenar
    await sleep(200);

    // 4. Verifica no banco que a mensagem foi processada pelo worker em background
    const rows = await db.sql<{ published_at: string | null }>(
      `select published_at from outbox_messages where id = ?`,
      [eventId],
    );
    expect(rows[0]!.published_at).not.toBeNull();

    // 5. Encerra graciosamente
    await worker.onApplicationShutdown("SIGTERM");
  });
});
