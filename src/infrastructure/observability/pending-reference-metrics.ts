import { Counter, Gauge, Histogram, type Registry, register as defaultRegister } from "prom-client";

export type PendingResolutionOutcome =
  | "applied"
  | "rejected_business"
  | "rejected_timeout"
  | "rescheduled";

export class PendingReferenceMetrics {
  readonly activeGauge: Gauge<string>;
  readonly resolvedCounter: Counter<string>;
  readonly durationHistogram: Histogram<string>;
  readonly errorsCounter: Counter<string>;

  constructor(registry: Registry = defaultRegister) {
    this.activeGauge =
      (registry.getSingleMetric("pending_references_active_gauge") as Gauge<string>) ??
      new Gauge({
        name: "pending_references_active_gauge",
        help: "Quantidade atual de transações com status PENDING_REFERENCE aguardando resolução",
        registers: [registry],
      });

    this.resolvedCounter =
      (registry.getSingleMetric("pending_references_resolved_total") as Counter<string>) ??
      new Counter({
        name: "pending_references_resolved_total",
        help: "Total de transações pendentes avaliadas discriminadas por desfecho",
        labelNames: ["outcome"],
        registers: [registry],
      });

    this.durationHistogram =
      (registry.getSingleMetric("pending_reference_resolution_duration_seconds") as Histogram<string>) ??
      new Histogram({
        name: "pending_reference_resolution_duration_seconds",
        help: "Duração em segundos da execução da resolução de referências pendentes",
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
        registers: [registry],
      });

    this.errorsCounter =
      (registry.getSingleMetric("pending_reference_errors_total") as Counter<string>) ??
      new Counter({
        name: "pending_reference_errors_total",
        help: "Total de erros inesperados durante a resolução de referências pendentes",
        registers: [registry],
      });
  }

  recordActive(count: number): void {
    this.activeGauge.set(Math.max(0, count));
  }

  recordResolved(outcome: PendingResolutionOutcome): void {
    this.resolvedCounter.inc({ outcome });
  }

  recordDuration(durationSeconds: number): void {
    this.durationHistogram.observe(durationSeconds);
  }

  recordError(): void {
    this.errorsCounter.inc();
  }
}

export const defaultPendingReferenceMetrics = new PendingReferenceMetrics();
