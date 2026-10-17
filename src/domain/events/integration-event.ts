export abstract class IntegrationEvent {
  abstract readonly eventType: string;

  protected constructor(
    public readonly eventId: string,
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}

  abstract payload(): Record<string, unknown>;
}
