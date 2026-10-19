import Decimal from "decimal.js";
import { DomainError } from "../../domain/errors/domain-error";
import { FailureCode } from "../../domain/errors/failure-code";
import { Money } from "../../domain/money/money";
import { appStructuredLogger } from "../../infrastructure/observability/app-logger";
import {
  defaultWageringMetrics,
  type WageringMetrics,
} from "../../infrastructure/observability/wagering-metrics";
import type { ReconciliationResponseDto } from "../dto/reconciliation.dto";
import type { UnitOfWork } from "../ports/unit-of-work.port";

export class ReconcileWalletUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly wageringMetrics: WageringMetrics = defaultWageringMetrics,
  ) {}

  async execute(walletId: string): Promise<ReconciliationResponseDto> {
    return this.uow.transactional(async (repos) => {
      const wallet = await repos.wallets.findById(walletId);
      if (!wallet) {
        throw new DomainError(FailureCode.WALLET_NOT_FOUND, "Wallet not found");
      }

      const totals = await repos.ledger.totals(walletId);

      const creditsMoney = Money.from(totals.credits, wallet.currency);
      const debitsMoney = Money.from(totals.debits, wallet.currency);
      const calculatedBalanceMoney = creditsMoney.subtract(debitsMoney);
      const storedBalanceMoney = wallet.balance;

      const consistent = storedBalanceMoney.equals(calculatedBalanceMoney);

      const diffVal = new Decimal(storedBalanceMoney.amount)
        .minus(new Decimal(calculatedBalanceMoney.amount))
        .abs();
      const difference = diffVal.toFixed(2);

      if (!consistent) {
        this.wageringMetrics.recordReconciliationMismatch();
        appStructuredLogger.error({
          msg: "Accounting inconsistency detected in wallet reconciliation",
          walletId,
          storedBalance: storedBalanceMoney.amount,
          calculatedBalance: calculatedBalanceMoney.amount,
          difference,
          entriesCount: totals.entries,
        });
      }

      return {
        walletId: wallet.id,
        storedBalance: storedBalanceMoney.amount,
        calculatedBalance: calculatedBalanceMoney.amount,
        difference,
        consistent,
        checkedEntries: totals.entries,
      };
    });
  }
}
