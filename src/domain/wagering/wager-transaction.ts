import { InvariantViolation } from "../errors/domain-error";
import type { FailureCode } from "../errors/failure-code";
import { Money } from "../money/money";

export type WagerKind = "BET" | "WIN" | "LOSS" | "REFUND" | "ROLLBACK" | "OPENING" | "DEPOSIT";
export type WagerStatus = "PENDING" | "PENDING_REFERENCE" | "PROCESSED" | "REJECTED" | "FAILED";

const TRANSITIONS: Record<WagerStatus, WagerStatus[]> = {
  PENDING: ["PROCESSED", "REJECTED", "PENDING_REFERENCE", "FAILED"],
  PENDING_REFERENCE: ["PROCESSED", "REJECTED", "PENDING_REFERENCE", "FAILED"],
  PROCESSED: [],
  REJECTED: [],
  FAILED: [],
};

export interface WagerTransactionProps {
  id: string;
  providerId: string;
  externalTransactionId: string;
  idempotencyKey: string;
  payloadHash: string;
  walletId: string;
  playerId: string;
  roundId: string;
  gameId: string;
  kind: WagerKind;
  money: Money;
  referenceExternalTransactionId: string | null;
  referenceTransactionId: string | null;
  status: WagerStatus;
  failureCode: FailureCode | null;
  resultBalance: Money | null;
  attempts: number;
  nextAttemptAt: Date | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateWagerTransactionInput = Omit<
  WagerTransactionProps,
  | "status" | "failureCode" | "resultBalance" | "attempts" | "nextAttemptAt"
  | "processedAt" | "createdAt" | "updatedAt" | "referenceTransactionId"
> & { referenceTransactionId?: string | null; now: Date };

export class WagerTransaction {
  private constructor(private p: WagerTransactionProps) {}

  static create(input: CreateWagerTransactionInput): WagerTransaction {
    const { now, referenceTransactionId, ...rest } = input;
    if (
      (rest.kind === "REFUND" || rest.kind === "ROLLBACK") &&
      !rest.referenceExternalTransactionId
    ) {
      throw new InvariantViolation("REFUND/ROLLBACK require reference");
    }
    return new WagerTransaction({
      ...rest,
      referenceTransactionId: referenceTransactionId ?? null,
      status: "PENDING",
      failureCode: null,
      resultBalance: null,
      attempts: 0,
      nextAttemptAt: null,
      processedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(props: WagerTransactionProps): WagerTransaction {
    return new WagerTransaction({ ...props });
  }

  get props(): Readonly<WagerTransactionProps> { return this.p; }
  get id(): string { return this.p.id; }
  get status(): WagerStatus { return this.p.status; }
  get kind(): WagerKind { return this.p.kind; }
  get failureCode(): FailureCode | null { return this.p.failureCode; }
  get isTerminal(): boolean { return TRANSITIONS[this.p.status].length === 0; }

  markProcessed(resultBalance: Money, now: Date, referenceTransactionId?: string | null): void {
    this.transition("PROCESSED", now);
    this.p.resultBalance = resultBalance;
    this.p.processedAt = now;
    this.p.nextAttemptAt = null;
    this.p.failureCode = null;
    if (referenceTransactionId !== undefined) this.p.referenceTransactionId = referenceTransactionId;
  }

  reject(code: FailureCode, resultBalance: Money, now: Date): void {
    this.transition("REJECTED", now);
    this.p.failureCode = code;
    this.p.resultBalance = resultBalance;
    this.p.nextAttemptAt = null;
  }

  fail(code: FailureCode, now: Date): void {
    this.transition("FAILED", now);
    this.p.failureCode = code;
    this.p.nextAttemptAt = null;
  }

  /** Mantém/entra em PENDING_REFERENCE e agenda a próxima tentativa. */
  markPendingReference(nextAttemptAt: Date, now: Date): void {
    const wasPending = this.p.status === "PENDING_REFERENCE";
    this.transition("PENDING_REFERENCE", now);
    if (wasPending) this.p.attempts += 1;
    this.p.nextAttemptAt = nextAttemptAt;
  }

  private transition(to: WagerStatus, now: Date): void {
    if (!TRANSITIONS[this.p.status].includes(to)) {
      throw new InvariantViolation(`Invalid transition ${this.p.status} -> ${to}`);
    }
    this.p.status = to;
    this.p.updatedAt = now;
  }
}
