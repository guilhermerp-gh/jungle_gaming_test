import type { FailureCode } from "./failure-code";

export class DomainError extends Error {
  constructor(
    public readonly code: FailureCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

/** Violação de invariante interna (bug de programação / transição inválida). */
export class InvariantViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvariantViolation";
  }
}
