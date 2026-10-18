import { randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import { waitForFailureInjection } from "../../infrastructure/testing/failure-injection";
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
import type { TransactionalRepositories, UnitOfWork } from "../ports/unit-of-work.port";

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

/**
 * Calcula o atraso de backoff exponencial com jitter de 0 a 1000ms e teto em 60 segundos.
 * Fórmula: min(1000 * 2^attempts, 60000) + jitter(0..1000ms)
 */
export function calculateBackoffDelayMs(
  attempts: number,
  jitterGenerator: () => number = () => Math.floor(Math.random() * 1000),
): number {
  const baseDelayMs = Math.min(1000 * Math.pow(2, attempts), 60_000);
  const jitterMs = jitterGenerator();
  return baseDelayMs + jitterMs;
}

export class ResolvePendingReferencesUseCase {
  private readonly logger = new Logger(ResolvePendingReferencesUseCase.name);

  constructor(
    private readonly uow: UnitOfWork,
    private readonly metrics: PendingReferenceMetrics = defaultPendingReferenceMetrics,
  ) {}

  /**
   * Executa a resolução atômica de transações PENDING_REFERENCE vencidas.
   * Cada registro é reivindicado com FOR UPDATE SKIP LOCKED e processado na mesma transação.
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

    let claimedCount = 0;
    let appliedCount = 0;
    let rejectedBusinessCount = 0;
    let rejectedTimeoutCount = 0;
    let rescheduledCount = 0;

    for (let i = 0; i < batchSize; i++) {
      let outcome: PendingResolutionOutcome | null = null;
      try {
        outcome = await this.uow.transactional(async (repos) => {
          // Reivindica exclusivamente 1 transação pendente elegível com FOR UPDATE SKIP LOCKED
          const candidates = await repos.wagers.claimDuePendingReferences(now, 1);
          if (candidates.length === 0) {
            return null;
          }
          const candidate = candidates[0]!;
          await waitForFailureInjection("TEST_HOOK_AFTER_RESOLVER_CLAIM_MS");
          return this.resolveCandidateInTransaction(repos, candidate, now, { maxAttempts, ttlSeconds });
        });
      } catch (err) {
        this.metrics.recordError();
        this.logger.error({
          msg: "Erro inesperado ao resolver pendência de referência no ciclo",
          outcome: "error",
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }

      if (!outcome) {
        // Nenhuma transação pendente elegível restante disponível
        break;
      }

      claimedCount++;
      if (outcome === "applied") appliedCount++;
      else if (outcome === "rejected_business") rejectedBusinessCount++;
      else if (outcome === "rejected_timeout") rejectedTimeoutCount++;
      else if (outcome === "rescheduled") rescheduledCount++;
    }

    // Atualiza o indicador de pendentes ativos no banco
    const activeCount = await this.uow.transactional(async (repos) => {
      return repos.wagers.countActivePendingReferences();
    });
    this.metrics.recordActive(activeCount);

    const durationSeconds = (performance.now() - startTime) / 1000;
    this.metrics.recordDuration(durationSeconds);

    return {
      claimedCount,
      appliedCount,
      rejectedBusinessCount,
      rejectedTimeoutCount,
      rescheduledCount,
      activeCount,
    };
  }

  /**
   * Resolve uma transação específica em transação SQL isolada com lock pessimista na aposta e na carteira.
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
      // Bloqueia a transação de aposta com FOR UPDATE
      const tx = await repos.wagers.findByIdForUpdate(txId);
      if (!tx || tx.status !== "PENDING_REFERENCE") {
        return null;
      }
      return this.resolveCandidateInTransaction(repos, tx, now, { maxAttempts, ttlSeconds });
    });
  }

  /**
   * Processa a decisão contábil, mutação e eventos mantendo o lock da transação e da carteira ativos.
   */
  private async resolveCandidateInTransaction(
    repos: TransactionalRepositories,
    tx: WagerTransaction,
    now: Date,
    options: { maxAttempts: number; ttlSeconds: number },
  ): Promise<PendingResolutionOutcome> {
    const startCandidateTime = performance.now();

    // 1. Lock pessimista da carteira
    const wallet = await repos.wallets.findByIdForUpdate(tx.props.walletId);
    if (!wallet) {
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
      const durationMs = performance.now() - startCandidateTime;
      this.logResolution(tx, "rejected_business", durationMs);
      return "rejected_business";
    }

    // 2. Busca da transação de referência
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

    // 3. Avalia as regras contábeis
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
      const durationMs = performance.now() - startCandidateTime;
      this.logResolution(tx, "applied", durationMs);
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
      const durationMs = performance.now() - startCandidateTime;
      this.logResolution(tx, "rejected_business", durationMs);
      return "rejected_business";
    }

    // Desfecho 3: Referência ainda pendente
    const nextAttempts = tx.props.attempts + 1;
    const ageMs = now.getTime() - tx.props.createdAt.getTime();
    const ttlMs = options.ttlSeconds * 1000;
    const isExpired = nextAttempts >= options.maxAttempts || ageMs >= ttlMs;

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
      const durationMs = performance.now() - startCandidateTime;
      this.logResolution(tx, "rejected_timeout", durationMs);
      return "rejected_timeout";
    }

    // Backoff exponencial com jitter
    const delayMs = calculateBackoffDelayMs(tx.props.attempts);
    const nextAttemptAt = new Date(now.getTime() + delayMs);

    tx.markPendingReference(nextAttemptAt, now);
    await repos.wagers.update(tx);

    this.metrics.recordResolved("rescheduled");
    const durationMs = performance.now() - startCandidateTime;
    this.logResolution(tx, "rescheduled", durationMs);
    return "rescheduled";
  }

  private logResolution(tx: WagerTransaction, outcome: PendingResolutionOutcome, durationMs: number): void {
    this.logger.log({
      msg: `Pending reference resolved: ${outcome}`,
      transactionId: tx.id,
      providerId: tx.props.providerId,
      referenceExternalTransactionId: tx.props.referenceExternalTransactionId,
      walletId: tx.props.walletId,
      attempts: tx.props.attempts,
      outcome,
      durationMs: Math.round(durationMs),
    });
  }
}
