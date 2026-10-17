import type { EntityManager } from "@mikro-orm/postgresql";
import type {
  LedgerPageItem,
  LedgerRepository,
  LedgerTotals,
} from "../../../application/ports/repositories.port";
import type { WalletLedgerEntry } from "../../../domain/ledger/wallet-ledger-entry";
import { LedgerMapper } from "../mappers";
import { WalletLedgerEntrySchema } from "../schemas";

/** Append-only: não existe (e não deve existir) método de update/delete. */
export class MikroOrmLedgerRepository implements LedgerRepository {
  constructor(private readonly em: EntityManager) {}

  async append(entry: WalletLedgerEntry): Promise<void> {
    await this.em.insert(WalletLedgerEntrySchema, LedgerMapper.toRecord(entry));
  }

  async findByTransactionId(transactionId: string): Promise<WalletLedgerEntry | null> {
    const r = await this.em.findOne(WalletLedgerEntrySchema, { transactionId }, { disableIdentityMap: true });
    return r ? LedgerMapper.toDomain(r) : null;
  }

  async listByWallet(walletId: string, opts: { afterSeq?: string; limit: number }): Promise<LedgerPageItem[]> {
    const rows = await this.em.find(
      WalletLedgerEntrySchema,
      opts.afterSeq ? { walletId, seq: { $gt: opts.afterSeq } } : { walletId },
      { orderBy: { seq: "asc" }, limit: opts.limit, disableIdentityMap: true },
    );
    return rows.map((r) => ({ seq: String(r.seq), entry: LedgerMapper.toDomain(r) }));
  }

  async totals(walletId: string): Promise<LedgerTotals> {
    // Somatório em NUMERIC no banco, devolvido como texto com escala 2.
    const rows = await this.em.execute<{ credits: string; debits: string; entries: string }[]>(
      `select
         coalesce(sum(amount) filter (where direction = 'CREDIT'), 0)::numeric(20,2)::text as credits,
         coalesce(sum(amount) filter (where direction = 'DEBIT'), 0)::numeric(20,2)::text  as debits,
         count(*)::text as entries
       from wallet_ledger_entries
       where wallet_id = ?`,
      [walletId],
    );
    const row = rows[0];
    return {
      credits: row?.credits ?? "0.00",
      debits: row?.debits ?? "0.00",
      entries: Number(row?.entries ?? "0"),
    };
  }
}
