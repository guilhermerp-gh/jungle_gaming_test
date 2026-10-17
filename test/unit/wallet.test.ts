import { describe, expect, test } from "bun:test";
import { Money } from "../../src/domain/money/money";
import { Wallet } from "../../src/domain/wallet/wallet";

const now = new Date();
const mk = (bal: string) =>
  Wallet.rehydrate({ id: "w", playerId: "p", balance: Money.from(bal, "BRL"), version: 1, createdAt: now, updatedAt: now });

describe("Wallet", () => {
  test("open: saldo zero, version 1", () => {
    const w = Wallet.open({ id: "w", playerId: "p", currency: "BRL", now });
    expect(w.balance.amount).toBe("0.00");
    expect(w.version).toBe(1);
    expect(w.balanceChanged).toBe(false);
  });
  test("debit/credit geram ledger e incrementam version", () => {
    const w = mk("100");
    const e = w.debit({ ledgerId: "l", transactionId: "t", amount: Money.from("30", "BRL"), now });
    expect(e.props.balanceAfter.amount).toBe("70.00");
    expect(w.version).toBe(2);
    w.credit({ ledgerId: "l2", transactionId: "t2", amount: Money.from("5", "BRL"), now });
    expect(w.balance.amount).toBe("75.00");
    expect(w.version).toBe(3);
  });
  test("saldo nunca negativo", () => {
    const w = mk("10");
    expect(() => w.debit({ ledgerId: "l", transactionId: "t", amount: Money.from("10.01", "BRL"), now })).toThrow();
    expect(w.balance.amount).toBe("10.00");
    expect(w.version).toBe(1);
  });
  test("moeda divergente", () => {
    expect(() => mk("10").credit({ ledgerId: "l", transactionId: "t", amount: Money.from("1", "USD"), now })).toThrow();
  });
});
