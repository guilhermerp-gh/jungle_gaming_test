import { Counter, Histogram, type Registry, register as defaultRegister } from "prom-client";

export type WagerTransactionStatusLabel =
  | "PROCESSED"
  | "REJECTED"
  | "PENDING_REFERENCE"
  | "FAILED";

export class WageringMetrics {
  readonly transactionsCounter: Counter<string>;
  readonly idempotentReplaysCounter: Counter<string>;
  readonly retriesCounter: Counter<string>;
  readonly lockConflictsCounter: Counter<string>;
  readonly processingDurationHistogram: Histogram<string>;
  readonly reconciliationMismatchCounter: Counter<string>;

  constructor(registry: Registry = defaultRegister) {
    this.transactionsCounter =
      (registry.getSingleMetric("wager_transactions_total") as Counter<string>) ??
      new Counter({
        name: "wager_transactions_total",
        help: "Total de transações de aposta processadas pelo serviço",
        labelNames: ["status", "kind"],
        registers: [registry],
      });

    this.idempotentReplaysCounter =
      (registry.getSingleMetric("idempotent_replays_total") as Counter<string>) ??
      new Counter({
        name: "idempotent_replays_total",
        help: "Total de replays de idempotência atendidos sem efeito financeiro duplicado",
        labelNames: ["kind", "source"],
        registers: [registry],
      });

    this.retriesCounter =
      (registry.getSingleMetric("retries_total") as Counter<string>) ??
      new Counter({
        name: "retries_total",
        help: "Total de tentativas e retentativas executadas pelo serviço",
        labelNames: ["operation"],
        registers: [registry],
      });

    this.lockConflictsCounter =
      (registry.getSingleMetric("lock_conflicts_total") as Counter<string>) ??
      new Counter({
        name: "lock_conflicts_total",
        help: "Total de conflitos de concorrência ou timeouts de lock capturados",
        labelNames: ["resource"],
        registers: [registry],
      });

    this.processingDurationHistogram =
      (registry.getSingleMetric("processing_duration_seconds") as Histogram<string>) ??
      new Histogram({
        name: "processing_duration_seconds",
        help: "Duração em segundos do processamento de transações financeiras",
        labelNames: ["operation", "status"],
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
        registers: [registry],
      });

    this.reconciliationMismatchCounter =
      (registry.getSingleMetric("reconciliation_mismatch_total") as Counter<string>) ??
      new Counter({
        name: "reconciliation_mismatch_total",
        help: "Total de divergências contábeis identificadas na reconciliação de carteiras",
        registers: [registry],
      });
  }

  recordTransaction(status: WagerTransactionStatusLabel, kind: string): void {
    this.transactionsCounter.inc({ status, kind });
  }

  recordIdempotentReplay(kind: string, source: "http" | "sqs" = "http"): void {
    this.idempotentReplaysCounter.inc({ kind, source });
  }

  recordRetry(operation: "outbox_publisher" | "pending_reference_resolver" | "wallet_lock"): void {
    this.retriesCounter.inc({ operation });
  }

  recordLockConflict(resource = "wallet"): void {
    this.lockConflictsCounter.inc({ resource });
  }

  recordDuration(operation: string, status: string, durationSeconds: number): void {
    this.processingDurationHistogram.observe({ operation, status }, Math.max(0, durationSeconds));
  }

  recordReconciliationMismatch(): void {
    this.reconciliationMismatchCounter.inc();
  }
}

export const defaultWageringMetrics = new WageringMetrics();
