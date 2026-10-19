import { DomainError } from "../../domain/errors/domain-error";
import { FailureCode } from "../../domain/errors/failure-code";
import type { WalletResponseDto } from "../dto/wallet.dto";
import type { UnitOfWork } from "../ports/unit-of-work.port";

export class GetWalletUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(walletId: string): Promise<WalletResponseDto> {
    return this.uow.transactional(async (repos) => {
      const wallet = await repos.wallets.findById(walletId);
      if (!wallet) {
        throw new DomainError(FailureCode.WALLET_NOT_FOUND, "Wallet not found");
      }
      return {
        id: wallet.id,
        playerId: wallet.playerId,
        currency: wallet.currency,
        balance: wallet.balance.amount,
        balanceAmount: wallet.balance.amount,
        money: { amount: wallet.balance.amount, currency: wallet.currency },
        version: wallet.version,
        createdAt: wallet.createdAt.toISOString(),
        updatedAt: wallet.updatedAt.toISOString(),
      };
    });
  }
}
