import { describe, expect, it } from "bun:test";
import { Registry } from "prom-client";
import { WageringMetrics } from "../../src/infrastructure/observability/wagering-metrics";
import { CorrelationContext } from "../../src/infrastructure/observability/correlation-context";
import { AppStructuredLogger } from "../../src/infrastructure/observability/app-logger";

describe("Observabilidade & Métricas Unit Tests (Fase 9)", () => {
  describe("WageringMetrics (Prometheus)", () => {
    it("deve inicializar e registrar todas as métricas em um registro isolado sem erros", async () => {
      const registry = new Registry();
      const metrics = new WageringMetrics(registry);

      metrics.recordTransaction("PROCESSED", "BET");
      metrics.recordTransaction("REJECTED", "WIN");
      metrics.recordTransaction("PENDING_REFERENCE", "REFUND");
      metrics.recordIdempotentReplay("BET", "http");
      metrics.recordIdempotentReplay("WIN", "sqs");
      metrics.recordRetry("outbox_publisher");
      metrics.recordRetry("pending_reference_resolver");
      metrics.recordRetry("wallet_lock");
      metrics.recordLockConflict("wallet");
      metrics.recordDuration("process_wager_transaction", "PROCESSED", 0.045);
      metrics.recordReconciliationMismatch();

      const output = await registry.metrics();

      expect(output).toContain("wager_transactions_total");
      expect(output).toContain('status="PROCESSED"');
      expect(output).toContain('status="REJECTED"');
      expect(output).toContain('status="PENDING_REFERENCE"');
      expect(output).toContain("idempotent_replays_total");
      expect(output).toContain('source="http"');
      expect(output).toContain('source="sqs"');
      expect(output).toContain("retries_total");
      expect(output).toContain('operation="outbox_publisher"');
      expect(output).toContain('operation="pending_reference_resolver"');
      expect(output).toContain('operation="wallet_lock"');
      expect(output).toContain("lock_conflicts_total");
      expect(output).toContain('resource="wallet"');
      expect(output).toContain("processing_duration_seconds");
      expect(output).toContain("reconciliation_mismatch_total");
    });

    it("não deve quebrar ao ser instanciado múltiplas vezes no mesmo registro (getSingleMetric)", () => {
      const registry = new Registry();
      const metrics1 = new WageringMetrics(registry);
      const metrics2 = new WageringMetrics(registry);

      expect(metrics1.transactionsCounter).toBe(metrics2.transactionsCounter);
      expect(metrics1.idempotentReplaysCounter).toBe(metrics2.idempotentReplaysCounter);
      expect(metrics1.lockConflictsCounter).toBe(metrics2.lockConflictsCounter);
    });
  });

  describe("CorrelationContext (AsyncLocalStorage)", () => {
    it("deve propagar correlationId e metadados dentro de CorrelationContext.run", () => {
      const cid = "test-corr-12345";
      CorrelationContext.run({ correlationId: cid, walletId: "wallet-1" }, () => {
        const current = CorrelationContext.get();
        expect(current?.correlationId).toBe(cid);
        expect(current?.walletId).toBe("wallet-1");
        expect(CorrelationContext.getCorrelationId()).toBe(cid);

        CorrelationContext.merge({ providerId: "evolution" });
        expect(CorrelationContext.get()?.providerId).toBe("evolution");
      });
    });

    it("deve retornar um UUID válido ao invocar getCorrelationId fora de contexto", () => {
      const fallbackId = CorrelationContext.getCorrelationId();
      expect(typeof fallbackId).toBe("string");
      expect(fallbackId.length).toBeGreaterThan(10);
    });
  });

  describe("AppStructuredLogger", () => {
    it("deve enriquecer mensagens com contexto assíncrono sem lançar exceções", () => {
      const logger = new AppStructuredLogger();

      CorrelationContext.run({ correlationId: "logger-test-id", instanceId: "unit-test" }, () => {
        expect(() => {
          logger.log("Mensagem de teste info", { customField: 42 });
          logger.warn("Alerta de teste", { warningCode: "WARN_01" });
          logger.error("Erro simulado", { errorCode: "ERR_500" });
          logger.debug("Mensagem de debug");
        }).not.toThrow();
      });
    });
  });
});
