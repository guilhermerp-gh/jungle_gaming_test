import { randomUUID } from "node:crypto";
import {
  WagerTransactionPendingReference,
  WagerTransactionProcessed,
  WagerTransactionRejected,
  WalletBalanceChanged,
} from "../../domain/events/events";
import { DomainError } from "../../domain/errors/domain-error";
import { FailureCode } from "../../domain/errors/failure-code";
import { InboxMessage } from "../../domain/messaging/inbox-message";
import { OutboxMessage } from "../../domain/messaging/outbox-message";
import { Money } from "../../domain/money/money";
import { computePayloadHash } from "../../domain/wagering/payload-hash";
import { WagerTransaction } from "../../domain/wagering/wager-transaction";
import { WageringPolicy } from "../../domain/wagering/wagering-policy";
import type { ProcessTransactionDto, TransactionResponseDto } from "../dto/transaction.dto";
import type { UnitOfWork } from "../ports/unit-of-work.port";
import { ResolvePendingReferencesUseCase } from "./resolve-pending-references.use-case";

export interface MessageProcessingContext {
  consumerName: string;
  messageId: string;
}

export interface ProcessTransactionResult {
  statusCode: 200 | 201 | 202;
  idempotentReplay: boolean;
  message?: string;
  transaction: TransactionResponseDto;
}

function toDto(tx: WagerTransaction, idempotentReplay = false): TransactionResponseDto {
  const p = tx.props;
  let message: string | undefined;
  if (idempotentReplay) {
    if (p.kind === "REFUND") {
      message = "Replay de Idempotência: este estorno já foi realizado anteriormente. O saldo não foi creditado novamente.";
    } else if (p.kind === "BET") {
      message = "Replay de Idempotência: esta aposta já foi processada anteriormente. O saldo não foi debitado novamente.";
    } else {
      message = "Replay de Idempotência: transação já processada anteriormente. O saldo permaneceu inalterado.";
    }
  }

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
    idempotentReplay,
    ...(message ? { message } : {}),
  };
}

export class ProcessWagerTransactionUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(
    idempotencyKey: string,
    dto: ProcessTransactionDto,
    context?: MessageProcessingContext,
  ): Promise<ProcessTransactionResult> {
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new DomainError(FailureCode.INVALID_PAYLOAD, "Missing Idempotency-Key header");
    }

    if ((dto.kind as string) === "OPENING") {
      throw new DomainError(FailureCode.INVALID_PAYLOAD, "Kind OPENING cannot be submitted directly");
    }

    const payloadHash = computePayloadHash({
      providerId: dto.providerId,
      externalTransactionId: dto.externalTransactionId,
      playerId: dto.playerId,
      walletId: dto.walletId,
      roundId: dto.roundId,
      gameId: dto.gameId,
      kind: dto.kind,
      money: { amount: dto.amount, currency: dto.currency },
      referenceExternalTransactionId: dto.referenceExternalTransactionId ?? null,
    });

    let executionResult;
    try {
      executionResult = await this.uow.transactional(async (repos) => {
        let inboxMessage: InboxMessage | null = null;
        if (context) {
          inboxMessage = await repos.inbox.find(context.consumerName, context.messageId);
          if (inboxMessage && inboxMessage.isProcessed) {
            const existingTx =
              (await repos.wagers.findByIdempotencyKey(idempotencyKey)) ??
              (await repos.wagers.findByExternalId(dto.providerId, dto.externalTransactionId));
            if (existingTx) {
              return {
                type: "REPLAY" as const,
                tx: existingTx,
              };
            }
          }

          if (!inboxMessage) {
            inboxMessage = InboxMessage.receive({
              consumerName: context.consumerName,
              messageId: context.messageId,
              payloadHash,
              now: new Date(),
            });
            await repos.inbox.tryInsert(inboxMessage);
          }
        }

        const markInboxIfPresent = async (date: Date) => {
          if (context && inboxMessage && !inboxMessage.isProcessed) {
            inboxMessage.markProcessed(date);
            await repos.inbox.markProcessed(inboxMessage);
          }
        };

        // 1. Lock pessimista por linha na carteira
        const wallet = await repos.wallets.findByIdForUpdate(dto.walletId);
        if (!wallet) {
          throw new DomainError(FailureCode.WALLET_NOT_FOUND, "Wallet not found");
        }

        if (wallet.playerId !== dto.playerId) {
          throw new DomainError(FailureCode.WALLET_PLAYER_MISMATCH, "Wallet player mismatch");
        }

        if (wallet.currency !== dto.currency) {
          throw new DomainError(FailureCode.CURRENCY_MISMATCH, "Currency mismatch");
        }

        // 2. Checagem de Idempotência
        const existingByIdempotency = await repos.wagers.findByIdempotencyKey(idempotencyKey);
        if (existingByIdempotency) {
          if (existingByIdempotency.props.payloadHash === payloadHash) {
            await markInboxIfPresent(new Date());
            return {
              type: "REPLAY" as const,
              tx: existingByIdempotency,
            };
          }
          throw new DomainError(
            FailureCode.IDEMPOTENCY_CONFLICT,
            "Idempotency key reused with different payload",
          );
        }

        // 3. Checagem de (providerId, externalTransactionId)
        const existingByExternal = await repos.wagers.findByExternalId(
          dto.providerId,
          dto.externalTransactionId,
        );
        if (existingByExternal) {
          throw new DomainError(
            FailureCode.IDEMPOTENCY_CONFLICT,
            "External transaction already exists under another idempotency key",
          );
        }

        // 4. Instancia WagerTransaction
        const now = new Date();
        const txId = randomUUID();
        const money = Money.from(dto.amount, dto.currency);

        const tx = WagerTransaction.create({
          id: txId,
          providerId: dto.providerId,
          externalTransactionId: dto.externalTransactionId,
          idempotencyKey,
          payloadHash,
          walletId: dto.walletId,
          playerId: dto.playerId,
          roundId: dto.roundId,
          gameId: dto.gameId,
          kind: dto.kind,
          money,
          referenceExternalTransactionId: dto.referenceExternalTransactionId ?? null,
          now,
        });

        // 5. Contexto e Avaliação de Política
        let ref: WagerTransaction | null = null;
        let existingReversal: WagerTransaction | null = null;

        if (dto.referenceExternalTransactionId) {
          ref = await repos.wagers.findByExternalId(dto.providerId, dto.referenceExternalTransactionId);
          if (ref) {
            existingReversal = await repos.wagers.findProcessedReversal(ref.id);
          }
        }

        const decision = WageringPolicy.evaluate(tx, {
          wallet,
          reference: ref,
          referenceAlreadyReversed: existingReversal !== null,
        });

        if (decision.type === "APPLY") {
          if (decision.direction === "DEBIT") {
            const ledgerEntry = wallet.debit({
              ledgerId: randomUUID(),
              transactionId: tx.id,
              amount: money,
              now,
              insufficientCode: decision.insufficientCode,
            });
            tx.markProcessed(wallet.balance, now, ref?.id ?? null);
            await repos.wagers.insert(tx);
            await repos.ledger.append(ledgerEntry);
            await repos.wallets.saveBalance(wallet);
            await repos.outbox.add(
              OutboxMessage.fromEvent(
                new WalletBalanceChanged(randomUUID(), now, {
                  walletId: wallet.id,
                  transactionId: tx.id,
                  balanceBefore: ledgerEntry.balanceBefore.amount,
                  balanceAfter: ledgerEntry.balanceAfter.amount,
                  currency: wallet.currency,
                  version: wallet.version,
                }),
              ),
            );
          } else if (decision.direction === "CREDIT") {
            const ledgerEntry = wallet.credit({
              ledgerId: randomUUID(),
              transactionId: tx.id,
              amount: money,
              now,
            });
            tx.markProcessed(wallet.balance, now, ref?.id ?? null);
            await repos.wagers.insert(tx);
            await repos.ledger.append(ledgerEntry);
            await repos.wallets.saveBalance(wallet);
            await repos.outbox.add(
              OutboxMessage.fromEvent(
                new WalletBalanceChanged(randomUUID(), now, {
                  walletId: wallet.id,
                  transactionId: tx.id,
                  balanceBefore: ledgerEntry.balanceBefore.amount,
                  balanceAfter: ledgerEntry.balanceAfter.amount,
                  currency: wallet.currency,
                  version: wallet.version,
                }),
              ),
            );
          } else {
            tx.markProcessed(wallet.balance, now, ref?.id ?? null);
            await repos.wagers.insert(tx);
          }

          const processedEvent = new WagerTransactionProcessed(randomUUID(), now, {
            transactionId: tx.id,
            walletId: wallet.id,
            kind: tx.kind,
            amount: tx.props.money.amount,
            currency: tx.props.money.currency,
            resultBalance: tx.props.resultBalance ? tx.props.resultBalance.amount : null,
          });
          await repos.outbox.add(OutboxMessage.fromEvent(processedEvent));
          await markInboxIfPresent(now);

          return {
            type: "PROCESSED" as const,
            tx,
          };
        }

        if (decision.type === "PENDING_REFERENCE") {
          const nextAttemptAt = new Date(now.getTime() + 5000);
          tx.markPendingReference(nextAttemptAt, now);
          await repos.wagers.insert(tx);

          const pendingEvent = new WagerTransactionPendingReference(randomUUID(), now, {
            transactionId: tx.id,
            walletId: wallet.id,
            kind: tx.kind,
            referenceExternalTransactionId: tx.props.referenceExternalTransactionId,
          });
          await repos.outbox.add(OutboxMessage.fromEvent(pendingEvent));
          await markInboxIfPresent(now);

          return {
            type: "PENDING_REFERENCE" as const,
            tx,
          };
        }

        // Caso REJECT
        tx.reject(decision.code, wallet.balance, now);
        await repos.wagers.insert(tx);

        const rejectedEvent = new WagerTransactionRejected(randomUUID(), now, {
          transactionId: tx.id,
          walletId: wallet.id,
          kind: tx.kind,
          failureCode: decision.code,
        });
        await repos.outbox.add(OutboxMessage.fromEvent(rejectedEvent));
        await markInboxIfPresent(now);

        let details: Record<string, unknown> | undefined;
        if (decision.code === FailureCode.ALREADY_REVERSED && existingReversal) {
          details = {
            referenceExternalTransactionId: dto.referenceExternalTransactionId,
            alreadyReversedByTransactionId: existingReversal.id,
            alreadyReversedByExternalId: existingReversal.props.externalTransactionId,
            reversedAt: existingReversal.props.processedAt?.toISOString() ?? null,
            amount: existingReversal.props.money.amount,
            currency: existingReversal.props.money.currency,
          };
        }

        return {
          type: "REJECTED" as const,
          code: decision.code,
          tx,
          details,
        };
      });
    } catch (err: unknown) {
      if (err instanceof DomainError) {
        throw err;
      }

      // Trata corrida de constraint única (idempotency_key ou provider_id + external_transaction_id)
      const isUniqueViolation =
        (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23505") ||
        (err instanceof Error && /unique constraint|duplicate key/i.test(err.message));

      if (isUniqueViolation) {
        // Tenta resolver olhando o registro já commitado pela transação concorrente vencedora
        const fallback = await this.uow.transactional(async (repos) => {
          let fallbackInbox: InboxMessage | null = null;
          if (context) {
            fallbackInbox = await repos.inbox.find(context.consumerName, context.messageId);
          }
          const byKey = await repos.wagers.findByIdempotencyKey(idempotencyKey);
          if (byKey) {
            if (byKey.props.payloadHash === payloadHash) {
              if (context && fallbackInbox && !fallbackInbox.isProcessed) {
                fallbackInbox.markProcessed(new Date());
                await repos.inbox.markProcessed(fallbackInbox);
              }
              return { type: "REPLAY" as const, tx: byKey };
            }
            throw new DomainError(
              FailureCode.IDEMPOTENCY_CONFLICT,
              "Idempotency key reused with different payload",
            );
          }

          const byExternal = await repos.wagers.findByExternalId(
            dto.providerId,
            dto.externalTransactionId,
          );
          if (byExternal) {
            throw new DomainError(
              FailureCode.IDEMPOTENCY_CONFLICT,
              "External transaction already exists under another idempotency key",
            );
          }
          return null;
        });

        if (fallback) {
          executionResult = fallback;
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    if (executionResult.type === "REPLAY") {
      const txDto = toDto(executionResult.tx, true);
      return {
        statusCode: 200,
        idempotentReplay: true,
        message: txDto.message,
        transaction: txDto,
      };
    }

    if (executionResult.type === "PROCESSED") {
      // FAST-PATH: Disparar resolução de transações que estavam em PENDING_REFERENCE aguardando esta referência
      try {
        const pendingForThis = await this.uow.transactional(async (repos) => {
          return repos.wagers.findPendingByReference(dto.providerId, dto.externalTransactionId);
        });

        if (pendingForThis.length > 0) {
          const resolverUseCase = new ResolvePendingReferencesUseCase(this.uow);
          for (const pending of pendingForThis) {
            await resolverUseCase.resolveOne(pending.id, new Date());
          }
        }
      } catch {
        // Fast-path é uma otimização; qualquer exceção será recuperada pelo worker periódico
      }

      return {
        statusCode: 201,
        idempotentReplay: false,
        transaction: toDto(executionResult.tx, false),
      };
    }

    if (executionResult.type === "PENDING_REFERENCE") {
      return {
        statusCode: 202,
        idempotentReplay: false,
        transaction: toDto(executionResult.tx, false),
      };
    }

    // Caso REJECTED: a transação e o outbox já foram persistidos e commitados!
    const message =
      executionResult.code === FailureCode.ALREADY_REVERSED
        ? `A transação de referência já foi estornada anteriormente (${dto.referenceExternalTransactionId}).`
        : `Transaction rejected by policy: ${executionResult.code}`;

    throw new DomainError(
      executionResult.code,
      message,
      executionResult.details,
    );
  }
}
