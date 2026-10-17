import type {
  InboxRepository,
  LedgerRepository,
  OutboxRepository,
  WagerTransactionRepository,
  WalletRepository,
} from "./repositories.port";

/** Repositórios vinculados a uma única transação SQL. */
export interface TransactionalRepositories {
  wallets: WalletRepository;
  wagers: WagerTransactionRepository;
  ledger: LedgerRepository;
  inbox: InboxRepository;
  outbox: OutboxRepository;
}

export interface UnitOfWork {
  /**
   * Executa `work` dentro de uma transação. Commit se resolver; rollback total se lançar.
   * Chamadas aninhadas reutilizam a transação externa (savepoint fica a cargo da implementação).
   */
  transactional<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T>;
}

/** `UPDATE ... WHERE version = ?` não afetou linhas: outra escrita ocorreu sem lock. */
export class ConcurrencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConcurrencyConflictError";
  }
}
