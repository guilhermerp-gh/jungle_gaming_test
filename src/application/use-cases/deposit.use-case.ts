import { randomUUID } from "node:crypto";
import { WalletBalanceChanged } from "../../domain/events/events";
import { DomainError } from "../../domain/errors/domain-error";
import { FailureCode } from "../../domain/errors/failure-code";
import { OutboxMessage } from "../../domain/messaging/outbox-message";
import { Money } from "../../domain/money/money";
import { computePayloadHash } from "../../domain/wagering/payload-hash";
import { WagerTransaction } from "../../domain/wagering/wager-transaction";
import type { DepositDto, DepositResponseDto } from "../dto/wallet.dto";
import type { UnitOfWork } from "../ports/unit-of-work.port";

export class DepositUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(
    walletId: string,
    idempotencyKey: string,
    dto: DepositDto,
  ): Promise<DepositResponseDto> {
    const now = new Date();

    return this.uow.transactional(async (repos) => {
      const wallet = await repos.wallets.findByIdForUpdate(walletId);
      if (!wallet) {
        throw new DomainError(FailureCode.WALLET_NOT_FOUND, "Wallet not found");
      }

      const money = Money.from(dto.amount, wallet.currency);
      const providerId = dto.providerId ?? "CASHIER";
      const externalTransactionId = dto.externalTransactionId ?? `dep-${idempotencyKey}`;

      const payloadHash = computePayloadHash({
        providerId,
        externalTransactionId,
        playerId: wallet.playerId,
        walletId: wallet.id,
        roundId: "DEPOSIT",
        gameId: "CASHIER",
        kind: "DEPOSIT",
        money: { amount: money.amount, currency: money.currency },
        referenceExternalTransactionId: null,
      });

      // 1. Checagem de Idempotência
      const existingByIdempotency = await repos.wagers.findByIdempotencyKey(idempotencyKey);
      if (existingByIdempotency) {
        if (existingByIdempotency.props.payloadHash === payloadHash) {
          const resBal = existingByIdempotency.props.resultBalance?.amount ?? wallet.balance.amount;
          return {
            idempotentReplay: true,
            transactionId: existingByIdempotency.id,
            walletId: wallet.id,
            playerId: wallet.playerId,
            currency: wallet.currency,
            amount: existingByIdempotency.props.money.amount,
            balanceBefore: wallet.balance.amount,
            balanceAfter: resBal,
            status: existingByIdempotency.status,
            createdAt: existingByIdempotency.props.createdAt.toISOString(),
            message: "Replay de Idempotência: este depósito já foi creditado anteriormente. O saldo não foi creditado novamente.",
          };
        }
        throw new DomainError(
          FailureCode.IDEMPOTENCY_CONFLICT,
          "Idempotency key reused with different payload",
        );
      }

      // 2. Checagem de externalTransactionId
      const existingByExternal = await repos.wagers.findByExternalId(
        providerId,
        externalTransactionId,
      );
      if (existingByExternal) {
        throw new DomainError(
          FailureCode.IDEMPOTENCY_CONFLICT,
          "External transaction already exists under another idempotency key",
        );
      }

      // 3. Criação da transação financeira DEPOSIT
      const tx = WagerTransaction.create({
        id: randomUUID(),
        providerId,
        externalTransactionId,
        idempotencyKey,
        payloadHash,
        walletId: wallet.id,
        playerId: wallet.playerId,
        roundId: "DEPOSIT",
        gameId: "CASHIER",
        kind: "DEPOSIT",
        money,
        referenceExternalTransactionId: null,
        now,
      });

      // 4. Crédito contábil na carteira
      const ledgerEntry = wallet.credit({
        ledgerId: randomUUID(),
        transactionId: tx.id,
        amount: money,
        now,
      });

      tx.markProcessed(wallet.balance, now);

      await repos.wagers.insert(tx);
      await repos.ledger.append(ledgerEntry);
      await repos.wallets.saveBalance(wallet);

      // 5. Emissão do evento Outbox
      const event = new WalletBalanceChanged(randomUUID(), now, {
        walletId: wallet.id,
        transactionId: tx.id,
        balanceBefore: ledgerEntry.balanceBefore.amount,
        balanceAfter: ledgerEntry.balanceAfter.amount,
        currency: wallet.currency,
        version: wallet.version,
      });
      await repos.outbox.add(OutboxMessage.fromEvent(event));

      return {
        idempotentReplay: false,
        transactionId: tx.id,
        walletId: wallet.id,
        playerId: wallet.playerId,
        currency: wallet.currency,
        amount: money.amount,
        balanceBefore: ledgerEntry.balanceBefore.amount,
        balanceAfter: ledgerEntry.balanceAfter.amount,
        status: "PROCESSED",
        createdAt: tx.props.createdAt.toISOString(),
      };
    });
  }
}
