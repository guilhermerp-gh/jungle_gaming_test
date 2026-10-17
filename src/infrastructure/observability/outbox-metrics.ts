import { Counter, Gauge, type Registry, register as defaultRegister } from "prom-client";

export class OutboxMetrics {
  readonly lagGauge: Gauge<string>;
  readonly publishedCounter: Counter<string>;
  readonly errorsCounter: Counter<string>;

  constructor(registry: Registry = defaultRegister) {
    this.lagGauge =
      (registry.getSingleMetric("outbox_lag_seconds") as Gauge<string>) ??
      new Gauge({
        name: "outbox_lag_seconds",
        help: "Lag em segundos entre o evento mais antigo pendente no outbox e o momento atual",
        registers: [registry],
      });

    this.publishedCounter =
      (registry.getSingleMetric("events_published_total") as Counter<string>) ??
      new Counter({
        name: "events_published_total",
        help: "Total de eventos publicados no broker de mensageria",
        labelNames: ["event_type"],
        registers: [registry],
      });

    this.errorsCounter =
      (registry.getSingleMetric("outbox_publish_errors_total") as Counter<string>) ??
      new Counter({
        name: "outbox_publish_errors_total",
        help: "Total de erros durante a publicação de eventos da outbox",
        labelNames: ["event_type"],
        registers: [registry],
      });
  }

  recordPublished(eventType: string): void {
    this.publishedCounter.inc({ event_type: eventType });
  }

  recordError(eventType: string): void {
    this.errorsCounter.inc({ event_type: eventType });
  }

  recordLag(seconds: number): void {
    this.lagGauge.set(Math.max(0, seconds));
  }
}

export const defaultOutboxMetrics = new OutboxMetrics();
