import { LockMode } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import type { WalletRepository } from "../../../application/ports/repositories.port";
import { ConcurrencyConflictError } from "../../../application/ports/unit-of-work.port";
import type { Wallet } from "../../../domain/wallet/wallet";
import { WalletMapper } from "../mappers";
import { WalletSchema } from "../schemas";

/**
 * Todas as leituras usam `disableIdentityMap`: escrevemos via `insert`/`nativeUpdate`
 * (sem flush), então o identity map poderia devolver um snapshot desatualizado.
 */
export class MikroOrmWalletRepository implements WalletRepository {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<Wallet | null> {
    const r = await this.em.findOne(WalletSchema, { id }, { disableIdentityMap: true });
    return r ? WalletMapper.toDomain(r) : null;
  }

  async findByIdForUpdate(id: string): Promise<Wallet | null> {
    const r = await this.em.findOne(
      WalletSchema,
      { id },
      { lockMode: LockMode.PESSIMISTIC_WRITE, disableIdentityMap: true },
    );
    return r ? WalletMapper.toDomain(r) : null;
  }

  async insert(wallet: Wallet): Promise<void> {
    await this.em.insert(WalletSchema, WalletMapper.toRecord(wallet));
  }

  async saveBalance(wallet: Wallet): Promise<void> {
    if (!wallet.balanceChanged) return;
    const affected = await this.em.nativeUpdate(
      WalletSchema,
      { id: wallet.id, version: wallet.loadedVersion },
      { balanceAmount: wallet.balance.amount, version: wallet.version, updatedAt: wallet.updatedAt },
    );
    if (affected !== 1) {
      throw new ConcurrencyConflictError(
        `Wallet ${wallet.id} version ${wallet.loadedVersion} changed concurrently`,
      );
    }
  }
}
