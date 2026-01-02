//! Crypto investments business logic service
//!
//! All business logic for crypto investments lives here.
//! Commands should only validate input, call these functions, and handle events.
//! This is the SINGLE SOURCE OF TRUTH for crypto investment operations.

use crate::error::Result;
use crate::models::{CryptoInvestment, CryptoTransaction, InsertCryptoTransaction};
use crate::services::currency::convert_to_czk;
use uuid::Uuid;

/// Recalculate crypto investment metrics from transactions
/// SINGLE SOURCE OF TRUTH for crypto metrics calculation
/// Recalculate crypto investment metrics from transactions
/// SINGLE SOURCE OF TRUTH for crypto metrics calculation
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
                currency,
            ))
        })?
        .filter_map(|r| r.ok())
        .collect();

    let mut total_qty = 0.0f64;
    let mut total_cost = 0.0f64;

    for (tx_type, qty, price, currency) in txs {
        // Convert price to CZK (base currency)
        let price_czk = convert_to_czk(price, &currency);

        if tx_type == "buy" {
            total_cost += qty * price_czk;
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

    conn.execute(
        "UPDATE crypto_investments SET quantity = ?1, average_price = ?2 WHERE id = ?3",
        rusqlite::params![total_qty.to_string(), avg_price.to_string(), investment_id],
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
