import Decimal from "decimal.js";
import { DomainError } from "../errors/domain-error";
import { FailureCode } from "../errors/failure-code";

const MoneyDecimal = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;
const CURRENCY_RE = /^[A-Z]{3}$/;

/** Value Object imutável. Nunca usa `number`: valores entram/saem como string decimal de escala 2. */
export class Money {
  private constructor(
    private readonly value: Decimal,
    public readonly currency: string,
  ) {
    Object.freeze(this);
  }

  static from(amount: string, currency: string): Money {
    if (typeof amount !== "string" || !AMOUNT_RE.test(amount)) {
      throw new DomainError(FailureCode.INVALID_PAYLOAD, `Invalid money amount: ${String(amount)}`);
    }
    if (typeof currency !== "string" || !CURRENCY_RE.test(currency)) {
      throw new DomainError(FailureCode.INVALID_PAYLOAD, `Invalid currency: ${String(currency)}`);
    }
    return new Money(new MoneyDecimal(amount), currency);
  }

  static zero(currency: string): Money {
    return Money.from("0", currency);
  }

  get amount(): string {
    return this.value.toFixed(2);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.value.plus(other.value), this.currency);
  }

  /** Resultado negativo não é representável → erro. */
  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    const result = this.value.minus(other.value);
    if (result.isNegative()) {
      throw new DomainError(FailureCode.INSUFFICIENT_FUNDS, "Money cannot be negative");
    }
    return new Money(result, this.currency);
  }

  isZero(): boolean {
    return this.value.isZero();
  }
  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.value.greaterThan(other.value);
  }
  isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.value.lessThan(other.value);
  }
  equals(other: Money): boolean {
    return this.currency === other.currency && this.value.equals(other.value);
  }

  toJSON(): { amount: string; currency: string } {
    return { amount: this.amount, currency: this.currency };
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new DomainError(FailureCode.CURRENCY_MISMATCH, `${this.currency} vs ${other.currency}`);
    }
  }
}
