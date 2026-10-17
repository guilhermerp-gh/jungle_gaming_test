import { DomainError } from "../../domain/errors/domain-error";
import { FailureCode } from "../../domain/errors/failure-code";
import type { WagerTransaction } from "../../domain/wagering/wager-transaction";
import type { TransactionResponseDto } from "../dto/transaction.dto";
import type { UnitOfWork } from "../ports/unit-of-work.port";

export type GetTransactionInput =
  | { id: string }
  | { providerId: string; externalTransactionId: string };

function toDto(tx: WagerTransaction): TransactionResponseDto {
  const p = tx.props;
  return {
    id: p.id,
    providerId: p.providerId,
    externalTransactionId: p.externalTransactionId,
    walletId: p.walletId,
    playerId: p.playerId,
    roundId: p.roundId,
    gameId: p.gameId,
    kind: p.kind,
    amount: p.money.amount,
    currency: p.money.currency,
    status: p.status,
    failureCode: p.failureCode,
    resultBalance: p.resultBalance ? p.resultBalance.amount : null,
    referenceExternalTransactionId: p.referenceExternalTransactionId,
    referenceTransactionId: p.referenceTransactionId,
    createdAt: p.createdAt.toISOString(),
    processedAt: p.processedAt ? p.processedAt.toISOString() : null,
  };
}

export class GetTransactionUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: GetTransactionInput): Promise<TransactionResponseDto> {
    return this.uow.transactional(async (repos) => {
      let tx: WagerTransaction | null = null;
      if ("id" in input) {
        tx = await repos.wagers.findById(input.id);
      } else {
        tx = await repos.wagers.findByExternalId(input.providerId, input.externalTransactionId);
      }

      if (!tx) {
        throw new DomainError(FailureCode.TRANSACTION_NOT_FOUND, "Transaction not found");
      }

      return toDto(tx);
    });
  }
}
