import { MikroORM } from "@mikro-orm/postgresql";
import { randomUUID } from "node:crypto";
import { MikroOrmUnitOfWork } from "../../src/infrastructure/persistence/repositories/mikro-orm-uow";
import { createOrmConfig } from "../../src/infrastructure/persistence/mikro-orm/orm-config";
import { Money } from "../../src/domain/money/money";
import { WagerTransaction, type WagerKind } from "../../src/domain/wagering/wager-transaction";
import { Wallet } from "../../src/domain/wallet/wallet";
import type { UnitOfWork } from "../../src/application/ports/unit-of-work.port";

/**
 * Banco de teste ISOLADO. Os testes de integração criam `wager_test` do zero, aplicam as
 * migrations nele e o removem ao final. O banco de desenvolvimento (`wager`) nunca é alterado.
 */
const BASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgres://wager:wager@localhost:5432/wager";
const TEST_DB = process.env.TEST_DB_NAME ?? "wager_test";

function withDatabase(url: string, db: string): string {
  const u = new URL(url);
  u.pathname = `/${db}`;
  return u.toString();
}

export const TEST_DATABASE_URL = withDatabase(BASE_URL, TEST_DB);

async function admin<T>(fn: (orm: MikroORM) => Promise<T>): Promise<T> {
  const orm = await MikroORM.init({
    ...createOrmConfig(withDatabase(BASE_URL, "postgres")),
    entities: [],
    discovery: { warnWhenNoEntities: false },
  });
  try {
    return await fn(orm);
  } finally {
    await orm.close(true);
  }
}

export interface TestDb {
  orm: MikroORM;
  uow: UnitOfWork;
  /** SQL raw fora de transação (simula acesso direto ao banco). */
  sql<T = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

export async function setupTestDb(): Promise<TestDb> {
  if (!/test/i.test(TEST_DB)) throw new Error(`Refusing to use non-test database "${TEST_DB}"`);
  await admin(async (orm) => {
    await orm.em.fork().execute(`drop database if exists "${TEST_DB}" with (force)`);
    await orm.em.fork().execute(`create database "${TEST_DB}"`);
  });

  const orm = await MikroORM.init(createOrmConfig(TEST_DATABASE_URL));
  await orm.migrator.up();

  return {
    orm,
    uow: new MikroOrmUnitOfWork(orm),
    sql: <T>(query: string, params: unknown[] = []) => orm.em.fork().execute<T[]>(query, params),
    async close() {
      await orm.close(true);
      await admin(async (a) => {
        await a.em.fork().execute(`drop database if exists "${TEST_DB}" with (force)`);
      });
    },
  };
}

/** TRUNCATE não dispara triggers de linha, por isso é permitido para limpar entre testes. */
export async function resetData(db: TestDb): Promise<void> {
  await db.sql(
    `truncate table outbox_messages, inbox_messages, wallet_ledger_entries, wager_transactions, wallets restart identity cascade`,
  );
}

export const uuid = (): string => randomUUID();
export const hash = (seed = "a"): string => seed.repeat(64).slice(0, 64);
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Cria wallet + transação OPENING + lançamento CREDIT na mesma transação. */
export async function seedWallet(uow: UnitOfWork, balance = "100.00", currency = "BRL") {
  const now = new Date();
  const wallet = Wallet.open({ id: uuid(), playerId: uuid(), currency, now });
  const opening = WagerTransaction.create({
    id: uuid(),
    providerId: "internal",
    externalTransactionId: `opening-${wallet.id}`,
    idempotencyKey: `opening-${wallet.id}`,
    payloadHash: hash("0"),
    walletId: wallet.id,
    playerId: wallet.playerId,
    roundId: "opening",
    gameId: "internal",
    kind: "OPENING",
    money: Money.from(balance, currency),
    referenceExternalTransactionId: null,
    now,
  });
  const entry = wallet.credit({ ledgerId: uuid(), transactionId: opening.id, amount: opening.props.money, now });
  opening.markProcessed(wallet.balance, now);

  await uow.transactional(async (r) => {
    await r.wallets.insert(wallet);
    await r.wagers.insert(opening);
    await r.ledger.append(entry);
  });
  return { wallet, opening, entry };
}

export function newWager(
  wallet: Wallet,
  kind: WagerKind,
  amount: string,
  extra: Partial<{ ref: string | null; refId: string | null; externalId: string; key: string }> = {},
): WagerTransaction {
  const externalId = extra.externalId ?? `ext-${uuid()}`;
  return WagerTransaction.create({
    id: uuid(),
    providerId: "provider-a",
    externalTransactionId: externalId,
    idempotencyKey: extra.key ?? `key-${externalId}`,
    payloadHash: hash("b"),
    walletId: wallet.id,
    playerId: wallet.playerId,
    roundId: "round-1",
    gameId: "game-1",
    kind,
    money: Money.from(amount, wallet.currency),
    referenceExternalTransactionId: extra.ref ?? null,
    referenceTransactionId: extra.refId ?? null,
    now: new Date(),
  });
}
