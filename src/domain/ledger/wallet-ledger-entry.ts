import { InvariantViolation } from "../errors/domain-error";
import { Money } from "../money/money";

export type LedgerDirection = "CREDIT" | "DEBIT";

export interface LedgerEntryProps {
  id: string;
  walletId: string;
  transactionId: string;
  direction: LedgerDirection;
  amount: Money;
  balanceBefore: Money;
  balanceAfter: Money;
  createdAt: Date;
}

/** Lançamento imutável; a aritmética é validada na criação e na reidratação. */
export class WalletLedgerEntry {
  private constructor(public readonly props: Readonly<LedgerEntryProps>) {}

  static create(props: LedgerEntryProps): WalletLedgerEntry {
    const { direction, amount, balanceBefore, balanceAfter } = props;
    if (amount.isZero()) throw new InvariantViolation("Ledger amount must be > 0");
    const expected =
      direction === "CREDIT" ? balanceBefore.add(amount) : balanceBefore.subtract(amount);
    if (!expected.equals(balanceAfter)) {
      throw new InvariantViolation("Ledger arithmetic inconsistent");
    }
    return new WalletLedgerEntry(Object.freeze({ ...props }));
  }

  static rehydrate(props: LedgerEntryProps): WalletLedgerEntry {
    return WalletLedgerEntry.create(props);
  }

  get id(): string {
    return this.props.id;
  }
}
