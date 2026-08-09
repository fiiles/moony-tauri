//! Database migrations for Moony
//!
//! The schema was squashed to a single baseline on 2026-08-06 (see
//! docs/plans/2026-08-06-migration-squash.md). The baseline reproduces the
//! exact schema of the historical 37-migration chain (verified against
//! `golden_schema.snapshot` by tests below).
//!
//! Rules (docs/playbooks/add-db-migration.md):
//! - Migrations are append-only from the baseline: next number + Vec entry.
//! - Never edit an applied migration, including the baseline.
//!
//! Legacy databases created by Moony <= 1.3.0 (pre-squash chain) are detected
//! by their `_migrations` entries. A fully migrated legacy database has a
//! schema identical to the baseline, so it is stamped as baseline without
//! executing any DDL. Partially migrated legacy databases must be opened with
//! Moony 1.3.0 once to finish the old chain first.

use crate::error::{AppError, Result};
use rusqlite::Connection;

const BASELINE_NAME: &str = "001_baseline";
/// Final migration of the pre-squash chain (Moony <= 1.3.0)
const LEGACY_FINAL_MIGRATION: &str = "037_multicurrency";

/// Run all database migrations
pub fn run_migrations(conn: &Connection) -> Result<()> {
    // Create migrations table to track applied migrations
    conn.execute(
        "CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            applied_at INTEGER NOT NULL DEFAULT (unixepoch())
        )",
        [],
    )?;

    let applied: Vec<String> = {
        let mut stmt = conn.prepare("SELECT name FROM _migrations")?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        rows.filter_map(|r| r.ok()).collect()
    };

    let migrations: Vec<(&str, &str)> = vec![
        (BASELINE_NAME, MIGRATION_001),
        ("002_snapshot_provenance", MIGRATION_002),
    ];

    // Legacy chain handling (databases created by Moony <= 1.3.0)
    let legacy_names: Vec<&String> = applied
        .iter()
        .filter(|name| !migrations.iter().any(|(n, _)| n == *name))
        .collect();
    if !legacy_names.is_empty() {
        if applied.iter().any(|n| n == LEGACY_FINAL_MIGRATION) {
            // Fully migrated legacy database: schema is identical to the
            // baseline by construction, so stamp it instead of executing DDL.
            if !applied.iter().any(|n| n == BASELINE_NAME) {
                println!("[MIGRATION] Legacy database detected; stamping {BASELINE_NAME}");
                conn.execute(
                    "INSERT INTO _migrations (name) VALUES (?1)",
                    [BASELINE_NAME],
                )?;
            }
        } else {
            return Err(AppError::Database(format!(
                "This database was created by an older Moony version and is only \
                 migrated up to {:?}. Open it with Moony 1.3.0 once to finish the \
                 legacy migrations, then upgrade.",
                legacy_names
                    .last()
                    .map(|s| s.as_str())
                    .unwrap_or("<unknown>")
            )));
        }
    }

    let applied: Vec<String> = {
        let mut stmt = conn.prepare("SELECT name FROM _migrations")?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        rows.filter_map(|r| r.ok()).collect()
    };

    for (name, sql) in migrations {
        if !applied.contains(&name.to_string()) {
            println!("[MIGRATION] Applying: {}", name);
            conn.execute_batch(sql)?;
            conn.execute("INSERT INTO _migrations (name) VALUES (?1)", [name])?;
            println!("[MIGRATION] Applied: {}", name);
        }
    }

    Ok(())
}

/// Baseline schema — squashed from the historical migrations 001-037.
/// Generated from golden_schema.snapshot; do not edit (append a new migration instead).
const MIGRATION_001: &str = r#"
-- Tables
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bank_account_zones (
    id TEXT PRIMARY KEY,
    bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    from_amount TEXT NOT NULL,
    to_amount TEXT,
    interest_rate TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS bank_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'checking',
    iban TEXT,
    bban TEXT,
    currency TEXT NOT NULL DEFAULT 'CZK',
    balance TEXT NOT NULL DEFAULT '0',
    institution_id TEXT REFERENCES institutions(id),
    external_account_id TEXT,
    data_source TEXT NOT NULL DEFAULT 'manual',
    last_synced_at INTEGER,
    interest_rate TEXT,
    has_zone_designation INTEGER NOT NULL DEFAULT 0,
    termination_date INTEGER,
    exclude_from_balance INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS bank_transactions (
    id TEXT PRIMARY KEY,
    bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    transaction_id TEXT,
    tx_type TEXT NOT NULL,
    amount TEXT NOT NULL,
    currency TEXT NOT NULL,
    description TEXT,
    counterparty_name TEXT,
    counterparty_iban TEXT,
    booking_date INTEGER NOT NULL,
    value_date INTEGER,
    category_id TEXT REFERENCES transaction_categories(id),
    merchant_category_code TEXT,
    remittance_info TEXT,
    variable_symbol TEXT,
    status TEXT NOT NULL DEFAULT 'booked',
    data_source TEXT NOT NULL DEFAULT 'manual',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()), import_batch_id TEXT REFERENCES csv_import_batches(id) ON DELETE CASCADE, categorization_source TEXT,
    UNIQUE(bank_account_id, transaction_id)
);

CREATE TABLE IF NOT EXISTS "bonds" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    isin TEXT,
    coupon_value TEXT NOT NULL,
    interest_rate TEXT NOT NULL DEFAULT '0',
    maturity_date INTEGER,
    currency TEXT NOT NULL DEFAULT 'CZK',
    quantity TEXT NOT NULL DEFAULT '1',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS budget_goals (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES transaction_categories(id) ON DELETE CASCADE,
    timeframe TEXT NOT NULL, -- 'monthly', 'quarterly', 'yearly'
    amount TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CZK',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(category_id, timeframe)
);

CREATE TABLE IF NOT EXISTS cashflow_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    amount TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CZK',
    frequency TEXT NOT NULL,
    item_type TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
, category TEXT NOT NULL DEFAULT 'income');

CREATE TABLE IF NOT EXISTS categorization_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    pattern TEXT NOT NULL,
    category_id TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 50,
    is_active INTEGER NOT NULL DEFAULT 1,
    stop_processing INTEGER NOT NULL DEFAULT 0,
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()), iban_pattern TEXT, variable_symbol TEXT,
    FOREIGN KEY (category_id) REFERENCES transaction_categories(id)
);

CREATE TABLE IF NOT EXISTS crypto_investments (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL UNIQUE,
    coingecko_id TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity TEXT NOT NULL,
    average_price TEXT NOT NULL
, currency TEXT NOT NULL DEFAULT 'CZK');

CREATE TABLE IF NOT EXISTS crypto_price_overrides (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL UNIQUE,
    price TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS crypto_prices (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL UNIQUE,
    coingecko_id TEXT,
    price TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    fetched_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS crypto_transactions (
    id TEXT PRIMARY KEY,
    investment_id TEXT NOT NULL REFERENCES crypto_investments(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    ticker TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity TEXT NOT NULL,
    price_per_unit TEXT NOT NULL,
    currency TEXT NOT NULL,
    transaction_date INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS crypto_value_history (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL,
    recorded_at INTEGER NOT NULL,
    value_czk TEXT NOT NULL,
    quantity TEXT NOT NULL,
    price TEXT NOT NULL,
    currency TEXT NOT NULL, is_stale INTEGER NOT NULL DEFAULT 0,
    UNIQUE(ticker, recorded_at)
);

CREATE TABLE IF NOT EXISTS csv_import_batches (
    id TEXT PRIMARY KEY,
    bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    imported_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    imported_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS csv_import_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    institution_id TEXT REFERENCES institutions(id),
    delimiter TEXT NOT NULL DEFAULT ';',
    encoding TEXT NOT NULL DEFAULT 'UTF-8',
    skip_rows INTEGER NOT NULL DEFAULT 0,
    date_column TEXT NOT NULL,
    date_format TEXT NOT NULL DEFAULT '%d.%m.%Y',
    amount_column TEXT NOT NULL,
    description_column TEXT,
    counterparty_column TEXT,
    variable_symbol_column TEXT,
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS dividend_data (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL UNIQUE,
    yearly_dividend_sum TEXT NOT NULL DEFAULT '0',
    currency TEXT NOT NULL DEFAULT 'USD',
    last_fetched_at INTEGER NOT NULL DEFAULT (unixepoch()),
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS dividend_overrides (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL UNIQUE,
    yearly_dividend_sum TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CZK',
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS entity_history (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    value TEXT NOT NULL,
    recorded_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS exchange_rate_history (
    date     INTEGER NOT NULL,
    currency TEXT NOT NULL,
    rate     REAL NOT NULL,
    PRIMARY KEY (date, currency)
);

CREATE TABLE IF NOT EXISTS exchange_rates (
    currency TEXT PRIMARY KEY,
    rate REAL NOT NULL,
    fetched_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS institutions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bic TEXT,
    country TEXT,
    logo_url TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS instruments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    type TEXT NOT NULL,
    current_price TEXT NOT NULL DEFAULT '0',
    previous_price TEXT
);

CREATE TABLE IF NOT EXISTS insurance_documents (
    id TEXT PRIMARY KEY,
    insurance_id TEXT NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'other',
    file_size INTEGER,
    uploaded_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS insurance_policies (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    policy_name TEXT NOT NULL,
    policy_number TEXT NOT NULL,
    start_date INTEGER NOT NULL,
    end_date INTEGER,
    payment_frequency TEXT NOT NULL,
    one_time_payment TEXT,
    one_time_payment_currency TEXT DEFAULT 'CZK',
    regular_payment TEXT NOT NULL DEFAULT '0',
    regular_payment_currency TEXT NOT NULL DEFAULT 'CZK',
    limits TEXT DEFAULT '[]',
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS investment_transactions (
    id TEXT PRIMARY KEY,
    investment_id TEXT NOT NULL REFERENCES stock_investments(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    ticker TEXT NOT NULL,
    company_name TEXT NOT NULL,
    quantity TEXT NOT NULL,
    price_per_unit TEXT NOT NULL,
    currency TEXT NOT NULL,
    transaction_date INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS "learned_payees" (
    id TEXT PRIMARY KEY,
    normalized_payee TEXT,
    original_payee TEXT,
    counterparty_iban TEXT,
    category_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (category_id) REFERENCES transaction_categories(id)
);

CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    principal TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CZK',
    interest_rate TEXT NOT NULL DEFAULT '0',
    interest_rate_validity_date INTEGER,
    monthly_payment TEXT NOT NULL DEFAULT '0',
    start_date INTEGER NOT NULL DEFAULT (unixepoch()),
    end_date INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS other_asset_transactions (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL REFERENCES other_assets(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    quantity TEXT NOT NULL,
    price_per_unit TEXT NOT NULL,
    currency TEXT NOT NULL,
    transaction_date INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS other_assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    quantity TEXT NOT NULL DEFAULT '0',
    market_price TEXT NOT NULL DEFAULT '0',
    currency TEXT NOT NULL DEFAULT 'CZK',
    average_purchase_price TEXT NOT NULL DEFAULT '0',
    yield_type TEXT NOT NULL DEFAULT 'none',
    yield_value TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS portfolio_metrics_history (
    id TEXT PRIMARY KEY,
    total_savings TEXT NOT NULL,
    total_loans_principal TEXT NOT NULL,
    total_investments TEXT NOT NULL,
    total_crypto TEXT NOT NULL DEFAULT '0',
    total_bonds TEXT NOT NULL,
    total_real_estate_personal TEXT NOT NULL,
    total_real_estate_investment TEXT NOT NULL,
    recorded_at INTEGER NOT NULL DEFAULT (unixepoch())
, total_other_assets TEXT NOT NULL DEFAULT '0', is_stale INTEGER NOT NULL DEFAULT 0, investments_by_currency  TEXT NOT NULL DEFAULT '{}', crypto_by_currency       TEXT NOT NULL DEFAULT '{}', savings_by_currency      TEXT NOT NULL DEFAULT '{}', bonds_by_currency        TEXT NOT NULL DEFAULT '{}', real_estate_by_currency  TEXT NOT NULL DEFAULT '{}', loans_by_currency        TEXT NOT NULL DEFAULT '{}', other_assets_by_currency TEXT NOT NULL DEFAULT '{}');

CREATE TABLE IF NOT EXISTS projection_settings (
    id TEXT PRIMARY KEY,
    asset_type TEXT NOT NULL UNIQUE,
    yearly_growth_rate TEXT NOT NULL DEFAULT '0',
    monthly_contribution TEXT NOT NULL DEFAULT '0',
    contribution_currency TEXT NOT NULL DEFAULT 'CZK',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    instrument_id TEXT NOT NULL REFERENCES instruments(id),
    purchase_date INTEGER NOT NULL,
    quantity TEXT NOT NULL,
    price_per_unit TEXT NOT NULL,
    fees TEXT NOT NULL DEFAULT '0',
    note TEXT
);

CREATE TABLE IF NOT EXISTS real_estate (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    type TEXT NOT NULL,
    purchase_price TEXT NOT NULL DEFAULT '0',
    purchase_price_currency TEXT NOT NULL DEFAULT 'CZK',
    market_price TEXT NOT NULL DEFAULT '0',
    market_price_currency TEXT NOT NULL DEFAULT 'CZK',
    monthly_rent TEXT,
    monthly_rent_currency TEXT DEFAULT 'CZK',
    recurring_costs TEXT DEFAULT '[]',
    photos TEXT DEFAULT '[]',
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS real_estate_documents (
    id TEXT PRIMARY KEY,
    real_estate_id TEXT NOT NULL REFERENCES real_estate(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'other',
    file_size INTEGER,
    uploaded_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS real_estate_insurances (
    real_estate_id TEXT NOT NULL REFERENCES real_estate(id) ON DELETE CASCADE,
    insurance_id TEXT NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
    PRIMARY KEY (real_estate_id, insurance_id)
);

CREATE TABLE IF NOT EXISTS real_estate_loans (
    real_estate_id TEXT NOT NULL REFERENCES real_estate(id) ON DELETE CASCADE,
    loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    PRIMARY KEY (real_estate_id, loan_id)
);

CREATE TABLE IF NOT EXISTS real_estate_one_time_costs (
    id TEXT PRIMARY KEY,
    real_estate_id TEXT NOT NULL REFERENCES real_estate(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    amount TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CZK',
    date INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS real_estate_photo_batches (
    id TEXT PRIMARY KEY,
    real_estate_id TEXT NOT NULL REFERENCES real_estate(id) ON DELETE CASCADE,
    photo_date INTEGER NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS real_estate_photos (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES real_estate_photo_batches(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    thumbnail_path TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS savings_account_zones (
    id TEXT PRIMARY KEY,
    savings_account_id TEXT NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
    from_amount TEXT NOT NULL,
    to_amount TEXT,
    interest_rate TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS savings_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    balance TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CZK',
    interest_rate TEXT NOT NULL DEFAULT '0',
    has_zone_designation INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
, termination_date INTEGER);

CREATE TABLE IF NOT EXISTS "stock_data" (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL UNIQUE,
    original_price TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    price_date INTEGER NOT NULL,
    fetched_at INTEGER NOT NULL DEFAULT (unixepoch())
, short_name TEXT, long_name TEXT, sector TEXT, industry TEXT, pe_ratio TEXT, forward_pe TEXT, market_cap TEXT, beta TEXT, fifty_two_week_high TEXT, fifty_two_week_low TEXT, trailing_dividend_rate TEXT, trailing_dividend_yield TEXT, ex_dividend_date INTEGER, description TEXT, exchange TEXT, quote_type TEXT, metadata_fetched_at INTEGER);

CREATE TABLE IF NOT EXISTS stock_investment_tags (
    investment_id TEXT NOT NULL REFERENCES stock_investments(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES stock_tags(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (investment_id, tag_id)
);

CREATE TABLE IF NOT EXISTS stock_investments (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    quantity TEXT NOT NULL,
    average_price TEXT NOT NULL
, currency TEXT NOT NULL DEFAULT 'CZK');

CREATE TABLE IF NOT EXISTS stock_price_overrides (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL UNIQUE,
    price TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CZK',
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS stock_tag_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS stock_tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
, group_id TEXT REFERENCES stock_tag_groups(id) ON DELETE SET NULL);

CREATE TABLE IF NOT EXISTS stock_value_history (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL,
    recorded_at INTEGER NOT NULL,
    value_czk TEXT NOT NULL,
    quantity TEXT NOT NULL,
    price TEXT NOT NULL,
    currency TEXT NOT NULL, is_stale INTEGER NOT NULL DEFAULT 0,
    UNIQUE(ticker, recorded_at)
);

CREATE TABLE IF NOT EXISTS transaction_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    parent_id TEXT REFERENCES transaction_categories(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS transaction_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    pattern TEXT NOT NULL,
    category_id TEXT NOT NULL REFERENCES transaction_categories(id),
    priority INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
, stop_processing INTEGER NOT NULL DEFAULT 0);

CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    surname TEXT NOT NULL,
    email TEXT NOT NULL,
    menu_preferences TEXT DEFAULT '{"savings":true,"loans":true,"insurance":true,"investments":true,"bonds":true,"realEstate":true}',
    currency TEXT NOT NULL DEFAULT 'CZK',
    exclude_personal_real_estate INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
, language TEXT NOT NULL DEFAULT 'en', coingecko_modal_dismissed INTEGER NOT NULL DEFAULT 0, mcp_server_enabled INTEGER NOT NULL DEFAULT 0);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bank_accounts_institution ON bank_accounts(institution_id);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_type ON bank_accounts(account_type);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_account ON bank_transactions(bank_account_id);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_batch ON bank_transactions(import_batch_id);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_category ON bank_transactions(category_id);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(booking_date);

CREATE INDEX IF NOT EXISTS idx_batches_real_estate ON real_estate_photo_batches(real_estate_id);

CREATE INDEX IF NOT EXISTS idx_budget_goals_category ON budget_goals(category_id);

CREATE INDEX IF NOT EXISTS idx_budget_goals_timeframe ON budget_goals(timeframe);

CREATE INDEX IF NOT EXISTS idx_categorization_rules_iban ON categorization_rules(iban_pattern) WHERE iban_pattern IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categorization_rules_priority ON categorization_rules(priority DESC, is_active);

CREATE INDEX IF NOT EXISTS idx_crypto_value_history_date ON crypto_value_history(recorded_at);

CREATE INDEX IF NOT EXISTS idx_crypto_value_history_ticker ON crypto_value_history(ticker);

CREATE INDEX IF NOT EXISTS idx_crypto_value_history_ticker_date ON crypto_value_history(ticker, recorded_at);

CREATE INDEX IF NOT EXISTS idx_csv_import_batches_account ON csv_import_batches(bank_account_id);

CREATE INDEX IF NOT EXISTS idx_erh_currency_date ON exchange_rate_history(currency, date);

CREATE INDEX IF NOT EXISTS idx_insurance_documents ON insurance_documents(insurance_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_learned_payees_composite 
ON learned_payees(normalized_payee, counterparty_iban);

CREATE INDEX IF NOT EXISTS idx_learned_payees_iban_only 
ON learned_payees(counterparty_iban) WHERE normalized_payee IS NULL;

CREATE INDEX IF NOT EXISTS idx_learned_payees_iban_partial ON learned_payees(counterparty_iban);

CREATE INDEX IF NOT EXISTS idx_learned_payees_payee_default 
ON learned_payees(normalized_payee) WHERE counterparty_iban IS NULL;

CREATE INDEX IF NOT EXISTS idx_photos_batch ON real_estate_photos(batch_id);

CREATE INDEX IF NOT EXISTS idx_real_estate_documents ON real_estate_documents(real_estate_id);

CREATE INDEX IF NOT EXISTS idx_stock_investment_tags_investment ON stock_investment_tags(investment_id);

CREATE INDEX IF NOT EXISTS idx_stock_investment_tags_tag ON stock_investment_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_stock_tags_group ON stock_tags(group_id);

CREATE INDEX IF NOT EXISTS idx_stock_value_history_date ON stock_value_history(recorded_at);

CREATE INDEX IF NOT EXISTS idx_stock_value_history_ticker ON stock_value_history(ticker);

CREATE INDEX IF NOT EXISTS idx_stock_value_history_ticker_date ON stock_value_history(ticker, recorded_at);

CREATE INDEX IF NOT EXISTS idx_transaction_rules_category ON transaction_rules(category_id);

-- Seed data
INSERT OR IGNORE INTO transaction_categories (id, name, icon, color, parent_id, sort_order, is_system) VALUES
    ('cat_dining', 'Dining & Restaurants', 'utensils', '#FF9800', NULL, '2', '1'),
    ('cat_entertainment', 'Entertainment', 'film', '#E91E63', NULL, '5', '1'),
    ('cat_groceries', 'Groceries', 'shopping-cart', '#4CAF50', NULL, '1', '1'),
    ('cat_health', 'Health & Medical', 'heart', '#F44336', NULL, '7', '1'),
    ('cat_housing', 'Housing', 'home', '#F59E0B', NULL, '14', '1'),
    ('cat_income', 'Income', 'trending-up', '#8BC34A', NULL, '9', '1'),
    ('cat_insurance', 'Insurance', 'shield', '#8B5CF6', NULL, '16', '1'),
    ('cat_internal_transfers', 'Internal Transfers', 'arrows-right-left', '#94A3B8', NULL, '13', '1'),
    ('cat_investments', 'Investments', 'line-chart', '#6366F1', NULL, '11', '1'),
    ('cat_loan_payments', 'Loan Payments', 'credit-card', '#EF4444', NULL, '17', '1'),
    ('cat_other', 'Other', 'more-horizontal', '#9E9E9E', NULL, '99', '1'),
    ('cat_savings', 'Savings', 'piggy-bank', '#22C55E', NULL, '12', '1'),
    ('cat_shopping', 'Shopping', 'shopping-bag', '#00BCD4', NULL, '6', '1'),
    ('cat_taxes', 'Taxes', 'landmark', '#DC2626', NULL, '15', '1'),
    ('cat_transport', 'Transportation', 'car', '#2196F3', NULL, '3', '1'),
    ('cat_travel', 'Travel', 'plane', '#3F51B5', NULL, '8', '1'),
    ('cat_utilities', 'Utilities', 'zap', '#9C27B0', NULL, '4', '1');

INSERT OR IGNORE INTO institutions (id, name, bic, country, logo_url) VALUES
    ('inst_air_bank', 'Air Bank', 'AIRACZPP', 'CZ', '/bank-logos/air-bank.svg'),
    ('inst_ceska_sporitelna', 'Česká spořitelna', 'GIBACZPX', 'CZ', '/bank-logos/ceska-sporitelna.svg'),
    ('inst_creditas', 'Banka CREDITAS', 'CTASCZ22', 'CZ', '/bank-logos/creditas.svg'),
    ('inst_csob', 'ČSOB', 'CEKOCZPP', 'CZ', '/bank-logos/csob.svg'),
    ('inst_fio', 'Fio banka', 'FIOBCZPP', 'CZ', '/bank-logos/fio.svg'),
    ('inst_ing', 'ING Bank', 'INGBCZPP', 'CZ', '/bank-logos/ing.svg'),
    ('inst_jt_banka', 'J&T Banka', 'JTBPCZPP', 'CZ', '/bank-logos/jt-banka.svg'),
    ('inst_komercni_banka', 'Komerční banka', 'KOMBCZPP', 'CZ', '/bank-logos/komercni-banka.svg'),
    ('inst_max_banka', 'MAX banka', 'EXPNCZPP', 'CZ', '/bank-logos/max-banka.svg'),
    ('inst_moneta', 'MONETA Money Bank', 'AGBACZPP', 'CZ', '/bank-logos/moneta.svg'),
    ('inst_nrb', 'Národní rozvojová banka', 'NROZCZPP', 'CZ', '/bank-logos/nrb.svg'),
    ('inst_other', 'Other', NULL, NULL, NULL),
    ('inst_ppf', 'PPF banka', 'PMBPCZPP', 'CZ', '/bank-logos/ppf.svg'),
    ('inst_raiffeisenbank', 'Raiffeisenbank', 'RZBCCZPP', 'CZ', '/bank-logos/raiffeisenbank.svg'),
    ('inst_revolut', 'Revolut', 'REVOGB21', 'GB', '/bank-logos/revolut.svg'),
    ('inst_trinity', 'Trinity Bank', 'MCEKCZPP', 'CZ', '/bank-logos/trinity.svg'),
    ('inst_unicredit', 'UniCredit Bank', 'BACXCZPP', 'CZ', '/bank-logos/unicredit.svg'),
    ('inst_wise', 'Wise', 'TRWIBEB1XXX', 'BE', '/bank-logos/wise.svg');

"#;

/// Migration 002: snapshot provenance (spec 2026-08-09-currency-native-history-design)
/// Distinguishes live-recorded portfolio snapshots from reconstructed
/// (gap-backfilled / recalculated) rows: live rows are authentic records that
/// repairs must not re-derive; backfill rows may be rebuilt freely.
/// Reconstructed rows written before this migration are exactly the
/// midnight-stamped ones (insert_snapshot_for_day / update_or_insert_snapshot
/// always wrote recorded_at = day start).
const MIGRATION_002: &str = r#"
ALTER TABLE portfolio_metrics_history ADD COLUMN source TEXT NOT NULL DEFAULT 'live';
UPDATE portfolio_metrics_history SET source = 'backfill' WHERE recorded_at % 86400 = 0;
"#;

#[cfg(test)]
mod tests {
    use super::*;

    /// Path to the golden schema fixture, relative to src-tauri/
    const GOLDEN_PATH: &str = "src/db/golden_schema.snapshot";

    /// All migration names of the pre-squash chain (Moony <= 1.3.0),
    /// used to simulate legacy databases in tests.
    const LEGACY_CHAIN: [&str; 37] = [
        "001_initial_schema",
        "002_add_bond_currency",
        "003_add_other_assets_history",
        "004_add_photo_batches",
        "005_add_insurance_documents",
        "006_add_savings_termination_date",
        "007_add_cashflow_items",
        "008_add_cashflow_category",
        "009_add_projection_settings",
        "010_add_real_estate_documents",
        "011_add_bond_quantity",
        "012_add_user_language",
        "013_add_stock_metadata",
        "014_add_crypto_manual_price",
        "015_add_bank_accounts",
        "016_add_import_batches",
        "017_add_stock_tags",
        "018_add_stock_tag_groups",
        "019_add_ticker_history",
        "020_add_investment_currency",
        "021_add_categorization",
        "022_add_new_categories",
        "023_add_insurance_loan_categories",
        "024_fix_missing_taxes",
        "025_add_budget_goals",
        "026_hierarchical_payee_matching",
        "027_nullable_payee_columns",
        "028_remove_variable_symbol_from_learned_payees",
        "029_update_investments_icon",
        "030_add_iban_vs_to_rules",
        "031_make_bond_isin_optional",
        "032_bank_account_zones_fix",
        "033_add_coingecko_modal_dismissed",
        "034_add_exchange_rates_table",
        "035_add_stale_data_columns",
        "036_add_mcp_server_enabled",
        "037_multicurrency",
    ];

    /// Dump the complete schema and seeded data of a migrated database
    /// in a stable, comparable text form.
    fn dump_schema_and_seed_data(conn: &Connection) -> String {
        let mut out = String::new();

        let mut stmt = conn
            .prepare(
                "SELECT type, name, COALESCE(sql, '') FROM sqlite_master
                 WHERE name NOT LIKE 'sqlite_%' AND name != '_migrations'
                 ORDER BY type, name",
            )
            .expect("prepare sqlite_master query");
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .expect("query sqlite_master");
        for row in rows {
            let (obj_type, name, sql) = row.expect("read sqlite_master row");
            out.push_str(&format!("== {} {} ==\n{}\n\n", obj_type, name, sql.trim()));
        }

        // Seeded data (stable columns only — created_at is insert-time volatile)
        for (table, cols) in [
            (
                "transaction_categories",
                "id, name, icon, color, parent_id, sort_order, is_system",
            ),
            ("institutions", "id, name, bic, country, logo_url"),
        ] {
            out.push_str(&format!("== data {} ==\n", table));
            let mut stmt = conn
                .prepare(&format!("SELECT {} FROM {} ORDER BY id", cols, table))
                .expect("prepare data query");
            let col_count = stmt.column_count();
            let rows = stmt
                .query_map([], move |row| {
                    let mut vals = Vec::with_capacity(col_count);
                    for i in 0..col_count {
                        let v: rusqlite::types::Value = row.get(i)?;
                        vals.push(match v {
                            rusqlite::types::Value::Null => "NULL".to_string(),
                            rusqlite::types::Value::Integer(n) => n.to_string(),
                            rusqlite::types::Value::Real(f) => f.to_string(),
                            rusqlite::types::Value::Text(s) => s,
                            rusqlite::types::Value::Blob(b) => format!("<blob {} bytes>", b.len()),
                        });
                    }
                    Ok(vals.join(" | "))
                })
                .expect("query data");
            for row in rows {
                out.push_str(&row.expect("read data row"));
                out.push('\n');
            }
            out.push('\n');
        }

        out
    }

    /// One-time generator kept for intentional schema changes via new
    /// migrations: cargo test regenerate_golden_schema -- --ignored
    #[test]
    #[ignore]
    fn regenerate_golden_schema() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        run_migrations(&conn).expect("run migrations");
        let dump = dump_schema_and_seed_data(&conn);
        std::fs::write(GOLDEN_PATH, &dump).expect("write golden fixture");
        println!("Golden schema fixture written to {}", GOLDEN_PATH);
    }

    /// The baseline must always produce exactly the golden schema, which is
    /// what the historical 37-migration chain produced.
    #[test]
    fn migrations_match_golden_schema() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        run_migrations(&conn).expect("run migrations");
        let dump = dump_schema_and_seed_data(&conn);
        let golden = std::fs::read_to_string(GOLDEN_PATH).expect("read golden fixture");
        assert_eq!(
            dump, golden,
            "Migrated schema differs from golden fixture. If this change is intentional, regenerate with: cargo test regenerate_golden_schema -- --ignored"
        );
    }

    /// Build a database that looks exactly like a fully migrated legacy
    /// (Moony 1.3.0) database: the baseline schema (which reproduces the
    /// legacy final schema, proven by migrations_match_golden_schema) plus
    /// legacy `_migrations` entries — and nothing newer.
    fn setup_legacy_db() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        conn.execute(
            "CREATE TABLE _migrations (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                applied_at INTEGER NOT NULL DEFAULT (unixepoch())
            )",
            [],
        )
        .expect("create migrations bookkeeping");
        conn.execute_batch(MIGRATION_001)
            .expect("apply baseline schema");
        for name in LEGACY_CHAIN {
            conn.execute("INSERT INTO _migrations (name) VALUES (?1)", [name])
                .expect("insert legacy migration row");
        }
        conn
    }

    #[test]
    fn legacy_database_is_stamped_without_ddl() {
        let conn = setup_legacy_db();

        // Simulate user data, including a deleted system category — stamping
        // must not resurrect it or modify data. History rows probe migration
        // 002: the midnight-stamped one was written by the old backfill.
        conn.execute(
            "INSERT INTO bank_accounts (id, name, account_type, currency, balance, data_source, created_at, updated_at)
             VALUES ('acc1', 'My account', 'checking', 'CZK', '1234.56', 'manual', 1700000000, 1700000000)",
            [],
        )
        .expect("insert sentinel account");
        conn.execute(
            "INSERT INTO portfolio_metrics_history
             (id, total_savings, total_loans_principal, total_investments, total_crypto,
              total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at)
             VALUES ('h_live', '1', '0', '0', '0', '0', '0', '0', 1700000123),
                    ('h_backfill', '1', '0', '0', '0', '0', '0', '0', 1699920000)",
            [],
        )
        .expect("insert sentinel history rows");
        conn.execute(
            "DELETE FROM transaction_categories WHERE id = 'cat_travel'",
            [],
        )
        .expect("delete a system category");

        run_migrations(&conn).expect("legacy upgrade must succeed");

        // Baseline stamped
        let stamped: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM _migrations WHERE name = ?1",
                [BASELINE_NAME],
                |row| row.get(0),
            )
            .expect("check stamp");
        assert_eq!(stamped, 1, "baseline must be stamped exactly once");

        // Data untouched
        let balance: String = conn
            .query_row(
                "SELECT balance FROM bank_accounts WHERE id = 'acc1'",
                [],
                |row| row.get(0),
            )
            .expect("sentinel account still present");
        assert_eq!(balance, "1234.56");
        let travel_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transaction_categories WHERE id = 'cat_travel'",
                [],
                |row| row.get(0),
            )
            .expect("count deleted category");
        assert_eq!(
            travel_count, 0,
            "stamping must not resurrect deleted categories"
        );

        // Post-baseline migrations run on legacy databases too: the upgraded
        // schema must equal a freshly migrated one.
        let schema_after = {
            let mut s = dump_schema_and_seed_data(&conn);
            s.truncate(s.find("== data ").unwrap());
            s
        };
        let fresh_schema = {
            let fresh = Connection::open_in_memory().expect("in-memory db");
            run_migrations(&fresh).expect("fresh migration");
            let mut s = dump_schema_and_seed_data(&fresh);
            s.truncate(s.find("== data ").unwrap());
            s
        };
        assert_eq!(schema_after, fresh_schema);

        // Migration 002 stamps provenance from the midnight convention.
        let source_of = |id: &str| -> String {
            conn.query_row(
                "SELECT source FROM portfolio_metrics_history WHERE id = ?1",
                [id],
                |row| row.get(0),
            )
            .expect("sentinel history row")
        };
        assert_eq!(source_of("h_live"), "live");
        assert_eq!(source_of("h_backfill"), "backfill");

        // Idempotent on second run
        run_migrations(&conn).expect("second run must be a no-op");
    }

    #[test]
    fn partially_migrated_legacy_database_errors() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(
            "CREATE TABLE _migrations (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                applied_at INTEGER NOT NULL DEFAULT (unixepoch())
            );
            INSERT INTO _migrations (name) VALUES ('001_initial_schema'), ('002_add_bond_currency');",
        )
        .expect("simulate partially migrated legacy db");

        let err = run_migrations(&conn).expect_err("must refuse partially migrated legacy db");
        let msg = format!("{err}");
        assert!(
            msg.contains("Moony 1.3.0"),
            "error must point to Moony 1.3.0, got: {msg}"
        );
    }
}
