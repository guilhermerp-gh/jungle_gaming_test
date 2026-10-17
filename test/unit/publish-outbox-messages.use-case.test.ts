import { describe, expect, it } from "bun:test";
import { Registry } from "prom-client";
import type { MessagePublisherPort } from "../../src/application/ports/message-publisher.port";
import type {
  InboxRepository,
  LedgerRepository,
  OutboxRepository,
  WagerTransactionRepository,
  WalletRepository,
} from "../../src/application/ports/repositories.port";
import type { TransactionalRepositories, UnitOfWork } from "../../src/application/ports/unit-of-work.port";
import { PublishOutboxMessagesUseCase } from "../../src/application/use-cases/publish-outbox-messages.use-case";
import { OutboxMessage } from "../../src/domain/messaging/outbox-message";
import { OutboxMetrics } from "../../src/infrastructure/observability/outbox-metrics";

class FakeOutboxRepository implements OutboxRepository {
  public messages: OutboxMessage[] = [];

  async add(message: OutboxMessage): Promise<void> {
    this.messages.push(message);
  }

  async claimBatch(now: Date, limit: number, leaseMs: number): Promise<OutboxMessage[]> {
    const eligible = this.messages
      .filter((m) => {
        const p = m.props;
        if (p.publishedAt !== null) return false;
        if (p.nextAttemptAt.getTime() > now.getTime()) return false;
        if (p.lockedUntil !== null && p.lockedUntil.getTime() > now.getTime()) return false;
        return true;
      })
      .slice(0, limit);

    for (const m of eligible) {
      m.lease(now, leaseMs);
    }
    return eligible;
  }

  async save(message: OutboxMessage): Promise<void> {
    const idx = this.messages.findIndex((m) => m.props.id === message.props.id);
    if (idx >= 0) {
      this.messages[idx] = message;
    } else {
      this.messages.push(message);
    }
  }

  async getOldestPendingOccurredAt(): Promise<Date | null> {
    const pending = this.messages
      .filter((m) => m.props.publishedAt === null)
      .sort((a, b) => a.props.occurredAt.getTime() - b.props.occurredAt.getTime());
    return pending.length > 0 ? pending[0]!.props.occurredAt : null;
  }
}

class FakeUnitOfWork implements UnitOfWork {
  constructor(public readonly outbox: FakeOutboxRepository) {}

  async transactional<T>(fn: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
    const dummyRepos: TransactionalRepositories = {
      wallets: {} as WalletRepository,
      wagers: {} as WagerTransactionRepository,
      ledger: {} as LedgerRepository,
      inbox: {} as InboxRepository,
      outbox: this.outbox,
    };
    return fn(dummyRepos);
  }
}


class FakePublisher implements MessagePublisherPort {
  public published: OutboxMessage[] = [];
  public failPredicate?: (msg: OutboxMessage) => boolean;

  async publish(message: OutboxMessage): Promise<void> {
    if (this.failPredicate && this.failPredicate(message)) {
      throw new Error(`Failed to publish ${message.props.id}`);
    }
    this.published.push(message);
  }
}

describe("PublishOutboxMessagesUseCase (Unit Tests)", () => {
  it("processa lote vazio retornando contadores zerados", async () => {
    const repo = new FakeOutboxRepository();
    const uow = new FakeUnitOfWork(repo);
    const publisher = new FakePublisher();
    const metrics = new OutboxMetrics(new Registry());

    const useCase = new PublishOutboxMessagesUseCase(uow, publisher, metrics);
    const result = await useCase.execute();

    expect(result).toEqual({
      claimedCount: 0,
      publishedCount: 0,
      failedCount: 0,
      lagSeconds: 0,
    });
    expect(publisher.published).toHaveLength(0);
  });

  it("publica mensagens pendentes, marca como publicado e calcula lag", async () => {
    const repo = new FakeOutboxRepository();
    const uow = new FakeUnitOfWork(repo);
    const publisher = new FakePublisher();
    const metrics = new OutboxMetrics(new Registry());

    const tenSecondsAgo = new Date(Date.now() - 10_000);
    const msg1 = OutboxMessage.rehydrate({
      id: "ev-1",
      aggregateId: "wallet-1",
      eventType: "WagerAcceptedEvent",
      payload: { amount: "10.00" },
      occurredAt: tenSecondsAgo,
      attempts: 0,
      nextAttemptAt: tenSecondsAgo,
      lockedUntil: null,
      publishedAt: null,
    });

    const msg2 = OutboxMessage.rehydrate({
      id: "ev-2",
      aggregateId: "wallet-1",
      eventType: "WagerSettledEvent",
      payload: { amount: "20.00" },
      occurredAt: new Date(Date.now() - 5_000),
      attempts: 0,
      nextAttemptAt: new Date(Date.now() - 5_000),
      lockedUntil: null,
      publishedAt: null,
    });

    await repo.add(msg1);
    await repo.add(msg2);

    const useCase = new PublishOutboxMessagesUseCase(uow, publisher, metrics);
    const result = await useCase.execute();

    expect(result.claimedCount).toBe(2);
    expect(result.publishedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.lagSeconds).toBe(0); // Nenhum evento pendente restou
    expect(publisher.published).toHaveLength(2);

    expect(msg1.props.publishedAt).not.toBeNull();
    expect(msg1.props.lockedUntil).toBeNull();
    expect(msg2.props.publishedAt).not.toBeNull();
    expect(msg2.props.lockedUntil).toBeNull();
  });

  it("aplica backoff exponencial e libera lock quando a publicação falha", async () => {
    const repo = new FakeOutboxRepository();
    const uow = new FakeUnitOfWork(repo);
    const publisher = new FakePublisher();
    publisher.failPredicate = () => true; // sempre falha

    const metrics = new OutboxMetrics(new Registry());
    const fiveSecondsAgo = new Date(Date.now() - 5_000);

    const msg = OutboxMessage.rehydrate({
      id: "ev-err-1",
      aggregateId: "wallet-2",
      eventType: "WagerRejectedEvent",
      payload: { reason: "INSUFFICIENT_FUNDS" },
      occurredAt: fiveSecondsAgo,
      attempts: 0,
      nextAttemptAt: fiveSecondsAgo,
      lockedUntil: null,
      publishedAt: null,
    });
    await repo.add(msg);

    const useCase = new PublishOutboxMessagesUseCase(uow, publisher, metrics);
    const now = new Date();
    const result = await useCase.execute({ now });

    expect(result.claimedCount).toBe(1);
    expect(result.publishedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.lagSeconds).toBeGreaterThanOrEqual(5);

    // Mensagem deve ter retentativa agendada:
    // attempts = 1 -> delay = min(1000 * 2^1, 60000) = 2000ms
    expect(msg.props.attempts).toBe(1);
    expect(msg.props.publishedAt).toBeNull();
    expect(msg.props.lockedUntil).toBeNull();
    expect(msg.props.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(now.getTime() + 1900);
  });

  it("isola falhas parciais em um lote", async () => {
    const repo = new FakeOutboxRepository();
    const uow = new FakeUnitOfWork(repo);
    const publisher = new FakePublisher();
    // Apenas ev-fail falha
    publisher.failPredicate = (m) => m.props.id === "ev-fail";

    const metrics = new OutboxMetrics(new Registry());
    const now = new Date();

    const okMsg = OutboxMessage.rehydrate({
      id: "ev-ok",
      aggregateId: "wallet-1",
      eventType: "WagerAcceptedEvent",
      payload: {},
      occurredAt: now,
      attempts: 0,
      nextAttemptAt: now,
      lockedUntil: null,
      publishedAt: null,
    });
    const failMsg = OutboxMessage.rehydrate({
      id: "ev-fail",
      aggregateId: "wallet-1",
      eventType: "WagerSettledEvent",
      payload: {},
      occurredAt: now,
      attempts: 0,
      nextAttemptAt: now,
      lockedUntil: null,
      publishedAt: null,
    });

    await repo.add(okMsg);
    await repo.add(failMsg);

    const useCase = new PublishOutboxMessagesUseCase(uow, publisher, metrics);
    const result = await useCase.execute({ now });

    expect(result.claimedCount).toBe(2);
    expect(result.publishedCount).toBe(1);
    expect(result.failedCount).toBe(1);

    expect(okMsg.props.publishedAt).not.toBeNull();
    expect(failMsg.props.publishedAt).toBeNull();
    expect(failMsg.props.attempts).toBe(1);
  });
});
