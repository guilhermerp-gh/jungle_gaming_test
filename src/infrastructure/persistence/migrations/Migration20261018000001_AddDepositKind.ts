import { Migration } from "@mikro-orm/migrations";

export class Migration20261018000001_AddDepositKind extends Migration {
  override isTransactional(): boolean {
    return false;
  }

  async up(): Promise<void> {
    this.addSql(`alter type wager_kind add value if not exists 'DEPOSIT';`);
  }

  override async down(): Promise<void> {
    // PostgreSQL enum values cannot be dropped safely without recreating the type.
  }
}
