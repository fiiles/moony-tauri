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
        ("007_add_cashflow_items", MIGRATION_007),
        ("008_add_cashflow_category", MIGRATION_008),
        ("009_add_projection_settings", MIGRATION_009),
        ("010_add_real_estate_documents", MIGRATION_010),
        ("011_add_bond_quantity", MIGRATION_011),
        ("012_add_user_language", MIGRATION_012),
        ("013_add_stock_metadata", MIGRATION_013),
        ("014_add_crypto_manual_price", MIGRATION_014),
        ("015_add_bank_accounts", MIGRATION_015),
        ("016_add_import_batches", MIGRATION_016),
        ("017_add_stock_tags", MIGRATION_017),
        ("018_add_stock_tag_groups", MIGRATION_018),
        ("019_add_ticker_history", MIGRATION_019),
        ("020_add_investment_currency", MIGRATION_020),
        ("021_add_categorization", MIGRATION_021),
        ("022_add_new_categories", MIGRATION_022),
        ("023_add_insurance_loan_categories", MIGRATION_023),
        ("024_fix_missing_taxes", MIGRATION_024),
    ];

    for (name, sql) in migrations {
        if !applied.contains(&name.to_string()) {
            println!("[MIGRATION] Applying: {}", name);
            conn.execute_batch(sql)?;
            conn.execute("INSERT INTO _migrations (name) VALUES (?1)", [name])?;
            println!("[MIGRATION] Applied: {}", name);
        }
    }

    // Fix for migration 014 that may have been recorded but table wasn't created
    let table_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='crypto_price_overrides'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .map(|count| count > 0)
        .unwrap_or(false);

    if !table_exists {
        println!("[MIGRATION] Fixing: crypto_price_overrides table missing, creating it now");
        conn.execute_batch(MIGRATION_014)?;
        println!("[MIGRATION] Fixed: crypto_price_overrides table created");
    }

    println!("[MIGRATION] Already applied: {:?}", applied);
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

/// Migration 007: Add cashflow_items table for user-defined income/expense items
const MIGRATION_007: &str = r#"
CREATE TABLE IF NOT EXISTS cashflow_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    amount TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CZK',
    frequency TEXT NOT NULL,
    item_type TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
"#;

/// Migration 008: Add category column to cashflow_items
const MIGRATION_008: &str = r#"
ALTER TABLE cashflow_items ADD COLUMN category TEXT NOT NULL DEFAULT 'income';
"#;

/// Migration 009: Add projection_settings table for portfolio projections
const MIGRATION_009: &str = r#"
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
"#;

/// Migration 010: Add real estate documents table
const MIGRATION_010: &str = r#"
-- Real estate documents (contracts, deeds, etc.)
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

CREATE INDEX IF NOT EXISTS idx_real_estate_documents ON real_estate_documents(real_estate_id);
"#;

/// Migration 011: Add quantity to bonds
const MIGRATION_011: &str = r#"
ALTER TABLE bonds ADD COLUMN quantity TEXT NOT NULL DEFAULT '1';
"#;

/// Migration 012: Add language preference to user_profile
const MIGRATION_012: &str = r#"
ALTER TABLE user_profile ADD COLUMN language TEXT NOT NULL DEFAULT 'en';
"#;

/// Migration 013: Add metadata columns to stock_prices and rename to stock_data
const MIGRATION_013: &str = r#"
-- Add Yahoo Finance metadata columns to stock_prices
ALTER TABLE stock_prices ADD COLUMN short_name TEXT;
ALTER TABLE stock_prices ADD COLUMN long_name TEXT;
ALTER TABLE stock_prices ADD COLUMN sector TEXT;
ALTER TABLE stock_prices ADD COLUMN industry TEXT;
ALTER TABLE stock_prices ADD COLUMN pe_ratio TEXT;
ALTER TABLE stock_prices ADD COLUMN forward_pe TEXT;
ALTER TABLE stock_prices ADD COLUMN market_cap TEXT;
ALTER TABLE stock_prices ADD COLUMN beta TEXT;
ALTER TABLE stock_prices ADD COLUMN fifty_two_week_high TEXT;
ALTER TABLE stock_prices ADD COLUMN fifty_two_week_low TEXT;
ALTER TABLE stock_prices ADD COLUMN trailing_dividend_rate TEXT;
ALTER TABLE stock_prices ADD COLUMN trailing_dividend_yield TEXT;
ALTER TABLE stock_prices ADD COLUMN ex_dividend_date INTEGER;
ALTER TABLE stock_prices ADD COLUMN description TEXT;
ALTER TABLE stock_prices ADD COLUMN exchange TEXT;
ALTER TABLE stock_prices ADD COLUMN quote_type TEXT;
ALTER TABLE stock_prices ADD COLUMN metadata_fetched_at INTEGER;

-- Rename table for clarity
ALTER TABLE stock_prices RENAME TO stock_data;
"#;

/// Migration 014: Add crypto_price_overrides table for manual price overrides (same pattern as stocks)
const MIGRATION_014: &str = r#"
CREATE TABLE IF NOT EXISTS crypto_price_overrides (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL UNIQUE,
    price TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
"#;

/// Migration 015: Add bank accounts, transactions, and categories system
const MIGRATION_015: &str = r#"
-- Institutions table (banks, financial institutions)
CREATE TABLE IF NOT EXISTS institutions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bic TEXT,
    country TEXT,
    logo_url TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Bank accounts table (extends/replaces savings_accounts)
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

-- Transaction categories
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

-- Bank transactions table
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
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(bank_account_id, transaction_id)
);

-- Transaction categorization rules
CREATE TABLE IF NOT EXISTS transaction_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    pattern TEXT NOT NULL,
    category_id TEXT NOT NULL REFERENCES transaction_categories(id),
    priority INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- CSV import presets
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

-- Migrate existing savings accounts to bank_accounts (preserving IDs)
INSERT OR IGNORE INTO bank_accounts (
    id, name, account_type, currency, balance,
    interest_rate, has_zone_designation, termination_date,
    data_source, created_at, updated_at
)
SELECT
    id, name, 'savings', currency, balance,
    interest_rate, has_zone_designation, termination_date,
    'manual', created_at, updated_at
FROM savings_accounts;

-- Insert default categories
INSERT OR IGNORE INTO transaction_categories (id, name, icon, color, sort_order, is_system) VALUES
    ('cat_groceries', 'Groceries', 'shopping-cart', '#4CAF50', 1, 1),
    ('cat_dining', 'Dining & Restaurants', 'utensils', '#FF9800', 2, 1),
    ('cat_transport', 'Transportation', 'car', '#2196F3', 3, 1),
    ('cat_utilities', 'Utilities', 'zap', '#9C27B0', 4, 1),
    ('cat_entertainment', 'Entertainment', 'film', '#E91E63', 5, 1),
    ('cat_shopping', 'Shopping', 'shopping-bag', '#00BCD4', 6, 1),
    ('cat_health', 'Health & Medical', 'heart', '#F44336', 7, 1),
    ('cat_travel', 'Travel', 'plane', '#3F51B5', 8, 1),
    ('cat_income', 'Income', 'trending-up', '#8BC34A', 9, 1),
    ('cat_transfer', 'Transfers', 'repeat', '#607D8B', 10, 1),
    ('cat_other', 'Other', 'more-horizontal', '#9E9E9E', 99, 1);

-- Pre-populate Czech banks with logos
INSERT OR IGNORE INTO institutions (id, name, bic, country, logo_url) VALUES
    ('inst_ceska_sporitelna', 'Česká spořitelna', 'GIBACZPX', 'CZ', '/bank-logos/ceska-sporitelna.svg'),
    ('inst_csob', 'ČSOB', 'CEKOCZPP', 'CZ', '/bank-logos/csob.svg'),
    ('inst_komercni_banka', 'Komerční banka', 'KOMBCZPP', 'CZ', '/bank-logos/komercni-banka.svg'),
    ('inst_moneta', 'MONETA Money Bank', 'AGBACZPP', 'CZ', '/bank-logos/moneta.svg'),
    ('inst_raiffeisenbank', 'Raiffeisenbank', 'RZBCCZPP', 'CZ', '/bank-logos/raiffeisenbank.svg'),
    ('inst_unicredit', 'UniCredit Bank', 'BACXCZPP', 'CZ', '/bank-logos/unicredit.svg'),
    ('inst_fio', 'Fio banka', 'FIOBCZPP', 'CZ', '/bank-logos/fio.svg'),
    ('inst_air_bank', 'Air Bank', 'AIRACZPP', 'CZ', '/bank-logos/air-bank.svg'),
    ('inst_creditas', 'Banka CREDITAS', 'CTASCZ22', 'CZ', '/bank-logos/creditas.svg'),
    ('inst_ing', 'ING Bank', 'INGBCZPP', 'CZ', '/bank-logos/ing.svg'),
    ('inst_jt_banka', 'J&T Banka', 'JTBPCZPP', 'CZ', '/bank-logos/jt-banka.svg'),
    ('inst_max_banka', 'MAX banka', 'EXPNCZPP', 'CZ', '/bank-logos/max-banka.svg'),
    ('inst_ppf', 'PPF banka', 'PMBPCZPP', 'CZ', '/bank-logos/ppf.svg'),
    ('inst_trinity', 'Trinity Bank', 'MCEKCZPP', 'CZ', '/bank-logos/trinity.svg'),
    ('inst_nrb', 'Národní rozvojová banka', 'NROZCZPP', 'CZ', '/bank-logos/nrb.svg'),
    ('inst_revolut', 'Revolut', 'REVOGB21', 'GB', '/bank-logos/revolut.svg'),
    ('inst_wise', 'Wise', 'TRWIBEB1XXX', 'BE', '/bank-logos/wise.svg'),
    ('inst_other', 'Other', NULL, NULL, NULL);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bank_accounts_institution ON bank_accounts(institution_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_type ON bank_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_account ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(booking_date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_category ON bank_transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transaction_rules_category ON transaction_rules(category_id);
"#;

/// Migration 016: Add CSV import batches for tracking imports
const MIGRATION_016: &str = r#"
-- CSV import batches - tracks each CSV upload
CREATE TABLE IF NOT EXISTS csv_import_batches (
    id TEXT PRIMARY KEY,
    bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    imported_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    imported_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Add import_batch_id to bank_transactions to link transactions to their import batch
ALTER TABLE bank_transactions ADD COLUMN import_batch_id TEXT REFERENCES csv_import_batches(id) ON DELETE CASCADE;

-- Create index for faster batch lookups
CREATE INDEX IF NOT EXISTS idx_csv_import_batches_account ON csv_import_batches(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_batch ON bank_transactions(import_batch_id);
"#;

/// Migration 017: Add stock tags for analysis grouping
const MIGRATION_017: &str = r#"
-- Stock tags for categorizing investments (e.g., Growth, Value, Dividend)
CREATE TABLE IF NOT EXISTS stock_tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Junction table for many-to-many relationship between investments and tags
CREATE TABLE IF NOT EXISTS stock_investment_tags (
    investment_id TEXT NOT NULL REFERENCES stock_investments(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES stock_tags(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (investment_id, tag_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_investment_tags_investment ON stock_investment_tags(investment_id);
CREATE INDEX IF NOT EXISTS idx_stock_investment_tags_tag ON stock_investment_tags(tag_id);
"#;

/// Migration 018: Add stock tag groups for organizing tags
const MIGRATION_018: &str = r#"
-- Tag groups for organizing tags (e.g., "Strategy", "Sector", "Risk Level")
CREATE TABLE IF NOT EXISTS stock_tag_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Add group_id to stock_tags (optional, tag can belong to 0 or 1 groups)
ALTER TABLE stock_tags ADD COLUMN group_id TEXT REFERENCES stock_tag_groups(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_stock_tags_group ON stock_tags(group_id);
"#;

/// Migration 019: Add per-ticker value history tables for efficient recalculation
const MIGRATION_019: &str = r#"
-- Stock value history per ticker per day
CREATE TABLE IF NOT EXISTS stock_value_history (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL,
    recorded_at INTEGER NOT NULL,
    value_czk TEXT NOT NULL,
    quantity TEXT NOT NULL,
    price TEXT NOT NULL,
    currency TEXT NOT NULL,
    UNIQUE(ticker, recorded_at)
);

-- Crypto value history per ticker per day
CREATE TABLE IF NOT EXISTS crypto_value_history (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL,
    recorded_at INTEGER NOT NULL,
    value_czk TEXT NOT NULL,
    quantity TEXT NOT NULL,
    price TEXT NOT NULL,
    currency TEXT NOT NULL,
    UNIQUE(ticker, recorded_at)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_value_history_ticker ON stock_value_history(ticker);
CREATE INDEX IF NOT EXISTS idx_stock_value_history_date ON stock_value_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_stock_value_history_ticker_date ON stock_value_history(ticker, recorded_at);
CREATE INDEX IF NOT EXISTS idx_crypto_value_history_ticker ON crypto_value_history(ticker);
CREATE INDEX IF NOT EXISTS idx_crypto_value_history_date ON crypto_value_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_crypto_value_history_ticker_date ON crypto_value_history(ticker, recorded_at);
"#;
/// Migration 020: Add currency column to stock_investments and crypto_investments
/// This allows storing the average price in the investment's native currency
const MIGRATION_020: &str = r#"
-- Add currency column to stock_investments (defaults to CZK for existing)
ALTER TABLE stock_investments ADD COLUMN currency TEXT NOT NULL DEFAULT 'CZK';

-- Add currency column to crypto_investments (defaults to CZK for existing)
ALTER TABLE crypto_investments ADD COLUMN currency TEXT NOT NULL DEFAULT 'CZK';

-- Update stock investments currency based on first transaction
UPDATE stock_investments
SET currency = (
    SELECT it.currency 
    FROM investment_transactions it 
    WHERE it.investment_id = stock_investments.id 
    ORDER BY it.transaction_date ASC 
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 FROM investment_transactions WHERE investment_id = stock_investments.id
);

-- Update crypto investments currency based on first transaction
UPDATE crypto_investments
SET currency = (
    SELECT ct.currency 
    FROM crypto_transactions ct 
    WHERE ct.investment_id = crypto_investments.id 
    ORDER BY ct.transaction_date ASC 
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 FROM crypto_transactions WHERE investment_id = crypto_investments.id
);
"#;

/// Migration 021: Add categorization tables and columns
/// - learned_payees: Stores user-learned payee → category mappings
/// - categorization_source: Tracks how a transaction was categorized
/// - stop_processing: Flag for rules to stop waterfall on match
const MIGRATION_021: &str = r#"
-- Learned payees for exact match categorization
CREATE TABLE IF NOT EXISTS learned_payees (
    id TEXT PRIMARY KEY,
    normalized_payee TEXT NOT NULL UNIQUE,
    original_payee TEXT NOT NULL,
    category_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (category_id) REFERENCES transaction_categories(id)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_learned_payees_normalized ON learned_payees(normalized_payee);

-- Add categorization_source to bank_transactions
-- Values: 'manual', 'rule', 'exact_match', 'ml'
ALTER TABLE bank_transactions ADD COLUMN categorization_source TEXT;

-- Add stop_processing to transaction_rules
ALTER TABLE transaction_rules ADD COLUMN stop_processing INTEGER NOT NULL DEFAULT 0;

-- Create categorization rules table (enhanced from transaction_rules)
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
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (category_id) REFERENCES transaction_categories(id)
);

-- Index for priority-based lookup
CREATE INDEX IF NOT EXISTS idx_categorization_rules_priority ON categorization_rules(priority DESC, is_active);
"#;

/// Migration 022: Add new transaction categories - Investments, Savings, Internal Transfers, Housing
const MIGRATION_022: &str = r#"
-- Add new categories for better transaction organization
INSERT OR IGNORE INTO transaction_categories (id, name, icon, color, sort_order, is_system) VALUES
    ('cat_investments', 'Investments', 'trending-up', '#6366F1', 11, 1),
    ('cat_savings', 'Savings', 'piggy-bank', '#22C55E', 12, 1),
    ('cat_internal_transfers', 'Internal Transfers', 'arrows-right-left', '#94A3B8', 13, 1),
    ('cat_housing', 'Housing', 'home', '#F59E0B', 14, 1),
    ('cat_taxes', 'Taxes', 'landmark', '#DC2626', 15, 1);
"#;

/// Migration 023: Add Insurance and Loan Payments categories, fix missing Taxes, remove Transfers
const MIGRATION_023: &str = r#"
-- Add new categories for Taxes, Insurance and Loan Payments
-- Using INSERT OR IGNORE to handle both new DBs (already have taxes) and existing DBs (may be missing)
INSERT OR IGNORE INTO transaction_categories (id, name, icon, color, sort_order, is_system) VALUES
    ('cat_taxes', 'Taxes', 'landmark', '#DC2626', 15, 1),
    ('cat_insurance', 'Insurance', 'shield', '#8B5CF6', 16, 1),
    ('cat_loan_payments', 'Loan Payments', 'credit-card', '#EF4444', 17, 1);

-- Remove Transfers category (keep Internal Transfers)
DELETE FROM transaction_categories WHERE id = 'cat_transfer';
"#;

/// Migration 024: Fix missing Taxes category (for databases that ran 023 before taxes was added)
const MIGRATION_024: &str = r#"
-- Add Taxes category if missing (INSERT OR IGNORE for safety)
INSERT OR IGNORE INTO transaction_categories (id, name, icon, color, sort_order, is_system) VALUES
    ('cat_taxes', 'Taxes', 'landmark', '#DC2626', 15, 1);
"#;
