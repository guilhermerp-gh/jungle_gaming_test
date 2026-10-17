import { Migration } from "@mikro-orm/migrations";

/**
 * Schema inicial. As invariantes financeiras são garantidas PELO BANCO (última barreira),
 * independentemente do código da aplicação:
 *  - saldo nunca negativo (CHECK);
 *  - idempotência persistente (UNIQUE idempotency_key / provider+external_id);
 *  - reversão única por referência (UNIQUE parcial);
 *  - ledger append-only (trigger bloqueia UPDATE/DELETE);
 *  - aritmética do ledger (CHECK balance_after = balance_before ± amount);
 *  - estados terminais de transação imutáveis (trigger).
 */
export class Migration20261017000001_InitialSchema extends Migration {
  override async up(): Promise<void> {
    // ---------- enums ----------
    this.addSql(`create type wager_kind as enum ('OPENING', 'BET', 'WIN', 'LOSS', 'REFUND', 'ROLLBACK');`);
    this.addSql(
      `create type wager_status as enum ('PENDING', 'PENDING_REFERENCE', 'PROCESSED', 'REJECTED', 'FAILED');`,
    );
    this.addSql(`create type ledger_direction as enum ('CREDIT', 'DEBIT');`);

    // ---------- wallets ----------
    this.addSql(`
      create table wallets (
        id              uuid           primary key,
        player_id       uuid           not null,
        currency        char(3)        not null,
        balance_amount  numeric(20,2)  not null,
        version         integer        not null,
        created_at      timestamptz    not null default now(),
        updated_at      timestamptz    not null default now(),
        constraint ux_wallets_player_currency unique (player_id, currency),
        constraint ck_wallets_balance_non_negative check (balance_amount >= 0),
        constraint ck_wallets_version_positive check (version >= 1),
        constraint ck_wallets_currency_format check (currency ~ '^[A-Z]{3}$')
      );`);

    // ---------- wager_transactions ----------
    this.addSql(`
      create table wager_transactions (
        id                                 uuid           primary key,
        provider_id                        text           not null,
        external_transaction_id            text           not null,
        idempotency_key                    text           not null,
        payload_hash                       char(64)       not null,
        wallet_id                          uuid           not null references wallets (id),
        player_id                          uuid           not null,
        round_id                           text           not null,
        game_id                            text           not null,
        kind                               wager_kind     not null,
        amount                             numeric(20,2)  not null,
        currency                           char(3)        not null,
        reference_external_transaction_id  text           null,
        reference_transaction_id           uuid           null references wager_transactions (id),
        status                             wager_status   not null,
        failure_code                       text           null,
        result_balance_amount              numeric(20,2)  null,
        attempts                           integer        not null default 0,
        next_attempt_at                    timestamptz    null,
        processed_at                       timestamptz    null,
        created_at                         timestamptz    not null default now(),
        updated_at                         timestamptz    not null default now(),
        constraint ux_wager_idempotency_key unique (idempotency_key),
        constraint ux_wager_provider_external unique (provider_id, external_transaction_id),
        constraint ck_wager_amount_positive check (amount > 0),
        constraint ck_wager_result_balance_non_negative check (result_balance_amount is null or result_balance_amount >= 0),
        constraint ck_wager_attempts_non_negative check (attempts >= 0),
        constraint ck_wager_reversal_requires_reference
          check (kind not in ('REFUND', 'ROLLBACK') or reference_external_transaction_id is not null),
        constraint ck_wager_processed_reversal_resolved
          check (kind not in ('REFUND', 'ROLLBACK') or status <> 'PROCESSED' or reference_transaction_id is not null),
        constraint ck_wager_failure_code check (status not in ('REJECTED', 'FAILED') or failure_code is not null),
        constraint ck_wager_processed_at check (status <> 'PROCESSED' or processed_at is not null),
        constraint ck_wager_pending_ref_scheduled check (status <> 'PENDING_REFERENCE' or next_attempt_at is not null)
      );`);

    // Uma referência só pode ser revertida UMA vez no total (REFUND ou ROLLBACK).
    this.addSql(`
      create unique index ux_single_reversal on wager_transactions (reference_transaction_id)
        where kind in ('REFUND', 'ROLLBACK') and status = 'PROCESSED';`);
    this.addSql(`
      create index ix_pending_ref on wager_transactions (next_attempt_at)
        where status = 'PENDING_REFERENCE';`);
    this.addSql(`
      create index ix_ref_lookup on wager_transactions (provider_id, reference_external_transaction_id)
        where reference_external_transaction_id is not null;`);
    this.addSql(`create index ix_wager_wallet on wager_transactions (wallet_id, created_at);`);

    // Estado terminal (PROCESSED/REJECTED/FAILED) é imutável.
    this.addSql(`
      create function fn_wager_tx_terminal_state() returns trigger
      language plpgsql as $$
      begin
        if old.status in ('PROCESSED', 'REJECTED', 'FAILED') and new is distinct from old then
          raise exception 'wager_transaction % is in terminal state % and cannot be modified', old.id, old.status
            using errcode = 'integrity_constraint_violation';
        end if;
        return new;
      end;
      $$;`);
    this.addSql(`
      create trigger trg_wager_tx_terminal_state
        before update on wager_transactions
        for each row execute function fn_wager_tx_terminal_state();`);

    // ---------- wallet_ledger_entries (append-only) ----------
    this.addSql(`
      create table wallet_ledger_entries (
        id              uuid              primary key,
        seq             bigserial         not null,
        wallet_id       uuid              not null references wallets (id),
        transaction_id  uuid              not null references wager_transactions (id),
        direction       ledger_direction  not null,
        amount          numeric(20,2)     not null,
        currency        char(3)           not null,
        balance_before  numeric(20,2)     not null,
        balance_after   numeric(20,2)     not null,
        created_at      timestamptz       not null default now(),
        constraint ux_ledger_seq unique (seq),
        constraint ux_ledger_tx_wallet unique (transaction_id, wallet_id),
        constraint ck_ledger_amount_positive check (amount > 0),
        constraint ck_ledger_balance_before_non_negative check (balance_before >= 0),
        constraint ck_ledger_balance_after_non_negative check (balance_after >= 0),
        constraint ck_ledger_arithmetic check (
          (direction = 'CREDIT' and balance_after = balance_before + amount)
          or (direction = 'DEBIT' and balance_after = balance_before - amount)
        )
      );`);
    this.addSql(`create index ix_ledger_wallet_seq on wallet_ledger_entries (wallet_id, seq);`);

    this.addSql(`
      create function fn_ledger_immutable() returns trigger
      language plpgsql as $$
      begin
        raise exception 'wallet_ledger_entries is append-only: % is not allowed', tg_op
          using errcode = 'integrity_constraint_violation';
      end;
      $$;`);
    this.addSql(`
      create trigger trg_ledger_entries_immutable
        before update or delete on wallet_ledger_entries
        for each row execute function fn_ledger_immutable();`);

    // ---------- inbox_messages ----------
    this.addSql(`
      create table inbox_messages (
        consumer_name  text         not null,
        message_id     text         not null,
        payload_hash   char(64)     not null,
        received_at    timestamptz  not null default now(),
        processed_at   timestamptz  null,
        primary key (consumer_name, message_id)
      );`);

    // ---------- outbox_messages ----------
    this.addSql(`
      create table outbox_messages (
        id               uuid         primary key,
        aggregate_id     uuid         not null,
        event_type       text         not null,
        payload          jsonb        not null,
        occurred_at      timestamptz  not null,
        attempts         integer      not null default 0,
        next_attempt_at  timestamptz  not null,
        locked_until     timestamptz  null,
        published_at     timestamptz  null,
        constraint ck_outbox_attempts_non_negative check (attempts >= 0)
      );`);
    this.addSql(`
      create index ix_outbox_pending on outbox_messages (next_attempt_at)
        where published_at is null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists outbox_messages;`);
    this.addSql(`drop table if exists inbox_messages;`);
    this.addSql(`drop trigger if exists trg_ledger_entries_immutable on wallet_ledger_entries;`);
    this.addSql(`drop table if exists wallet_ledger_entries;`);
    this.addSql(`drop function if exists fn_ledger_immutable();`);
    this.addSql(`drop trigger if exists trg_wager_tx_terminal_state on wager_transactions;`);
    this.addSql(`drop table if exists wager_transactions;`);
    this.addSql(`drop function if exists fn_wager_tx_terminal_state();`);
    this.addSql(`drop table if exists wallets;`);
    this.addSql(`drop type if exists ledger_direction;`);
    this.addSql(`drop type if exists wager_status;`);
    this.addSql(`drop type if exists wager_kind;`);
  }
}
