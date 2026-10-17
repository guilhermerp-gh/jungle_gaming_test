import type { FailureCode } from "../../../domain/errors/failure-code";
import { WalletLedgerEntry, type LedgerDirection } from "../../../domain/ledger/wallet-ledger-entry";
import { InboxMessage } from "../../../domain/messaging/inbox-message";
import { OutboxMessage } from "../../../domain/messaging/outbox-message";
import { Money } from "../../../domain/money/money";
import {
  WagerTransaction,
  type WagerKind,
  type WagerStatus,
} from "../../../domain/wagering/wager-transaction";
import { Wallet } from "../../../domain/wallet/wallet";
import type {
  InboxMessageRecord,
  OutboxMessageRecord,
  WagerTransactionRecord,
  WalletLedgerEntryRecord,
  WalletRecord,
} from "../schemas";

/** Linhas vindas de SQL raw trazem timestamps como string; via ORM já chegam como Date. */
export function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function toDateOrNull(value: Date | string | null | undefined): Date | null {
  return value === null || value === undefined ? null : toDate(value);
}

/** Converte `NUMERIC` (string) do banco em `Money`. `CHAR(3)` pode vir com padding. */
function money(amount: string, currency: string): Money {
  return Money.from(String(amount), currency.trim());
}

export const WalletMapper = {
  toDomain(r: WalletRecord): Wallet {
    return Wallet.rehydrate({
      id: r.id,
      playerId: r.playerId,
      balance: money(r.balanceAmount, r.currency),
      version: Number(r.version),
      createdAt: toDate(r.createdAt),
      updatedAt: toDate(r.updatedAt),
    });
  },
  toRecord(w: Wallet): WalletRecord {
    return {
      id: w.id,
      playerId: w.playerId,
      currency: w.currency,
      balanceAmount: w.balance.amount,
      version: w.version,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    };
  },
};

export const WagerTransactionMapper = {
  toDomain(r: WagerTransactionRecord): WagerTransaction {
    const currency = r.currency.trim();
    return WagerTransaction.rehydrate({
      id: r.id,
      providerId: r.providerId,
      externalTransactionId: r.externalTransactionId,
      idempotencyKey: r.idempotencyKey,
      payloadHash: r.payloadHash.trim(),
      walletId: r.walletId,
      playerId: r.playerId,
      roundId: r.roundId,
      gameId: r.gameId,
      kind: r.kind as WagerKind,
      money: money(r.amount, currency),
      referenceExternalTransactionId: r.referenceExternalTransactionId,
      referenceTransactionId: r.referenceTransactionId,
      status: r.status as WagerStatus,
      failureCode: r.failureCode as FailureCode | null,
      resultBalance: r.resultBalanceAmount === null ? null : money(r.resultBalanceAmount, currency),
      attempts: Number(r.attempts),
      nextAttemptAt: toDateOrNull(r.nextAttemptAt),
      processedAt: toDateOrNull(r.processedAt),
      createdAt: toDate(r.createdAt),
      updatedAt: toDate(r.updatedAt),
    });
  },
  toRecord(tx: WagerTransaction): WagerTransactionRecord {
    const p = tx.props;
    return {
      id: p.id,
      providerId: p.providerId,
      externalTransactionId: p.externalTransactionId,
      idempotencyKey: p.idempotencyKey,
      payloadHash: p.payloadHash,
      walletId: p.walletId,
      playerId: p.playerId,
      roundId: p.roundId,
      gameId: p.gameId,
      kind: p.kind,
      amount: p.money.amount,
      currency: p.money.currency,
      referenceExternalTransactionId: p.referenceExternalTransactionId,
      referenceTransactionId: p.referenceTransactionId,
      status: p.status,
      failureCode: p.failureCode,
      resultBalanceAmount: p.resultBalance?.amount ?? null,
      attempts: p.attempts,
      nextAttemptAt: p.nextAttemptAt,
      processedAt: p.processedAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  },
};

export const LedgerMapper = {
  toDomain(r: WalletLedgerEntryRecord): WalletLedgerEntry {
    const currency = r.currency.trim();
    // rehydrate revalida a aritmética balance_after = balance_before ± amount.
    return WalletLedgerEntry.rehydrate({
      id: r.id,
      walletId: r.walletId,
      transactionId: r.transactionId,
      direction: r.direction as LedgerDirection,
      amount: money(r.amount, currency),
      balanceBefore: money(r.balanceBefore, currency),
      balanceAfter: money(r.balanceAfter, currency),
      createdAt: toDate(r.createdAt),
    });
  },
  toRecord(e: WalletLedgerEntry): Omit<WalletLedgerEntryRecord, "seq"> {
    const p = e.props;
    return {
      id: p.id,
      walletId: p.walletId,
      transactionId: p.transactionId,
      direction: p.direction,
      amount: p.amount.amount,
      currency: p.amount.currency,
      balanceBefore: p.balanceBefore.amount,
      balanceAfter: p.balanceAfter.amount,
      createdAt: p.createdAt,
    };
  },
};

export const InboxMapper = {
  toDomain(r: InboxMessageRecord): InboxMessage {
    return InboxMessage.rehydrate({
      consumerName: r.consumerName,
      messageId: r.messageId,
      payloadHash: r.payloadHash.trim(),
      receivedAt: toDate(r.receivedAt),
      processedAt: toDateOrNull(r.processedAt),
    });
  },
  toRecord(m: InboxMessage): InboxMessageRecord {
    return { ...m.props };
  },
};

export const OutboxMapper = {
  toDomain(r: OutboxMessageRecord): OutboxMessage {
    return OutboxMessage.rehydrate({
      id: r.id,
      aggregateId: r.aggregateId,
      eventType: r.eventType,
      payload: typeof r.payload === "string" ? (JSON.parse(r.payload) as Record<string, unknown>) : r.payload,
      occurredAt: toDate(r.occurredAt),
      attempts: Number(r.attempts),
      nextAttemptAt: toDate(r.nextAttemptAt),
      lockedUntil: toDateOrNull(r.lockedUntil),
      publishedAt: toDateOrNull(r.publishedAt),
    });
  },
  toRecord(m: OutboxMessage): OutboxMessageRecord {
    return { ...m.props, payload: { ...m.props.payload } };
  },
};
