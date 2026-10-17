import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { MessagePublisherPort } from "../../application/ports/message-publisher.port";
import type { OutboxMessage } from "../../domain/messaging/outbox-message";

export interface SqsMessagePublisherOptions {
  queueUrl: string;
  endpoint?: string;
  region?: string;
  client?: SQSClient;
}

export class SqsMessagePublisher implements MessagePublisherPort {
  private readonly client: SQSClient;
  private readonly queueUrl: string;

  constructor(options: SqsMessagePublisherOptions) {
    this.queueUrl = options.queueUrl;
    this.client =
      options.client ??
      new SQSClient({
        region: options.region ?? "us-east-1",
        endpoint: options.endpoint,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
        },
      });
  }

  async publish(message: OutboxMessage): Promise<void> {
    const p = message.props;
    const body = JSON.stringify({
      eventId: p.id,
      aggregateId: p.aggregateId,
      eventType: p.eventType,
      payload: p.payload,
      occurredAt: p.occurredAt.toISOString(),
    });

    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: body,
      MessageGroupId: p.aggregateId,
      MessageDeduplicationId: p.id,
    });

    await this.client.send(command);
  }
}
