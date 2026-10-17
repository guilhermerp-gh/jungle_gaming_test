import type { EntityManager, MikroORM } from "@mikro-orm/postgresql";
import { AsyncLocalStorage } from "node:async_hooks";
import type { TransactionalRepositories, UnitOfWork } from "../../../application/ports/unit-of-work.port";
import { MikroOrmLedgerRepository } from "./mikro-orm-ledger.repository";
import { MikroOrmInboxRepository, MikroOrmOutboxRepository } from "./mikro-orm-messaging.repository";
import { MikroOrmWagerTransactionRepository } from "./mikro-orm-wager.repository";
import { MikroOrmWalletRepository } from "./mikro-orm-wallet.repository";

export function createRepositories(em: EntityManager): TransactionalRepositories {
  return {
    wallets: new MikroOrmWalletRepository(em),
    wagers: new MikroOrmWagerTransactionRepository(em),
    ledger: new MikroOrmLedgerRepository(em),
    inbox: new MikroOrmInboxRepository(em),
    outbox: new MikroOrmOutboxRepository(em),
  };
}

/**
 * Unit of Work sobre `em.transactional()`.
 * - Cada chamada de topo usa um fork isolado do EntityManager (nunca o contexto global).
 * - Chamadas aninhadas (dentro de `work`) reaproveitam a transação corrente via savepoint.
 * - Qualquer exceção em `work` provoca rollback total (inclusive locks liberados).
 */
export class MikroOrmUnitOfWork implements UnitOfWork {
  private readonly current = new AsyncLocalStorage<EntityManager>();

  constructor(private readonly orm: MikroORM) {}

  transactional<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
    const outer = this.current.getStore();
    const base = outer ?? this.orm.em.fork();
    return base.transactional((em) => this.current.run(em, () => work(createRepositories(em))));
  }
}
