import { randomUUID } from "node:crypto";
import {
  WalletBalanceChanged,
  WagerTransactionProcessed,
  WagerTransactionRejected,
} from "../../domain/events/events";
import { FailureCode } from "../../domain/errors/failure-code";
import { OutboxMessage } from "../../domain/messaging/outbox-message";
import type { WagerTransaction } from "../../domain/wagering/wager-transaction";
import { WageringPolicy } from "../../domain/wagering/wagering-policy";
import { loadConfig } from "../../infrastructure/config/config";
import {
  defaultPendingReferenceMetrics,
  type PendingReferenceMetrics,
  type PendingResolutionOutcome,
} from "../../infrastructure/observability/pending-reference-metrics";
import type { UnitOfWork } from "../ports/unit-of-work.port";

export interface ResolvePendingReferencesOptions {
  batchSize?: number;
  now?: Date;
  maxAttempts?: number;
  ttlSeconds?: number;
}

export interface ResolvePendingReferencesResult {
  claimedCount: number;
  appliedCount: number;
  rejectedBusinessCount: number;
  rejectedTimeoutCount: number;
  rescheduledCount: number;
  activeCount: number;
}

export class ResolvePendingReferencesUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly metrics: PendingReferenceMetrics = defaultPendingReferenceMetrics,
  ) {}

  /**
   * Executa a resolução em lote das transações com status PENDING_REFERENCE vencidas.
   */
  async execute(
    options?: ResolvePendingReferencesOptions,
  ): Promise<ResolvePendingReferencesResult> {
    const startTime = performance.now();
    const config = loadConfig();
    const now = options?.now ?? new Date();
    const batchSize = options?.batchSize ?? 50;
    const maxAttempts = options?.maxAttempts ?? config.RESOLVER_MAX_ATTEMPTS;
    const ttlSeconds = options?.ttlSeconds ?? config.RESOLVER_TTL_SECONDS;

    // 1. Reivindica transações vencidas elegíveis para resolução
    const candidates = await this.uow.transactional(async (repos) => {
      return repos.wagers.claimDuePendingReferences(now, batchSize);
    });

    let appliedCount = 0;
    let rejectedBusinessCount = 0;
    let rejectedTimeoutCount = 0;
    let rescheduledCount = 0;

    // 2. Processa cada transação individualmente para isolar falhas e locks
    for (const candidate of candidates) {
      try {
        const outcome = await this.resolveOne(candidate.id, now, { maxAttempts, ttlSeconds });
        if (outcome === "applied") appliedCount++;
        else if (outcome === "rejected_business") rejectedBusinessCount++;
        else if (outcome === "rejected_timeout") rejectedTimeoutCount++;
        else if (outcome === "rescheduled") rescheduledCount++;
      } catch {
        this.metrics.recordError();
        // Log ou re-tentativa transparente no próximo ciclo
      }
    }

    // 3. Atualiza o indicador de pendentes ativos no banco
    const activeCount = await this.uow.transactional(async (repos) => {
      return repos.wagers.countActivePendingReferences();
    });
    this.metrics.recordActive(activeCount);

    const durationSeconds = (performance.now() - startTime) / 1000;
    this.metrics.recordDuration(durationSeconds);

    return {
      claimedCount: candidates.length,
      appliedCount,
      rejectedBusinessCount,
      rejectedTimeoutCount,
      rescheduledCount,
      activeCount,
    };
  }

  /**
   * Resolve uma transação específica em transação SQL isolada com lock pessimista na carteira.
   */
  async resolveOne(
    txId: string,
    now: Date = new Date(),
    options?: { maxAttempts?: number; ttlSeconds?: number },
  ): Promise<PendingResolutionOutcome | null> {
    const config = loadConfig();
    const maxAttempts = options?.maxAttempts ?? config.RESOLVER_MAX_ATTEMPTS;
    const ttlSeconds = options?.ttlSeconds ?? config.RESOLVER_TTL_SECONDS;

    return this.uow.transactional(async (repos) => {
      // 1. Carrega a transação e confirma se ainda está em PENDING_REFERENCE
      const tx = await repos.wagers.findById(txId);
      if (!tx || tx.status !== "PENDING_REFERENCE") {
        return null;
      }

      // 2. Lock pessimista da carteira
      const wallet = await repos.wallets.findByIdForUpdate(tx.props.walletId);
      if (!wallet) {
        // Se por alguma razão a carteira não existir, rejeita com erro
        tx.reject(FailureCode.WALLET_NOT_FOUND, tx.props.money, now);
        await repos.wagers.update(tx);
        await repos.outbox.add(
          OutboxMessage.fromEvent(
            new WagerTransactionRejected(randomUUID(), now, {
              transactionId: tx.id,
              walletId: tx.props.walletId,
              kind: tx.kind,
              failureCode: FailureCode.WALLET_NOT_FOUND,
            }),
          ),
        );
        this.metrics.recordResolved("rejected_business");
        return "rejected_business";
      }

      // 3. Busca a transação de referência
      let ref: WagerTransaction | null = null;
      let referenceAlreadyReversed = false;

      if (tx.props.referenceExternalTransactionId) {
        ref = await repos.wagers.findByExternalId(
          tx.props.providerId,
          tx.props.referenceExternalTransactionId,
        );
        if (ref) {
          referenceAlreadyReversed = await repos.wagers.hasProcessedReversal(ref.id);
        }
      }

      // 4. Avalia as regras de aposta
      const decision = WageringPolicy.evaluate(tx, {
        wallet,
        reference: ref,
        referenceAlreadyReversed,
      });

      // Desfecho 1: Sucesso - Aplicar movimentação financeira
      if (decision.type === "APPLY") {
        if (decision.direction === "DEBIT") {
          const ledgerEntry = wallet.debit({
            ledgerId: randomUUID(),
            transactionId: tx.id,
            amount: tx.props.money,
            now,
            insufficientCode: decision.insufficientCode,
          });
          tx.markProcessed(wallet.balance, now, ref?.id ?? null);
          await repos.wagers.update(tx);
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
            amount: tx.props.money,
            now,
          });
          tx.markProcessed(wallet.balance, now, ref?.id ?? null);
          await repos.wagers.update(tx);
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
          await repos.wagers.update(tx);
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

        this.metrics.recordResolved("applied");
        return "applied";
      }

      // Desfecho 2: Rejeição de negócio
      if (decision.type === "REJECT") {
        tx.reject(decision.code, wallet.balance, now);
        await repos.wagers.update(tx);

        const rejectedEvent = new WagerTransactionRejected(randomUUID(), now, {
          transactionId: tx.id,
          walletId: wallet.id,
          kind: tx.kind,
          failureCode: decision.code,
        });
        await repos.outbox.add(OutboxMessage.fromEvent(rejectedEvent));

        this.metrics.recordResolved("rejected_business");
        return "rejected_business";
      }

      // Desfecho 3: Referência ainda pendente
      const nextAttempts = tx.props.attempts + 1;
      const ageMs = now.getTime() - tx.props.createdAt.getTime();
      const ttlMs = ttlSeconds * 1000;
      const isExpired = nextAttempts >= maxAttempts || ageMs >= ttlMs;

      if (isExpired) {
        tx.reject(FailureCode.REFERENCE_NOT_FOUND, wallet.balance, now);
        await repos.wagers.update(tx);

        const rejectedEvent = new WagerTransactionRejected(randomUUID(), now, {
          transactionId: tx.id,
          walletId: wallet.id,
          kind: tx.kind,
          failureCode: FailureCode.REFERENCE_NOT_FOUND,
        });
        await repos.outbox.add(OutboxMessage.fromEvent(rejectedEvent));

        this.metrics.recordResolved("rejected_timeout");
        return "rejected_timeout";
      }

      // Backoff exponencial com jitter (entre 0 e 1000ms)
      const baseDelayMs = Math.min(1000 * Math.pow(2, tx.props.attempts), 60000);
      const jitterMs = Math.floor(Math.random() * 1000);
      const nextAttemptAt = new Date(now.getTime() + baseDelayMs + jitterMs);

      tx.markPendingReference(nextAttemptAt, now);
      await repos.wagers.update(tx);

      this.metrics.recordResolved("rescheduled");
      return "rescheduled";
    });
  }
}
