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
  DepositUseCase,
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
    wallet.markSaved();
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
    expect(replay.message).toContain("Replay de Idempotência: esta aposta já foi processada anteriormente");
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

  it("ProcessWagerTransactionUseCase > Fast-path na mesma carteira resolve pendência atomicamente na transação da BET", async () => {
    const { uow } = createTestUow();
    const createWallet = new CreateWalletUseCase(uow);
    const processTx = new ProcessWagerTransactionUseCase(uow);

    const playerId = randomUUID();
    const wallet = await createWallet.execute({
      playerId,
      currency: "BRL",
      initialBalance: "50.00",
    });

    // 1. WIN chega antes da BET -> 202 PENDING_REFERENCE
    const winResult = await processTx.execute("key-win-fast", {
      providerId: "provider-fast",
      externalTransactionId: "ext-win-fast",
      playerId,
      walletId: wallet.id,
      roundId: "round-fast",
      gameId: "game-fast",
      kind: "WIN",
      amount: "100.00",
      currency: "BRL",
      referenceExternalTransactionId: "ext-bet-fast",
    });
    expect(winResult.statusCode).toBe(202);

    // 2. BET chega -> 201 PROCESSED e o fast-path resolve o WIN na mesma transação
    const betResult = await processTx.execute("key-bet-fast", {
      providerId: "provider-fast",
      externalTransactionId: "ext-bet-fast",
      playerId,
      walletId: wallet.id,
      roundId: "round-fast",
      gameId: "game-fast",
      kind: "BET",
      amount: "20.00",
      currency: "BRL",
    });
    expect(betResult.statusCode).toBe(201);

    // Saldo final: 50 - 20 + 100 = 130
    const updatedWallet = await uow.transactional(async (r) => r.wallets.findById(wallet.id));
    expect(updatedWallet!.balance.amount).toBe("130.00");

    // WIN deve ter sido processado
    const updatedWin = await uow.transactional(async (r) =>
      r.wagers.findByExternalId("provider-fast", "ext-win-fast"),
    );
    expect(updatedWin!.status).toBe("PROCESSED");
    expect(updatedWin!.props.referenceTransactionId).toBe(betResult.transaction.id);
  });

  it("ProcessWagerTransactionUseCase > Fast-path em carteira distinta apenas agenda next_attempt_at = now sem mutação de saldo", async () => {
    const { uow } = createTestUow();
    const createWallet = new CreateWalletUseCase(uow);
    const processTx = new ProcessWagerTransactionUseCase(uow);

    const player1 = randomUUID();
    const player2 = randomUUID();
    const wallet1 = await createWallet.execute({ playerId: player1, currency: "BRL", initialBalance: "10.00" });
    const wallet2 = await createWallet.execute({ playerId: player2, currency: "BRL", initialBalance: "50.00" });

    // WIN registrado na carteira 2 aguardando BET da carteira 1
    await processTx.execute("key-win-cross", {
      providerId: "provider-cross",
      externalTransactionId: "ext-win-cross",
      playerId: player2,
      walletId: wallet2.id,
      roundId: "round-cross",
      gameId: "game-cross",
      kind: "WIN",
      amount: "30.00",
      currency: "BRL",
      referenceExternalTransactionId: "ext-bet-cross",
    });

    // BET processada na carteira 1
    const betResult = await processTx.execute("key-bet-cross", {
      providerId: "provider-cross",
      externalTransactionId: "ext-bet-cross",
      playerId: player1,
      walletId: wallet1.id,
      roundId: "round-cross",
      gameId: "game-cross",
      kind: "BET",
      amount: "5.00",
      currency: "BRL",
    });
    expect(betResult.statusCode).toBe(201);

    // Carteira 1 debitada: 10 - 5 = 5.00
    const w1 = await uow.transactional(async (r) => r.wallets.findById(wallet1.id));
    expect(w1!.balance.amount).toBe("5.00");

    // Carteira 2 NÃO movimentada pelo fast-path (continua 50.00)
    const w2 = await uow.transactional(async (r) => r.wallets.findById(wallet2.id));
    expect(w2!.balance.amount).toBe("50.00");

    // WIN da carteira 2 permanece PENDING_REFERENCE, mas com nextAttemptAt elegível imediatamente (<= now)
    const winTx = await uow.transactional(async (r) =>
      r.wagers.findByExternalId("provider-cross", "ext-win-cross"),
    );
    expect(winTx!.status).toBe("PENDING_REFERENCE");
    expect(winTx!.props.nextAttemptAt).toBeDefined();
    expect(winTx!.props.nextAttemptAt!.getTime()).toBeLessThanOrEqual(Date.now() + 100);
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

  it("DepositUseCase > credita saldo, grava no ledger, emite evento Outbox e suporta idempotência estrita", async () => {
    const { uow, wallets, wagers, ledger, outbox } = createTestUow();
    const createWallet = new CreateWalletUseCase(uow);
    const deposit = new DepositUseCase(uow);

    const playerId = randomUUID();
    const wallet = await createWallet.execute({ playerId, currency: "BRL", initialBalance: "50.00" });

    // 1. Depósito com sucesso
    const res = await deposit.execute(wallet.id, "key-dep-01", {
      amount: "75.00",
      providerId: "PIX_GATEWAY",
      externalTransactionId: "pix-12345",
    });

    expect(res.idempotentReplay).toBe(false);
    expect(res.amount).toBe("75.00");
    expect(res.balanceBefore).toBe("50.00");
    expect(res.balanceAfter).toBe("125.00");
    expect(res.status).toBe("PROCESSED");

    // Valida persistência
    const updatedWallet = await wallets.findById(wallet.id);
    expect(updatedWallet?.balance.amount).toBe("125.00");
    expect(wagers.byId.has(res.transactionId)).toBe(true);
    expect(ledger.entries.length).toBe(2); // OPENING + DEPOSIT
    expect(outbox.messages.length).toBe(2);

    // 2. Replay idempotente (mesma chave e mesmo payload)
    const replay = await deposit.execute(wallet.id, "key-dep-01", {
      amount: "75.00",
      providerId: "PIX_GATEWAY",
      externalTransactionId: "pix-12345",
    });
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.message).toContain("Replay de Idempotência: este depósito já foi creditado anteriormente");
    expect(replay.transactionId).toBe(res.transactionId);
    expect(updatedWallet?.balance.amount).toBe("125.00");

    // 3. Conflito de Idempotência (mesma chave, valor diferente)
    try {
      await deposit.execute(wallet.id, "key-dep-01", {
        amount: "100.00",
        providerId: "PIX_GATEWAY",
        externalTransactionId: "pix-12345",
      });
      expect().fail("Deveria lançar IDEMPOTENCY_CONFLICT");
    } catch (err) {
      expect((err as DomainError).code).toBe(FailureCode.IDEMPOTENCY_CONFLICT);
    }

    // 4. Carteira inexistente
    try {
      await deposit.execute(randomUUID(), "key-dep-other", {
        amount: "50.00",
        providerId: "CASHIER",
      });
      expect().fail("Deveria lançar WALLET_NOT_FOUND");
    } catch (err) {
      expect((err as DomainError).code).toBe(FailureCode.WALLET_NOT_FOUND);
    }
  });
});
