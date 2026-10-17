import { describe, expect, it } from "bun:test";
import { SendMessageCommand, type SQSClient } from "@aws-sdk/client-sqs";
import { OutboxMessage } from "../../src/domain/messaging/outbox-message";
import { SqsMessagePublisher } from "../../src/infrastructure/sqs/sqs-message-publisher";

describe("SqsMessagePublisher (Unit Tests)", () => {
  it("publica mensagem no SQS com GroupId, DeduplicationId e payload estruturado", async () => {
    let sentCommand: SendMessageCommand | null = null;

    const mockClient = {
      send: async (command: unknown) => {
        sentCommand = command as SendMessageCommand;
        return { MessageId: "msg-123" };
      },
    } as unknown as SQSClient;

    const publisher = new SqsMessagePublisher({
      queueUrl: "https://sqs.us-east-1.amazonaws.com/123/wallet-events.fifo",
      client: mockClient,
    });

    const now = new Date("2026-10-17T12:00:00.000Z");
    const message = OutboxMessage.rehydrate({
      id: "event-uuid-1",
      aggregateId: "wallet-uuid-99",
      eventType: "WagerAcceptedEvent",
      payload: { transactionId: "tx-1", amount: "50.00", currency: "BRL" },
      occurredAt: now,
      attempts: 0,
      nextAttemptAt: now,
      lockedUntil: null,
      publishedAt: null,
    });

    await publisher.publish(message);

    expect(sentCommand).not.toBeNull();
    const input = (sentCommand as unknown as { input: Record<string, unknown> }).input;
    expect(input.QueueUrl).toBe("https://sqs.us-east-1.amazonaws.com/123/wallet-events.fifo");
    expect(input.MessageGroupId).toBe("wallet-uuid-99");
    expect(input.MessageDeduplicationId).toBe("event-uuid-1");

    const parsedBody = JSON.parse(input.MessageBody as string);
    expect(parsedBody.eventId).toBe("event-uuid-1");
    expect(parsedBody.aggregateId).toBe("wallet-uuid-99");
    expect(parsedBody.eventType).toBe("WagerAcceptedEvent");
    expect(parsedBody.payload).toEqual({ transactionId: "tx-1", amount: "50.00", currency: "BRL" });
    expect(parsedBody.occurredAt).toBe(now.toISOString());
  });

  it("propaga erro se o cliente SQS falhar", async () => {
    const mockClient = {
      send: async () => {
        throw new Error("SQS Network Timeout");
      },
    } as unknown as SQSClient;

    const publisher = new SqsMessagePublisher({
      queueUrl: "https://sqs.us-east-1.amazonaws.com/123/wallet-events.fifo",
      client: mockClient,
    });

    const message = OutboxMessage.rehydrate({
      id: "event-uuid-2",
      aggregateId: "wallet-uuid-1",
      eventType: "WagerSettledEvent",
      payload: {},
      occurredAt: new Date(),
      attempts: 0,
      nextAttemptAt: new Date(),
      lockedUntil: null,
      publishedAt: null,
    });

    expect(publisher.publish(message)).rejects.toThrow("SQS Network Timeout");
  });
});
