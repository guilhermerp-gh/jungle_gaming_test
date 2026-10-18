import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { Registry } from "prom-client";
import type {
  InboxRepository,
  LedgerPageItem,
  LedgerRepository,
  LedgerTotals,
  OutboxRepository,
  WagerTransactionRepository,
  WalletRepository,
} from "../../src/application/ports/repositories.port";
import type { TransactionalRepositories, UnitOfWork } from "../../src/application/ports/unit-of-work.port";
import {
  calculateBackoffDelayMs,
  ResolvePendingReferencesUseCase,
} from "../../src/application/use-cases/resolve-pending-references.use-case";
import { FailureCode } from "../../src/domain/errors/failure-code";
import type { WalletLedgerEntry } from "../../src/domain/ledger/wallet-ledger-entry";
import type { OutboxMessage } from "../../src/domain/messaging/outbox-message";
import { Money } from "../../src/domain/money/money";
import { WagerTransaction } from "../../src/domain/wagering/wager-transaction";
import { Wallet } from "../../src/domain/wallet/wallet";
import { PendingReferenceMetrics } from "../../src/infrastructure/observability/pending-reference-metrics";

class InMemoryWalletRepo implements WalletRepository {
  public readonly map = new Map<string, Wallet>();
  async findById(id: string): Promise<Wallet | null> {
    return this.map.get(id) ?? null;
  }
  async findByIdForUpdate(id: string): Promise<Wallet | null> {
    return this.map.get(id) ?? null;
  }
  async insert(wallet: Wallet): Promise<void> {
    this.map.set(wallet.id, wallet);
  }
  async saveBalance(wallet: Wallet): Promise<void> {
    wallet.markSaved();
    this.map.set(wallet.id, wallet);
  }
}

class InMemoryWagerRepo implements WagerTransactionRepository {
  public readonly byId = new Map<string, WagerTransaction>();
  public readonly byIdempotency = new Map<string, WagerTransaction>();
  public readonly byExternal = new Map<string, WagerTransaction>();

  async findById(id: string): Promise<WagerTransaction | null> {
    return this.byId.get(id) ?? null;
  }
  async findByIdForUpdate(id: string): Promise<WagerTransaction | null> {
    return this.byId.get(id) ?? null;
  }
  async findByIdempotencyKey(key: string): Promise<WagerTransaction | null> {
    return this.byIdempotency.get(key) ?? null;
  }
  async findByExternalId(providerId: string, externalId: string): Promise<WagerTransaction | null> {
    return this.byExternal.get(`${providerId}:${externalId}`) ?? null;
  }
  async hasProcessedReversal(referenceTransactionId: string): Promise<boolean> {
    for (const tx of this.byId.values()) {
      if (
        tx.props.referenceTransactionId === referenceTransactionId &&
        (tx.kind === "REFUND" || tx.kind === "ROLLBACK") &&
        tx.status === "PROCESSED"
      ) {
        return true;
      }
    }
    return false;
  }
  async findProcessedReversal(referenceTransactionId: string): Promise<WagerTransaction | null> {
    for (const tx of this.byId.values()) {
      if (
        tx.props.referenceTransactionId === referenceTransactionId &&
        (tx.kind === "REFUND" || tx.kind === "ROLLBACK") &&
        tx.status === "PROCESSED"
      ) {
        return tx;
      }
    }
    return null;
  }
  async insert(tx: WagerTransaction): Promise<void> {
    this.byId.set(tx.id, tx);
    this.byIdempotency.set(tx.props.idempotencyKey, tx);
    this.byExternal.set(`${tx.props.providerId}:${tx.props.externalTransactionId}`, tx);
  }
  async update(tx: WagerTransaction): Promise<void> {
    this.byId.set(tx.id, tx);
  }
  async claimDuePendingReferences(now: Date = new Date(), limit = 50): Promise<WagerTransaction[]> {
    const list: WagerTransaction[] = [];
    for (const tx of this.byId.values()) {
      if (tx.status === "PENDING_REFERENCE" && tx.props.nextAttemptAt && tx.props.nextAttemptAt <= now) {
        list.push(tx);
        if (list.length >= limit) break;
      }
    }
    return list;
  }
  async findPendingByReference(
    providerId: string,
    referenceExternalTransactionId: string,
  ): Promise<WagerTransaction[]> {
    const list: WagerTransaction[] = [];
    for (const tx of this.byId.values()) {
      if (
        tx.props.providerId === providerId &&
        tx.props.referenceExternalTransactionId === referenceExternalTransactionId &&
        tx.status === "PENDING_REFERENCE"
      ) {
        list.push(tx);
      }
    }
    return list;
  }
  async countActivePendingReferences(): Promise<number> {
    let count = 0;
    for (const tx of this.byId.values()) {
      if (tx.status === "PENDING_REFERENCE") count++;
    }
    return count;
  }
}

class InMemoryLedgerRepo implements LedgerRepository {
  public readonly entries: WalletLedgerEntry[] = [];
  async append(entry: WalletLedgerEntry): Promise<void> {
    this.entries.push(entry);
  }
  async findByTransactionId(transactionId: string): Promise<WalletLedgerEntry | null> {
    return this.entries.find((e) => e.transactionId === transactionId) ?? null;
  }
  async listByWallet(): Promise<LedgerPageItem[]> {
    return [];
  }
  async totals(): Promise<LedgerTotals> {
    return { credits: "0.00", debits: "0.00", entries: 0 };
  }
}

class InMemoryOutboxRepo implements OutboxRepository {
  public readonly messages: OutboxMessage[] = [];
  async add(message: OutboxMessage): Promise<void> {
    this.messages.push(message);
  }
  async claimBatch(): Promise<OutboxMessage[]> {
    return [];
  }
  async save(): Promise<void> {}
  async getOldestPendingOccurredAt(): Promise<Date | null> {
    return null;
  }
}

class InMemoryInboxRepo implements InboxRepository {
  async tryInsert(): Promise<boolean> {
    return true;
  }
  async find() {
    return null;
  }
  async markProcessed(): Promise<void> {}
}

function makeTestUow(
  wallets: InMemoryWalletRepo,
  wagers: InMemoryWagerRepo,
  ledger: InMemoryLedgerRepo,
  outbox: InMemoryOutboxRepo,
  inbox: InMemoryInboxRepo,
): UnitOfWork {
  const repos: TransactionalRepositories = { wallets, wagers, ledger, outbox, inbox };
  return {
    async transactional<T>(work: (r: TransactionalRepositories) => Promise<T>): Promise<T> {
      return work(repos);
    },
  };
}

describe("ResolvePendingReferencesUseCase (Unit Tests)", () => {
  function setup() {
    const wallets = new InMemoryWalletRepo();
    const wagers = new InMemoryWagerRepo();
    const ledger = new InMemoryLedgerRepo();
    const outbox = new InMemoryOutboxRepo();
    const inbox = new InMemoryInboxRepo();
    const uow = makeTestUow(wallets, wagers, ledger, outbox, inbox);
    const registry = new Registry();
    const metrics = new PendingReferenceMetrics(registry);
    const useCase = new ResolvePendingReferencesUseCase(uow, metrics);

    return { wallets, wagers, ledger, outbox, inbox, useCase, metrics };
  }

  it("resolveOne > aplica WIN quando a BET de referência se encontra PROCESSED", async () => {
    const { wallets, wagers, ledger, outbox, useCase } = setup();

    const now = new Date("2026-10-17T12:00:00Z");
    const playerId = randomUUID();
    const wallet = Wallet.open({ id: randomUUID(), playerId, currency: "BRL", now });
    await wallets.insert(wallet);

    // BET já processada
    const bet = WagerTransaction.create({
      id: randomUUID(),
      providerId: "prov-1",
      externalTransactionId: "bet-ext-100",
      idempotencyKey: "key-bet",
      payloadHash: "hash-bet",
      walletId: wallet.id,
      playerId,
      roundId: "round-1",
      gameId: "game-1",
      kind: "BET",
      money: Money.from("50.00", "BRL"),
      referenceExternalTransactionId: null,
      now,
    });
    bet.markProcessed(Money.from("0.00", "BRL"), now);
    await wagers.insert(bet);

    // WIN dependente em PENDING_REFERENCE
    const win = WagerTransaction.create({
      id: randomUUID(),
      providerId: "prov-1",
      externalTransactionId: "win-ext-100",
      idempotencyKey: "key-win",
      payloadHash: "hash-win",
      walletId: wallet.id,
      playerId,
      roundId: "round-1",
      gameId: "game-1",
      kind: "WIN",
      money: Money.from("120.00", "BRL"),
      referenceExternalTransactionId: "bet-ext-100",
      now,
    });
    win.markPendingReference(new Date("2026-10-17T12:00:05Z"), now);
    await wagers.insert(win);

    const outcome = await useCase.resolveOne(win.id, new Date("2026-10-17T12:00:06Z"));

    expect(outcome).toBe("applied");
    expect(win.status).toBe("PROCESSED");
    expect(win.props.referenceTransactionId).toBe(bet.id);
    expect(wallet.balance.amount).toBe("120.00");
    expect(ledger.entries.length).toBe(1);
    expect(ledger.entries[0]!.direction).toBe("CREDIT");
    expect(outbox.messages.length).toBe(2); // WalletBalanceChanged + WagerTransactionProcessed
  });

  it("resolveOne > aplica REFUND quando a BET de referência se encontra PROCESSED", async () => {
    const { wallets, wagers, ledger, useCase } = setup();

    const now = new Date("2026-10-17T12:00:00Z");
    const playerId = randomUUID();
    const wallet = Wallet.open({ id: randomUUID(), playerId, currency: "BRL", now });
    await wallets.insert(wallet);

    const bet = WagerTransaction.create({
      id: randomUUID(),
      providerId: "prov-1",
      externalTransactionId: "bet-ext-200",
      idempotencyKey: "key-bet-200",
      payloadHash: "hash-bet-200",
      walletId: wallet.id,
      playerId,
      roundId: "round-2",
      gameId: "game-1",
      kind: "BET",
      money: Money.from("40.00", "BRL"),
      referenceExternalTransactionId: null,
      now,
    });
    bet.markProcessed(Money.from("0.00", "BRL"), now);
    await wagers.insert(bet);

    const refund = WagerTransaction.create({
      id: randomUUID(),
      providerId: "prov-1",
      externalTransactionId: "ref-ext-200",
      idempotencyKey: "key-ref-200",
      payloadHash: "hash-ref-200",
      walletId: wallet.id,
      playerId,
      roundId: "round-2",
      gameId: "game-1",
      kind: "REFUND",
      money: Money.from("40.00", "BRL"),
      referenceExternalTransactionId: "bet-ext-200",
      now,
    });
    refund.markPendingReference(new Date("2026-10-17T12:00:05Z"), now);
    await wagers.insert(refund);

    const outcome = await useCase.resolveOne(refund.id, new Date("2026-10-17T12:00:06Z"));

    expect(outcome).toBe("applied");
    expect(refund.status).toBe("PROCESSED");
    expect(wallet.balance.amount).toBe("40.00");
    expect(ledger.entries.length).toBe(1);
    expect(ledger.entries[0]!.direction).toBe("CREDIT");
  });

  it("resolveOne > rejeita transação com ALREADY_REVERSED se a referência já foi revertida", async () => {
    const { wallets, wagers, useCase } = setup();

    const now = new Date("2026-10-17T12:00:00Z");
    const playerId = randomUUID();
    const wallet = Wallet.open({ id: randomUUID(), playerId, currency: "BRL", now });
    await wallets.insert(wallet);

    const bet = WagerTransaction.create({
      id: randomUUID(),
      providerId: "prov-1",
      externalTransactionId: "bet-ext-300",
      idempotencyKey: "key-bet-300",
      payloadHash: "hash-bet-300",
      walletId: wallet.id,
      playerId,
      roundId: "round-3",
      gameId: "game-1",
      kind: "BET",
      money: Money.from("30.00", "BRL"),
      referenceExternalTransactionId: null,
      now,
    });
    bet.markProcessed(Money.from("0.00", "BRL"), now);
    await wagers.insert(bet);

    // Primeiro REFUND já executado e processado
    const refund1 = WagerTransaction.create({
      id: randomUUID(),
      providerId: "prov-1",
      externalTransactionId: "ref-ext-301",
      idempotencyKey: "key-ref-301",
      payloadHash: "hash-ref-301",
      walletId: wallet.id,
      playerId,
      roundId: "round-3",
      gameId: "game-1",
      kind: "REFUND",
      money: Money.from("30.00", "BRL"),
      referenceExternalTransactionId: "bet-ext-300",
      now,
    });
    refund1.markProcessed(Money.from("30.00", "BRL"), now, bet.id);
    await wagers.insert(refund1);

    // Segundo REFUND dependente
    const refund2 = WagerTransaction.create({
      id: randomUUID(),
      providerId: "prov-1",
      externalTransactionId: "ref-ext-302",
      idempotencyKey: "key-ref-302",
      payloadHash: "hash-ref-302",
      walletId: wallet.id,
      playerId,
      roundId: "round-3",
      gameId: "game-1",
      kind: "REFUND",
      money: Money.from("30.00", "BRL"),
      referenceExternalTransactionId: "bet-ext-300",
      now,
    });
    refund2.markPendingReference(new Date("2026-10-17T12:00:05Z"), now);
    await wagers.insert(refund2);

    const outcome = await useCase.resolveOne(refund2.id, new Date("2026-10-17T12:00:06Z"));

    expect(outcome).toBe("rejected_business");
    expect(refund2.status).toBe("REJECTED");
    expect(refund2.failureCode).toBe(FailureCode.ALREADY_REVERSED);
  });

  it("resolveOne > reagenda com backoff quando a referência ainda não existe e tentativas < limite", async () => {
    const { wallets, wagers, useCase } = setup();

    const now = new Date("2026-10-17T12:00:00Z");
    const playerId = randomUUID();
    const wallet = Wallet.open({ id: randomUUID(), playerId, currency: "BRL", now });
    await wallets.insert(wallet);

    const win = WagerTransaction.create({
      id: randomUUID(),
      providerId: "prov-1",
      externalTransactionId: "win-orphan-1",
      idempotencyKey: "key-orphan-1",
      payloadHash: "hash-orphan-1",
      walletId: wallet.id,
      playerId,
      roundId: "round-4",
      gameId: "game-1",
      kind: "WIN",
      money: Money.from("10.00", "BRL"),
      referenceExternalTransactionId: "bet-not-yet-here",
      now,
    });
    win.markPendingReference(new Date("2026-10-17T12:00:01Z"), now);
    await wagers.insert(win);

    const initialAttempts = win.props.attempts;
    const outcome = await useCase.resolveOne(win.id, new Date("2026-10-17T12:00:02Z"), {
      maxAttempts: 10,
      ttlSeconds: 900,
    });

    expect(outcome).toBe("rescheduled");
    expect(win.status).toBe("PENDING_REFERENCE");
    expect(win.props.attempts).toBe(initialAttempts + 1);
    expect(win.props.nextAttemptAt!.getTime()).toBeGreaterThan(new Date("2026-10-17T12:00:02Z").getTime());
  });

  it("resolveOne > expira com REFERENCE_NOT_FOUND quando atinge o limite de 10 tentativas", async () => {
    const { wallets, wagers, useCase } = setup();

    const now = new Date("2026-10-17T12:00:00Z");
    const playerId = randomUUID();
    const wallet = Wallet.open({ id: randomUUID(), playerId, currency: "BRL", now });
    await wallets.insert(wallet);

    const win = WagerTransaction.create({
      id: randomUUID(),
      providerId: "prov-1",
      externalTransactionId: "win-orphan-max",
      idempotencyKey: "key-orphan-max",
      payloadHash: "hash-orphan-max",
      walletId: wallet.id,
      playerId,
      roundId: "round-5",
      gameId: "game-1",
      kind: "WIN",
      money: Money.from("10.00", "BRL"),
      referenceExternalTransactionId: "bet-never-arrived",
      now,
    });
    // Simula 9 tentativas prévias
    for (let i = 0; i < 10; i++) {
      win.markPendingReference(new Date(), now);
    }
    expect(win.props.attempts).toBe(9);
    await wagers.insert(win);

    // Na 10ª avaliação atinge maxAttempts = 10
    const outcome = await useCase.resolveOne(win.id, new Date("2026-10-17T12:00:30Z"), {
      maxAttempts: 10,
      ttlSeconds: 900,
    });

    expect(outcome).toBe("rejected_timeout");
    expect(win.status).toBe("REJECTED");
    expect(win.failureCode).toBe(FailureCode.REFERENCE_NOT_FOUND);
    expect(wallet.balance.amount).toBe("0.00");
  });

  it("resolveOne > expira com REFERENCE_NOT_FOUND quando a idade ultrapassa o TTL de 15 minutos", async () => {
    const { wallets, wagers, useCase } = setup();

    const createdAt = new Date("2026-10-17T12:00:00Z");
    const playerId = randomUUID();
    const wallet = Wallet.open({ id: randomUUID(), playerId, currency: "BRL", now: createdAt });
    await wallets.insert(wallet);

    const win = WagerTransaction.create({
      id: randomUUID(),
      providerId: "prov-1",
      externalTransactionId: "win-orphan-ttl",
      idempotencyKey: "key-orphan-ttl",
      payloadHash: "hash-orphan-ttl",
      walletId: wallet.id,
      playerId,
      roundId: "round-6",
      gameId: "game-1",
      kind: "WIN",
      money: Money.from("10.00", "BRL"),
      referenceExternalTransactionId: "bet-never-came",
      now: createdAt,
    });
    win.markPendingReference(new Date("2026-10-17T12:00:05Z"), createdAt);
    await wagers.insert(win);

    // Avaliação 16 minutos depois (idade > 900s)
    const evaluatedAt = new Date("2026-10-17T12:16:00Z");
    const outcome = await useCase.resolveOne(win.id, evaluatedAt, {
      maxAttempts: 10,
      ttlSeconds: 900,
    });

    expect(outcome).toBe("rejected_timeout");
    expect(win.status).toBe("REJECTED");
    expect(win.failureCode).toBe(FailureCode.REFERENCE_NOT_FOUND);
  });

  it("execute > reivindica lote elegível e agrega contadores de resultado", async () => {
    const { wallets, wagers, useCase } = setup();

    const now = new Date("2026-10-17T12:00:00Z");
    const playerId = randomUUID();
    const wallet = Wallet.open({ id: randomUUID(), playerId, currency: "BRL", now });
    await wallets.insert(wallet);

    // Cria 2 pendentes vencidos e 1 futuro
    const tx1 = WagerTransaction.create({
      id: randomUUID(),
      providerId: "prov-1",
      externalTransactionId: "tx-batch-1",
      idempotencyKey: "key-b1",
      payloadHash: "hash-b1",
      walletId: wallet.id,
      playerId,
      roundId: "r-b1",
      gameId: "g-1",
      kind: "WIN",
      money: Money.from("10.00", "BRL"),
      referenceExternalTransactionId: "ref-b1",
      now,
    });
    tx1.markPendingReference(new Date("2026-10-17T11:59:50Z"), now);
    await wagers.insert(tx1);

    const tx2 = WagerTransaction.create({
      id: randomUUID(),
      providerId: "prov-1",
      externalTransactionId: "tx-batch-2",
      idempotencyKey: "key-b2",
      payloadHash: "hash-b2",
      walletId: wallet.id,
      playerId,
      roundId: "r-b2",
      gameId: "g-1",
      kind: "WIN",
      money: Money.from("20.00", "BRL"),
      referenceExternalTransactionId: "ref-b2",
      now,
    });
    tx2.markPendingReference(new Date("2026-10-17T11:59:55Z"), now);
    await wagers.insert(tx2);

    const txFuture = WagerTransaction.create({
      id: randomUUID(),
      providerId: "prov-1",
      externalTransactionId: "tx-batch-future",
      idempotencyKey: "key-bf",
      payloadHash: "hash-bf",
      walletId: wallet.id,
      playerId,
      roundId: "r-bf",
      gameId: "g-1",
      kind: "WIN",
      money: Money.from("30.00", "BRL"),
      referenceExternalTransactionId: "ref-bf",
      now,
    });
    txFuture.markPendingReference(new Date("2026-10-17T12:05:00Z"), now);
    await wagers.insert(txFuture);

    const result = await useCase.execute({ now, batchSize: 10 });

    expect(result.claimedCount).toBe(2);
    expect(result.rescheduledCount).toBe(2);
    expect(result.appliedCount).toBe(0);
    expect(result.activeCount).toBe(3);
  });

  it("calculateBackoffDelayMs > calcula backoff exponencial com teto de 60s e jitter respeitado", () => {
    // attempts = 0 -> base: 1000ms
    expect(calculateBackoffDelayMs(0, () => 0)).toBe(1000);
    expect(calculateBackoffDelayMs(0, () => 500)).toBe(1500);

    // attempts = 1 -> base: 2000ms
    expect(calculateBackoffDelayMs(1, () => 0)).toBe(2000);

    // attempts = 3 -> base: 8000ms
    expect(calculateBackoffDelayMs(3, () => 250)).toBe(8250);

    // attempts = 5 -> base: 32000ms
    expect(calculateBackoffDelayMs(5, () => 0)).toBe(32000);

    // attempts = 6 -> 64000ms, mas teto é 60000ms!
    expect(calculateBackoffDelayMs(6, () => 0)).toBe(60000);

    // attempts = 10 -> base limitada a 60000ms
    expect(calculateBackoffDelayMs(10, () => 100)).toBe(60100);

    // Jitter padrão deve estar entre [base, base + 1000)
    const randomized = calculateBackoffDelayMs(2);
    expect(randomized).toBeGreaterThanOrEqual(4000);
    expect(randomized).toBeLessThan(5000);
  });

  it("execute > cada claim e resolução é atômica e não reprocessa pendência já resolvida", async () => {
    const { wallets, wagers, useCase } = setup();

    const now = new Date("2026-10-17T12:00:00Z");
    const playerId = randomUUID();
    const wallet = Wallet.open({ id: randomUUID(), playerId, currency: "BRL", now });
    await wallets.insert(wallet);

    // BET já confirmada
    const bet = WagerTransaction.create({
      id: randomUUID(),
      providerId: "prov-atomic",
      externalTransactionId: "bet-at-1",
      idempotencyKey: "key-bet-at",
      payloadHash: "hash-bet-at",
      walletId: wallet.id,
      playerId,
      roundId: "r-at",
      gameId: "g-1",
      kind: "BET",
      money: Money.from("10.00", "BRL"),
      referenceExternalTransactionId: null,
      now,
    });
    bet.markProcessed(Money.from("0.00", "BRL"), now);
    await wagers.insert(bet);

    // WIN dependente vencido
    const win = WagerTransaction.create({
      id: randomUUID(),
      providerId: "prov-atomic",
      externalTransactionId: "win-at-1",
      idempotencyKey: "key-win-at",
      payloadHash: "hash-win-at",
      walletId: wallet.id,
      playerId,
      roundId: "r-at",
      gameId: "g-1",
      kind: "WIN",
      money: Money.from("50.00", "BRL"),
      referenceExternalTransactionId: "bet-at-1",
      now,
    });
    win.markPendingReference(new Date("2026-10-17T11:59:59Z"), now);
    await wagers.insert(win);

    const result = await useCase.execute({ now, batchSize: 5 });
    expect(result.claimedCount).toBe(1);
    expect(result.appliedCount).toBe(1);
    expect(win.status).toBe("PROCESSED");

    // Segunda execução imediata não deve re-reivindicar nada
    const secondResult = await useCase.execute({ now, batchSize: 5 });
    expect(secondResult.claimedCount).toBe(0);
    expect(secondResult.appliedCount).toBe(0);
  });
});

