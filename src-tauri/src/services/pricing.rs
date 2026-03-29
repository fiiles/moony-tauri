//! Unified price resolution service
//!
//! SINGLE SOURCE OF TRUTH for determining the active price of a stock or crypto asset.
//! Logic: manual override > API price > None

use crate::services::currency::convert_to_czk;

/// Resolved price for a stock or crypto asset
#[derive(Debug, Clone)]
pub struct ResolvedPrice {
    /// Price in original currency (as string for precision)
    pub original_price: String,
    /// Original currency code
    pub currency: String,
    /// Price converted to CZK
    pub price_czk: f64,
    /// When the price was last fetched/updated (Unix timestamp)
    pub fetched_at: Option<i64>,
    /// Whether this is a manual override
    pub is_manual: bool,
}

/// Resolve the current price for a stock ticker.
/// Priority: stock_price_overrides > stock_data > None
pub fn resolve_stock_price(conn: &rusqlite::Connection, ticker: &str) -> Option<ResolvedPrice> {
    // 1. Check manual override
    let override_price: Option<(String, String, i64)> = conn
        .query_row(
            "SELECT price, currency, updated_at FROM stock_price_overrides WHERE ticker = ?1",
            [ticker],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .ok();

    // 2. Check global (API) price
    let global_price: Option<(String, String, i64)> = conn
        .query_row(
            "SELECT original_price, currency, fetched_at FROM stock_data WHERE ticker = ?1",
            [ticker],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .ok();

    // 3. Resolve: prefer override if newer, otherwise global
    match (&override_price, &global_price) {
        (Some((op, oc, ou)), Some((_, _, gu))) if *ou > *gu => Some(ResolvedPrice {
            original_price: op.clone(),
            currency: oc.clone(),
            price_czk: convert_to_czk(op.parse().unwrap_or(0.0), oc),
            fetched_at: Some(*ou),
            is_manual: true,
        }),
        (Some((op, oc, ou)), None) => Some(ResolvedPrice {
            original_price: op.clone(),
            currency: oc.clone(),
            price_czk: convert_to_czk(op.parse().unwrap_or(0.0), oc),
            fetched_at: Some(*ou),
            is_manual: true,
        }),
        (_, Some((gp, gc, gu))) => Some(ResolvedPrice {
            original_price: gp.clone(),
            currency: gc.clone(),
            price_czk: convert_to_czk(gp.parse().unwrap_or(0.0), gc),
            fetched_at: Some(*gu),
            is_manual: false,
        }),
        _ => None,
    }
}

/// Resolve the current price for a crypto symbol.
/// Priority: crypto_price_overrides > crypto_prices > None
pub fn resolve_crypto_price(conn: &rusqlite::Connection, symbol: &str) -> Option<ResolvedPrice> {
    // 1. Check manual override
    let override_price: Option<(String, String, i64)> = conn
        .query_row(
            "SELECT price, currency, updated_at FROM crypto_price_overrides WHERE symbol = ?1",
            [symbol],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .ok();

    // 2. Check global (API) price
    let global_price: Option<(String, String, i64)> = conn
        .query_row(
            "SELECT price, currency, fetched_at FROM crypto_prices WHERE symbol = ?1",
            [symbol],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .ok();

    // 3. Resolve: prefer override if newer than API price, otherwise use API price
    match (&override_price, &global_price) {
        (Some((op, oc, ou)), Some((_, _, gu))) if *ou > *gu => Some(ResolvedPrice {
            original_price: op.clone(),
            currency: oc.clone(),
            price_czk: convert_to_czk(op.parse().unwrap_or(0.0), oc),
            fetched_at: Some(*ou),
            is_manual: true,
        }),
        (Some((op, oc, ou)), None) => Some(ResolvedPrice {
            original_price: op.clone(),
            currency: oc.clone(),
            price_czk: convert_to_czk(op.parse().unwrap_or(0.0), oc),
            fetched_at: Some(*ou),
            is_manual: true,
        }),
        (_, Some((gp, gc, gu))) => Some(ResolvedPrice {
            original_price: gp.clone(),
            currency: gc.clone(),
            price_czk: convert_to_czk(gp.parse().unwrap_or(0.0), gc),
            fetched_at: Some(*gu),
            is_manual: false,
        }),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(
            r#"
            CREATE TABLE stock_data (
                ticker TEXT PRIMARY KEY,
                original_price TEXT NOT NULL,
                currency TEXT NOT NULL DEFAULT 'USD',
                fetched_at INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE stock_price_overrides (
                ticker TEXT PRIMARY KEY,
                price TEXT NOT NULL,
                currency TEXT NOT NULL DEFAULT 'USD',
                updated_at INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE crypto_prices (
                symbol TEXT PRIMARY KEY,
                price TEXT NOT NULL,
                currency TEXT NOT NULL DEFAULT 'USD',
                fetched_at INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE crypto_price_overrides (
                symbol TEXT PRIMARY KEY,
                price TEXT NOT NULL,
                currency TEXT NOT NULL DEFAULT 'USD',
                updated_at INTEGER NOT NULL DEFAULT 0
            );
            "#,
        )
        .expect("schema");
        conn
    }

    #[test]
    fn test_resolve_stock_price_returns_none_when_no_data() {
        let conn = setup_test_db();
        let result = resolve_stock_price(&conn, "AAPL");
        assert!(result.is_none());
    }

    #[test]
    fn test_resolve_stock_price_from_global_data() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO stock_data (ticker, original_price, currency, fetched_at) VALUES ('AAPL', '150.00', 'USD', 100)",
            [],
        )
        .unwrap();

        let result = resolve_stock_price(&conn, "AAPL").expect("price");
        assert_eq!(result.original_price, "150.00");
        assert_eq!(result.currency, "USD");
        assert!(!result.is_manual);
    }

    #[test]
    fn test_resolve_stock_price_prefers_newer_override() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO stock_data (ticker, original_price, currency, fetched_at) VALUES ('MSFT', '300.00', 'USD', 50)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO stock_price_overrides (ticker, price, currency, updated_at) VALUES ('MSFT', '350.00', 'USD', 100)",
            [],
        )
        .unwrap();

        let result = resolve_stock_price(&conn, "MSFT").expect("price");
        assert_eq!(result.original_price, "350.00");
        assert!(result.is_manual);
    }

    #[test]
    fn test_resolve_crypto_price_returns_none_when_no_data() {
        let conn = setup_test_db();
        let result = resolve_crypto_price(&conn, "BTC");
        assert!(result.is_none());
    }
}
