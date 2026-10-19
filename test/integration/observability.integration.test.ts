import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { NestFactory } from "@nestjs/core";
import { Module, type INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { register } from "prom-client";
import { HttpModule } from "../../src/interfaces/http/http.module";
import { HttpExceptionFilter } from "../../src/interfaces/http/filters/http-exception.filter";
import { MetricsController } from "../../src/main";
import { resetData, setupTestDb, type TestDb } from "../helpers/db";
import { CORRELATION_ID_HEADER } from "../../src/interfaces/http/middlewares/correlation-id.middleware";

@Module({
  imports: [],
  controllers: [MetricsController],
})
class TestMetricsModule {}

describe("Observabilidade, Métricas Prometheus & Correlation ID (Integration Tests - Fase 9)", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    db = await setupTestDb();

    @Module({
      imports: [
        HttpModule.register({ orm: db.orm, uow: db.uow }),
        TestMetricsModule,
      ],
    })
    class IntegrationTestModule {}

    app = await NestFactory.create(IntegrationTestModule, { logger: false });
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0);

    const server = app.getHttpServer();
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app?.close();
    await db?.close();
  });

  beforeEach(async () => {
    await resetData(db);
  });

  describe("Rastreabilidade Distribuída (Correlation ID)", () => {
    it("deve gerar automaticamente um X-Correlation-Id caso não seja informado na requisição", async () => {
      const res = await fetch(`${baseUrl}/wallets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: randomUUID(),
          currency: "BRL",
        }),
      });

      expect(res.status).toBe(201);
      const returnedCid = res.headers.get(CORRELATION_ID_HEADER);
      expect(returnedCid).not.toBeNull();
      expect(typeof returnedCid).toBe("string");
      expect(returnedCid!.length).toBeGreaterThan(10);
    });

    it("deve propagar e devolver o X-Correlation-Id customizado enviado pelo cliente", async () => {
      const customTraceId = "trace-e2e-obs-123456";

      const res = await fetch(`${baseUrl}/wallets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [CORRELATION_ID_HEADER]: customTraceId,
        },
        body: JSON.stringify({
          playerId: randomUUID(),
          currency: "BRL",
        }),
      });

      expect(res.status).toBe(201);
      expect(res.headers.get(CORRELATION_ID_HEADER)).toBe(customTraceId);
    });
  });

  describe("Métricas Prometheus de Transações e Replays", () => {
    it("deve incrementar wager_transactions_total no processamento e idempotent_replays_total no replay", async () => {
      const playerId = randomUUID();
      const openWalletRes = await fetch(`${baseUrl}/wallets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          currency: "BRL",
          initialBalance: "100.00",
        }),
      });
      const wallet = (await openWalletRes.json()) as { id: string };

      const idempotencyKey = `req-obs-${randomUUID()}`;
      const betPayload = {
        providerId: "evolution",
        externalTransactionId: `tx-ext-${randomUUID()}`,
        playerId,
        walletId: wallet.id,
        roundId: "round-obs-1",
        gameId: "roulette",
        kind: "BET",
        amount: "30.00",
        currency: "BRL",
      };

      // 1. Processamento novo
      const betRes = await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(betPayload),
      });

      expect(betRes.status).toBe(201);
      const betData = (await betRes.json()) as { idempotentReplay: boolean };
      expect(betData.idempotentReplay).toBe(false);

      const metricsAfterBet = await register.metrics();
      expect(metricsAfterBet).toContain("wager_transactions_total");
      expect(metricsAfterBet).toContain('kind="BET"');
      expect(metricsAfterBet).toContain('status="PROCESSED"');

      // 2. Replay idempotente com mesma chave
      const replayRes = await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(betPayload),
      });

      expect(replayRes.status).toBe(200);
      const replayData = (await replayRes.json()) as { idempotentReplay: boolean };
      expect(replayData.idempotentReplay).toBe(true);

      const metricsAfterReplay = await register.metrics();
      expect(metricsAfterReplay).toContain("idempotent_replays_total");
      expect(metricsAfterReplay).toContain('kind="BET"');
      expect(metricsAfterReplay).toContain('source="http"');
    });
  });

  describe("Métrica de Divergência Contábil (reconciliation_mismatch_total)", () => {
    it("deve incrementar reconciliation_mismatch_total quando o saldo não coincidir com o ledger", async () => {
      const playerId = randomUUID();
      const openWalletRes = await fetch(`${baseUrl}/wallets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          currency: "BRL",
          initialBalance: "50.00",
        }),
      });
      const wallet = (await openWalletRes.json()) as { id: string };

      // Força anomalia de saldo via SQL direto
      await db.sql(
        `UPDATE wallets SET balance_amount = 999.00 WHERE id = ?`,
        [wallet.id],
      );

      const reconRes = await fetch(`${baseUrl}/wallets/${wallet.id}/reconciliation`, {
        method: "POST",
      });

      expect(reconRes.status).toBe(200);
      const reconData = (await reconRes.json()) as { consistent: boolean };
      expect(reconData.consistent).toBe(false);

      const metricsAfterRecon = await register.metrics();
      expect(metricsAfterRecon).toContain("reconciliation_mismatch_total");
    });
  });

  describe("Endpoints de Exposição /metrics e /api/metrics", () => {
    it("GET /metrics deve retornar dados formatados no padrão de scrape do Prometheus", async () => {
      const res = await fetch(`${baseUrl}/metrics?raw=true`, {
        headers: { Accept: "text/plain" },
      });

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("# HELP");
      expect(text).toContain("# TYPE");
      expect(text).toContain("wager_transactions_total");
      expect(text).toContain("outbox_lag_seconds");
    });

    it("GET /api/metrics deve retornar a lista de métricas no formato JSON estruturado", async () => {
      const res = await fetch(`${baseUrl}/api/metrics`);
      expect(res.status).toBe(200);
      const json = (await res.json()) as Array<{ name: string }>;
      expect(Array.isArray(json)).toBe(true);

      const metricNames = json.map((m) => m.name);
      expect(metricNames).toContain("wager_transactions_total");
      expect(metricNames).toContain("idempotent_replays_total");
      expect(metricNames).toContain("lock_conflicts_total");
    });
  });
});
