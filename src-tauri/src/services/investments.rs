//! Investment business logic service
//!
//! All business logic for investments lives here.
//! Commands should only validate input, call these functions, and handle events.
//! This is the SINGLE SOURCE OF TRUTH for investment operations.

use crate::error::{AppError, Result};
use crate::models::{InsertInvestmentTransaction, InvestmentTransaction, StockInvestment};
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
            currency,
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
        currency: currency.to_string(),
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

            conn.execute(
                "INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price, currency)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![id, ticker_upper, company_name, qty, avg, currency],
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
