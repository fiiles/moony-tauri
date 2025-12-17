//! Database migrations for Moony
//!
//! Creates all tables matching the schema from schema.ts

use crate::error::Result;
use rusqlite::Connection;

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

    // Check which migrations have been applied
    let applied: Vec<String> = {
        let mut stmt = conn.prepare("SELECT name FROM _migrations")?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        rows.filter_map(|r| r.ok()).collect()
    };

    // Apply migrations in order
    let migrations: Vec<(&str, &str)> = vec![
        ("001_initial_schema", MIGRATION_001),
        ("002_add_bond_currency", MIGRATION_002),
        ("003_add_other_assets_history", MIGRATION_003),
        ("004_add_photo_batches", MIGRATION_004),
        ("005_add_insurance_documents", MIGRATION_005),
        ("006_add_savings_termination_date", MIGRATION_006),
    ];

    for (name, sql) in migrations {
        if !applied.contains(&name.to_string()) {
            conn.execute_batch(sql)?;
            conn.execute("INSERT INTO _migrations (name) VALUES (?1)", [name])?;
        }
    }

    Ok(())
}

/// Initial schema migration - creates all tables
const MIGRATION_001: &str = r#"
-- App configuration - stores app settings and recovery key hash
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- User profile - stores user info
CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    surname TEXT NOT NULL,
    email TEXT NOT NULL,
    menu_preferences TEXT DEFAULT '{"savings":true,"loans":true,"insurance":true,"investments":true,"bonds":true,"realEstate":true}',
    currency TEXT NOT NULL DEFAULT 'CZK',
    exclude_personal_real_estate INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Portfolio metrics history
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
);

-- Entity History
CREATE TABLE IF NOT EXISTS entity_history (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    value TEXT NOT NULL,
    recorded_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Savings Accounts
CREATE TABLE IF NOT EXISTS savings_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    balance TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CZK',
    interest_rate TEXT NOT NULL DEFAULT '0',
    has_zone_designation INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS savings_account_zones (
    id TEXT PRIMARY KEY,
    savings_account_id TEXT NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
    from_amount TEXT NOT NULL,
    to_amount TEXT,
    interest_rate TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Bonds
CREATE TABLE IF NOT EXISTS bonds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    isin TEXT NOT NULL,
    coupon_value TEXT NOT NULL,
    interest_rate TEXT NOT NULL DEFAULT '0',
    maturity_date INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Loans
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

-- Stock Investments
CREATE TABLE IF NOT EXISTS stock_investments (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    quantity TEXT NOT NULL,
    average_price TEXT NOT NULL
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

-- Real Estate
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

CREATE TABLE IF NOT EXISTS real_estate_loans (
    real_estate_id TEXT NOT NULL REFERENCES real_estate(id) ON DELETE CASCADE,
    loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    PRIMARY KEY (real_estate_id, loan_id)
);

-- Stock Prices
CREATE TABLE IF NOT EXISTS stock_prices (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL UNIQUE,
    original_price TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    price_date INTEGER NOT NULL,
    fetched_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS stock_price_overrides (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL UNIQUE,
    price TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CZK',
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Dividend Data
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

-- Insurance Policies
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

CREATE TABLE IF NOT EXISTS real_estate_insurances (
    real_estate_id TEXT NOT NULL REFERENCES real_estate(id) ON DELETE CASCADE,
    insurance_id TEXT NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
    PRIMARY KEY (real_estate_id, insurance_id)
);

-- Crypto
CREATE TABLE IF NOT EXISTS crypto_investments (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL UNIQUE,
    coingecko_id TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity TEXT NOT NULL,
    average_price TEXT NOT NULL
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

-- Other Assets
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

-- Instruments (legacy, kept for compatibility)
CREATE TABLE IF NOT EXISTS instruments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    type TEXT NOT NULL,
    current_price TEXT NOT NULL DEFAULT '0',
    previous_price TEXT
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
"#;

/// Migration 002: Add currency to bonds
const MIGRATION_002: &str = r#"
ALTER TABLE bonds ADD COLUMN currency TEXT NOT NULL DEFAULT 'CZK';
"#;

/// Migration 003: Add total_other_assets to portfolio metrics history
const MIGRATION_003: &str = r#"
ALTER TABLE portfolio_metrics_history ADD COLUMN total_other_assets TEXT NOT NULL DEFAULT '0';
"#;

/// Migration 004: Add photo batches and photos for real estate
const MIGRATION_004: &str = r#"
-- Photo batches (date + description grouping)
CREATE TABLE IF NOT EXISTS real_estate_photo_batches (
    id TEXT PRIMARY KEY,
    real_estate_id TEXT NOT NULL REFERENCES real_estate(id) ON DELETE CASCADE,
    photo_date INTEGER NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Individual photos within batches
CREATE TABLE IF NOT EXISTS real_estate_photos (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES real_estate_photo_batches(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    thumbnail_path TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_batches_real_estate ON real_estate_photo_batches(real_estate_id);
CREATE INDEX IF NOT EXISTS idx_photos_batch ON real_estate_photos(batch_id);
"#;

/// Migration 005: Add insurance documents table
const MIGRATION_005: &str = r#"
-- Insurance documents (contracts, certificates, claims, etc.)
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

CREATE INDEX IF NOT EXISTS idx_insurance_documents ON insurance_documents(insurance_id);
"#;

/// Migration 006: Add termination date to savings accounts
const MIGRATION_006: &str = r#"
ALTER TABLE savings_accounts ADD COLUMN termination_date INTEGER;
"#;
