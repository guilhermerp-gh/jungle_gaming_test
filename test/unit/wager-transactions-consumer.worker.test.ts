import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import type { Message, SQSClient } from "@aws-sdk/client-sqs";
import { Registry } from "prom-client";
import { DomainError } from "../../src/domain/errors/domain-error";
import { FailureCode } from "../../src/domain/errors/failure-code";
import type { ProcessWagerTransactionUseCase } from "../../src/application/use-cases/process-wager-transaction.use-case";
import { SqsConsumerMetrics } from "../../src/infrastructure/observability/sqs-consumer-metrics";
import {
  WagerMessagePayloadSchema,
  WagerTransactionsConsumerWorker,
} from "../../src/interfaces/workers/wager-transactions-consumer.worker";

interface SqsCommandLike {
  constructor?: { name?: string };
  name?: string;
  input?: Record<string, unknown>;
}

class MockSqsClient {
  public sentCommands: SqsCommandLike[] = [];

  async send(command: SqsCommandLike): Promise<unknown> {
    this.sentCommands.push(command);
    const commandName = command.constructor?.name ?? command.name;

    if (commandName === "ReceiveMessageCommand") {
      return { Messages: [] };
    }
    if (commandName === "SendMessageCommand") {
      return { MessageId: randomUUID() };
    }
    if (commandName === "DeleteMessageCommand") {
      return {};
    }
    if (commandName === "ChangeMessageVisibilityCommand") {
      return {};
    }
    return {};
  }
}

describe("WagerTransactionsConsumerWorker (Unit Tests)", () => {
  const dummyPayload = {
    idempotencyKey: "key-unit-1",
    providerId: "prov-1",
    externalTransactionId: "ext-1",
    playerId: randomUUID(),
    walletId: randomUUID(),
    roundId: "r1",
    gameId: "g1",
    kind: "BET" as const,
    amount: "25.00",
    currency: "BRL",
  };

  it("WagerMessagePayloadSchema > valida campos obrigatórios e formato monetário", () => {
    const valid = WagerMessagePayloadSchema.safeParse(dummyPayload);
    expect(valid.success).toBe(true);

    const invalidAmount = WagerMessagePayloadSchema.safeParse({
      ...dummyPayload,
      amount: "invalid-number",
    });
    expect(invalidAmount.success).toBe(false);

    const invalidUuid = WagerMessagePayloadSchema.safeParse({
      ...dummyPayload,
      walletId: "not-a-uuid",
    });
    expect(invalidUuid.success).toBe(false);

    const invalidKind = WagerMessagePayloadSchema.safeParse({
      ...dummyPayload,
      kind: "INVALID_KIND",
    });
    expect(invalidKind.success).toBe(false);
  });

  it("processSingleMessage > processa mensagem válida com sucesso e faz ack (DeleteMessage)", async () => {
    const mockSqs = new MockSqsClient();
    const registry = new Registry();
    const metrics = new SqsConsumerMetrics(registry);

    let executedWithKey = "";
    let executedWithContext: unknown = null;

    const mockUseCase = {
      async execute(key: string, dto: unknown, context: unknown) {
        executedWithKey = key;
        executedWithContext = context;
        return {
          statusCode: 201 as const,
          idempotentReplay: false,
          transaction: { id: randomUUID(), ...(dto as Record<string, unknown>) },
        };
      },
    } as unknown as ProcessWagerTransactionUseCase;

    const worker = new WagerTransactionsConsumerWorker(mockUseCase, {
      queueUrl: "http://localhost:4566/000000000000/wager-transactions.fifo",
      dlqUrl: "http://localhost:4566/000000000000/wager-transactions-dlq.fifo",
      sqsClient: mockSqs as unknown as SQSClient,
      metrics,
    });

    const msg: Message = {
      MessageId: "msg-001",
      ReceiptHandle: "receipt-001",
      Body: JSON.stringify(dummyPayload),
      Attributes: { ApproximateReceiveCount: "1" },
    };

    await worker.processSingleMessage(msg);

    expect(executedWithKey).toBe("key-unit-1");
    expect(executedWithContext).toEqual({
      consumerName: "wager-transactions-consumer",
      messageId: "msg-001",
    });

    const deleteCmd = mockSqs.sentCommands.find(
      (c) => (c.constructor?.name ?? "") === "DeleteMessageCommand",
    );
    expect(deleteCmd).toBeDefined();
    expect(deleteCmd?.input?.ReceiptHandle).toBe("receipt-001");

    const consumed = await registry.getSingleMetricAsString("sqs_messages_consumed_total");
    expect(consumed).toContain('status="success"');
  });

  it("processSingleMessage > replay idempotente faz DeleteMessage e incrementa idempotent_replay", async () => {
    const mockSqs = new MockSqsClient();
    const registry = new Registry();
    const metrics = new SqsConsumerMetrics(registry);

    const mockUseCase = {
      async execute() {
        return {
          statusCode: 200 as const,
          idempotentReplay: true,
          transaction: { id: randomUUID() },
        };
      },
    } as unknown as ProcessWagerTransactionUseCase;

    const worker = new WagerTransactionsConsumerWorker(mockUseCase, {
      queueUrl: "http://localhost:4566/000000000000/wager-transactions.fifo",
      dlqUrl: "http://localhost:4566/000000000000/wager-transactions-dlq.fifo",
      sqsClient: mockSqs as unknown as SQSClient,
      metrics,
    });

    const msg: Message = {
      MessageId: "msg-replay-1",
      ReceiptHandle: "receipt-replay-1",
      Body: JSON.stringify(dummyPayload),
    };

    await worker.processSingleMessage(msg);

    const deleteCmd = mockSqs.sentCommands.find(
      (c) => (c.constructor?.name ?? "") === "DeleteMessageCommand",
    );
    expect(deleteCmd).toBeDefined();

    const consumed = await registry.getSingleMetricAsString("sqs_messages_consumed_total");
    expect(consumed).toContain('status="idempotent_replay"');
  });

  it("processSingleMessage > rejeição de negócio (INSUFFICIENT_FUNDS) é tratada com ack (DeleteMessage)", async () => {
    const mockSqs = new MockSqsClient();
    const registry = new Registry();
    const metrics = new SqsConsumerMetrics(registry);

    const mockUseCase = {
      async execute() {
        throw new DomainError(FailureCode.INSUFFICIENT_FUNDS, "Saldo insuficiente");
      },
    } as unknown as ProcessWagerTransactionUseCase;

    const worker = new WagerTransactionsConsumerWorker(mockUseCase, {
      queueUrl: "http://localhost:4566/000000000000/wager-transactions.fifo",
      dlqUrl: "http://localhost:4566/000000000000/wager-transactions-dlq.fifo",
      sqsClient: mockSqs as unknown as SQSClient,
      metrics,
    });

    const msg: Message = {
      MessageId: "msg-rej-1",
      ReceiptHandle: "receipt-rej-1",
      Body: JSON.stringify(dummyPayload),
    };

    await worker.processSingleMessage(msg);

    const deleteCmd = mockSqs.sentCommands.find(
      (c) => (c.constructor?.name ?? "") === "DeleteMessageCommand",
    );
    expect(deleteCmd).toBeDefined();

    const consumed = await registry.getSingleMetricAsString("sqs_messages_consumed_total");
    expect(consumed).toContain('status="business_rejection"');
  });

  it("processSingleMessage > JSON corrompido (Poison Pill) despacha para DLQ e remove da fila principal", async () => {
    const mockSqs = new MockSqsClient();
    const registry = new Registry();
    const metrics = new SqsConsumerMetrics(registry);

    const mockUseCase = {} as ProcessWagerTransactionUseCase;

    const worker = new WagerTransactionsConsumerWorker(mockUseCase, {
      queueUrl: "http://localhost:4566/000000000000/wager-transactions.fifo",
      dlqUrl: "http://localhost:4566/000000000000/wager-transactions-dlq.fifo",
      sqsClient: mockSqs as unknown as SQSClient,
      metrics,
    });

    const msg: Message = {
      MessageId: "msg-poison-1",
      ReceiptHandle: "receipt-poison-1",
      Body: "{ invalid json format !!",
    };

    await worker.processSingleMessage(msg);

    const dlqSend = mockSqs.sentCommands.find(
      (c) => (c.constructor?.name ?? "") === "SendMessageCommand",
    );
    expect(dlqSend).toBeDefined();
    expect(dlqSend?.input?.QueueUrl).toContain("wager-transactions-dlq.fifo");

    const deleteCmd = mockSqs.sentCommands.find(
      (c) => (c.constructor?.name ?? "") === "DeleteMessageCommand",
    );
    expect(deleteCmd).toBeDefined();

    const dlqMetric = await registry.getSingleMetricAsString("dlq_messages_total");
    expect(dlqMetric).toContain('reason="InvalidJson"');
  });

  it("processSingleMessage > erro transitório de infraestrutura NÃO faz ack e ajusta visibilidade com backoff", async () => {
    const mockSqs = new MockSqsClient();
    const registry = new Registry();
    const metrics = new SqsConsumerMetrics(registry);

    const mockUseCase = {
      async execute() {
        throw new Error("Connection timeout to PostgreSQL");
      },
    } as unknown as ProcessWagerTransactionUseCase;

    const worker = new WagerTransactionsConsumerWorker(mockUseCase, {
      queueUrl: "http://localhost:4566/000000000000/wager-transactions.fifo",
      dlqUrl: "http://localhost:4566/000000000000/wager-transactions-dlq.fifo",
      sqsClient: mockSqs as unknown as SQSClient,
      metrics,
    });

    const msg: Message = {
      MessageId: "msg-transient-1",
      ReceiptHandle: "receipt-transient-1",
      Body: JSON.stringify(dummyPayload),
      Attributes: { ApproximateReceiveCount: "2" },
    };

    await worker.processSingleMessage(msg);

    const deleteCmd = mockSqs.sentCommands.find(
      (c) => (c.constructor?.name ?? "") === "DeleteMessageCommand",
    );
    expect(deleteCmd).toBeUndefined();

    const visCmd = mockSqs.sentCommands.find(
      (c) => (c.constructor?.name ?? "") === "ChangeMessageVisibilityCommand",
    );
    expect(visCmd).toBeDefined();
    expect(visCmd?.input?.VisibilityTimeout).toBe(4);

    const consumed = await registry.getSingleMetricAsString("sqs_messages_consumed_total");
    expect(consumed).toContain('status="transient_error"');
  });
});
