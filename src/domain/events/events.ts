import { IntegrationEvent } from "./integration-event";

export class WagerTransactionProcessed extends IntegrationEvent {
  readonly eventType = "WagerTransactionProcessed";
  constructor(
    eventId: string, occurredAt: Date,
    private readonly d: { transactionId: string; walletId: string; kind: string; amount: string; currency: string; resultBalance: string | null },
  ) { super(eventId, d.walletId, occurredAt); }
  payload() { return { ...this.d }; }
}

export class WagerTransactionRejected extends IntegrationEvent {
  readonly eventType = "WagerTransactionRejected";
  constructor(
    eventId: string, occurredAt: Date,
    private readonly d: { transactionId: string; walletId: string; kind: string; failureCode: string },
  ) { super(eventId, d.walletId, occurredAt); }
  payload() { return { ...this.d }; }
}

export class WagerTransactionPendingReference extends IntegrationEvent {
  readonly eventType = "WagerTransactionPendingReference";
  constructor(
    eventId: string, occurredAt: Date,
    private readonly d: { transactionId: string; walletId: string; kind: string; referenceExternalTransactionId: string | null },
  ) { super(eventId, d.walletId, occurredAt); }
  payload() { return { ...this.d }; }
}

export class WalletBalanceChanged extends IntegrationEvent {
  readonly eventType = "WalletBalanceChanged";
  constructor(
    eventId: string, occurredAt: Date,
    private readonly d: { walletId: string; transactionId: string; balanceBefore: string; balanceAfter: string; currency: string; version: number },
  ) { super(eventId, d.walletId, occurredAt); }
  payload() { return { ...this.d }; }
}
