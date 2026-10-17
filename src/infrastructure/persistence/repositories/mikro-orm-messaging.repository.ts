import { LockMode } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import type { InboxRepository, OutboxRepository } from "../../../application/ports/repositories.port";
import type { InboxMessage } from "../../../domain/messaging/inbox-message";
import type { OutboxMessage } from "../../../domain/messaging/outbox-message";
import { InboxMapper, OutboxMapper } from "../mappers";
import { InboxMessageSchema, OutboxMessageSchema } from "../schemas";

export class MikroOrmInboxRepository implements InboxRepository {
  constructor(private readonly em: EntityManager) {}

  async tryInsert(message: InboxMessage): Promise<boolean> {
    const p = message.props;
    const rows = await this.em.execute<{ message_id: string }[]>(
      `insert into inbox_messages (consumer_name, message_id, payload_hash, received_at, processed_at)
       values (?, ?, ?, ?, ?)
       on conflict (consumer_name, message_id) do nothing
       returning message_id`,
      [p.consumerName, p.messageId, p.payloadHash, p.receivedAt, p.processedAt],
    );
    return rows.length === 1;
  }

  async find(consumerName: string, messageId: string): Promise<InboxMessage | null> {
    const r = await this.em.findOne(InboxMessageSchema, { consumerName, messageId }, { disableIdentityMap: true });
    return r ? InboxMapper.toDomain(r) : null;
  }

  async markProcessed(message: InboxMessage): Promise<void> {
    const p = message.props;
    await this.em.nativeUpdate(
      InboxMessageSchema,
      { consumerName: p.consumerName, messageId: p.messageId },
      { processedAt: p.processedAt },
    );
  }
}

export class MikroOrmOutboxRepository implements OutboxRepository {
  constructor(private readonly em: EntityManager) {}

  async add(message: OutboxMessage): Promise<void> {
    await this.em.insert(OutboxMessageSchema, OutboxMapper.toRecord(message));
  }

  async claimBatch(now: Date, limit: number, leaseMs: number): Promise<OutboxMessage[]> {
    const rows = await this.em.find(
      OutboxMessageSchema,
      {
        publishedAt: null,
        nextAttemptAt: { $lte: now },
        $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
      },
      {
        orderBy: { occurredAt: "asc" },
        limit,
        // FOR UPDATE SKIP LOCKED: publishers concorrentes nunca pegam a mesma linha.
        lockMode: LockMode.PESSIMISTIC_PARTIAL_WRITE,
        disableIdentityMap: true,
      },
    );
    if (rows.length === 0) return [];

    const messages = rows.map((r) => OutboxMapper.toDomain(r));
    for (const m of messages) m.lease(now, leaseMs);
    const lockedUntil = messages[0]!.props.lockedUntil;
    await this.em.nativeUpdate(OutboxMessageSchema, { id: { $in: messages.map((m) => m.props.id) } }, { lockedUntil });
    return messages;
  }

  async save(message: OutboxMessage): Promise<void> {
    const p = message.props;
    await this.em.nativeUpdate(
      OutboxMessageSchema,
      { id: p.id },
      {
        attempts: p.attempts,
        nextAttemptAt: p.nextAttemptAt,
        lockedUntil: p.lockedUntil,
        publishedAt: p.publishedAt,
      },
    );
  }

  async getOldestPendingOccurredAt(): Promise<Date | null> {
    const row = await this.em.findOne(
      OutboxMessageSchema,
      { publishedAt: null },
      { orderBy: { occurredAt: "asc" }, fields: ["occurredAt"], disableIdentityMap: true },
    );
    return row ? row.occurredAt : null;
  }
}

