import type { WalletLedgerEntry } from "../../domain/ledger/wallet-ledger-entry";
import type { InboxMessage } from "../../domain/messaging/inbox-message";
import type { OutboxMessage } from "../../domain/messaging/outbox-message";
import type { WagerTransaction } from "../../domain/wagering/wager-transaction";
import type { Wallet } from "../../domain/wallet/wallet";

/**
 * Portas de persistência. Implementações vivem na infraestrutura e são sempre
 * obtidas a partir de um `UnitOfWork`, ou seja, já vinculadas à transação SQL corrente.
 */

export interface WalletRepository {
  findById(id: string): Promise<Wallet | null>;
  /** `SELECT ... FOR UPDATE`: serializa operações sobre a mesma wallet (nunca lock global). */
  findByIdForUpdate(id: string): Promise<Wallet | null>;
  insert(wallet: Wallet): Promise<void>;
  /**
   * Persiste saldo/versão com checagem `WHERE version = loadedVersion`.
   * Lança `ConcurrencyConflictError` se nenhuma linha for afetada. No-op se o saldo não mudou.
   */
  saveBalance(wallet: Wallet): Promise<void>;
}

export interface WagerTransactionRepository {
  findById(id: string): Promise<WagerTransaction | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<WagerTransaction | null>;
  findByExternalId(providerId: string, externalTransactionId: string): Promise<WagerTransaction | null>;
  /** Existe reversão (REFUND/ROLLBACK) PROCESSED apontando para a transação? */
  hasProcessedReversal(referenceTransactionId: string): Promise<boolean>;
  insert(tx: WagerTransaction): Promise<void>;
  update(tx: WagerTransaction): Promise<void>;
  /** Pendentes de referência vencidas, com `FOR UPDATE SKIP LOCKED` (multi-instância). */
  claimDuePendingReferences(now: Date, limit: number): Promise<WagerTransaction[]>;
}

export interface LedgerPageItem {
  seq: string;
  entry: WalletLedgerEntry;
}

export interface LedgerTotals {
  credits: string;
  debits: string;
  entries: number;
}

export interface LedgerRepository {
  append(entry: WalletLedgerEntry): Promise<void>;
  findByTransactionId(transactionId: string): Promise<WalletLedgerEntry | null>;
  /** Paginação por cursor (`seq` estritamente crescente). */
  listByWallet(walletId: string, opts: { afterSeq?: string; limit: number }): Promise<LedgerPageItem[]>;
  /** Somatórios calculados no banco em NUMERIC (sem aritmética em `number`). */
  totals(walletId: string): Promise<LedgerTotals>;
}

export interface InboxRepository {
  /** `INSERT ... ON CONFLICT DO NOTHING`. Retorna `true` se a mensagem foi registrada agora. */
  tryInsert(message: InboxMessage): Promise<boolean>;
  find(consumerName: string, messageId: string): Promise<InboxMessage | null>;
  markProcessed(message: InboxMessage): Promise<void>;
}

export interface OutboxRepository {
  add(message: OutboxMessage): Promise<void>;
  /**
   * Seleciona mensagens pendentes com `FOR UPDATE SKIP LOCKED`, aplica lease (`locked_until`)
   * e as devolve. Deve ser chamado dentro de uma transação curta.
   */
  claimBatch(now: Date, limit: number, leaseMs: number): Promise<OutboxMessage[]>;
  save(message: OutboxMessage): Promise<void>;
  /** Retorna a data occurredAt do evento pendente mais antigo (para cálculo de lag). */
  getOldestPendingOccurredAt(): Promise<Date | null>;
}

