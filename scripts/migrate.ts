import { MikroORM } from "@mikro-orm/postgresql";
import { createOrmConfig } from "../src/infrastructure/persistence/mikro-orm/orm-config";

const action = process.argv[2] ?? "up";
const databaseUrl = process.env.DATABASE_URL ?? "postgres://wager:wager@localhost:5432/wager";

const orm = await MikroORM.init(createOrmConfig(databaseUrl));
try {
  if (action === "down") {
    const result = await orm.migrator.down();
    console.log(`[migrator] Migration revertida com sucesso.`, result);
  } else {
    const result = await orm.migrator.up();
    console.log(`[migrator] Migration aplicada com sucesso.`, result);
  }
} finally {
  await orm.close(true);
}
