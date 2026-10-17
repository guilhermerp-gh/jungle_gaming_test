import { Counter, Histogram, type Registry, register as defaultRegister } from "prom-client";

export type SqsConsumeStatus =
  | "success"
  | "business_rejection"
  | "idempotent_replay"
  | "transient_error"
  | "poison_pill";

export class SqsConsumerMetrics {
  readonly consumedCounter: Counter<string>;
  readonly durationHistogram: Histogram<string>;
  readonly dlqCounter: Counter<string>;

  constructor(registry: Registry = defaultRegister) {
    this.consumedCounter =
      (registry.getSingleMetric("sqs_messages_consumed_total") as Counter<string>) ??
      new Counter({
        name: "sqs_messages_consumed_total",
        help: "Total de mensagens SQS processadas pelo consumidor",
        labelNames: ["consumer", "status"],
        registers: [registry],
      });

    this.durationHistogram =
      (registry.getSingleMetric("sqs_processing_duration_seconds") as Histogram<string>) ??
      new Histogram({
        name: "sqs_processing_duration_seconds",
        help: "Duração em segundos do processamento de mensagens SQS",
        labelNames: ["consumer"],
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
        registers: [registry],
      });

    this.dlqCounter =
      (registry.getSingleMetric("dlq_messages_total") as Counter<string>) ??
      new Counter({
        name: "dlq_messages_total",
        help: "Total de mensagens encaminhadas para a Dead Letter Queue (DLQ)",
        labelNames: ["consumer", "reason"],
        registers: [registry],
      });
  }

  recordConsumed(consumer: string, status: SqsConsumeStatus): void {
    this.consumedCounter.inc({ consumer, status });
  }

  recordDuration(consumer: string, durationSeconds: number): void {
    this.durationHistogram.observe({ consumer }, durationSeconds);
  }

  recordDlq(consumer: string, reason = "poison_pill"): void {
    this.dlqCounter.inc({ consumer, reason });
  }
}

export const defaultSqsConsumerMetrics = new SqsConsumerMetrics();
