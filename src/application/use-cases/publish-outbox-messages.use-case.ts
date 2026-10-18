import { waitForFailureInjection } from "../../infrastructure/testing/failure-injection";
import type { MessagePublisherPort } from "../ports/message-publisher.port";
import type { UnitOfWork } from "../ports/unit-of-work.port";
import { defaultOutboxMetrics, type OutboxMetrics } from "../../infrastructure/observability/outbox-metrics";

export interface PublishOutboxMessagesOptions {
  batchSize?: number;
  leaseMs?: number;
  now?: Date;
}

export interface PublishOutboxResult {
  claimedCount: number;
  publishedCount: number;
  failedCount: number;
  lagSeconds: number;
}

export class PublishOutboxMessagesUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly publisher: MessagePublisherPort,
    private readonly metrics: OutboxMetrics = defaultOutboxMetrics,
  ) {}

  async execute(options?: PublishOutboxMessagesOptions): Promise<PublishOutboxResult> {
    const now = options?.now ?? new Date();
    const batchSize = options?.batchSize ?? 50;
    const leaseMs = options?.leaseMs ?? 30_000;

    // 1. Reivindica lote de mensagens em transação curta com SKIP LOCKED e lease
    const messages = await this.uow.transactional(async (repos) => {
      return repos.outbox.claimBatch(now, batchSize, leaseMs);
    });

    let publishedCount = 0;
    let failedCount = 0;

    // 2. Publica cada mensagem de forma individual para isolamento de falha
    for (const message of messages) {
      const eventType = message.props.eventType;
      try {
        await this.publisher.publish(message);
        await waitForFailureInjection("TEST_HOOK_AFTER_OUTBOX_PUBLISH_MS");
        message.markPublished(new Date());
        await this.uow.transactional(async (repos) => repos.outbox.save(message));
        this.metrics.recordPublished(eventType);
        publishedCount++;
      } catch {
        message.scheduleRetry(new Date());
        await this.uow.transactional(async (repos) => repos.outbox.save(message));
        this.metrics.recordError(eventType);
        failedCount++;
      }
    }

    // 3. Calcula o lag atual da outbox em segundos
    const oldestPending = await this.uow.transactional(async (repos) => {
      return repos.outbox.getOldestPendingOccurredAt();
    });

    const currentNow = options?.now ?? new Date();
    const lagSeconds = oldestPending
      ? Math.max(0, (currentNow.getTime() - oldestPending.getTime()) / 1000)
      : 0;

    this.metrics.recordLag(lagSeconds);

    return {
      claimedCount: messages.length,
      publishedCount,
      failedCount,
      lagSeconds,
    };
  }
}
