//! Crypto investments business logic service
//!
//! All business logic for crypto investments lives here.
//! Commands should only validate input, call these functions, and handle events.
//! This is the SINGLE SOURCE OF TRUTH for crypto investment operations.

use crate::error::Result;
use crate::models::{CryptoInvestment, CryptoTransaction, InsertCryptoTransaction};
use crate::services::currency::convert_between;
use uuid::Uuid;

/// Recalculate crypto investment metrics from transactions
/// SINGLE SOURCE OF TRUTH for crypto metrics calculation
/// NOTE: Average price is calculated in the investment's native currency (from first transaction)
/// Transactions in other currencies are converted to the native currency before averaging
pub fn recalculate_crypto_metrics(conn: &rusqlite::Connection, investment_id: &str) -> Result<()> {
    // Get all transactions for this investment (including currency), sorted by date
    let mut stmt = conn.prepare(
        "SELECT type, quantity, price_per_unit, currency FROM crypto_transactions WHERE investment_id = ?1 ORDER BY transaction_date ASC, created_at ASC"
    )?;

    let txs: Vec<(String, f64, f64, String)> = stmt
        .query_map([investment_id], |row| {
            let tx_type: String = row.get(0)?;
            let qty: String = row.get(1)?;
            let price: String = row.get(2)?;
            let currency: String = row.get(3)?;
            Ok((
                tx_type,
                qty.parse().unwrap_or(0.0),
                price.parse().unwrap_or(0.0),
                currency.to_uppercase(),
            ))
        })?
        .filter_map(|r| r.ok())
        .collect();

    // If no transactions, nothing to recalculate
    if txs.is_empty() {
        return Ok(());
    }

    // Native currency is the currency of the first transaction
    let native_currency = txs[0].3.clone();

    let mut total_qty = 0.0f64;
    let mut total_cost = 0.0f64;

    for (tx_type, qty, price, currency) in txs {
        // Convert price to native currency if different
        let price_in_native = if currency == native_currency {
            price
        } else {
            convert_between(price, &currency, &native_currency)
        };

        if tx_type == "buy" {
            total_cost += qty * price_in_native;
            total_qty += qty;
        } else if tx_type == "sell" {
            // Reduce quantity, adjust cost proportionally
            if total_qty > 0.0 {
                let avg_cost = total_cost / total_qty;
                total_cost -= qty * avg_cost;
            }
            total_qty -= qty;
        }
    }

    // Prevent negative values
    if total_qty < 0.0 {
        total_qty = 0.0;
    }
    if total_cost < 0.0 {
        total_cost = 0.0;
    }

    let avg_price = if total_qty > 0.0 {
        total_cost / total_qty
    } else {
        0.0
    };

    // Update both average_price (in native currency) and currency column
    conn.execute(
        "UPDATE crypto_investments SET quantity = ?1, average_price = ?2, currency = ?3 WHERE id = ?4",
        rusqlite::params![total_qty.to_string(), avg_price.to_string(), native_currency, investment_id],
    )?;

    Ok(())
}

/// Internal function to create a crypto transaction record
/// Used by both single-create and potential future bulk import
/// This is the SINGLE SOURCE OF TRUTH for crypto transaction creation
#[allow(clippy::too_many_arguments)]
pub fn create_crypto_transaction_internal(
    conn: &rusqlite::Connection,
    investment_id: &str,
    ticker: &str,
    name: &str,
    tx_type: &str,
    quantity: &str,
    price_per_unit: &str,
    currency: &str,
    transaction_date: i64,
) -> Result<CryptoTransaction> {
    let tx_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT INTO crypto_transactions
         (id, investment_id, type, ticker, name, quantity, price_per_unit, currency, transaction_date, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            tx_id,
            investment_id,
            tx_type,
            ticker,
            name,
            quantity,
            price_per_unit,
            currency,
            transaction_date,
            now,
        ],
    )?;

    Ok(CryptoTransaction {
        id: tx_id,
        investment_id: investment_id.to_string(),
        tx_type: tx_type.to_string(),
        ticker: ticker.to_string(),
        name: name.to_string(),
        quantity: quantity.to_string(),
        price_per_unit: price_per_unit.to_string(),
        currency: currency.to_string(),
        transaction_date,
        created_at: now,
    })
}

/// Get or create a crypto investment by ticker
/// Returns the investment ID
/// This is the SINGLE SOURCE OF TRUTH for crypto investment lookup/creation
pub fn get_or_create_crypto(
    conn: &rusqlite::Connection,
    ticker: &str,
    coingecko_id: Option<&str>,
    name: &str,
    initial_quantity: Option<&str>,
    initial_avg_price: Option<&str>,
) -> Result<String> {
    let ticker_upper = ticker.to_uppercase();

    // Check if investment already exists
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM crypto_investments WHERE ticker = ?1",
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

            conn.execute(
                "INSERT INTO crypto_investments (id, ticker, coingecko_id, name, quantity, average_price)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![id, ticker_upper, coingecko_id, name, qty, avg],
            )?;
            Ok(id)
        }
    }
}

/// Get crypto investment details by ID
pub fn get_crypto_by_id(
    conn: &rusqlite::Connection,
    investment_id: &str,
) -> Result<CryptoInvestment> {
    let inv = conn.query_row(
        "SELECT id, ticker, coingecko_id, name, quantity, average_price FROM crypto_investments WHERE id = ?1",
        [investment_id],
        |row| {
            Ok(CryptoInvestment {
                id: row.get(0)?,
                ticker: row.get(1)?,
                coingecko_id: row.get(2)?,
                name: row.get(3)?,
                quantity: row.get(4)?,
                average_price: row.get(5)?,
            })
        },
    )?;
    Ok(inv)
}

/// Create crypto investment with optional initial transaction
/// This is the main entry point for creating crypto investments with transactions
pub fn create_crypto_with_transaction(
    conn: &rusqlite::Connection,
    ticker: &str,
    coingecko_id: Option<&str>,
    name: &str,
    initial_quantity: Option<&str>,
    initial_avg_price: Option<&str>,
    initial_transaction: Option<&InsertCryptoTransaction>,
) -> Result<CryptoInvestment> {
    let ticker_upper = ticker.to_uppercase();

    // Get or create the investment
    let investment_id = get_or_create_crypto(
        conn,
        &ticker_upper,
        coingecko_id,
        name,
        initial_quantity,
        initial_avg_price,
    )?;

    // Create initial transaction if provided
    if let Some(tx) = initial_transaction {
        create_crypto_transaction_internal(
            conn,
            &investment_id,
            &ticker_upper,
            name,
            &tx.tx_type,
            &tx.quantity,
            &tx.price_per_unit,
            &tx.currency,
            tx.transaction_date,
        )?;

        // Recalculate metrics from the transaction
        recalculate_crypto_metrics(conn, &investment_id)?;
    }

    // Return the investment
    get_crypto_by_id(conn, &investment_id)
}

/// Add a transaction to an existing crypto investment
pub fn add_transaction_to_crypto(
    conn: &rusqlite::Connection,
    investment_id: &str,
    data: &InsertCryptoTransaction,
) -> Result<CryptoTransaction> {
    // Get crypto investment info
    let (ticker, name): (String, String) = conn.query_row(
        "SELECT ticker, name FROM crypto_investments WHERE id = ?1",
        [investment_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;

    let tx = create_crypto_transaction_internal(
        conn,
        investment_id,
        &ticker,
        &name,
        &data.tx_type,
        &data.quantity,
        &data.price_per_unit,
        &data.currency,
        data.transaction_date,
    )?;

    recalculate_crypto_metrics(conn, investment_id)?;

    Ok(tx)
}

/// Get value history for a specific crypto ticker
pub fn get_value_history(
    conn: &rusqlite::Connection,
    ticker: &str,
    start_date: Option<i64>,
    end_date: Option<i64>,
) -> Result<Vec<crate::models::TickerValueHistory>> {
    let ticker_upper = ticker.to_uppercase();

    let mut query = String::from(
        "SELECT ticker, recorded_at, value_czk, quantity, price, currency 
         FROM crypto_value_history 
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

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_get_value_history_sql_construction() {
        let conn = Connection::open_in_memory().unwrap();

        // Create table
        conn.execute(
            "CREATE TABLE crypto_value_history (
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
            "INSERT INTO crypto_value_history (ticker, recorded_at, value_czk, quantity, price, currency)
             VALUES ('BTC', 1000, '1000', '1', '10000', 'USD')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO crypto_value_history (ticker, recorded_at, value_czk, quantity, price, currency)
             VALUES ('BTC', 2000, '2000', '1', '20000', 'USD')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO crypto_value_history (ticker, recorded_at, value_czk, quantity, price, currency)
             VALUES ('BTC', 3000, '3000', '1', '30000', 'USD')",
            [],
        ).unwrap();

        // Test 1: No dates (All) - Should NOT fail
        let history = get_value_history(&conn, "BTC", None, None).unwrap();
        assert_eq!(history.len(), 3);

        // Test 2: Start date only
        let history = get_value_history(&conn, "BTC", Some(2000), None).unwrap();
        assert_eq!(history.len(), 2); // 2000 and 3000

        // Test 3: End date only
        let history = get_value_history(&conn, "BTC", None, Some(2000)).unwrap();
        assert_eq!(history.len(), 2); // 1000 and 2000

        // Test 4: Both dates
        let history = get_value_history(&conn, "BTC", Some(2000), Some(2500)).unwrap();
        assert_eq!(history.len(), 1); // Only 2000
    }
}
