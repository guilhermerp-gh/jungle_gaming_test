import { afterEach, describe, expect, it } from "bun:test";
import type { ResolvePendingReferencesUseCase } from "../../src/application/use-cases/resolve-pending-references.use-case";
import { PendingReferenceResolverWorker } from "../../src/interfaces/workers/pending-reference-resolver.worker";

class MockResolveUseCase {
  public executeCalls = 0;
  async execute() {
    this.executeCalls++;
    return {
      claimedCount: 0,
      appliedCount: 0,
      rejectedBusinessCount: 0,
      rejectedTimeoutCount: 0,
      rescheduledCount: 0,
      activeCount: 0,
    };
  }
}

describe("PendingReferenceResolverWorker (Unit Tests)", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("não inicia quando APP_ROLE é api, consumer ou outbox", async () => {
    process.env.APP_ROLE = "api";
    process.env.DATABASE_URL = "postgres://wager:wager@localhost:5432/wager";
    process.env.WAGER_QUEUE_URL = "http://localhost:4566/000000000000/wager.fifo";
    process.env.EVENTS_QUEUE_URL = "http://localhost:4566/000000000000/events.fifo";

    const mockUseCase = new MockResolveUseCase();
    const worker = new PendingReferenceResolverWorker(
      mockUseCase as unknown as ResolvePendingReferencesUseCase,
      { pollIntervalMs: 20 },
    );

    await worker.onApplicationBootstrap();
    await new Promise((resolve) => setTimeout(resolve, 60));
    await worker.onApplicationShutdown();

    expect(mockUseCase.executeCalls).toBe(0);
  });

  it("inicia e executa ciclos periódicos quando APP_ROLE é resolver ou all", async () => {
    process.env.APP_ROLE = "resolver";
    process.env.DATABASE_URL = "postgres://wager:wager@localhost:5432/wager";
    process.env.WAGER_QUEUE_URL = "http://localhost:4566/000000000000/wager.fifo";
    process.env.EVENTS_QUEUE_URL = "http://localhost:4566/000000000000/events.fifo";

    const mockUseCase = new MockResolveUseCase();
    const worker = new PendingReferenceResolverWorker(
      mockUseCase as unknown as ResolvePendingReferencesUseCase,
      { pollIntervalMs: 20 },
    );

    await worker.onApplicationBootstrap();
    // Aguarda alguns ciclos
    await new Promise((resolve) => setTimeout(resolve, 80));
    await worker.onApplicationShutdown("SIGTERM");

    expect(mockUseCase.executeCalls).toBeGreaterThan(0);
  });

  it("graceful shutdown encerra a execução sem erros", async () => {
    process.env.APP_ROLE = "all";
    process.env.DATABASE_URL = "postgres://wager:wager@localhost:5432/wager";
    process.env.WAGER_QUEUE_URL = "http://localhost:4566/000000000000/wager.fifo";
    process.env.EVENTS_QUEUE_URL = "http://localhost:4566/000000000000/events.fifo";

    const mockUseCase = new MockResolveUseCase();
    const worker = new PendingReferenceResolverWorker(
      mockUseCase as unknown as ResolvePendingReferencesUseCase,
      { pollIntervalMs: 10 },
    );

    worker.start();
    await new Promise((resolve) => setTimeout(resolve, 30));
    await worker.onApplicationShutdown("SIGINT");
    const callsAfterShutdown = mockUseCase.executeCalls;

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(mockUseCase.executeCalls).toBe(callsAfterShutdown);
  });
});
