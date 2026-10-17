import { randomUUID } from "node:crypto";
import { WalletBalanceChanged } from "../../domain/events/events";
import { DomainError } from "../../domain/errors/domain-error";
import { FailureCode } from "../../domain/errors/failure-code";
import { OutboxMessage } from "../../domain/messaging/outbox-message";
import { Money } from "../../domain/money/money";
import { computePayloadHash } from "../../domain/wagering/payload-hash";
import { WagerTransaction } from "../../domain/wagering/wager-transaction";
import { Wallet } from "../../domain/wallet/wallet";
import type { CreateWalletDto, WalletResponseDto } from "../dto/wallet.dto";
import type { UnitOfWork } from "../ports/unit-of-work.port";

export class CreateWalletUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(dto: CreateWalletDto): Promise<WalletResponseDto> {
    const now = new Date();
    const walletId = randomUUID();
    const wallet = Wallet.open({
      id: walletId,
      playerId: dto.playerId,
      currency: dto.currency,
      now,
    });

    try {
      return await this.uow.transactional(async (repos) => {
        await repos.wallets.insert(wallet);

        const initialAmount = dto.initialBalance ?? "0.00";
        const initialMoney = Money.from(initialAmount, dto.currency);

        if (initialMoney.isGreaterThan(Money.zero(dto.currency))) {
          const txId = randomUUID();
          const idempotencyKey = `opening-${wallet.id}`;
          const payloadHash = computePayloadHash({
            providerId: "SYSTEM",
            externalTransactionId: txId,
            playerId: wallet.playerId,
            walletId: wallet.id,
            roundId: "OPENING",
            gameId: "SYSTEM",
            kind: "OPENING",
            money: { amount: initialMoney.amount, currency: initialMoney.currency },
            referenceExternalTransactionId: null,
          });

          const tx = WagerTransaction.create({
            id: txId,
            providerId: "SYSTEM",
            externalTransactionId: txId,
            idempotencyKey,
            payloadHash,
            walletId: wallet.id,
            playerId: wallet.playerId,
            roundId: "OPENING",
            gameId: "SYSTEM",
            kind: "OPENING",
            money: initialMoney,
            referenceExternalTransactionId: null,
            now,
          });

          const ledgerEntry = wallet.credit({
            ledgerId: randomUUID(),
            transactionId: tx.id,
            amount: initialMoney,
            now,
          });

          tx.markProcessed(wallet.balance, now);

          await repos.wagers.insert(tx);
          await repos.ledger.append(ledgerEntry);
          await repos.wallets.saveBalance(wallet);

          const event = new WalletBalanceChanged(randomUUID(), now, {
            walletId: wallet.id,
            transactionId: tx.id,
            balanceBefore: ledgerEntry.balanceBefore.amount,
            balanceAfter: ledgerEntry.balanceAfter.amount,
            currency: wallet.currency,
            version: wallet.version,
          });
          await repos.outbox.add(OutboxMessage.fromEvent(event));
        }

        return {
          id: wallet.id,
          playerId: wallet.playerId,
          currency: wallet.currency,
          balance: wallet.balance.amount,
          version: wallet.version,
          createdAt: wallet.createdAt.toISOString(),
          updatedAt: wallet.updatedAt.toISOString(),
        };
      });
    } catch (err: unknown) {
      const errorMsg = String((err as Error)?.message ?? "");
      const errorCode = String((err as Record<string, unknown>)?.code ?? "");
      if (
        errorCode === "23505" ||
        errorMsg.includes("ux_wallets_player_currency") ||
        errorMsg.includes("unique constraint")
      ) {
        throw new DomainError(
          FailureCode.WALLET_ALREADY_EXISTS,
          "Wallet already exists for this player and currency",
        );
      }
      throw err;
    }
  }
}
