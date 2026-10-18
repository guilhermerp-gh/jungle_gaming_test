import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  CreateQueueCommand,
  DeleteQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { OutboxMessage } from "../../src/domain/messaging/outbox-message";
import { resetData, setupTestDb, TEST_DATABASE_URL, type TestDb } from "../helpers/db";
import {
  startAppInstance,
  startAppInstances,
  stopAppInstances,
  waitForLog,
  sleep,
  type AppInstance,
} from "../helpers/multi-instance";

interface WalletResponse { id: string; playerId: string; balance: string }
interface TransactionResponse { id: string; idempotentReplay: boolean }

describe("Fase 8 — multi-instância e recuperação", () => {
  let db: TestDb;
  let instances: AppInstance[] = [];
  let testQueues: { WAGER_QUEUE_URL: string; EVENTS_QUEUE_URL: string; DLQ_QUEUE_URL: string };

  beforeAll(async () => {
    db = await setupTestDb();
    const sqs = createSqsClient();
    const runId = randomUUID().slice(0, 8);
    const dlq = await sqs.send(new CreateQueueCommand({
      QueueName: `dlq-phase08-${runId}.fifo`,
      Attributes: { FifoQueue: "true" },
    }));
    const wagerQueue = await sqs.send(new CreateQueueCommand({
      QueueName: `wager-phase08-${runId}.fifo`,
      Attributes: { FifoQueue: "true", VisibilityTimeout: "30" },
    }));
    const eventsQueue = await sqs.send(new CreateQueueCommand({
      QueueName: `events-phase08-${runId}.fifo`,
      Attributes: { FifoQueue: "true", VisibilityTimeout: "30" },
    }));
    testQueues = {
      WAGER_QUEUE_URL: wagerQueue.QueueUrl!,
      EVENTS_QUEUE_URL: eventsQueue.QueueUrl!,
      DLQ_QUEUE_URL: dlq.QueueUrl!,
    };
    instances = await startAppInstances(3, {
      databaseUrl: TEST_DATABASE_URL,
      appRole: "api",
      environment: { ...sqsEnvironment(), ...testQueues },
    });
  });
  afterAll(async () => {
    await stopAppInstances(instances);
    if (testQueues) {
      const sqs = createSqsClient();
      await sqs.send(new DeleteQueueCommand({ QueueUrl: testQueues.WAGER_QUEUE_URL })).catch(() => {});
      await sqs.send(new DeleteQueueCommand({ QueueUrl: testQueues.EVENTS_QUEUE_URL })).catch(() => {});
      await sqs.send(new DeleteQueueCommand({ QueueUrl: testQueues.DLQ_QUEUE_URL })).catch(() => {});
    }
    if (db) await db.close();
  });
  beforeEach(async () => resetData(db));

  it("processa uma hot wallet por nós distintos sem dupla cobrança", async () => {
    const wallet = await createWallet(instances[0]!, "100.00");
    const responses = await Promise.all(["a", "b"].map((suffix, index) => submitTransaction(
      instances[index + 1]!, `phase-08-key-${suffix}-${randomUUID()}`,
      transactionPayload(wallet, `phase-08-bet-${suffix}-${randomUUID()}`, "80.00"),
    )));
    expect(responses.map((response) => response.status).sort()).toEqual([201, 422]);
    expect((await getJson<WalletResponse>(instances[0]!, `/wallets/${wallet.id}`)).balance).toBe("20.00");
    await assertLedgerConsistent(instances[1]!, wallet.id, "20.00");
    expect((await getJson<{ items: unknown[] }>(instances[2]!, `/wallets/${wallet.id}/ledger`)).items).toHaveLength(2);
  });

  it("persiste replay idempotente quando uma instância é substituída", async () => {
    const wallet = await createWallet(instances[0]!, "100.00");
    const key = `phase-08-replay-${randomUUID()}`;
    const payload = transactionPayload(wallet, `phase-08-replay-tx-${randomUUID()}`, "10.00");
    const first = await submitTransaction(instances[0]!, key, payload);
    expect(first.status).toBe(201);
    const created = (await first.json()) as TransactionResponse;
    await stopAppInstances([instances[0]!]);
    const survivorPayloads = ["one", "two"].map((suffix) => transactionPayload(
      wallet, `phase-08-survivor-${suffix}-${randomUUID()}`, "5.00",
    ));
    const survivorResponses = await Promise.all(survivorPayloads.map((survivorPayload, index) =>
      submitTransaction(instances[index + 1]!, `phase-08-survivor-key-${index}-${randomUUID()}`, survivorPayload),
    ));
    expect(survivorResponses.every((response) => response.status === 201)).toBe(true);
    const replacement = await startAppInstance({
      id: "phase-08-replacement",
      databaseUrl: TEST_DATABASE_URL,
      appRole: "api",
      environment: { ...sqsEnvironment(), ...testQueues },
    });
    instances[0] = replacement;
    const replay = await submitTransaction(replacement, key, payload);
    expect(replay.status).toBe(200);
    const replayBody = (await replay.json()) as TransactionResponse;
    expect(replayBody.id).toBe(created.id);
    expect(replayBody.idempotentReplay).toBe(true);
    expect((await getJson<WalletResponse>(instances[1]!, `/wallets/${wallet.id}`)).balance).toBe("80.00");
    await assertLedgerConsistent(instances[2]!, wallet.id, "80.00");
  });

  it("resolve uma tempestade de idempotência entre os três nós", async () => {
    const wallet = await createWallet(instances[0]!, "100.00");
    const key = `phase-08-storm-${randomUUID()}`;
    const payload = transactionPayload(wallet, `phase-08-storm-tx-${randomUUID()}`, "10.00");
    const responses = await Promise.all(instances.map((instance) => submitTransaction(instance, key, payload)));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 200, 201]);
    const bodies = await Promise.all(responses.map(async (response) => (await response.json()) as TransactionResponse));
    expect(new Set(bodies.map((body) => body.id)).size).toBe(1);
    expect(bodies.filter((body) => body.idempotentReplay).length).toBe(2);
    await assertLedgerConsistent(instances[0]!, wallet.id, "90.00");
  });

  it("processa carteiras independentes em paralelo através dos três nós", async () => {
    const wallets = await Promise.all(Array.from({ length: 9 }, (_, index) => createWallet(
      instances[index % instances.length]!, "20.00",
    )));
    const responses = await Promise.all(wallets.map((wallet, index) => submitTransaction(
      instances[index % instances.length]!,
      `phase-08-isolation-${index}-${randomUUID()}`,
      transactionPayload(wallet, `phase-08-isolation-tx-${index}-${randomUUID()}`, "5.00"),
    )));
    expect(responses.every((response) => response.status === 201)).toBe(true);
    await Promise.all(wallets.map((wallet, index) => assertLedgerConsistent(
      instances[index % instances.length]!, wallet.id, "15.00",
    )));
  });

  it("recupera redelivery de SQS após crash pós-commit/pré-ack sem duplicar saldo ou ledger", async () => {
    const wallet = await createWallet(instances[0]!, "100.00");
    const idempotencyKey = `phase-08-consumer-${randomUUID()}`;
    const payload = transactionPayload(wallet, `phase-08-consumer-ext-${randomUUID()}`, "25.00");
    const sqs = createSqsClient();

    // 1. Posta a mensagem no SQS
    await sqs.send(new SendMessageCommand({
      QueueUrl: testQueues.WAGER_QUEUE_URL,
      MessageBody: JSON.stringify({ ...payload, idempotencyKey }),
      MessageGroupId: wallet.id,
      MessageDeduplicationId: idempotencyKey,
    }));

    // 2. Sobe processo consumidor independente com hook de pausa de 5s após commit e visibilidade de 2s
    const crashedConsumer = await startAppInstance({
      id: "phase-08-crashed-consumer",
      databaseUrl: TEST_DATABASE_URL,
      entrypoint: "test/fixtures/consumer-once.ts",
      environment: {
        ...sqsEnvironment(),
        ...testQueues,
        TEST_HOOK_AFTER_CONSUMER_COMMIT_MS: "5000",
        VISIBILITY_TIMEOUT: "2",
      },
    });

    // 3. Aguarda o consumidor atingir o hook logo após o commit
    await waitForLog(crashedConsumer, "test hook reached");

    // 4. Derruba o processo consumidor com SIGKILL antes do ack
    crashedConsumer.process.kill("SIGKILL");
    await crashedConsumer.process.exited;

    // 5. Verifica que o commit inicial foi gravado no banco de dados
    const afterCrash = await getJson<WalletResponse>(instances[0]!, `/wallets/${wallet.id}`);
    expect(afterCrash.balance).toBe("75.00");

    // 6. Sobe consumidor sobrevivente para processar a mensagem reentregue após expiração da visibilidade
    const survivingConsumer = await startAppInstance({
      id: "phase-08-surviving-consumer",
      databaseUrl: TEST_DATABASE_URL,
      appRole: "consumer",
      environment: {
        ...sqsEnvironment(),
        ...testQueues,
      },
    });

    await sleep(3500);
    await stopAppInstances([survivingConsumer]);

    // 7. Confirma que o saldo permanece 75.00 (sem débito duplicado) e ledger consistente
    const afterRedelivery = await getJson<WalletResponse>(instances[1]!, `/wallets/${wallet.id}`);
    expect(afterRedelivery.balance).toBe("75.00");
    await assertLedgerConsistent(instances[2]!, wallet.id, "75.00");

    const ledger = await getJson<{ items: unknown[] }>(instances[0]!, `/wallets/${wallet.id}/ledger`);
    expect(ledger.items).toHaveLength(2); // 1 seed + 1 débito único
  });

  it("recupera outbox após lease expirado preservando o mesmo eventId", async () => {
    const wallet = await createWallet(instances[0]!, "100.00");
    const eventId = randomUUID();
    const sqs = createSqsClient();

    // 1. Mensagem simulando que um publisher anterior travou após obter o lease de 2s
    const expiredLease = new Date(Date.now() + 2_000);
    const crashedMsg = OutboxMessage.rehydrate({
      id: eventId,
      aggregateId: wallet.id,
      eventType: "WagerSettledEvent",
      payload: { amount: "10.00", walletId: wallet.id },
      occurredAt: new Date(Date.now() - 15_000),
      attempts: 1,
      nextAttemptAt: new Date(Date.now() - 15_000),
      lockedUntil: expiredLease,
      publishedAt: null,
    });
    await db.uow.transactional(async (repos) => repos.outbox.add(crashedMsg));

    // 2. Sobe um worker publisher com polling rápido para reivindicar a mensagem após o lease
    const publisherInstance = await startAppInstance({
      id: "phase-08-outbox-worker",
      databaseUrl: TEST_DATABASE_URL,
      appRole: "outbox",
      environment: {
        ...sqsEnvironment(),
        ...testQueues,
        OUTBOX_POLL_INTERVAL_MS: "100",
      },
    });

    // 3. Aguarda expiração do lease (2s) e publicação pelo worker
    await sleep(3000);
    await stopAppInstances([publisherInstance]);

    // 4. Comprova que a mensagem órfã foi reivindicada e marcada como published_at no banco
    const row = await db.sql<{ published_at: string | null; locked_until: string | null }>(
      `select published_at, locked_until from outbox_messages where id = ?`,
      [eventId],
    );
    expect(row[0]!.published_at).not.toBeNull();
    expect(row[0]!.locked_until).toBeNull();

    // 5. Comprova que o evento publicado no SQS preserva o contrato at-least-once com o mesmo eventId
    const found = await waitForQueueMessage(sqs, testQueues.EVENTS_QUEUE_URL, eventId);
    expect(found).toBe(true);
  });

  it("resolve pendências fora de ordem após restart de resolver sem duplicar ledger", async () => {
    const wallet = await createWallet(instances[0]!, "100.00");
    const refExternalId = `phase-08-resolver-bet-${randomUUID()}`;

    // 1. Submete um WIN de 50.00 dependente de uma BET que ainda não existe
    const winPayload = {
      providerId: "phase-08-provider",
      externalTransactionId: `phase-08-resolver-win-${randomUUID()}`,
      playerId: wallet.playerId,
      walletId: wallet.id,
      roundId: "phase-08-round",
      gameId: "phase-08-game",
      kind: "WIN",
      amount: "50.00",
      currency: "BRL",
      referenceExternalTransactionId: refExternalId,
    };
    const winRes = await submitTransaction(instances[0]!, `phase-08-win-key-${randomUUID()}`, winPayload);
    expect(winRes.status).toBe(202);

    // 2. Submete a BET de referência (20.00) através do nó 1
    const betPayload = transactionPayload(wallet, refExternalId, "20.00");
    const betRes = await submitTransaction(instances[1]!, `phase-08-bet-key-${randomUUID()}`, betPayload);
    expect(betRes.status).toBe(201);

    // 3. Sobe um worker resolver para processar a pendência
    const resolver = await startAppInstance({
      id: "phase-08-resolver-worker",
      databaseUrl: TEST_DATABASE_URL,
      appRole: "resolver",
      environment: {
        ...sqsEnvironment(),
        ...testQueues,
        RESOLVER_POLL_INTERVAL_MS: "100",
      },
    });

    // 4. Aguarda a resolução da pendência
    await sleep(2000);
    await stopAppInstances([resolver]);

    // 5. Confirma que a pendência foi concluída exatamente uma vez
    // Saldo esperado: 100.00 (seed) - 20.00 (bet) + 50.00 (win) = 130.00
    const afterResolved = await getJson<WalletResponse>(instances[2]!, `/wallets/${wallet.id}`);
    expect(afterResolved.balance).toBe("130.00");
    await assertLedgerConsistent(instances[1]!, wallet.id, "130.00");

    const ledger = await getJson<{ items: unknown[] }>(instances[0]!, `/wallets/${wallet.id}/ledger`);
    expect(ledger.items).toHaveLength(3); // 1 seed + 1 débito BET + 1 crédito WIN
  });

});

async function createWallet(instance: AppInstance, initialBalance: string): Promise<WalletResponse> {
  const response = await fetch(`${instance.baseUrl}/wallets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId: randomUUID(), currency: "BRL", initialBalance }) });
  expect(response.status).toBe(201);
  return (await response.json()) as WalletResponse;
}
function transactionPayload(wallet: WalletResponse, externalTransactionId: string, amount: string): Record<string, string> {
  return { providerId: "phase-08-provider", externalTransactionId, playerId: wallet.playerId, walletId: wallet.id, roundId: "phase-08-round", gameId: "phase-08-game", kind: "BET", amount, currency: "BRL" };
}
async function submitTransaction(instance: AppInstance, idempotencyKey: string, payload: Record<string, unknown>): Promise<Response> {
  return fetch(`${instance.baseUrl}/transactions`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(payload) });
}
function createSqsClient(): SQSClient {
  const env = sqsEnvironment();
  return new SQSClient({
    region: env.AWS_REGION,
    endpoint: env.AWS_ENDPOINT_URL,
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  });
}
async function waitForQueueMessage(sqs: SQSClient, queueUrl: string, expectedId: string, timeoutMs = 8000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await sqs.send(new ReceiveMessageCommand({ QueueUrl: queueUrl, MaxNumberOfMessages: 10, WaitTimeSeconds: 1 }));
    if (res.Messages) {
      for (const m of res.Messages) {
        try {
          const body = JSON.parse(m.Body ?? "{}");
          if (body.eventId === expectedId || body.id === expectedId) return true;
        } catch {
          // ignore
        }
      }
    }
    await sleep(100);
  }
  return false;
}
async function getJson<T>(instance: AppInstance, path: string): Promise<T> {
  const response = await fetch(`${instance.baseUrl}${path}`);
  expect(response.status).toBe(200);
  return (await response.json()) as T;
}
async function assertLedgerConsistent(instance: AppInstance, walletId: string, expectedBalance: string): Promise<void> {
  const response = await fetch(`${instance.baseUrl}/wallets/${walletId}/reconciliation`, { method: "POST" });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { consistent: boolean; storedBalance: string; calculatedBalance: string };
  expect(body.consistent).toBe(true);
  expect(body.storedBalance).toBe(expectedBalance);
  expect(body.calculatedBalance).toBe(expectedBalance);
}
function sqsEnvironment(): Record<string, string> {
  return { AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL ?? "http://127.0.0.1:4566", AWS_REGION: process.env.AWS_REGION ?? "us-east-1", WAGER_QUEUE_URL: process.env.WAGER_QUEUE_URL ?? "http://127.0.0.1:4566/000000000000/wager-transactions.fifo", EVENTS_QUEUE_URL: process.env.EVENTS_QUEUE_URL ?? "http://127.0.0.1:4566/000000000000/wallet-events.fifo", DLQ_QUEUE_URL: process.env.DLQ_QUEUE_URL ?? "http://127.0.0.1:4566/000000000000/wager-transactions-dlq.fifo" };
}

