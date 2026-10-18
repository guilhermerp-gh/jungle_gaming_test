import { Migrator } from "@mikro-orm/migrations";
import { defineConfig } from "@mikro-orm/postgresql";
import { fileURLToPath } from "node:url";
import { Migration20261017000001_InitialSchema } from "../migrations/Migration20261017000001_InitialSchema";
import { Migration20261018000001_AddDepositKind } from "../migrations/Migration20261018000001_AddDepositKind";
import { ALL_SCHEMAS } from "../schemas";

const migrationsDir = fileURLToPath(new URL("../migrations", import.meta.url));

/**
 * Lista explícita de migrations (em vez de glob): determinística e compatível com o Bun.
 * Ao criar uma nova migration, registre-a aqui.
 */
export const MIGRATIONS = [
  { name: "Migration20261017000001_InitialSchema", class: Migration20261017000001_InitialSchema },
  { name: "Migration20261018000001_AddDepositKind", class: Migration20261018000001_AddDepositKind },
];

export function createOrmConfig(databaseUrl: string | undefined = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  return defineConfig({
    clientUrl: databaseUrl,
    entities: ALL_SCHEMAS,
    extensions: [Migrator],
    // Nunca usar o EntityManager global: cada operação usa um fork/transação explícita.
    allowGlobalContext: false,
    debug: process.env.MIKRO_ORM_DEBUG === "true",
    pool: { min: 0, max: Number(process.env.DB_POOL_MAX ?? 10) },
    migrations: {
      tableName: "mikro_orm_migrations",
      path: migrationsDir,
      pathTs: migrationsDir,
      migrationsList: MIGRATIONS,
      transactional: true,
      allOrNothing: false,
      snapshot: false,
      emit: "ts",
    },
  });
}
