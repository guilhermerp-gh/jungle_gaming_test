import { DomainError, InvariantViolation } from "../errors/domain-error";
import { FailureCode } from "../errors/failure-code";
import { WalletLedgerEntry } from "../ledger/wallet-ledger-entry";
import { Money } from "../money/money";

export interface WalletProps {
  id: string;
  playerId: string;
  balance: Money;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Wallet {
  private _balance: Money;
  private _version: number;
  private _updatedAt: Date;
  /** Versão lida do banco; usada na checagem `WHERE version = ?` do UPDATE. */
  public readonly loadedVersion: number;

  private constructor(private readonly props: WalletProps) {
    this._balance = props.balance;
    this._version = props.version;
    this._updatedAt = props.updatedAt;
    this.loadedVersion = props.version;
  }

  static open(args: { id: string; playerId: string; currency: string; now: Date }): Wallet {
    return new Wallet({
      id: args.id,
      playerId: args.playerId,
      balance: Money.zero(args.currency),
      version: 1,
      createdAt: args.now,
      updatedAt: args.now,
    });
  }

  static rehydrate(props: WalletProps): Wallet {
    if (props.version < 1) throw new InvariantViolation("Wallet version must be >= 1");
    return new Wallet(props);
  }

  get id(): string { return this.props.id; }
  get playerId(): string { return this.props.playerId; }
  get currency(): string { return this._balance.currency; }
  get balance(): Money { return this._balance; }
  get version(): number { return this._version; }
  get updatedAt(): Date { return this._updatedAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get balanceChanged(): boolean { return this._version !== this.loadedVersion; }

  credit(args: { ledgerId: string; transactionId: string; amount: Money; now: Date }): WalletLedgerEntry {
    return this.apply("CREDIT", args);
  }

  debit(args: {
    ledgerId: string;
    transactionId: string;
    amount: Money;
    now: Date;
    insufficientCode?: FailureCode;
  }): WalletLedgerEntry {
    if (this.currency !== args.amount.currency) {
      throw new DomainError(FailureCode.CURRENCY_MISMATCH, "Currency mismatch");
    }
    if (this._balance.isLessThan(args.amount)) {
      throw new DomainError(args.insufficientCode ?? FailureCode.INSUFFICIENT_FUNDS, "Insufficient funds");
    }
    return this.apply("DEBIT", args);
  }

  private apply(
    direction: "CREDIT" | "DEBIT",
    args: { ledgerId: string; transactionId: string; amount: Money; now: Date },
  ): WalletLedgerEntry {
    if (this.currency !== args.amount.currency) {
      throw new DomainError(FailureCode.CURRENCY_MISMATCH, "Currency mismatch");
    }
    const before = this._balance;
    const after = direction === "CREDIT" ? before.add(args.amount) : before.subtract(args.amount);
    const entry = WalletLedgerEntry.create({
      id: args.ledgerId,
      walletId: this.id,
      transactionId: args.transactionId,
      direction,
      amount: args.amount,
      balanceBefore: before,
      balanceAfter: after,
      createdAt: args.now,
    });
    this._balance = after;
    this._version += 1;
    this._updatedAt = args.now;
    return entry;
  }
}
