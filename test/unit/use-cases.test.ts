import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
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
  CreateWalletUseCase,
  GetLedgerUseCase,
  GetTransactionUseCase,
  GetWalletUseCase,
  ProcessWagerTransactionUseCase,
  ReconcileWalletUseCase,
} from "../../src/application/use-cases";
import { DomainError } from "../../src/domain/errors/domain-error";
import { FailureCode } from "../../src/domain/errors/failure-code";
import type { WalletLedgerEntry } from "../../src/domain/ledger/wallet-ledger-entry";
import type { OutboxMessage } from "../../src/domain/messaging/outbox-message";
import { Money } from "../../src/domain/money/money";
import type { WagerTransaction } from "../../src/domain/wagering/wager-transaction";
import { Wallet } from "../../src/domain/wallet/wallet";

class InMemoryWalletRepository implements WalletRepository {
  public readonly map = new Map<string, Wallet>();
  public readonly byPlayerCurrency = new Set<string>();

  async findById(id: string): Promise<Wallet | null> {
    return this.map.get(id) ?? null;
  }
  async findByIdForUpdate(id: string): Promise<Wallet | null> {
    return this.map.get(id) ?? null;
  }
  async insert(wallet: Wallet): Promise<void> {
    const key = `${wallet.playerId}:${wallet.currency}`;
    if (this.byPlayerCurrency.has(key)) {
      const err = new Error("ux_wallets_player_currency");
      (err as unknown as Record<string, unknown>).code = "23505";
      throw err;
    }
    this.byPlayerCurrency.add(key);
    this.map.set(wallet.id, wallet);
  }
  async saveBalance(wallet: Wallet): Promise<void> {
    this.map.set(wallet.id, wallet);
  }
}

class InMemoryWagerRepository implements WagerTransactionRepository {
  public readonly byId = new Map<string, WagerTransaction>();
  public readonly byIdempotency = new Map<string, WagerTransaction>();
  public readonly byExternal = new Map<string, WagerTransaction>();

  async findById(id: string): Promise<WagerTransaction | null> {
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
  async insert(tx: WagerTransaction): Promise<void> {
    this.byId.set(tx.id, tx);
    this.byIdempotency.set(tx.props.idempotencyKey, tx);
    this.byExternal.set(`${tx.props.providerId}:${tx.props.externalTransactionId}`, tx);
  }
  async update(tx: WagerTransaction): Promise<void> {
    this.byId.set(tx.id, tx);
  }
  async claimDuePendingReferences(): Promise<WagerTransaction[]> {
    return [];
  }
}

class InMemoryLedgerRepository implements LedgerRepository {
  public readonly entries: { seq: string; entry: WalletLedgerEntry }[] = [];
  private seqCounter = 0;

  async append(entry: WalletLedgerEntry): Promise<void> {
    this.seqCounter += 1;
    this.entries.push({ seq: String(this.seqCounter), entry });
  }
  async findByTransactionId(transactionId: string): Promise<WalletLedgerEntry | null> {
    const item = this.entries.find((e) => e.entry.transactionId === transactionId);
    return item ? item.entry : null;
  }
  async listByWallet(walletId: string, opts: { afterSeq?: string; limit: number }): Promise<LedgerPageItem[]> {
    const filtered = this.entries.filter((e) => {
      if (e.entry.walletId !== walletId) return false;
      if (opts.afterSeq && Number(e.seq) <= Number(opts.afterSeq)) return false;
      return true;
    });
    return filtered.slice(0, opts.limit);
  }
  async totals(walletId: string): Promise<LedgerTotals> {
    let credits = Money.zero("BRL");
    let debits = Money.zero("BRL");
    let count = 0;
    for (const item of this.entries) {
      if (item.entry.walletId === walletId) {
        count += 1;
        if (item.entry.direction === "CREDIT") {
          credits = credits.add(item.entry.amount);
        } else {
          debits = debits.add(item.entry.amount);
        }
      }
    }
    return {
      credits: credits.amount,
      debits: debits.amount,
      entries: count,
    };
  }
}

class InMemoryOutboxRepository implements OutboxRepository {
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


class InMemoryInboxRepository implements InboxRepository {
  async tryInsert(): Promise<boolean> {
    return true;
  }
  async find() {
    return null;
  }
  async markProcessed() {}
}

function createTestUow() {
  const wallets = new InMemoryWalletRepository();
  const wagers = new InMemoryWagerRepository();
  const ledger = new InMemoryLedgerRepository();
  const outbox = new InMemoryOutboxRepository();
  const inbox = new InMemoryInboxRepository();

  const repos: TransactionalRepositories = { wallets, wagers, ledger, outbox, inbox };

  const uow: UnitOfWork = {
    async transactional<T>(work: (r: TransactionalRepositories) => Promise<T>): Promise<T> {
      return work(repos);
    },
  };

  return { uow, wallets, wagers, ledger, outbox, inbox };
}

describe("Application Use Cases (Unit Tests)", () => {
  it("CreateWalletUseCase > cria carteira e lança OPENING quando saldo inicial > 0", async () => {
    const { uow, ledger, outbox } = createTestUow();
    const useCase = new CreateWalletUseCase(uow);
    const playerId = randomUUID();

    const result = await useCase.execute({
      playerId,
      currency: "BRL",
      initialBalance: "150.00",
    });

    expect(result.playerId).toBe(playerId);
    expect(result.currency).toBe("BRL");
    expect(result.balance).toBe("150.00");
    expect(result.version).toBe(2);
    expect(ledger.entries.length).toBe(1);
    expect(ledger.entries[0]?.entry.direction).toBe("CREDIT");
    expect(ledger.entries[0]?.entry.amount.amount).toBe("150.00");
    expect(outbox.messages.length).toBe(1);
  });

  it("CreateWalletUseCase > falha com WALLET_ALREADY_EXISTS para jogador e moeda duplicados", async () => {
    const { uow } = createTestUow();
    const useCase = new CreateWalletUseCase(uow);
    const playerId = randomUUID();

    await useCase.execute({ playerId, currency: "BRL", initialBalance: "0.00" });

    await expect(
      useCase.execute({ playerId, currency: "BRL", initialBalance: "10.00" }),
    ).rejects.toThrowError(DomainError);
  });

  it("ProcessWagerTransactionUseCase > BET processa com sucesso e debita saldo", async () => {
    const { uow } = createTestUow();
    const createWallet = new CreateWalletUseCase(uow);
    const processTx = new ProcessWagerTransactionUseCase(uow);

    const playerId = randomUUID();
    const wallet = await createWallet.execute({
      playerId,
      currency: "BRL",
      initialBalance: "100.00",
    });

    const result = await processTx.execute("key-bet-1", {
      providerId: "provider-1",
      externalTransactionId: "ext-tx-1",
      playerId,
      walletId: wallet.id,
      roundId: "round-1",
      gameId: "game-1",
      kind: "BET",
      amount: "30.00",
      currency: "BRL",
    });

    expect(result.statusCode).toBe(201);
    expect(result.idempotentReplay).toBe(false);
    expect(result.transaction.status).toBe("PROCESSED");
    expect(result.transaction.resultBalance).toBe("70.00");
  });

  it("ProcessWagerTransactionUseCase > replay com mesma key e payload retorna 200 e snapshot", async () => {
    const { uow } = createTestUow();
    const createWallet = new CreateWalletUseCase(uow);
    const processTx = new ProcessWagerTransactionUseCase(uow);

    const playerId = randomUUID();
    const wallet = await createWallet.execute({
      playerId,
      currency: "BRL",
      initialBalance: "100.00",
    });

    const payload = {
      providerId: "provider-1",
      externalTransactionId: "ext-tx-1",
      playerId,
      walletId: wallet.id,
      roundId: "round-1",
      gameId: "game-1",
      kind: "BET" as const,
      amount: "25.00",
      currency: "BRL",
    };

    const first = await processTx.execute("key-replay-1", payload);
    expect(first.statusCode).toBe(201);

    const replay = await processTx.execute("key-replay-1", payload);
    expect(replay.statusCode).toBe(200);
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.transaction.id).toBe(first.transaction.id);
  });

  it("ProcessWagerTransactionUseCase > mesma key com payload divergente retorna IDEMPOTENCY_CONFLICT", async () => {
    const { uow } = createTestUow();
    const createWallet = new CreateWalletUseCase(uow);
    const processTx = new ProcessWagerTransactionUseCase(uow);

    const playerId = randomUUID();
    const wallet = await createWallet.execute({
      playerId,
      currency: "BRL",
      initialBalance: "100.00",
    });

    await processTx.execute("key-conflict-1", {
      providerId: "provider-1",
      externalTransactionId: "ext-tx-1",
      playerId,
      walletId: wallet.id,
      roundId: "round-1",
      gameId: "game-1",
      kind: "BET",
      amount: "25.00",
      currency: "BRL",
    });

    await expect(
      processTx.execute("key-conflict-1", {
        providerId: "provider-1",
        externalTransactionId: "ext-tx-1",
        playerId,
        walletId: wallet.id,
        roundId: "round-1",
        gameId: "game-1",
        kind: "BET",
        amount: "50.00", // Alterou o amount!
        currency: "BRL",
      }),
    ).rejects.toThrowError(DomainError);
  });

  it("ProcessWagerTransactionUseCase > WIN com referência pendente retorna 202 Accepted", async () => {
    const { uow } = createTestUow();
    const createWallet = new CreateWalletUseCase(uow);
    const processTx = new ProcessWagerTransactionUseCase(uow);

    const playerId = randomUUID();
    const wallet = await createWallet.execute({
      playerId,
      currency: "BRL",
      initialBalance: "10.00",
    });

    const result = await processTx.execute("key-pending-1", {
      providerId: "provider-1",
      externalTransactionId: "ext-win-1",
      playerId,
      walletId: wallet.id,
      roundId: "round-1",
      gameId: "game-1",
      kind: "WIN",
      amount: "50.00",
      currency: "BRL",
      referenceExternalTransactionId: "ext-bet-does-not-exist-yet",
    });

    expect(result.statusCode).toBe(202);
    expect(result.idempotentReplay).toBe(false);
    expect(result.transaction.status).toBe("PENDING_REFERENCE");
  });

  it("GetWalletUseCase > retorna dados e saldo da carteira", async () => {
    const { uow } = createTestUow();
    const createWallet = new CreateWalletUseCase(uow);
    const getWallet = new GetWalletUseCase(uow);

    const playerId = randomUUID();
    const created = await createWallet.execute({ playerId, currency: "BRL", initialBalance: "75.00" });

    const fetched = await getWallet.execute(created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.balance).toBe("75.00");
  });

  it("GetLedgerUseCase > pagina extrato com cursor seq", async () => {
    const { uow } = createTestUow();
    const createWallet = new CreateWalletUseCase(uow);
    const processTx = new ProcessWagerTransactionUseCase(uow);
    const getLedger = new GetLedgerUseCase(uow);

    const playerId = randomUUID();
    const wallet = await createWallet.execute({ playerId, currency: "BRL", initialBalance: "100.00" });

    await processTx.execute("k1", {
      providerId: "p1",
      externalTransactionId: "e1",
      playerId,
      walletId: wallet.id,
      roundId: "r1",
      gameId: "g1",
      kind: "BET",
      amount: "10.00",
      currency: "BRL",
    });

    await processTx.execute("k2", {
      providerId: "p1",
      externalTransactionId: "e2",
      playerId,
      walletId: wallet.id,
      roundId: "r2",
      gameId: "g2",
      kind: "BET",
      amount: "20.00",
      currency: "BRL",
    });

    // OPENING + 2 BETs = 3 entries
    const page1 = await getLedger.execute({ walletId: wallet.id, limit: 2 });
    expect(page1.items.length).toBe(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await getLedger.execute({ walletId: wallet.id, limit: 2, cursor: page1.nextCursor! });
    expect(page2.items.length).toBe(1);
    expect(page2.nextCursor).toBeNull();
  });

  it("ReconcileWalletUseCase > retorna consistent: true quando ledger e saldo batem", async () => {
    const { uow } = createTestUow();
    const createWallet = new CreateWalletUseCase(uow);
    const processTx = new ProcessWagerTransactionUseCase(uow);
    const reconcile = new ReconcileWalletUseCase(uow);

    const playerId = randomUUID();
    const wallet = await createWallet.execute({ playerId, currency: "BRL", initialBalance: "100.00" });

    await processTx.execute("k-rec", {
      providerId: "p1",
      externalTransactionId: "e-rec",
      playerId,
      walletId: wallet.id,
      roundId: "r1",
      gameId: "g1",
      kind: "BET",
      amount: "40.00",
      currency: "BRL",
    });

    const report = await reconcile.execute(wallet.id);
    expect(report.consistent).toBe(true);
    expect(report.storedBalance).toBe("60.00");
    expect(report.calculatedBalance).toBe("60.00");
    expect(report.difference).toBe("0.00");
    expect(report.checkedEntries).toBe(2); // OPENING + BET
  });

  it("GetTransactionUseCase > consulta por id, por externalId ou lança TRANSACTION_NOT_FOUND", async () => {
    const { uow } = createTestUow();
    const createWallet = new CreateWalletUseCase(uow);
    const processTx = new ProcessWagerTransactionUseCase(uow);
    const getTx = new GetTransactionUseCase(uow);

    const playerId = randomUUID();
    const wallet = await createWallet.execute({ playerId, currency: "BRL", initialBalance: "50.00" });

    const processed = await processTx.execute("key-tx-lookup", {
      providerId: "prov-1",
      externalTransactionId: "ext-tx-lookup",
      playerId,
      walletId: wallet.id,
      roundId: "r1",
      gameId: "g1",
      kind: "BET",
      amount: "10.00",
      currency: "BRL",
    });

    // Por ID
    const byId = await getTx.execute({ id: processed.transaction.id });
    expect(byId.id).toBe(processed.transaction.id);
    expect(byId.amount).toBe("10.00");

    // Por Provider + ExternalId
    const byExt = await getTx.execute({ providerId: "prov-1", externalTransactionId: "ext-tx-lookup" });
    expect(byExt.id).toBe(processed.transaction.id);

    // Inexistente
    try {
      await getTx.execute({ id: randomUUID() });
      expect().fail("Deveria ter lançado DomainError");
    } catch (e) {
      expect((e as DomainError).code).toBe(FailureCode.TRANSACTION_NOT_FOUND);
    }
  });
});
