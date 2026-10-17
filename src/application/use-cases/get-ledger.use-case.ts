import { DomainError } from "../../domain/errors/domain-error";
import { FailureCode } from "../../domain/errors/failure-code";
import type { LedgerEntryItemDto, LedgerPageDto } from "../dto/ledger.dto";
import type { UnitOfWork } from "../ports/unit-of-work.port";

export interface GetLedgerInput {
  walletId: string;
  limit?: number;
  cursor?: string;
}

export class GetLedgerUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: GetLedgerInput): Promise<LedgerPageDto> {
    return this.uow.transactional(async (repos) => {
      const wallet = await repos.wallets.findById(input.walletId);
      if (!wallet) {
        throw new DomainError(FailureCode.WALLET_NOT_FOUND, "Wallet not found");
      }

      let afterSeq: string | undefined;
      if (input.cursor) {
        try {
          const decoded = Buffer.from(input.cursor, "base64").toString("utf-8");
          if (!decoded || !/^\d+$/.test(decoded)) {
            throw new Error("Invalid cursor format");
          }
          afterSeq = decoded;
        } catch {
          throw new DomainError(FailureCode.INVALID_PAYLOAD, "Invalid cursor");
        }
      }

      const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
      const rows = await repos.ledger.listByWallet(input.walletId, { afterSeq, limit });

      const items: LedgerEntryItemDto[] = rows.map((r) => {
        const e = r.entry;
        return {
          id: e.id,
          transactionId: e.transactionId,
          direction: e.direction,
          amount: e.amount.amount,
          currency: e.amount.currency,
          balanceBefore: e.balanceBefore.amount,
          balanceAfter: e.balanceAfter.amount,
          createdAt: e.createdAt.toISOString(),
        };
      });

      let nextCursor: string | null = null;
      if (rows.length === limit) {
        const lastRow = rows[rows.length - 1];
        if (lastRow) {
          nextCursor = Buffer.from(lastRow.seq, "utf-8").toString("base64");
        }
      }

      return {
        items,
        nextCursor,
      };
    });
  }
}
