/**
 * ============================================================================
 * 🧪 TESTES DE INTEGRAÇÃO: PERSISTÊNCIA & POSTGRESQL (FASE 2)
 * ============================================================================
 * Arquivo: test/integration/persistence.test.ts
 *
 * 🎯 RESPONSABILIDADE DESTE ARQUIVO:
 * Validar diretamente no banco de dados PostgreSQL real as garantias estruturais
 * e de integridade financeira que foram implementadas na Fase 2 através de
 * esquemas MikroORM, triggers PL/pgSQL, restrições CHECK e índices parciais.
 *
 * 📋 O QUE ELE TESTA ESPECIFICAMENTE:
 * 1. Carteira & Concorrência:
 *    - Persistência e reidratação do Aggregate Wallet com Value Object Money.
 *    - Concorrência Otimista: falha ao salvar alteração com versão desatualizada (saveBalance).
 *    - Lock Pessimista: serialização de transações concorrentes na mesma carteira
 *      utilizando SELECT ... FOR UPDATE (sem travamento global da tabela).
 *    - Integridade no Banco: bloqueio de saldo negativo via constraint CHECK do PostgreSQL.
 *
 * 2. Imutabilidade do Livro-Razão (Ledger):
 *    - Trigger `trg_ledger_entries_immutable`: aborta tentativas de UPDATE no ledger.
 *    - Trigger `trg_ledger_entries_immutable`: aborta tentativas de DELETE no ledger.
 *    - Constraint CHECK: rejeita inserções com matemática inconsistente (balanceAfter != balanceBefore ± amount).
 *    - Totais Contábeis: somatórios NUMERIC em banco e paginação sequencial via seq crescente.
 *
 * 3. Transações de Aposta & Estados Terminais:
 *    - Trigger `trg_wager_tx_terminal_state`: impede alteração de transações já processadas/rejeitadas.
 *    - Índice Parcial `ux_single_reversal`: impede que uma mesma aposta sofra mais de uma reversão (REFUND/ROLLBACK).
 *    - Concorrência de Leases: claimDuePendingReferences com FOR UPDATE SKIP LOCKED.
 *
 * 4. Padrões de Mensageria Resiliente:
 *    - Inbox Pattern: tryInsert com garantia de idempotência via ON CONFLICT DO NOTHING.
 *    - Outbox Pattern: claimBatch aplicando lease temporário com SKIP LOCKED para múltiplos workers.
 * ============================================================================
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { ConcurrencyConflictError } from "../../src/application/ports/unit-of-work.port";
import { Money } from "../../src/domain/money/money";
import { InboxMessage } from "../../src/domain/messaging/inbox-message";
import { OutboxMessage } from "../../src/domain/messaging/outbox-message";
import { WalletBalanceChanged } from "../../src/domain/events/events";
import {
  hash,
  newWager,
  resetData,
  seedWallet,
  setupTestDb,
  sleep,
  uuid,
  type TestDb,
} from "../helpers/db";

describe("Persistence & Database (Fase 2)", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await setupTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await resetData(db);
  });

  describe("Wallet & Concurrency Lock", () => {
    it("persiste e busca uma carteira mantendo Value Object Money e versão", async () => {
      const { wallet } = await seedWallet(db.uow, "250.75", "BRL");

      const found = await db.uow.transactional(async (r) => {
        return r.wallets.findById(wallet.id);
      });

      expect(found).not.toBeNull();
      expect(found!.id).toBe(wallet.id);
      expect(found!.playerId).toBe(wallet.playerId);
      expect(found!.currency).toBe("BRL");
      expect(found!.balance.amount).toBe("250.75");
      expect(found!.version).toBe(2); // open (v1) + credit (v2)
    });

    it("impede escrita concorrente na mesma versão com saveBalance", async () => {
      const { wallet } = await seedWallet(db.uow, "100.00", "BRL");

      // Transação 1 debita 10.00 e salva
      await db.uow.transactional(async (r) => {
        const w = await r.wallets.findById(wallet.id);
        const bet = newWager(w!, "BET", "10.00");
        const entry = w!.debit({
          ledgerId: uuid(),
          transactionId: bet.id,
          amount: Money.from("10.00", "BRL"),
          now: new Date(),
        });
        bet.markProcessed(w!.balance, new Date());
        await r.wagers.insert(bet);
        await r.ledger.append(entry);
        await r.wallets.saveBalance(w!);
      });

      // Transação 2 tenta salvar a wallet antiga (com loadedVersion defasada)
      wallet.debit({
        ledgerId: uuid(),
        transactionId: uuid(),
        amount: Money.from("20.00", "BRL"),
        now: new Date(),
      });

      expect(
        db.uow.transactional(async (r) => {
          await r.wallets.saveBalance(wallet);
        }),
      ).rejects.toThrow(ConcurrencyConflictError);
    });

    it("lock pessimista (findByIdForUpdate) serializa transações concorrentes na mesma wallet", async () => {
      const { wallet } = await seedWallet(db.uow, "100.00", "BRL");
      const order: string[] = [];

      // Transação lenta segurando o lock
      const tx1 = db.uow.transactional(async (r) => {
        const w = await r.wallets.findByIdForUpdate(wallet.id);
        order.push("tx1:lock");
        await sleep(150);
        const bet = newWager(w!, "BET", "30.00");
        const entry = w!.debit({
          ledgerId: uuid(),
          transactionId: bet.id,
          amount: Money.from("30.00", "BRL"),
          now: new Date(),
        });
        bet.markProcessed(w!.balance, new Date());
        await r.wagers.insert(bet);
        await r.ledger.append(entry);
        await r.wallets.saveBalance(w!);
        order.push("tx1:done");
      });

      // Transação 2 tenta pegar lock na mesma wallet (deve aguardar tx1)
      const tx2 = (async () => {
        await sleep(30);
        order.push("tx2:waiting");
        return db.uow.transactional(async (r) => {
          const w = await r.wallets.findByIdForUpdate(wallet.id);
          order.push("tx2:acquired");
          return w!.balance.amount;
        });
      })();

      const [, balanceTx2] = await Promise.all([tx1, tx2]);

      expect(order).toEqual(["tx1:lock", "tx2:waiting", "tx1:done", "tx2:acquired"]);
      expect(balanceTx2).toBe("70.00");
    });

    it("rejeita saldo negativo diretamente no PostgreSQL via CHECK constraint", async () => {
      const { wallet } = await seedWallet(db.uow, "50.00", "BRL");

      expect(
        db.sql(`update wallets set balance_amount = -10.00 where id = ?`, [wallet.id]),
      ).rejects.toThrow(/ck_wallets_balance_non_negative/i);
    });
  });

  describe("Ledger Imutabilidade (Append-only Trigger)", () => {
    it("bloqueia UPDATE na tabela wallet_ledger_entries disparando exceção na trigger", async () => {
      const { entry } = await seedWallet(db.uow, "100.00", "BRL");

      expect(
        db.sql(`update wallet_ledger_entries set amount = 999.00 where id = ?`, [entry.id]),
      ).rejects.toThrow(/wallet_ledger_entries is append-only/i);
    });

    it("bloqueia DELETE na tabela wallet_ledger_entries disparando exceção na trigger", async () => {
      const { entry } = await seedWallet(db.uow, "100.00", "BRL");

      expect(
        db.sql(`delete from wallet_ledger_entries where id = ?`, [entry.id]),
      ).rejects.toThrow(/wallet_ledger_entries is append-only/i);
    });

    it("rejeita lançamento com aritmética inconsistente via CHECK constraint", async () => {
      const { wallet } = await seedWallet(db.uow, "100.00", "BRL");

      // Registra transação dummy
      const tx = newWager(wallet, "BET", "10.00");
      await db.uow.transactional(async (r) => {
        await r.wagers.insert(tx);
      });

      // Tenta inserir ledger com balance_after incorreto (100 - 10 deveria ser 90, inserindo 80)
      expect(
        db.sql(
          `insert into wallet_ledger_entries
           (id, wallet_id, transaction_id, direction, amount, currency, balance_before, balance_after)
           values (?, ?, ?, 'DEBIT', 10.00, 'BRL', 100.00, 80.00)`,
          [uuid(), wallet.id, tx.id],
        ),
      ).rejects.toThrow(/ck_ledger_arithmetic/i);
    });

    it("calcula totais e paginação com cursor seq crescente", async () => {
      const { wallet, opening } = await seedWallet(db.uow, "100.00", "BRL");

      // Adiciona mais dois lançamentos
      const bet = newWager(wallet, "BET", "30.00");
      const win = newWager(wallet, "WIN", "50.00");

      await db.uow.transactional(async (r) => {
        const w = await r.wallets.findByIdForUpdate(wallet.id);
        const e1 = w!.debit({ ledgerId: uuid(), transactionId: bet.id, amount: bet.props.money, now: new Date() });
        const e2 = w!.credit({ ledgerId: uuid(), transactionId: win.id, amount: win.props.money, now: new Date() });
        bet.markProcessed(w!.balance, new Date());
        win.markProcessed(w!.balance, new Date());
        await r.wagers.insert(bet);
        await r.wagers.insert(win);
        await r.ledger.append(e1);
        await r.ledger.append(e2);
        await r.wallets.saveBalance(w!);
      });

      const totals = await db.uow.transactional((r) => r.ledger.totals(wallet.id));
      expect(totals.credits).toBe("150.00"); // 100 opening + 50 win
      expect(totals.debits).toBe("30.00");
      expect(totals.entries).toBe(3);

      // Paginação
      const page1 = await db.uow.transactional((r) => r.ledger.listByWallet(wallet.id, { limit: 2 }));
      expect(page1.length).toBe(2);
      expect(page1[0]!.entry.transactionId).toBe(opening.id);

      const cursor = page1[1]!.seq;
      const page2 = await db.uow.transactional((r) => r.ledger.listByWallet(wallet.id, { afterSeq: cursor, limit: 2 }));
      expect(page2.length).toBe(1);
      expect(page2[0]!.entry.transactionId).toBe(win.id);
    });
  });

  describe("Wager Transactions & Terminal States", () => {
    it("trigger impede alteração a partir de estado terminal (PROCESSED)", async () => {
      const { wallet } = await seedWallet(db.uow, "100.00", "BRL");
      const bet = newWager(wallet, "BET", "20.00");
      bet.markProcessed(wallet.balance, new Date());

      await db.uow.transactional(async (r) => {
        await r.wagers.insert(bet);
      });

      // Tenta alterar no banco diretamente
      expect(
        db.sql(`update wager_transactions set status = 'FAILED' where id = ?`, [bet.id]),
      ).rejects.toThrow(/terminal state PROCESSED and cannot be modified/i);
    });

    it("índice único parcial ux_single_reversal impede duas reversões para a mesma transação", async () => {
      const { wallet } = await seedWallet(db.uow, "100.00", "BRL");
      const bet = newWager(wallet, "BET", "20.00", { externalId: "bet-1" });
      bet.markProcessed(wallet.balance, new Date());

      await db.uow.transactional(async (r) => {
        await r.wagers.insert(bet);
      });

      // Reversão 1: REFUND
      const refund = newWager(wallet, "REFUND", "20.00", {
        externalId: "refund-1",
        ref: "bet-1",
        refId: bet.id,
      });
      refund.markProcessed(wallet.balance, new Date(), bet.id);

      await db.uow.transactional(async (r) => {
        await r.wagers.insert(refund);
      });

      // Reversão 2: ROLLBACK da mesma aposta (deve falhar por violação de índice único)
      const rollback = newWager(wallet, "ROLLBACK", "20.00", {
        externalId: "rollback-1",
        ref: "bet-1",
        refId: bet.id,
      });
      rollback.markProcessed(wallet.balance, new Date(), bet.id);

      expect(
        db.uow.transactional(async (r) => {
          await r.wagers.insert(rollback);
        }),
      ).rejects.toThrow(/ux_single_reversal/i);
    });

    it("claimDuePendingReferences seleciona pendências vencidas com SKIP LOCKED", async () => {
      const { wallet } = await seedWallet(db.uow, "100.00", "BRL");
      const now = new Date();

      const p1 = newWager(wallet, "REFUND", "10.00", { ref: "future-1" });
      p1.markPendingReference(new Date(now.getTime() - 5000), now); // Vencida

      const p2 = newWager(wallet, "REFUND", "10.00", { ref: "future-2" });
      p2.markPendingReference(new Date(now.getTime() + 60000), now); // Futura

      await db.uow.transactional(async (r) => {
        await r.wagers.insert(p1);
        await r.wagers.insert(p2);
      });

      const claimed = await db.uow.transactional((r) => r.wagers.claimDuePendingReferences(now, 10));
      expect(claimed.length).toBe(1);
      expect(claimed[0]!.id).toBe(p1.id);
    });
  });

  describe("Messaging: Inbox & Outbox", () => {
    it("inbox tryInsert é idempotente com ON CONFLICT DO NOTHING", async () => {
      const now = new Date();
      const msg1 = InboxMessage.receive({
        consumerName: "consumer-1",
        messageId: "msg-123",
        payloadHash: hash("msg"),
        now,
      });

      const first = await db.uow.transactional((r) => r.inbox.tryInsert(msg1));
      expect(first).toBe(true);

      const duplicate = InboxMessage.receive({
        consumerName: "consumer-1",
        messageId: "msg-123",
        payloadHash: hash("msg"),
        now,
      });

      const second = await db.uow.transactional((r) => r.inbox.tryInsert(duplicate));
      expect(second).toBe(false);
    });

    it("outbox claimBatch aplica lease com SKIP LOCKED", async () => {
      const now = new Date();
      const event = new WalletBalanceChanged(uuid(), now, {
        walletId: uuid(),
        transactionId: uuid(),
        balanceBefore: "100.00",
        balanceAfter: "80.00",
        currency: "BRL",
        version: 2,
      });
      const outbox = OutboxMessage.fromEvent(event);

      await db.uow.transactional(async (r) => {
        await r.outbox.add(outbox);
      });

      // Claim batch com lease de 30s
      const batch1 = await db.uow.transactional((r) => r.outbox.claimBatch(now, 10, 30_000));
      expect(batch1.length).toBe(1);
      expect(batch1[0]!.props.id).toBe(outbox.props.id);
      expect(batch1[0]!.props.lockedUntil).not.toBeNull();

      // Segunda tentativa imediata não deve pegar a mesma mensagem porque está sob lease
      const batch2 = await db.uow.transactional((r) => r.outbox.claimBatch(now, 10, 30_000));
      expect(batch2.length).toBe(0);
    });
  });
});
