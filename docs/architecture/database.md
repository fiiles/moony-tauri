# Database Schema Reference

The single SQLCipher-encrypted SQLite database behind Moony. Schema is defined
entirely by the append-only migrations in `src-tauri/src/db/migrations.rs`,
starting from the squashed baseline `MIGRATION_001` ("001_baseline",
2026-08-06 — see `docs/plans/2026-08-06-migration-squash.md`). Domain grouping
below follows the domain map in `docs/architecture/overview.md`.

## How Migrations Work

- Migrations are **append-only inline SQL string consts** in
  `src-tauri/src/db/migrations.rs`. There are no `.sql` files.
- To add one: define `const MIGRATION_002: &str = r#"..."#;` (next free
  number) and append a `("002_short_name", MIGRATION_002)` entry to the `Vec`
  in `run_migrations()`. Numbers are zero-padded, sequential, never reused.
- Applied migrations are tracked by name in the `_migrations` table. On every
  DB open, `run_migrations()` executes any entry whose name is not yet
  recorded there — no manual step, no CLI.
- **Never edit a migration that has shipped**, including the baseline.
  Existing databases will not re-run it; the fix is always a new migration.
- The baseline is guarded by `golden_schema.snapshot` (same directory): a test
  asserts the migrated schema matches the fixture byte-for-byte. When a new
  migration intentionally changes the schema, regenerate the fixture with
  `cargo test regenerate_golden_schema -- --ignored` and commit it alongside.
- Databases created by Moony <= 1.3.0 (the historical 37-migration chain) are
  recognized by their `_migrations` entries: fully migrated ones are stamped
  as `001_baseline` without executing DDL; partially migrated ones get an
  error directing the user to open the DB with Moony 1.3.0 once first.
- SQLite has no `ALTER COLUMN` (can't change nullability, drop a column with
  constraints, etc.). The established workaround is
  **create-new → copy → drop → rename**: create `table_new` with the desired
  shape, `INSERT INTO ... SELECT` the data across, drop the old table (and its
  indexes), rename `table_new` back, recreate indexes. (The pre-squash chain
  used this in its migrations 027, 028, and 031 — see git history for worked
  examples.)

## Storage Conventions

- **Primary keys are TEXT UUIDs**, generated in Rust via
  `Uuid::new_v4().to_string()`. System-seeded rows use readable prefixed IDs
  instead (`cat_groceries`, `inst_fio`). The only exceptions:
  `user_profile.id` (`INTEGER PRIMARY KEY AUTOINCREMENT` — single-row table),
  `app_config.key` and `exchange_rates.currency` (natural TEXT keys), and
  composite-key join/history tables.
- **Timestamps are INTEGER unix epochs**, typically
  `INTEGER NOT NULL DEFAULT (unixepoch())` for `created_at` / `updated_at`.
- **All money and decimal values are TEXT strings** (`'0'`, `'1234.56'`) —
  balances, prices, quantities, rates. Parsed in Rust/TS at use time to avoid
  float drift. The **only exception**: `exchange_rates.rate` and
  `exchange_rate_history.rate` are `REAL`.
- **CZK is the base currency.** Aggregated values (e.g.
  `stock_value_history.value_czk`, `portfolio_metrics_history` totals) are
  stored in CZK; entity tables carry a `currency` column for native amounts.
- **Per-currency breakdowns are JSON strings in TEXT columns**, e.g. the seven
  `portfolio_metrics_history.*_by_currency` columns
  (`TEXT NOT NULL DEFAULT '{}'`). Other JSON-in-TEXT columns:
  `user_profile.menu_preferences`, `real_estate.recurring_costs` / `.photos`,
  `insurance_policies.limits`.
- **Paired override tables**: fetched market data lives in one table, manual
  user overrides in a sibling that wins at read time —
  `stock_data` + `stock_price_overrides`, `crypto_prices` +
  `crypto_price_overrides`, `dividend_data` + `dividend_overrides`.
- **History tables use `(date, key)` UNIQUE constraints** so backfills upsert
  instead of duplicating: `stock_value_history` / `crypto_value_history`
  `UNIQUE(ticker, recorded_at)`, `exchange_rate_history`
  `PRIMARY KEY (date, currency)`, `bank_transactions`
  `UNIQUE(bank_account_id, transaction_id)`.

## Table Catalog

Grouped by owning domain (see the domain map in `overview.md`). "Since" is the
migration that introduced the table.

### Infrastructure

| Table | Since | Purpose | Notable columns / constraints |
|---|---|---|---|
| `_migrations` | bootstrap | Tracks applied migrations by name | `name TEXT UNIQUE`, `applied_at`; created directly in `run_migrations()`, not in a migration const |

### Auth / profile

| Table | Since | Purpose | Notable columns / constraints |
|---|---|---|---|
| `app_config` | 001 | Key-value app settings incl. recovery-key hash | `key TEXT PRIMARY KEY`, `value TEXT` |
| `user_profile` | 001 | Single-row user profile and preferences | `INTEGER AUTOINCREMENT` PK (convention exception); `currency DEFAULT 'CZK'`, `language` (012), `menu_preferences` JSON, `coingecko_modal_dismissed` (033), `mcp_server_enabled` (036) gates the local API server |

### Bank accounts

| Table | Since | Purpose | Notable columns / constraints |
|---|---|---|---|
| `institutions` | 015 | Banks/financial institutions, pre-seeded with Czech banks | Readable seeded IDs (`inst_fio`, `inst_csob`, …); `bic`, `logo_url` |
| `bank_accounts` | 015 | All bank/savings accounts (superseded `savings_accounts`; rows migrated preserving IDs) | `account_type DEFAULT 'checking'`, `institution_id` FK, `iban`/`bban`, `data_source DEFAULT 'manual'`, `has_zone_designation`, `exclude_from_balance`, `interest_rate` TEXT |
| `bank_account_zones` | 032 | Tiered interest-rate zones per account | FK `bank_account_id` ON DELETE CASCADE; `from_amount`/`to_amount`/`interest_rate` TEXT; valid rows copied from `savings_account_zones` |
| `bank_transactions` | 015 | Imported/manual bank transactions | `UNIQUE(bank_account_id, transaction_id)` dedupes imports; `category_id` FK, `categorization_source` (021), `import_batch_id` FK ON DELETE CASCADE (016), `variable_symbol`; indexes on account, date, category, batch |
| `csv_import_presets` | 015 | Per-bank CSV parsing configuration | `delimiter`, `encoding`, `skip_rows`, `date_format`, column mappings; `is_system` |
| `csv_import_batches` | 016 | One row per CSV upload with import stats | FK `bank_account_id` ON DELETE CASCADE; `imported_count`/`duplicate_count`/`error_count` |

### Categorization

| Table | Since | Purpose | Notable columns / constraints |
|---|---|---|---|
| `transaction_categories` | 015 | Spending categories, system-seeded + user-defined | Readable seeded IDs (`cat_groceries`, …); self-referencing `parent_id` FK, `is_system`, `sort_order`; seed rows adjusted in 022–024, 029 |
| `categorization_rules` | 021 | Priority-ordered pattern rules (supersedes `transaction_rules`) | `rule_type`/`pattern`, `priority DEFAULT 50` (index `priority DESC, is_active`), `stop_processing`, `iban_pattern` + `variable_symbol` (030) for compound matching |
| `learned_payees` | 021 | Learned payee → category mappings for auto-categorization | Rebuilt twice (027: nullable payee for IBAN-only rules; 028: `variable_symbol` dropped); UNIQUE index `(normalized_payee, counterparty_iban)`; partial indexes for the 3-level matching hierarchy |

### Budgeting

| Table | Since | Purpose | Notable columns / constraints |
|---|---|---|---|
| `budget_goals` | 025 | Spending limit per category per timeframe | `UNIQUE(category_id, timeframe)`; `timeframe` ∈ monthly/quarterly/yearly; `amount` TEXT; FK ON DELETE CASCADE |

### Stocks

| Table | Since | Purpose | Notable columns / constraints |
|---|---|---|---|
| `stock_investments` | 001 | One row per held ticker (position) | `ticker TEXT UNIQUE`; `quantity`/`average_price` TEXT; `currency` (020, backfilled from first transaction) |
| `investment_transactions` | 001 | Buy/sell transactions per stock position | FK `investment_id` ON DELETE CASCADE; `type`, `price_per_unit`, `currency`, `transaction_date` |
| `stock_data` | 001 (as `stock_prices`, renamed in 013) | Fetched Yahoo Finance quote + company metadata cache | `ticker UNIQUE`; 013 added `sector`, `industry`, `pe_ratio`, `market_cap`, `beta`, 52-week range, dividend fields, `metadata_fetched_at` |
| `stock_price_overrides` | 001 | Manual price overrides (win over `stock_data`) | `ticker UNIQUE`; `currency DEFAULT 'CZK'` |
| `dividend_data` | 001 | Fetched yearly dividend sums per ticker | `ticker UNIQUE`; `yearly_dividend_sum` TEXT |
| `dividend_overrides` | 001 | Manual dividend overrides (win over `dividend_data`) | `ticker UNIQUE` |
| `stock_tags` | 017 | User tags for grouping investments | `name UNIQUE`; `group_id` FK ON DELETE SET NULL (018) |
| `stock_investment_tags` | 017 | Investment ↔ tag many-to-many join | Composite PK `(investment_id, tag_id)`; both FKs ON DELETE CASCADE |
| `stock_tag_groups` | 018 | Optional grouping of tags (e.g. "Strategy") | `name UNIQUE` |
| `stock_value_history` | 019 | Daily CZK value per ticker (also feeds portfolio trend) | `UNIQUE(ticker, recorded_at)`; `value_czk`, native `price`+`currency`, `is_stale` (035) |

### Crypto

| Table | Since | Purpose | Notable columns / constraints |
|---|---|---|---|
| `crypto_investments` | 001 | One row per held crypto asset | `ticker UNIQUE`, `coingecko_id`; `currency` (020) |
| `crypto_transactions` | 001 | Buy/sell transactions per crypto position | FK `investment_id` ON DELETE CASCADE |
| `crypto_prices` | 001 | Fetched CoinGecko price cache | `symbol UNIQUE`; `coingecko_id` |
| `crypto_price_overrides` | 014 | Manual price overrides (win over `crypto_prices`) | `symbol UNIQUE`; subject of the out-of-band repair at `migrations.rs:80-94` |
| `crypto_value_history` | 019 | Daily CZK value per crypto ticker (also feeds portfolio trend) | `UNIQUE(ticker, recorded_at)`; `value_czk`, `is_stale` (035) |

### Bonds

| Table | Since | Purpose | Notable columns / constraints |
|---|---|---|---|
| `bonds` | 001 | Bond holdings | `isin` nullable (rebuilt in 031); `coupon_value`, `interest_rate`, `quantity` (011), `currency` (002), `maturity_date` |

### Loans

| Table | Since | Purpose | Notable columns / constraints |
|---|---|---|---|
| `loans` | 001 | Loans/mortgages | `principal`, `monthly_payment`, `interest_rate` + `interest_rate_validity_date`, `start_date`/`end_date` |

### Real estate

| Table | Since | Purpose | Notable columns / constraints |
|---|---|---|---|
| `real_estate` | 001 | Properties (personal or investment) | `type`; purchase/market price each with own currency column; `monthly_rent`; `recurring_costs` JSON `'[]'`, `photos` JSON `'[]'` |
| `real_estate_one_time_costs` | 001 | One-off costs per property | FK `real_estate_id` ON DELETE CASCADE; `amount` TEXT, `date` |
| `real_estate_loans` | 001 | Property ↔ loan join | Composite PK `(real_estate_id, loan_id)`; both FKs ON DELETE CASCADE |
| `real_estate_insurances` | 001 | Property ↔ insurance policy join | Composite PK `(real_estate_id, insurance_id)`; both FKs ON DELETE CASCADE |
| `real_estate_photo_batches` | 004 | Photo uploads grouped by date + description | FK `real_estate_id` ON DELETE CASCADE; indexed |
| `real_estate_photos` | 004 | Individual photos in a batch | FK `batch_id` ON DELETE CASCADE; `file_path` + `thumbnail_path` |
| `real_estate_documents` | 010 | Documents (deeds, contracts) per property | FK `real_estate_id` ON DELETE CASCADE; `file_path`, `file_type`, `file_size` |

### Insurance

| Table | Since | Purpose | Notable columns / constraints |
|---|---|---|---|
| `insurance_policies` | 001 | Insurance policies | `type`, `provider`, `payment_frequency`, one-time + regular payment each with currency column, `limits` JSON `'[]'`, `status DEFAULT 'active'` |
| `insurance_documents` | 005 | Documents per policy | FK `insurance_id` ON DELETE CASCADE; `file_path`, `file_type`, `file_size` |

### Other assets

| Table | Since | Purpose | Notable columns / constraints |
|---|---|---|---|
| `other_assets` | 001 | Miscellaneous assets (gold, art, …) | `quantity`, `market_price`, `average_purchase_price` TEXT; `yield_type DEFAULT 'none'` + `yield_value` |
| `other_asset_transactions` | 001 | Buy/sell transactions per other asset | FK `asset_id` ON DELETE CASCADE |

### Portfolio / net worth

| Table | Since | Purpose | Notable columns / constraints |
|---|---|---|---|
| `portfolio_metrics_history` | 001 | Daily net-worth snapshots per asset class | Totals as CZK TEXT (`total_savings`, `total_loans_principal`, …, `total_other_assets` added 003); `is_stale` (035); seven `*_by_currency` JSON TEXT `DEFAULT '{}'` (037); `source` TEXT `'live'`/`'backfill'` provenance (002 post-squash — live rows are authentic records, backfill rows may be rebuilt) |
| `entity_history` | 001 | Generic per-entity value history (`entity_type` + `entity_id`) — **orphaned: no code reads or writes it** (see Deprecated section) | `value` TEXT, `recorded_at` |

(`stock_value_history` and `crypto_value_history` above also feed this domain's trend charts.)

### Currency

| Table | Since | Purpose | Notable columns / constraints |
|---|---|---|---|
| `exchange_rates` | 034 | Latest ECB rates persisted for offline use | `currency TEXT PRIMARY KEY`; **`rate REAL`** (money-as-TEXT exception) |
| `exchange_rate_history` | 037 | Daily historical rates for accurate backfills | `PRIMARY KEY (date, currency)`; **`rate REAL`**; index `(currency, date)` |

### Cashflow / projection

| Table | Since | Purpose | Notable columns / constraints |
|---|---|---|---|
| `cashflow_items` | 007 | User-defined recurring income/expense items | `amount` TEXT, `frequency`, `item_type`, `category` (008) |
| `projection_settings` | 009 | Growth/contribution assumptions per asset class | `asset_type UNIQUE`; `yearly_growth_rate`, `monthly_contribution` TEXT |

## ⚠️ Deprecated Tables — Never Write Features Against These

These tables still exist in old databases (migrations are append-only, so they
are never dropped) but are dead. Do not read from or write to them in new code.

| Table | Superseded by | Notes |
|---|---|---|
| `savings_accounts` | `bank_accounts` | Migration 015 copied all rows into `bank_accounts` (IDs preserved, `account_type = 'savings'`) |
| `savings_account_zones` | `bank_account_zones` | Migration 032 copied valid rows across |
| `instruments` | `stock_investments` | Legacy pre-1.0 investment model, "kept for compatibility" |
| `purchases` | `investment_transactions` | Legacy companion of `instruments` |
| `transaction_rules` | `categorization_rules` | Replaced by the enhanced rules table in migration 021 |
| `entity_history` | — (never used) | Created in migration 001 but referenced by no Rust or frontend code since; history/backfill actually uses `portfolio_metrics_history`, `stock_value_history`, and `crypto_value_history` |
