import type { FailureCode } from "../errors/failure-code";
import { FailureCode as FC } from "../errors/failure-code";
import type { Wallet } from "../wallet/wallet";
import type { WagerTransaction } from "./wager-transaction";

export type PolicyDecision =
  | { type: "APPLY"; direction: "DEBIT" | "CREDIT" | null; insufficientCode: FailureCode }
  | { type: "REJECT"; code: FailureCode }
  | { type: "PENDING_REFERENCE" };

export interface PolicyContext {
  wallet: Wallet;
  /** Transação referenciada (null = ainda não existe). */
  reference: WagerTransaction | null;
  /** Já existe REFUND/ROLLBACK PROCESSED sobre a referência. */
  referenceAlreadyReversed: boolean;
}

const reject = (code: FailureCode): PolicyDecision => ({ type: "REJECT", code });

export const WageringPolicy = {
  evaluate(tx: WagerTransaction, ctx: PolicyContext): PolicyDecision {
    const t = tx.props;
    const { wallet } = ctx;

    if (wallet.playerId !== t.playerId) return reject(FC.WALLET_PLAYER_MISMATCH);
    if (wallet.currency !== t.money.currency) return reject(FC.CURRENCY_MISMATCH);

    switch (t.kind) {
      case "DEPOSIT":
      case "OPENING":
        return { type: "APPLY", direction: "CREDIT", insufficientCode: FC.INSUFFICIENT_FUNDS };
      case "BET":
        if (wallet.balance.isLessThan(t.money)) return reject(FC.INSUFFICIENT_FUNDS);
        return { type: "APPLY", direction: "DEBIT", insufficientCode: FC.INSUFFICIENT_FUNDS };
      case "LOSS":
        return { type: "APPLY", direction: null, insufficientCode: FC.INSUFFICIENT_FUNDS };
      case "WIN": {
        if (!t.referenceExternalTransactionId) {
          return { type: "APPLY", direction: "CREDIT", insufficientCode: FC.INSUFFICIENT_FUNDS };
        }
        const refCheck = checkReference(tx, ctx, ["BET"]);
        if (refCheck) return refCheck;
        return { type: "APPLY", direction: "CREDIT", insufficientCode: FC.INSUFFICIENT_FUNDS };
      }
      case "REFUND":
      case "ROLLBACK": {
        if (!t.referenceExternalTransactionId) return reject(FC.REFERENCE_REQUIRED);
        const allowed = t.kind === "REFUND" ? ["BET"] : ["BET", "WIN", "REFUND"];
        const refCheck = checkReference(tx, ctx, allowed);
        if (refCheck) return refCheck;
        const ref = ctx.reference!;
        if (!ref.props.money.equals(t.money)) return reject(FC.AMOUNT_MISMATCH);
        if (ctx.referenceAlreadyReversed) return reject(FC.ALREADY_REVERSED);
        // REFUND credita; ROLLBACK é o inverso da referência.
        const direction: "DEBIT" | "CREDIT" =
          t.kind === "REFUND" || ref.kind === "BET" ? "CREDIT" : "DEBIT";
        if (direction === "DEBIT" && wallet.balance.isLessThan(t.money)) {
          return reject(FC.REVERSAL_INSUFFICIENT_FUNDS);
        }
        return { type: "APPLY", direction, insufficientCode: FC.REVERSAL_INSUFFICIENT_FUNDS };
      }
      default:
        return reject(FC.INVALID_PAYLOAD);
    }
  },
};

function checkReference(
  tx: WagerTransaction,
  ctx: PolicyContext,
  allowedKinds: string[],
): PolicyDecision | null {
  const ref = ctx.reference;
  if (!ref) return { type: "PENDING_REFERENCE" };
  const r = ref.props;
  const t = tx.props;
  if (r.status === "PENDING_REFERENCE" || r.status === "PENDING") return { type: "PENDING_REFERENCE" };
  if (r.status !== "PROCESSED") return reject(FC.REFERENCE_NOT_PROCESSED);
  if (
    r.providerId !== t.providerId ||
    r.playerId !== t.playerId ||
    r.walletId !== t.walletId ||
    r.money.currency !== t.money.currency ||
    r.roundId !== t.roundId
  ) {
    return reject(FC.REFERENCE_MISMATCH);
  }
  if (!allowedKinds.includes(r.kind)) return reject(FC.INVALID_REFERENCE_KIND);
  return null;
}
