import { BigIntType, EntitySchema } from "@mikro-orm/core";

/**
 * Records de persistência (formato da linha no banco). O domínio NUNCA depende destes tipos:
 * a conversão é feita pelos mappers em `../mappers`.
 *
 * Dinheiro: `NUMERIC(20,2)` ↔ `string` (tipo `decimal` do MikroORM retorna string; o driver `pg`
 * também entrega NUMERIC como string). Nunca `number`.
 */

export interface WalletRecord {
  id: string;
  playerId: string;
  currency: string;
  balanceAmount: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WagerTransactionRecord {
  id: string;
  providerId: string;
  externalTransactionId: string;
  idempotencyKey: string;
  payloadHash: string;
  walletId: string;
  playerId: string;
  roundId: string;
  gameId: string;
  kind: string;
  amount: string;
  currency: string;
  referenceExternalTransactionId: string | null;
  referenceTransactionId: string | null;
  status: string;
  failureCode: string | null;
  resultBalanceAmount: string | null;
  attempts: number;
  nextAttemptAt: Date | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletLedgerEntryRecord {
  id: string;
  seq?: string;
  walletId: string;
  transactionId: string;
  direction: string;
  amount: string;
  currency: string;
  balanceBefore: string;
  balanceAfter: string;
  createdAt: Date;
}

export interface InboxMessageRecord {
  consumerName: string;
  messageId: string;
  payloadHash: string;
  receivedAt: Date;
  processedAt: Date | null;
}

export interface OutboxMessageRecord {
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

const money = { type: "decimal", precision: 20, scale: 2 } as const;
const tz = { type: "datetime", columnType: "timestamptz" } as const;

export const WalletSchema = new EntitySchema<WalletRecord>({
  name: "WalletRecord",
  tableName: "wallets",
  properties: {
    id: { type: "uuid", primary: true },
    playerId: { type: "uuid" },
    currency: { type: "string", columnType: "char(3)" },
    balanceAmount: { ...money },
    version: { type: "integer" },
    createdAt: { ...tz },
    updatedAt: { ...tz },
  },
});

export const WagerTransactionSchema = new EntitySchema<WagerTransactionRecord>({
  name: "WagerTransactionRecord",
  tableName: "wager_transactions",
  properties: {
    id: { type: "uuid", primary: true },
    providerId: { type: "text" },
    externalTransactionId: { type: "text" },
    idempotencyKey: { type: "text" },
    payloadHash: { type: "string", columnType: "char(64)" },
    walletId: { type: "uuid" },
    playerId: { type: "uuid" },
    roundId: { type: "text" },
    gameId: { type: "text" },
    kind: { type: "string", columnType: "wager_kind" },
    amount: { ...money },
    currency: { type: "string", columnType: "char(3)" },
    referenceExternalTransactionId: { type: "text", nullable: true },
    referenceTransactionId: { type: "uuid", nullable: true },
    status: { type: "string", columnType: "wager_status" },
    failureCode: { type: "text", nullable: true },
    resultBalanceAmount: { ...money, nullable: true },
    attempts: { type: "integer" },
    nextAttemptAt: { ...tz, nullable: true },
    processedAt: { ...tz, nullable: true },
    createdAt: { ...tz },
    updatedAt: { ...tz },
  },
});

export const WalletLedgerEntrySchema = new EntitySchema<WalletLedgerEntryRecord>({
  name: "WalletLedgerEntryRecord",
  tableName: "wallet_ledger_entries",
  properties: {
    id: { type: "uuid", primary: true },
    // BIGSERIAL gerado pelo banco (nunca enviado no insert); string para não perder precisão.
    seq: { type: new BigIntType("string"), nullable: true },
    walletId: { type: "uuid" },
    transactionId: { type: "uuid" },
    direction: { type: "string", columnType: "ledger_direction" },
    amount: { ...money },
    currency: { type: "string", columnType: "char(3)" },
    balanceBefore: { ...money },
    balanceAfter: { ...money },
    createdAt: { ...tz },
  },
});

export const InboxMessageSchema = new EntitySchema<InboxMessageRecord>({
  name: "InboxMessageRecord",
  tableName: "inbox_messages",
  properties: {
    consumerName: { type: "text", primary: true },
    messageId: { type: "text", primary: true },
    payloadHash: { type: "string", columnType: "char(64)" },
    receivedAt: { ...tz },
    processedAt: { ...tz, nullable: true },
  },
});

export const OutboxMessageSchema = new EntitySchema<OutboxMessageRecord>({
  name: "OutboxMessageRecord",
  tableName: "outbox_messages",
  properties: {
    id: { type: "uuid", primary: true },
    aggregateId: { type: "uuid" },
    eventType: { type: "text" },
    payload: { type: "json", columnType: "jsonb" },
    occurredAt: { ...tz },
    attempts: { type: "integer" },
    nextAttemptAt: { ...tz },
    lockedUntil: { ...tz, nullable: true },
    publishedAt: { ...tz, nullable: true },
  },
});

export const ALL_SCHEMAS = [
  WalletSchema,
  WagerTransactionSchema,
  WalletLedgerEntrySchema,
  InboxMessageSchema,
  OutboxMessageSchema,
];
