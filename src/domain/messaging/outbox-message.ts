import type { IntegrationEvent } from "../events/integration-event";

export interface OutboxProps {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
  attempts: number;
  nextAttemptAt: Date;
  lockedUntil: Date | null;
  publishedAt: Date | null;
}

export class OutboxMessage {
  private constructor(private p: OutboxProps) {}

  static fromEvent(event: IntegrationEvent): OutboxMessage {
    return new OutboxMessage({
      id: event.eventId,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload(),
      occurredAt: event.occurredAt,
      attempts: 0,
      nextAttemptAt: event.occurredAt,
      lockedUntil: null,
      publishedAt: null,
    });
  }

  static rehydrate(props: OutboxProps): OutboxMessage {
    return new OutboxMessage({ ...props });
  }

  get props(): Readonly<OutboxProps> { return this.p; }

  lease(now: Date, leaseMs = 30_000): void {
    this.p.lockedUntil = new Date(now.getTime() + leaseMs);
  }

  markPublished(now: Date): void {
    this.p.publishedAt = now;
    this.p.lockedUntil = null;
  }

  /** Backoff exponencial limitado a 60s. */
  scheduleRetry(now: Date): void {
    this.p.attempts += 1;
    const delayMs = Math.min(1000 * 2 ** this.p.attempts, 60_000);
    this.p.nextAttemptAt = new Date(now.getTime() + delayMs);
    this.p.lockedUntil = null;
  }
}
