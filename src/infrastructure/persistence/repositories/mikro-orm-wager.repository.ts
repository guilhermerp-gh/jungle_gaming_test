import { LockMode } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import type { WagerTransactionRepository } from "../../../application/ports/repositories.port";
import type { WagerTransaction } from "../../../domain/wagering/wager-transaction";
import { WagerTransactionMapper } from "../mappers";
import { WagerTransactionSchema } from "../schemas";

export class MikroOrmWagerTransactionRepository implements WagerTransactionRepository {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<WagerTransaction | null> {
    const r = await this.em.findOne(WagerTransactionSchema, { id }, { disableIdentityMap: true });
    return r ? WagerTransactionMapper.toDomain(r) : null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<WagerTransaction | null> {
    const r = await this.em.findOne(WagerTransactionSchema, { idempotencyKey }, { disableIdentityMap: true });
    return r ? WagerTransactionMapper.toDomain(r) : null;
  }

  async findByExternalId(providerId: string, externalTransactionId: string): Promise<WagerTransaction | null> {
    const r = await this.em.findOne(
      WagerTransactionSchema,
      { providerId, externalTransactionId },
      { disableIdentityMap: true },
    );
    return r ? WagerTransactionMapper.toDomain(r) : null;
  }

  async hasProcessedReversal(referenceTransactionId: string): Promise<boolean> {
    const count = await this.em.count(WagerTransactionSchema, {
      referenceTransactionId,
      kind: { $in: ["REFUND", "ROLLBACK"] },
      status: "PROCESSED",
    });
    return count > 0;
  }

  async insert(tx: WagerTransaction): Promise<void> {
    await this.em.insert(WagerTransactionSchema, WagerTransactionMapper.toRecord(tx));
  }

  async update(tx: WagerTransaction): Promise<void> {
    const record = WagerTransactionMapper.toRecord(tx);
    const { id, createdAt: _ignored, ...changes } = record;
    void _ignored;
    const affected = await this.em.nativeUpdate(WagerTransactionSchema, { id }, changes);
    if (affected !== 1) throw new Error(`WagerTransaction ${id} not found for update`);
  }

  async claimDuePendingReferences(now: Date, limit: number): Promise<WagerTransaction[]> {
    const rows = await this.em.find(
      WagerTransactionSchema,
      { status: "PENDING_REFERENCE", nextAttemptAt: { $lte: now } },
      {
        orderBy: { nextAttemptAt: "asc" },
        limit,
        // FOR UPDATE SKIP LOCKED: instâncias concorrentes pegam lotes disjuntos.
        lockMode: LockMode.PESSIMISTIC_PARTIAL_WRITE,
        disableIdentityMap: true,
      },
    );
    return rows.map((r) => WagerTransactionMapper.toDomain(r));
  }
}
