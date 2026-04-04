//! Investment business logic service
//!
//! All business logic for investments lives here.
//! Commands should only validate input, call these functions, and handle events.
//! This is the SINGLE SOURCE OF TRUTH for investment operations.

use crate::error::{AppError, Result};
use crate::models::{InsertInvestmentTransaction, InvestmentTransaction, StockInvestment};
use chrono::DateTime;
use rusqlite::params_from_iter;
use rusqlite::types::Value;
use std::collections::HashMap;
use uuid::Uuid;

/// Recalculate investment quantity and average price from transactions
/// SINGLE SOURCE OF TRUTH for investment metrics calculation
/// NOTE: Average price is calculated in the investment's native currency (set by first transaction)
pub fn recalculate_investment_metrics(
    conn: &rusqlite::Connection,
    investment_id: &str,
) -> Result<()> {
    // Get all transactions for this investment
    let mut stmt = conn.prepare(
        "SELECT type, quantity, price_per_unit, currency FROM investment_transactions WHERE investment_id = ?1"
    )?;

    let txs: Vec<(String, f64, f64, String)> = stmt
        .query_map([investment_id], |row| {
            let type_: String = row.get(0)?;
            let qty_str: String = row.get(1)?;
            let price_str: String = row.get(2)?;
            let currency: String = row.get(3)?;

            let qty = qty_str
                .split_whitespace()
                .next()
                .unwrap_or("0")
                .parse::<f64>()
                .unwrap_or(0.0);
            let price = price_str
                .split_whitespace()
                .next()
                .unwrap_or("0")
                .parse::<f64>()
                .unwrap_or(0.0);

            Ok((type_, qty, price, currency))
        })?
        .filter_map(|r| r.ok())
        .collect();

    let mut total_quantity = 0.0;
    let mut weighted_buy_sum = 0.0;
    let mut weighted_buy_qty = 0.0;

    // Calculate average price in native currency (no conversion)
    // All transactions for an investment should have the same currency
    for (tx_type, qty, price, _currency) in txs {
        if tx_type == "buy" {
            total_quantity += qty;
            weighted_buy_sum += qty * price;
            weighted_buy_qty += qty;
        } else {
            total_quantity -= qty;
        }
    }

    let average_price = if weighted_buy_qty > 0.0 {
        weighted_buy_sum / weighted_buy_qty
    } else {
        0.0
    };

    conn.execute(
        "UPDATE stock_investments SET quantity = ?1, average_price = ?2 WHERE id = ?3",
        rusqlite::params![
            total_quantity.to_string(),
            average_price.to_string(),
            investment_id
        ],
    )?;

    Ok(())
}

/// Internal function to create a transaction record
/// Used by both single-create, add transaction, and bulk import
/// This is the SINGLE SOURCE OF TRUTH for transaction creation
#[allow(clippy::too_many_arguments)]
pub fn create_transaction_internal(
    conn: &rusqlite::Connection,
    investment_id: &str,
    ticker: &str,
    company_name: &str,
    tx_type: &str,
    quantity: &str,
    price_per_unit: &str,
    currency: &str,
    transaction_date: i64,
) -> Result<InvestmentTransaction> {
    let tx_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let currency_upper = currency.to_uppercase();

    conn.execute(
        "INSERT INTO investment_transactions
         (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            tx_id,
            investment_id,
            tx_type,
            ticker,
            company_name,
            quantity,
            price_per_unit,
            currency_upper,
            transaction_date,
            now,
        ],
    )?;

    Ok(InvestmentTransaction {
        id: tx_id,
        investment_id: investment_id.to_string(),
        tx_type: tx_type.to_string(),
        ticker: ticker.to_string(),
        company_name: company_name.to_string(),
        quantity: quantity.to_string(),
        price_per_unit: price_per_unit.to_string(),
        currency: currency_upper,
        transaction_date,
        created_at: now,
    })
}

/// Get or create an investment by ticker
/// Returns the investment ID
/// This is the SINGLE SOURCE OF TRUTH for investment lookup/creation
pub fn get_or_create_investment(
    conn: &rusqlite::Connection,
    ticker: &str,
    company_name: &str,
    currency: &str,
    initial_quantity: Option<&str>,
    initial_avg_price: Option<&str>,
) -> Result<String> {
    let ticker_upper = ticker.to_uppercase();

    // Check if investment already exists
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM stock_investments WHERE ticker = ?1",
            [&ticker_upper],
            |row| row.get(0),
        )
        .ok();

    match existing {
        Some(id) => Ok(id),
        None => {
            let id = Uuid::new_v4().to_string();
            let qty = initial_quantity.unwrap_or("0");
            let avg = initial_avg_price.unwrap_or("0");
            let currency_upper = currency.to_uppercase();

            conn.execute(
                "INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price, currency)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![id, ticker_upper, company_name, qty, avg, currency_upper],
            )?;
            Ok(id)
        }
    }
}

/// Get investment details by ID
pub fn get_investment_by_id(
    conn: &rusqlite::Connection,
    investment_id: &str,
) -> Result<StockInvestment> {
    let inv = conn.query_row(
        "SELECT id, ticker, company_name, quantity, average_price, currency FROM stock_investments WHERE id = ?1",
        [investment_id],
        |row| {
            Ok(StockInvestment {
                id: row.get(0)?,
                ticker: row.get(1)?,
                company_name: row.get(2)?,
                quantity: row.get(3)?,
                average_price: row.get(4)?,
                currency: row.get(5)?,
            })
        },
    )?;
    Ok(inv)
}

/// Get investment details by ticker
pub fn get_investment_by_ticker(
    conn: &rusqlite::Connection,
    ticker: &str,
) -> Result<Option<(String, String)>> {
    let ticker_upper = ticker.to_uppercase();

    let result: Option<(String, String)> = conn
        .query_row(
            "SELECT id, company_name FROM stock_investments WHERE ticker = ?1",
            [&ticker_upper],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok();

    Ok(result)
}

/// Unified import logic for a single transaction
/// Used by CSV import and creates both investment (if needed) and transaction
/// Returns (description, transaction_date, ticker) on success
#[allow(clippy::too_many_arguments)]
pub fn import_single_transaction(
    conn: &rusqlite::Connection,
    ticker: &str,
    company_name: &str,
    tx_type: &str,
    quantity: &str,
    price_per_unit: &str,
    currency: &str,
    transaction_date: i64,
) -> Result<(String, i64, String)> {
    let ticker_upper = ticker.to_uppercase();
    let tx_type_lower = tx_type.to_lowercase();

    // Validate transaction type
    if tx_type_lower != "buy" && tx_type_lower != "sell" {
        return Err(AppError::Validation(format!(
            "Invalid type '{}' (must be 'buy' or 'sell')",
            tx_type
        )));
    }

    // Check if investment exists
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM stock_investments WHERE ticker = ?1",
            [&ticker_upper],
            |row| row.get(0),
        )
        .ok();

    // For sell transactions, require existing investment
    if tx_type_lower == "sell" && existing.is_none() {
        return Err(AppError::Validation(format!(
            "{}: Cannot sell - no existing position found",
            ticker_upper
        )));
    }

    // Get or create investment
    let investment_id = match existing {
        Some(id) => {
            // Validate currency matches for existing investment
            let inv_currency: String = conn
                .query_row(
                    "SELECT currency FROM stock_investments WHERE id = ?1",
                    [&id],
                    |row| row.get(0),
                )
                .unwrap_or_else(|_| currency.to_uppercase());

            if inv_currency.to_uppercase() != currency.to_uppercase() {
                return Err(AppError::Validation(format!(
                    "{}: Currency mismatch - investment uses {} but transaction is in {}",
                    ticker_upper, inv_currency, currency
                )));
            }
            id
        }
        None => {
            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price, currency)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![id, ticker_upper, company_name, "0", "0", currency.to_uppercase()],
            )?;
            id
        }
    };

    // Create transaction using the shared function
    create_transaction_internal(
        conn,
        &investment_id,
        &ticker_upper,
        company_name,
        &tx_type_lower,
        quantity,
        price_per_unit,
        currency,
        transaction_date,
    )?;

    // Recalculate metrics
    recalculate_investment_metrics(conn, &investment_id)?;

    Ok((
        format!(
            "{} {} {} @ {}",
            tx_type_lower.to_uppercase(),
            quantity,
            ticker_upper,
            price_per_unit
        ),
        transaction_date,
        ticker_upper,
    ))
}

/// Create investment with optional initial transaction
/// This is the main entry point for creating investments with transactions
pub fn create_investment_with_transaction(
    conn: &rusqlite::Connection,
    ticker: &str,
    company_name: &str,
    initial_quantity: Option<&str>,
    initial_avg_price: Option<&str>,
    initial_transaction: Option<&InsertInvestmentTransaction>,
) -> Result<StockInvestment> {
    let ticker_upper = ticker.to_uppercase();

    // Determine currency from initial transaction (first transaction sets the currency)
    let currency = initial_transaction
        .map(|tx| tx.currency.as_str())
        .unwrap_or("CZK");

    // Get or create the investment
    let investment_id = get_or_create_investment(
        conn,
        &ticker_upper,
        company_name,
        currency,
        initial_quantity,
        initial_avg_price,
    )?;

    // Create initial transaction if provided
    if let Some(tx) = initial_transaction {
        create_transaction_internal(
            conn,
            &investment_id,
            &ticker_upper,
            company_name,
            &tx.tx_type,
            &tx.quantity,
            &tx.price_per_unit,
            &tx.currency,
            tx.transaction_date,
        )?;

        // Recalculate metrics from the transaction
        recalculate_investment_metrics(conn, &investment_id)?;
    }

    // Return the investment
    get_investment_by_id(conn, &investment_id)
}

/// Add a transaction to an existing investment
/// Validates that transaction currency matches investment currency
pub fn add_transaction_to_investment(
    conn: &rusqlite::Connection,
    investment_id: &str,
    data: &InsertInvestmentTransaction,
) -> Result<InvestmentTransaction> {
    // Get investment info including currency
    let (ticker, company_name, inv_currency): (String, String, String) = conn.query_row(
        "SELECT ticker, company_name, currency FROM stock_investments WHERE id = ?1",
        [investment_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;

    // Validate currency matches
    if inv_currency.to_uppercase() != data.currency.to_uppercase() {
        return Err(AppError::Validation(format!(
            "Currency mismatch: {} uses {} but transaction is in {}. All transactions for a stock must use the same currency.",
            ticker, inv_currency, data.currency
        )));
    }

    let tx = create_transaction_internal(
        conn,
        investment_id,
        &ticker,
        &company_name,
        &data.tx_type,
        &data.quantity,
        &data.price_per_unit,
        &data.currency,
        data.transaction_date,
    )?;

    recalculate_investment_metrics(conn, investment_id)?;

    Ok(tx)
}

/// Get value history for a specific stock ticker
pub fn get_value_history(
    conn: &rusqlite::Connection,
    ticker: &str,
    start_date: Option<i64>,
    end_date: Option<i64>,
) -> Result<Vec<crate::models::TickerValueHistory>> {
    let ticker_upper = ticker.to_uppercase();

    let mut query = String::from(
        "SELECT ticker, recorded_at, value_czk, quantity, price, currency 
         FROM stock_value_history 
         WHERE ticker = ?",
    );

    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    params.push(Box::new(ticker_upper));

    if let Some(start) = start_date {
        query.push_str(" AND recorded_at >= ?");
        params.push(Box::new(start));
    }
    if let Some(end) = end_date {
        query.push_str(" AND recorded_at <= ?");
        params.push(Box::new(end));
    }

    query.push_str(" ORDER BY recorded_at DESC");

    let mut stmt = conn.prepare(&query)?;

    let rows = stmt.query_map(rusqlite::params_from_iter(params), |row| {
        Ok(crate::models::TickerValueHistory {
            ticker: row.get(0)?,
            recorded_at: row.get(1)?,
            value_czk: row.get(2)?,
            quantity: row.get(3)?,
            price: row.get(4)?,
            currency: row.get(5)?,
        })
    })?;

    let histories: Vec<crate::models::TickerValueHistory> = rows.filter_map(|r| r.ok()).collect();
    Ok(histories)
}

/// Convert a Unix timestamp to a "YYYY-MM-DD" date string (UTC).
fn ts_to_date_str(ts: i64) -> String {
    DateTime::from_timestamp(ts, 0)
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_default()
}

/// Find the most recent (value_czk, quantity) for a ticker at or before `target_ts`.
///
/// # Precondition
/// The entries in `history` must be sorted by timestamp ascending (as returned
/// by the SQL `ORDER BY ticker, recorded_at ASC` query in `compute_twr_for_tickers`).
fn lookup_ticker_at(
    history: &HashMap<String, Vec<(i64, f64, f64)>>,
    ticker: &str,
    target_ts: i64,
) -> (f64, f64) {
    history
        .get(ticker)
        .and_then(|entries| {
            entries
                .iter()
                .rev()
                .find(|(ts, _, _)| *ts <= target_ts)
                .map(|(_, val, qty)| (*val, *qty))
        })
        .unwrap_or((0.0, 0.0))
}

/// Compute daily chain-linked time-weighted return for a group of tickers.
///
/// Returns one `TwrDataPoint` per calendar day from `from_ts` to `to_ts` inclusive.
/// The first point is always `{ date: from_ts, twr: 0.0 }`.
/// Cash flows are estimated from quantity changes in `stock_value_history`.
///
/// `from_ts` and `to_ts` must be Unix timestamps (seconds, midnight UTC).
pub fn compute_twr_for_tickers(
    conn: &rusqlite::Connection,
    tickers: &[String],
    from_ts: i64,
    to_ts: i64,
) -> Result<Vec<crate::models::TwrDataPoint>> {
    if tickers.is_empty() {
        return Ok(vec![crate::models::TwrDataPoint {
            date: ts_to_date_str(from_ts),
            twr: 0.0,
        }]);
    }

    // Build SQL with two IN clause copies (tickers appear twice: once for main range, once for pre-range lookup)
    // params: ?1=from_ts, ?2=to_ts, ?3..?(n+2)=tickers (main range), ?(n+3)..?(2n+2)=tickers (pre-range)
    let n = tickers.len();
    let main_placeholders: Vec<String> = (3..=n + 2).map(|i| format!("?{i}")).collect();
    let pre_placeholders: Vec<String> = (n + 3..=2 * n + 2).map(|i| format!("?{i}")).collect();
    let sql = format!(
        "SELECT ticker, recorded_at, CAST(value_czk AS REAL), CAST(quantity AS REAL) \
         FROM stock_value_history \
         WHERE ticker IN ({main}) AND recorded_at >= ?1 AND recorded_at <= ?2 \
         UNION ALL \
         SELECT s.ticker, s.recorded_at, CAST(s.value_czk AS REAL), CAST(s.quantity AS REAL) \
         FROM stock_value_history s \
         WHERE s.ticker IN ({pre}) \
           AND s.recorded_at = ( \
               SELECT MAX(recorded_at) FROM stock_value_history \
               WHERE ticker = s.ticker AND recorded_at < ?1 \
           ) \
         ORDER BY ticker, recorded_at ASC",
        main = main_placeholders.join(", "),
        pre = pre_placeholders.join(", "),
    );

    let params: Vec<Value> = std::iter::once(Value::Integer(from_ts))
        .chain(std::iter::once(Value::Integer(to_ts)))
        .chain(tickers.iter().map(|t| Value::Text(t.clone()))) // main range
        .chain(tickers.iter().map(|t| Value::Text(t.clone()))) // pre-range
        .collect();

    let mut history: HashMap<String, Vec<(i64, f64, f64)>> = HashMap::new();
    {
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(params_from_iter(params), |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, f64>(3)?,
            ))
        })?;
        for row in rows {
            let (ticker, ts, val, qty) = row?;
            history.entry(ticker).or_default().push((ts, val, qty));
        }
    }

    let mut result = vec![crate::models::TwrDataPoint {
        date: ts_to_date_str(from_ts),
        twr: 0.0,
    }];
    let mut twr_factor = 1.0f64;
    let mut day = from_ts + 86400;

    while day <= to_ts {
        let prev_day = day - 86400;
        let mut v_curr = 0.0f64;
        let mut v_prev = 0.0f64;
        let mut cf = 0.0f64;

        for ticker in tickers {
            let (val_curr, qty_curr) = lookup_ticker_at(&history, ticker, day);
            let (val_prev, qty_prev) = lookup_ticker_at(&history, ticker, prev_day);
            v_curr += val_curr;
            v_prev += val_prev;

            let delta_qty = qty_curr - qty_prev;
            if delta_qty.abs() > 1e-9 {
                let price_czk = if qty_curr > 1e-9 {
                    val_curr / qty_curr
                } else if qty_prev > 1e-9 {
                    val_prev / qty_prev
                } else {
                    0.0
                };
                cf += delta_qty * price_czk;
            }
        }

        let denominator = v_prev + cf;
        if denominator > 1e-9 {
            let daily_r = (v_curr - v_prev - cf) / denominator;
            twr_factor *= 1.0 + daily_r;
        }

        result.push(crate::models::TwrDataPoint {
            date: ts_to_date_str(day),
            twr: (twr_factor - 1.0) * 100.0,
        });

        day += 86400;
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_get_value_history_sql_construction() {
        let conn = Connection::open_in_memory().unwrap();

        // Create table
        conn.execute(
            "CREATE TABLE stock_value_history (
                ticker TEXT NOT NULL,
                recorded_at INTEGER NOT NULL,
                value_czk TEXT NOT NULL,
                quantity TEXT NOT NULL,
                price TEXT NOT NULL,
                currency TEXT NOT NULL
            )",
            [],
        )
        .unwrap();

        // Insert dummy data
        conn.execute(
            "INSERT INTO stock_value_history (ticker, recorded_at, value_czk, quantity, price, currency)
             VALUES ('AAPL', 1000, '1000', '10', '100', 'USD')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO stock_value_history (ticker, recorded_at, value_czk, quantity, price, currency)
             VALUES ('AAPL', 2000, '2000', '10', '200', 'USD')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO stock_value_history (ticker, recorded_at, value_czk, quantity, price, currency)
             VALUES ('AAPL', 3000, '3000', '10', '300', 'USD')",
            [],
        ).unwrap();

        // Test 1: No dates (All) - Should NOT fail
        let history = get_value_history(&conn, "AAPL", None, None).unwrap();
        assert_eq!(history.len(), 3);

        // Test 2: Start date only
        let history = get_value_history(&conn, "AAPL", Some(2000), None).unwrap();
        assert_eq!(history.len(), 2); // 2000 and 3000

        // Test 3: End date only
        let history = get_value_history(&conn, "AAPL", None, Some(2000)).unwrap();
        assert_eq!(history.len(), 2); // 1000 and 2000

        // Test 4: Both dates
        let history = get_value_history(&conn, "AAPL", Some(2000), Some(2500)).unwrap();
        assert_eq!(history.len(), 1); // Only 2000
    }

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(
            r#"
            CREATE TABLE stock_investments (
                id TEXT PRIMARY KEY,
                ticker TEXT NOT NULL UNIQUE,
                company_name TEXT NOT NULL,
                quantity TEXT NOT NULL DEFAULT '0',
                average_price TEXT NOT NULL DEFAULT '0',
                currency TEXT NOT NULL DEFAULT 'CZK'
            );

            CREATE TABLE investment_transactions (
                id TEXT PRIMARY KEY,
                investment_id TEXT NOT NULL,
                type TEXT NOT NULL,
                ticker TEXT NOT NULL,
                company_name TEXT NOT NULL,
                quantity TEXT NOT NULL,
                price_per_unit TEXT NOT NULL,
                currency TEXT NOT NULL,
                transaction_date INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );
            "#,
        )
        .expect("schema");
        conn
    }

    #[test]
    fn test_get_or_create_investment_creates_new() {
        let conn = setup_test_db();
        let id = get_or_create_investment(&conn, "AAPL", "Apple Inc.", "USD", None, None)
            .expect("create");
        assert!(!id.is_empty());

        // Second call returns same id
        let id2 = get_or_create_investment(&conn, "AAPL", "Apple Inc.", "USD", None, None)
            .expect("get existing");
        assert_eq!(id, id2);
    }

    #[test]
    fn test_get_or_create_investment_upcases_ticker() {
        let conn = setup_test_db();
        let id1 =
            get_or_create_investment(&conn, "aapl", "Apple", "USD", None, None).expect("lowercase");
        let id2 =
            get_or_create_investment(&conn, "AAPL", "Apple", "USD", None, None).expect("uppercase");
        assert_eq!(id1, id2);
    }

    #[test]
    fn test_recalculate_metrics_buy_only() {
        let conn = setup_test_db();
        let investment_id = get_or_create_investment(&conn, "MSFT", "Microsoft", "USD", None, None)
            .expect("create");

        conn.execute(
            "INSERT INTO investment_transactions
             (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at)
             VALUES ('tx1', ?1, 'buy', 'MSFT', 'Microsoft', '10', '300', 'USD', 0, 0)",
            [&investment_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO investment_transactions
             (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at)
             VALUES ('tx2', ?1, 'buy', 'MSFT', 'Microsoft', '5', '360', 'USD', 0, 0)",
            [&investment_id],
        )
        .unwrap();

        recalculate_investment_metrics(&conn, &investment_id).expect("recalc");

        let inv = get_investment_by_id(&conn, &investment_id).expect("get");
        let qty: f64 = inv.quantity.parse().unwrap();
        let avg: f64 = inv.average_price.parse().unwrap();
        assert_eq!(qty, 15.0);
        // avg = (10*300 + 5*360) / 15 = 4800/15 = 320
        assert!((avg - 320.0).abs() < 0.01);
    }

    #[test]
    fn test_recalculate_metrics_buy_then_sell() {
        let conn = setup_test_db();
        let investment_id =
            get_or_create_investment(&conn, "TSLA", "Tesla", "USD", None, None).expect("create");

        conn.execute(
            "INSERT INTO investment_transactions
             (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at)
             VALUES ('tx1', ?1, 'buy', 'TSLA', 'Tesla', '20', '200', 'USD', 0, 0)",
            [&investment_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO investment_transactions
             (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at)
             VALUES ('tx2', ?1, 'sell', 'TSLA', 'Tesla', '8', '250', 'USD', 1, 0)",
            [&investment_id],
        )
        .unwrap();

        recalculate_investment_metrics(&conn, &investment_id).expect("recalc");

        let inv = get_investment_by_id(&conn, &investment_id).expect("get");
        let qty: f64 = inv.quantity.parse().unwrap();
        assert_eq!(qty, 12.0);
        let avg: f64 = inv.average_price.parse().unwrap();
        assert!((avg - 200.0).abs() < 0.01);
    }

    #[test]
    fn test_import_single_transaction_invalid_type() {
        let conn = setup_test_db();
        let result =
            import_single_transaction(&conn, "AAPL", "Apple", "hold", "10", "150", "USD", 0);
        assert!(result.is_err());
    }

    #[test]
    fn test_import_single_transaction_sell_without_position() {
        let conn = setup_test_db();
        let result =
            import_single_transaction(&conn, "GOOG", "Google", "sell", "5", "100", "USD", 0);
        assert!(result.is_err());
    }

    #[test]
    fn test_import_single_transaction_buy_creates_investment() {
        let conn = setup_test_db();
        let result = import_single_transaction(
            &conn,
            "nvda",
            "NVIDIA",
            "buy",
            "3",
            "500",
            "USD",
            1_700_000_000,
        );
        assert!(result.is_ok());
        let (desc, _date, ticker) = result.unwrap();
        assert_eq!(ticker, "NVDA");
        assert!(desc.contains("BUY"));
    }

    #[test]
    fn test_import_single_transaction_currency_mismatch() {
        let conn = setup_test_db();
        import_single_transaction(&conn, "AMD", "AMD", "buy", "10", "100", "USD", 0).unwrap();
        let result = import_single_transaction(&conn, "AMD", "AMD", "buy", "5", "90", "EUR", 1);
        assert!(result.is_err());
    }

    fn setup_twr_db() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE stock_value_history (
                id TEXT PRIMARY KEY,
                ticker TEXT NOT NULL,
                recorded_at INTEGER NOT NULL,
                value_czk TEXT NOT NULL,
                quantity TEXT NOT NULL,
                price TEXT NOT NULL,
                currency TEXT NOT NULL,
                UNIQUE(ticker, recorded_at)
            );",
        )
        .unwrap();
        conn
    }

    #[test]
    fn test_twr_buy_does_not_inflate_return() {
        // Day 0: 10 AAPL @ 100 CZK = 1000 CZK
        // Day 1: buy 10 more @ 100 CZK → 20 @ 100 = 2000 (CF = 1000, pure cash-in, no price gain)
        // Day 2: price rises to 110 → 20 @ 110 = 2200 (no transaction, pure gain = 10%)
        // Expected TWR: day0=0%, day1=0%, day2=10%
        let conn = setup_twr_db();
        let day0: i64 = 1_700_000_000 / 86400 * 86400;
        let day1 = day0 + 86400;
        let day2 = day0 + 2 * 86400;
        conn.execute_batch(&format!(
            "INSERT INTO stock_value_history (id, ticker, recorded_at, value_czk, quantity, price, currency) VALUES
             ('a', 'AAPL', {day0}, '1000.0', '10.0', '100.0', 'USD'),
             ('b', 'AAPL', {day1}, '2000.0', '20.0', '100.0', 'USD'),
             ('c', 'AAPL', {day2}, '2200.0', '20.0', '110.0', 'USD');"
        ))
        .unwrap();

        let result = compute_twr_for_tickers(&conn, &["AAPL".to_string()], day0, day2).unwrap();
        assert_eq!(result.len(), 3);
        assert!((result[0].twr - 0.0).abs() < 0.01, "day0 should be 0%");
        assert!(
            (result[1].twr - 0.0).abs() < 0.01,
            "buy should not inflate TWR"
        );
        assert!(
            (result[2].twr - 10.0).abs() < 0.1,
            "price gain should be ~10%"
        );
    }

    #[test]
    fn test_twr_pure_price_appreciation() {
        // No transactions: daily chain TWR equals simple cumulative return
        let conn = setup_twr_db();
        let day0: i64 = 1_700_200_000 / 86400 * 86400;
        let day1 = day0 + 86400;
        let day2 = day0 + 2 * 86400;
        conn.execute_batch(&format!(
            "INSERT INTO stock_value_history (id, ticker, recorded_at, value_czk, quantity, price, currency) VALUES
             ('a', 'AAPL', {day0}, '1000.0', '10.0', '100.0', 'USD'),
             ('b', 'AAPL', {day1}, '1050.0', '10.0', '105.0', 'USD'),
             ('c', 'AAPL', {day2}, '1100.0', '10.0', '110.0', 'USD');"
        ))
        .unwrap();

        let result = compute_twr_for_tickers(&conn, &["AAPL".to_string()], day0, day2).unwrap();
        assert_eq!(result.len(), 3);
        assert!((result[0].twr - 0.0).abs() < 0.01);
        // day1: (1050-1000)/1000 = 5%
        assert!((result[1].twr - 5.0).abs() < 0.1);
        // day2: 1.05 * (1100/1050) - 1 ≈ 10%
        assert!((result[2].twr - 10.0).abs() < 0.5);
    }

    #[test]
    fn test_twr_empty_tickers_returns_single_zero_point() {
        let conn = setup_twr_db();
        let day0: i64 = 1_700_400_000 / 86400 * 86400;
        let day1 = day0 + 86400;
        let result = compute_twr_for_tickers(&conn, &[], day0, day1).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].twr, 0.0);
    }
}
