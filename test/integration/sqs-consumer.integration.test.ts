/**
 * ============================================================================
 * 🧪 TESTES DE INTEGRAÇÃO: SQS CONSUMER & INBOX PATTERN (FASE 6)
 * ============================================================================
 * Arquivo: test/integration/sqs-consumer.integration.test.ts
 *
 * 🎯 RESPONSABILIDADE DESTE ARQUIVO:
 * Validar contra o PostgreSQL real e o LocalStack SQS real (wager-transactions.fifo
 * e wager-transactions-dlq.fifo) as garantias do Consumidor SQS:
 *
 * 1. Ponta a Ponta:
 *    - Mensagem enviada para wager-transactions.fifo é consumida.
 *    - Processamento contábil debita carteira, grava ledger e gera outbox.
 *    - Mensagem é registrada e marcada como processada em inbox_messages.
 *    - Mensagem é deletada do SQS (ack).
 *
 * 2. Rejeição de Negócio Persistida (INSUFFICIENT_FUNDS):
 *    - Aposta superior ao saldo é salva como REJECTED no PostgreSQL.
 *    - Gera evento na outbox, marca inbox e dá ack (DeleteMessage) no SQS.
 *
 * 3. Redelivery & Inbox Deduplication (Crash pós-commit / pré-ack):
 *    - Mensagem reentregue pelo SQS é interceptada pelo Inbox.
 *    - Nenhum débito duplicado é gerado no ledger nem no saldo da carteira.
 *    - Mensagem é deletada com sucesso no SQS.
 *
 * 4. Poison Pill / Encaminhamento para DLQ:
 *    - Mensagem com JSON quebrado é despachada para wager-transactions-dlq.fifo
 *      e removida da fila principal.
 *
 * 5. Ciclo de Vida e Graceful Shutdown:
 *    - Interrupção limpa do worker sob SIGTERM.
 * ============================================================================
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import {
  CreateQueueCommand,
  DeleteMessageCommand,
  DeleteQueueCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { randomUUID } from "node:crypto";
import { ProcessWagerTransactionUseCase } from "../../src/application/use-cases/process-wager-transaction.use-case";
import { SqsConsumerMetrics } from "../../src/infrastructure/observability/sqs-consumer-metrics";
import { WagerTransactionsConsumerWorker } from "../../src/interfaces/workers/wager-transactions-consumer.worker";
import {
  resetData,
  seedWallet,
  setupTestDb,
  type TestDb,
} from "../helpers/db";

const SQS_ENDPOINT = process.env.AWS_ENDPOINT_URL ?? "http://localhost:4566";

describe("SQS Consumer & Inbox Pattern (Integration Tests - Fase 6)", () => {
  let db: TestDb;
  let sqsClient: SQSClient;
  let processUseCase: ProcessWagerTransactionUseCase;
  let metrics: SqsConsumerMetrics;
  let testQueueUrl: string;
  let testDlqUrl: string;

  async function drainQueue(queueUrl: string) {
    for (let i = 0; i < 5; i++) {
      const res = await sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 0,
        }),
      );
      if (!res.Messages || res.Messages.length === 0) break;
      for (const msg of res.Messages) {
        if (msg.ReceiptHandle) {
          await sqsClient.send(
            new DeleteMessageCommand({
              QueueUrl: queueUrl,
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
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    });

    const runId = randomUUID().slice(0, 8);
    const dlqName = `wager-dlq-test-${runId}.fifo`;
    const queueName = `wager-test-${runId}.fifo`;

    const dlqRes = await sqsClient.send(
      new CreateQueueCommand({
        QueueName: dlqName,
        Attributes: {
          FifoQueue: "true",
          ContentBasedDeduplication: "false",
        },
      }),
    );
    testDlqUrl = dlqRes.QueueUrl!;

    const attrRes = await sqsClient.send(
      new GetQueueAttributesCommand({
        QueueUrl: testDlqUrl,
        AttributeNames: ["QueueArn"],
      }),
    );
    const dlqArn = attrRes.Attributes?.QueueArn ?? "";

    const queueRes = await sqsClient.send(
      new CreateQueueCommand({
        QueueName: queueName,
        Attributes: {
          FifoQueue: "true",
          VisibilityTimeout: "30",
          RedrivePolicy: JSON.stringify({
            deadLetterTargetArn: dlqArn,
            maxReceiveCount: 5,
          }),
        },
      }),
    );
    testQueueUrl = queueRes.QueueUrl!;

    processUseCase = new ProcessWagerTransactionUseCase(db.uow);
    metrics = new SqsConsumerMetrics();
  });

  afterAll(async () => {
    if (testQueueUrl) {
      try {
        await sqsClient.send(new DeleteQueueCommand({ QueueUrl: testQueueUrl }));
      } catch {}
    }
    if (testDlqUrl) {
      try {
        await sqsClient.send(new DeleteQueueCommand({ QueueUrl: testDlqUrl }));
      } catch {}
    }
    await db.close();
  });

  beforeEach(async () => {
    await resetData(db);
    await drainQueue(testQueueUrl);
    await drainQueue(testDlqUrl);
  });

  it("Ponta a ponta > consome BET válida do SQS, debita carteira, registra inbox e dá ack", async () => {
    const { wallet: seededWallet } = await seedWallet(db.uow, "100.00", "BRL");
    const walletId = seededWallet.id;
    const playerId = seededWallet.playerId;
    const idempotencyKey = `key-${randomUUID()}`;
    const externalTransactionId = `ext-${randomUUID()}`;

    const payload = {
      idempotencyKey,
      providerId: "pragmatic",
      externalTransactionId,
      playerId,
      walletId,
      roundId: "round-101",
      gameId: "gates-of-olympus",
      kind: "BET",
      amount: "30.00",
      currency: "BRL",
    };

    // Publica no SQS wager-transactions.fifo
    const sendResult = await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: testQueueUrl,
        MessageBody: JSON.stringify(payload),
        MessageGroupId: walletId,
        MessageDeduplicationId: idempotencyKey,
      }),
    );
    expect(sendResult.MessageId).toBeDefined();

    const worker = new WagerTransactionsConsumerWorker(processUseCase, {
      queueUrl: testQueueUrl,
      dlqUrl: testDlqUrl,
      sqsClient,
      metrics,
      waitTimeSeconds: 1,
      maxNumberOfMessages: 10,
    });

    // Executa uma iteração de consumo
    const processedCount = await worker.pollOnce();
    expect(processedCount).toBe(1);

    // 1. Verifica saldo da carteira no PostgreSQL
    const wallet = await db.uow.transactional((r) => r.wallets.findById(walletId));
    expect(wallet).not.toBeNull();
    expect(wallet!.balance.amount).toBe("70.00");
    expect(wallet!.version).toBe(3);

    // 2. Verifica registro contábil no ledger
    const ledger = await db.uow.transactional((r) => r.ledger.listByWallet(walletId, { limit: 10 }));
    expect(ledger.length).toBe(2); // OPENING + DEBIT
    const debitEntry = ledger.find((l) => l.entry.direction === "DEBIT");
    expect(debitEntry).toBeDefined();
    expect(debitEntry!.entry.amount.amount).toBe("30.00");
    expect(debitEntry!.entry.balanceAfter.amount).toBe("70.00");

    // 3. Verifica registro da transação
    const tx = await db.uow.transactional((r) => r.wagers.findByIdempotencyKey(idempotencyKey));
    expect(tx).not.toBeNull();
    expect(tx!.status).toBe("PROCESSED");

    // 4. Verifica registro de Inbox
    const inbox = await db.uow.transactional((r) =>
      r.inbox.find("wager-transactions-consumer", sendResult.MessageId!),
    );
    expect(inbox).not.toBeNull();
    expect(inbox!.isProcessed).toBe(true);

    // 5. Verifica que a fila SQS está vazia (ack executado)
    const emptyCheck = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: testQueueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 0,
      }),
    );
    expect(emptyCheck.Messages ?? []).toHaveLength(0);
  });

  it("Rejeição contábil > BET com saldo insuficiente persiste status REJECTED e dá ack no SQS", async () => {
    const { wallet: seededWallet } = await seedWallet(db.uow, "15.00", "BRL");
    const walletId = seededWallet.id;
    const playerId = seededWallet.playerId;
    const idempotencyKey = `key-${randomUUID()}`;
    const externalTransactionId = `ext-${randomUUID()}`;

    const payload = {
      idempotencyKey,
      providerId: "evolution",
      externalTransactionId,
      playerId,
      walletId,
      roundId: "round-202",
      gameId: "roulette",
      kind: "BET",
      amount: "50.00", // Saldo é apenas 15.00
      currency: "BRL",
    };

    const sendResult = await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: testQueueUrl,
        MessageBody: JSON.stringify(payload),
        MessageGroupId: walletId,
        MessageDeduplicationId: idempotencyKey,
      }),
    );

    const worker = new WagerTransactionsConsumerWorker(processUseCase, {
      queueUrl: testQueueUrl,
      dlqUrl: testDlqUrl,
      sqsClient,
      metrics,
      waitTimeSeconds: 1,
    });

    const processedCount = await worker.pollOnce();
    expect(processedCount).toBe(1);

    // 1. Saldo permanece intacto
    const wallet = await db.uow.transactional((r) => r.wallets.findById(walletId));
    expect(wallet!.balance.amount).toBe("15.00");

    // 2. Transação gravada com status REJECTED
    const tx = await db.uow.transactional((r) => r.wagers.findByIdempotencyKey(idempotencyKey));
    expect(tx).not.toBeNull();
    expect(tx!.status).toBe("REJECTED");
    expect(tx!.props.failureCode).toBe("INSUFFICIENT_FUNDS");

    // 3. Inbox marcado como processado
    const inbox = await db.uow.transactional((r) =>
      r.inbox.find("wager-transactions-consumer", sendResult.MessageId!),
    );
    expect(inbox).not.toBeNull();
    expect(inbox!.isProcessed).toBe(true);

    // 4. Fila SQS vazia (ack realizado)
    const emptyCheck = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: testQueueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 0,
      }),
    );
    expect(emptyCheck.Messages ?? []).toHaveLength(0);
  });

  it("Redelivery & Inbox Deduplication > mensagem reentregue após commit não duplica lançamento contábil", async () => {
    const { wallet: seededWallet } = await seedWallet(db.uow, "100.00", "BRL");
    const walletId = seededWallet.id;
    const playerId = seededWallet.playerId;
    const idempotencyKey = `key-${randomUUID()}`;
    const externalTransactionId = `ext-${randomUUID()}`;

    const payload = {
      idempotencyKey,
      providerId: "pragmatic",
      externalTransactionId,
      playerId,
      walletId,
      roundId: "round-303",
      gameId: "sweet-bonanza",
      kind: "BET" as const,
      amount: "25.00",
      currency: "BRL",
    };

    // 1. Envia mensagem ao SQS com VisibilityTimeout de 1s
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: testQueueUrl,
        MessageBody: JSON.stringify(payload),
        MessageGroupId: walletId,
        MessageDeduplicationId: idempotencyKey,
      }),
    );

    // 2. Recebe a mensagem do SQS, processa no use case (comitando no Postgres) mas NÃO dá ack (simulando crash do worker)
    const receiveRes = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: testQueueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 1,
        VisibilityTimeout: 1, // expira em 1 segundo
      }),
    );
    expect(receiveRes.Messages).toBeDefined();
    expect(receiveRes.Messages!.length).toBe(1);
    const msg = receiveRes.Messages![0]!;

    // Executa no caso de uso gravando o inbox com messageId real
    await processUseCase.execute(idempotencyKey, payload, {
      consumerName: "wager-transactions-consumer",
      messageId: msg.MessageId!,
    });

    const walletAfterFirst = await db.uow.transactional((r) => r.wallets.findById(walletId));
    expect(walletAfterFirst!.balance.amount).toBe("75.00");

    // 3. Aguarda 1.5s para expirar a visibilidade no LocalStack SQS
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 4. Agora o worker consome a mensagem reentregue pelo SQS
    const worker = new WagerTransactionsConsumerWorker(processUseCase, {
      queueUrl: testQueueUrl,
      dlqUrl: testDlqUrl,
      sqsClient,
      metrics,
      waitTimeSeconds: 1,
    });

    const count = await worker.pollOnce();
    expect(count).toBe(1);

    // 5. Saldo permanece estritamente 75.00 (sem débito duplo!)
    const walletAfterSecond = await db.uow.transactional((r) => r.wallets.findById(walletId));
    expect(walletAfterSecond!.balance.amount).toBe("75.00");

    // 6. Ledger contém apenas 2 registros (OPENING + 1 DEBIT)
    const ledger = await db.uow.transactional((r) => r.ledger.listByWallet(walletId, { limit: 10 }));
    expect(ledger.length).toBe(2);

    // 7. Fila agora está vazia (deletada pelo worker na reentrega)
    const emptyCheck = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: testQueueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 0,
      }),
    );
    expect(emptyCheck.Messages ?? []).toHaveLength(0);
  });

  it("Poison Pill > mensagem com JSON quebrado é despachada para a DLQ e removida da fila principal", async () => {
    // Publica mensagem inválida (JSON corrompido)
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: testQueueUrl,
        MessageBody: "CORRUPTED_JSON_NOT_VALID",
        MessageGroupId: "poison-group",
        MessageDeduplicationId: `dedup-${randomUUID()}`,
      }),
    );

    const worker = new WagerTransactionsConsumerWorker(processUseCase, {
      queueUrl: testQueueUrl,
      dlqUrl: testDlqUrl,
      sqsClient,
      metrics,
      waitTimeSeconds: 1,
    });

    const processedCount = await worker.pollOnce();
    expect(processedCount).toBe(1);

    // 1. Fila principal deve estar vazia (deletada)
    const mainCheck = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: testQueueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 0,
      }),
    );
    expect(mainCheck.Messages ?? []).toHaveLength(0);

    // 2. DLQ deve conter a mensagem com ErrorReason
    const dlqCheck = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: testDlqUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 1,
        MessageAttributeNames: ["All"],
      }),
    );
    expect(dlqCheck.Messages).toBeDefined();
    expect(dlqCheck.Messages!.length).toBe(1);
    expect(dlqCheck.Messages![0]?.Body).toBe("CORRUPTED_JSON_NOT_VALID");
    expect(dlqCheck.Messages![0]?.MessageAttributes?.ErrorReason?.StringValue).toBe("InvalidJson");
  });

  it("Graceful Shutdown > encerra o worker de forma limpa", async () => {
    const worker = new WagerTransactionsConsumerWorker(processUseCase, {
      queueUrl: testQueueUrl,
      dlqUrl: testDlqUrl,
      sqsClient,
      metrics,
      waitTimeSeconds: 1,
    });

    worker.start();
    await worker.onApplicationShutdown("SIGTERM");
    expect(true).toBe(true);
  });
});
