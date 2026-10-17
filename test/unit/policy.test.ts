import { describe, expect, test } from "bun:test";
import { Money } from "../../src/domain/money/money";
import { Wallet } from "../../src/domain/wallet/wallet";
import { WagerTransaction, type WagerKind } from "../../src/domain/wagering/wager-transaction";
import { WageringPolicy } from "../../src/domain/wagering/wagering-policy";
import { WalletLedgerEntry } from "../../src/domain/ledger/wallet-ledger-entry";

const now = new Date();
const wallet = (bal = "100") =>
  Wallet.rehydrate({ id: "w", playerId: "p", balance: Money.from(bal, "BRL"), version: 1, createdAt: now, updatedAt: now });

function tx(kind: WagerKind, amount = "80", ref: string | null = null, over: Record<string, unknown> = {}) {
  return WagerTransaction.create({
    id: `id-${kind}-${ref}`, providerId: "prov", externalTransactionId: `ext-${kind}-${ref}`,
    idempotencyKey: "k", payloadHash: "h", walletId: "w", playerId: "p", roundId: "r1", gameId: "g",
    kind, money: Money.from(amount, "BRL"), referenceExternalTransactionId: ref, now, ...over,
  });
}
function processed(kind: WagerKind, amount = "80") {
  const t = tx(kind, amount, kind === "REFUND" || kind === "ROLLBACK" ? "x" : null);
  t.markProcessed(Money.from("0", "BRL"), now);
  return t;
}
const ctx = (w: Wallet, reference: WagerTransaction | null = null, rev = false) =>
  ({ wallet: w, reference, referenceAlreadyReversed: rev });

describe("WageringPolicy", () => {
  test("BET aplica débito / rejeita sem saldo", () => {
    expect(WageringPolicy.evaluate(tx("BET"), ctx(wallet())).type).toBe("APPLY");
    expect(WageringPolicy.evaluate(tx("BET"), ctx(wallet("50")))).toEqual({ type: "REJECT", code: "INSUFFICIENT_FUNDS" });
  });
  test("LOSS não move saldo", () => {
    expect(WageringPolicy.evaluate(tx("LOSS"), ctx(wallet()))).toMatchObject({ type: "APPLY", direction: null });
  });
  test("WIN credita; com referência inexistente fica pendente", () => {
    expect(WageringPolicy.evaluate(tx("WIN"), ctx(wallet()))).toMatchObject({ direction: "CREDIT" });
    expect(WageringPolicy.evaluate(tx("WIN", "10", "b"), ctx(wallet())).type).toBe("PENDING_REFERENCE");
  });
  test("REFUND sem referência / ausente / ok", () => {
    expect(() => tx("REFUND")).toThrow();
    expect(WageringPolicy.evaluate(tx("REFUND", "80", "b"), ctx(wallet())).type).toBe("PENDING_REFERENCE");
    expect(WageringPolicy.evaluate(tx("REFUND", "80", "b"), ctx(wallet(), processed("BET")))).toMatchObject({ direction: "CREDIT" });
  });
  test("REFUND valor divergente / kind inválido / reversão dupla / mismatch", () => {
    const r = (kind: WagerKind) => WageringPolicy.evaluate(tx(kind, "70", "b"), ctx(wallet(), processed("BET")));
    expect(r("REFUND")).toEqual({ type: "REJECT", code: "AMOUNT_MISMATCH" });
    expect(WageringPolicy.evaluate(tx("REFUND", "80", "b"), ctx(wallet(), processed("WIN")))).toEqual({ type: "REJECT", code: "INVALID_REFERENCE_KIND" });
    expect(WageringPolicy.evaluate(tx("ROLLBACK", "80", "b"), ctx(wallet(), processed("BET"), true))).toEqual({ type: "REJECT", code: "ALREADY_REVERSED" });
    const other = processed("BET");
    expect(WageringPolicy.evaluate(tx("REFUND", "80", "b", { roundId: "r2" }), ctx(wallet(), other))).toEqual({ type: "REJECT", code: "REFERENCE_MISMATCH" });
  });
  test("referência rejeitada → REFERENCE_NOT_PROCESSED", () => {
    const ref = tx("BET");
    ref.reject("INSUFFICIENT_FUNDS", Money.from("0", "BRL"), now);
    expect(WageringPolicy.evaluate(tx("REFUND", "80", "b"), ctx(wallet(), ref))).toEqual({ type: "REJECT", code: "REFERENCE_NOT_PROCESSED" });
  });
  test("ROLLBACK de WIN debita; sem saldo → REVERSAL_INSUFFICIENT_FUNDS", () => {
    expect(WageringPolicy.evaluate(tx("ROLLBACK", "80", "b"), ctx(wallet(), processed("WIN")))).toMatchObject({ direction: "DEBIT" });
    expect(WageringPolicy.evaluate(tx("ROLLBACK", "80", "b"), ctx(wallet("10"), processed("WIN")))).toEqual({ type: "REJECT", code: "REVERSAL_INSUFFICIENT_FUNDS" });
  });
  test("ROLLBACK de BET credita; de REFUND debita; de LOSS inválido", () => {
    expect(WageringPolicy.evaluate(tx("ROLLBACK", "80", "b"), ctx(wallet(), processed("BET")))).toMatchObject({ direction: "CREDIT" });
    expect(WageringPolicy.evaluate(tx("ROLLBACK", "80", "b"), ctx(wallet(), processed("REFUND")))).toMatchObject({ direction: "DEBIT" });
    expect(WageringPolicy.evaluate(tx("ROLLBACK", "80", "b"), ctx(wallet(), processed("LOSS")))).toEqual({ type: "REJECT", code: "INVALID_REFERENCE_KIND" });
  });
  test("player/moeda divergentes", () => {
    expect(WageringPolicy.evaluate(tx("BET", "1", null, { playerId: "other" }), ctx(wallet()))).toEqual({ type: "REJECT", code: "WALLET_PLAYER_MISMATCH" });
    expect(WageringPolicy.evaluate(tx("BET", "1", null, { money: Money.from("1", "USD") }), ctx(wallet()))).toEqual({ type: "REJECT", code: "CURRENCY_MISMATCH" });
  });
});

describe("WagerTransaction state machine", () => {
  test("terminal não transiciona", () => {
    const t = tx("BET");
    t.markProcessed(Money.from("1", "BRL"), now);
    expect(() => t.reject("INSUFFICIENT_FUNDS", Money.from("1", "BRL"), now)).toThrow();
  });
  test("pending reference incrementa attempts a partir da 2ª vez", () => {
    const t = tx("REFUND", "1", "b");
    t.markPendingReference(now, now);
    expect(t.props.attempts).toBe(0);
    t.markPendingReference(now, now);
    expect(t.props.attempts).toBe(1);
    t.markProcessed(Money.from("1", "BRL"), now);
    expect(t.isTerminal).toBe(true);
  });
});

describe("WalletLedgerEntry", () => {
  test("rejeita aritmética inconsistente", () => {
    expect(() => WalletLedgerEntry.create({
      id: "l", walletId: "w", transactionId: "t", direction: "CREDIT", amount: Money.from("10", "BRL"),
      balanceBefore: Money.from("5", "BRL"), balanceAfter: Money.from("20", "BRL"), createdAt: now,
    })).toThrow();
  });
});
