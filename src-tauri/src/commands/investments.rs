//! Investment commands

use crate::commands::portfolio;
use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{
    DividendOverride, EnrichedStockInvestment, InsertInvestmentTransaction, InsertStockInvestment,
    InvestmentTransaction, StockInvestment, StockPriceOverride,
};
use crate::services::currency::convert_to_czk;
use tauri::State;
use uuid::Uuid;

/// Get all investments with enriched price data
#[tauri::command]
pub async fn get_all_investments(db: State<'_, Database>) -> Result<Vec<EnrichedStockInvestment>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, ticker, company_name, quantity, average_price FROM stock_investments",
        )?;

        let investments: Vec<StockInvestment> = stmt
            .query_map([], |row| {
                Ok(StockInvestment {
                    id: row.get(0)?,
                    ticker: row.get(1)?,
                    company_name: row.get(2)?,
                    quantity: row.get(3)?,
                    average_price: row.get(4)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        // Enrich with price data
        let mut enriched = Vec::new();
        for inv in investments {
            enriched.push(enrich_investment(conn, inv)?);
        }

        Ok(enriched)
    })
}

/// Get a single investment by ID with enriched price data
#[tauri::command]
pub async fn get_investment(
    db: State<'_, Database>,
    id: String,
) -> Result<EnrichedStockInvestment> {
    db.with_conn(|conn| {
        let inv = conn.query_row(
            "SELECT id, ticker, company_name, quantity, average_price FROM stock_investments WHERE id = ?1",
            [&id],
            |row| {
                Ok(StockInvestment {
                    id: row.get(0)?,
                    ticker: row.get(1)?,
                    company_name: row.get(2)?,
                    quantity: row.get(3)?,
                    average_price: row.get(4)?,
                })
            },
        )?;


        enrich_investment(conn, inv)
    })
}

/// Helper function to enrich a stock investment with price and dividend data
fn enrich_investment(
    conn: &rusqlite::Connection,
    inv: StockInvestment,
) -> Result<EnrichedStockInvestment> {
    // Get price override
    let override_price: Option<(String, String, i64)> = conn
        .query_row(
            "SELECT price, currency, updated_at FROM stock_price_overrides WHERE ticker = ?1",
            [&inv.ticker],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .ok();

    // Get global price
    let global_price: Option<(String, String, i64)> = conn
        .query_row(
            "SELECT original_price, currency, fetched_at FROM stock_data WHERE ticker = ?1",
            [&inv.ticker],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .ok();

    // Determine active price - keep original price and currency, plus convert to CZK
    let (original_price, currency, current_price, fetched_at, is_manual) =
        match (&override_price, &global_price) {
            (Some((op, oc, ou)), Some((_, _, gu))) if *ou > *gu => (
                op.clone(),
                oc.clone(),
                convert_to_czk(op.parse().unwrap_or(0.0), oc),
                Some(*ou),
                true,
            ),
            (Some((op, oc, ou)), None) => (
                op.clone(),
                oc.clone(),
                convert_to_czk(op.parse().unwrap_or(0.0), oc),
                Some(*ou),
                true,
            ),
            (_, Some((gp, gc, gu))) => (
                gp.clone(),
                gc.clone(),
                convert_to_czk(gp.parse().unwrap_or(0.0), gc),
                Some(*gu),
                false,
            ),
            _ => ("0".to_string(), "CZK".to_string(), 0.0, None, false),
        };

    // Get dividend data
    let user_dividend: Option<(String, String)> = conn
        .query_row(
            "SELECT yearly_dividend_sum, currency FROM dividend_overrides WHERE ticker = ?1",
            [&inv.ticker],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok();

    let global_dividend: Option<(String, String)> = conn
        .query_row(
            "SELECT yearly_dividend_sum, currency FROM dividend_data WHERE ticker = ?1",
            [&inv.ticker],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok();

    // Get original dividend and currency
    let (original_dividend_yield, dividend_currency, dividend_yield, is_manual_dividend) =
        match (&user_dividend, &global_dividend) {
            (Some((sum, curr)), _) => {
                let orig = sum.parse().unwrap_or(0.0);
                (orig, curr.clone(), convert_to_czk(orig, curr), true)
            }
            (None, Some((sum, curr))) => {
                let orig = sum.parse().unwrap_or(0.0);
                (orig, curr.clone(), convert_to_czk(orig, curr), false)
            }
            _ => (0.0, "CZK".to_string(), 0.0, false),
        };

    Ok(EnrichedStockInvestment {
        id: inv.id,
        ticker: inv.ticker,
        company_name: inv.company_name,
        quantity: inv.quantity,
        average_price: inv.average_price,
        current_price: current_price.to_string(),
        original_price,
        currency,
        fetched_at,
        is_manual_price: is_manual,
        dividend_yield,
        original_dividend_yield,
        dividend_currency,
        is_manual_dividend,
    })
}

/// Create investment
#[tauri::command]
pub async fn create_investment(
    db: State<'_, Database>,
    data: InsertStockInvestment,
    initial_transaction: Option<InsertInvestmentTransaction>,
) -> Result<StockInvestment> {
    let ticker = data.ticker.to_uppercase();

    db.with_conn(|conn| {
        // Check if investment already exists
        let existing: Option<String> = conn.query_row(
            "SELECT id FROM stock_investments WHERE ticker = ?1",
            [&ticker],
            |row| row.get(0),
        ).ok();

        let investment_id = if let Some(id) = existing {
            id
        } else {
            let id = Uuid::new_v4().to_string();
            let avg_price = data.average_price.clone().unwrap_or_else(|| "0".to_string());
            let qty = data.quantity.clone().unwrap_or_else(|| "0".to_string());

            conn.execute(
                "INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![id, ticker, data.company_name, qty, avg_price],
            )?;
            id
        };

        // Create initial transaction if provided
        if let Some(tx) = initial_transaction {
            let tx_id = Uuid::new_v4().to_string();
            let now = chrono::Utc::now().timestamp();

            conn.execute(
                "INSERT INTO investment_transactions
                 (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                rusqlite::params![
                    tx_id,
                    investment_id,
                    tx.tx_type,
                    ticker,
                    data.company_name,
                    tx.quantity,
                    tx.price_per_unit,
                    tx.currency,
                    tx.transaction_date,
                    now,
                ],
            )?;

            // Recalculate quantity and average price from the transaction
            recalculate_investment(conn, &investment_id)?;
        }

        // Return the investment
        let inv = conn.query_row(
            "SELECT id, ticker, company_name, quantity, average_price FROM stock_investments WHERE id = ?1",
            [&investment_id],
            |row| Ok(StockInvestment {
                id: row.get(0)?,
                ticker: row.get(1)?,
                company_name: row.get(2)?,
                quantity: row.get(3)?,
                average_price: row.get(4)?,
            }),
        )?;

        Ok(inv)
    })
}

/// Delete investment
#[tauri::command]
pub async fn delete_investment(db: State<'_, Database>, id: String) -> Result<()> {
    db.with_conn(|conn| {
        let changes = conn.execute("DELETE FROM stock_investments WHERE id = ?1", [&id])?;
        if changes == 0 {
            return Err(AppError::NotFound("Investment not found".into()));
        }
        Ok(())
    })
}

/// Get transactions for investment
#[tauri::command]
pub async fn get_investment_transactions(
    db: State<'_, Database>,
    investment_id: String,
) -> Result<Vec<InvestmentTransaction>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, investment_id, type, ticker, company_name, quantity, price_per_unit,
                    currency, transaction_date, created_at
             FROM investment_transactions WHERE investment_id = ?1
             ORDER BY transaction_date DESC",
        )?;

        let txs = stmt
            .query_map([&investment_id], |row| {
                Ok(InvestmentTransaction {
                    id: row.get(0)?,
                    investment_id: row.get(1)?,
                    tx_type: row.get(2)?,
                    ticker: row.get(3)?,
                    company_name: row.get(4)?,
                    quantity: row.get(5)?,
                    price_per_unit: row.get(6)?,
                    currency: row.get(7)?,
                    transaction_date: row.get(8)?,
                    created_at: row.get(9)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(txs)
    })
}

/// Create transaction
#[tauri::command]
pub async fn create_investment_transaction(
    db: State<'_, Database>,
    investment_id: String,
    data: InsertInvestmentTransaction,
) -> Result<InvestmentTransaction> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    let result = db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO investment_transactions
             (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                id,
                investment_id,
                data.tx_type,
                data.ticker,
                data.company_name,
                data.quantity,
                data.price_per_unit,
                data.currency,
                data.transaction_date,
                now,
            ],
        )?;

        recalculate_investment(conn, &investment_id)?;

        Ok(InvestmentTransaction {
            id,
            investment_id,
            tx_type: data.tx_type,
            ticker: data.ticker,
            company_name: data.company_name,
            quantity: data.quantity,
            price_per_unit: data.price_per_unit,
            currency: data.currency,
            transaction_date: data.transaction_date,
            created_at: now,
        })
    })?;

    // Update portfolio snapshot
    portfolio::update_todays_snapshot(&db).await.ok();

    Ok(result)
}

/// Delete transaction
#[tauri::command]
pub async fn delete_investment_transaction(db: State<'_, Database>, tx_id: String) -> Result<()> {
    db.with_conn(|conn| {
        // Get investment_id before deleting
        let investment_id: String = conn.query_row(
            "SELECT investment_id FROM investment_transactions WHERE id = ?1",
            [&tx_id],
            |row| row.get(0),
        )?;

        conn.execute(
            "DELETE FROM investment_transactions WHERE id = ?1",
            [&tx_id],
        )?;

        // Check if any transactions remain
        let tx_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM investment_transactions WHERE investment_id = ?1",
            [&investment_id],
            |row| row.get(0),
        )?;

        if tx_count == 0 {
            // No transactions left - delete the investment entirely
            conn.execute(
                "DELETE FROM stock_investments WHERE id = ?1",
                [&investment_id],
            )?;
        } else {
            // Recalculate investment metrics
            recalculate_investment(conn, &investment_id)?;
        }

        Ok(())
    })?;

    // Update portfolio snapshot
    portfolio::update_todays_snapshot(&db).await.ok();

    Ok(())
}

/// Update transaction
#[tauri::command]
pub async fn update_investment_transaction(
    db: State<'_, Database>,
    tx_id: String,
    data: InsertInvestmentTransaction,
) -> Result<InvestmentTransaction> {
    let result = db.with_conn(|conn| {
        // Get investment_id
        let investment_id: String = conn.query_row(
            "SELECT investment_id FROM investment_transactions WHERE id = ?1",
            [&tx_id],
            |row| row.get(0),
        )?;

        conn.execute(
            "UPDATE investment_transactions
             SET type = ?2, quantity = ?3, price_per_unit = ?4, currency = ?5, transaction_date = ?6
             WHERE id = ?1",
            rusqlite::params![
                tx_id,
                data.tx_type,
                data.quantity,
                data.price_per_unit,
                data.currency,
                data.transaction_date,
            ],
        )?;

        recalculate_investment(conn, &investment_id)?;

        // Fetch updated transaction
        let tx = conn.query_row(
            "SELECT id, investment_id, type, ticker, company_name, quantity, price_per_unit,
                    currency, transaction_date, created_at
             FROM investment_transactions WHERE id = ?1",
            [&tx_id],
            |row| {
                Ok(InvestmentTransaction {
                    id: row.get(0)?,
                    investment_id: row.get(1)?,
                    tx_type: row.get(2)?,
                    ticker: row.get(3)?,
                    company_name: row.get(4)?,
                    quantity: row.get(5)?,
                    price_per_unit: row.get(6)?,
                    currency: row.get(7)?,
                    transaction_date: row.get(8)?,
                    created_at: row.get(9)?,
                })
            },
        )?;

        Ok(tx)
    })?;

    // Update portfolio snapshot
    portfolio::update_todays_snapshot(&db).await.ok();

    Ok(result)
}

/// Import investment transactions from CSV data
#[tauri::command]
pub async fn import_investment_transactions(
    db: State<'_, Database>,
    transactions: Vec<serde_json::Value>,
    default_currency: String,
) -> Result<serde_json::Value> {
    let mut success_count = 0;
    let mut errors: Vec<String> = Vec::new();
    let mut imported: Vec<String> = Vec::new();

    db.with_conn(|conn| {
        for (index, tx) in transactions.iter().enumerate() {
            let result = process_import_transaction(conn, tx, &default_currency);
            match result {
                Ok(description) => {
                    success_count += 1;
                    imported.push(format!("Row {}: {}", index + 1, description));
                }
                Err(e) => errors.push(format!("Row {}: {}", index + 1, e)),
            }
        }

        Ok(serde_json::json!({
            "success": success_count,
            "errors": errors,
            "imported": imported
        }))
    })?;

    // Update portfolio snapshot after all imports
    portfolio::update_todays_snapshot(&db).await.ok();

    // Return result structure
    Ok(serde_json::json!({
        "success": success_count,
        "errors": errors,
        "imported": imported
    }))
}

fn process_import_transaction(
    conn: &rusqlite::Connection,
    tx: &serde_json::Value,
    default_currency: &str,
) -> std::result::Result<String, String> {
    // Extract fields from the transaction object
    let ticker = tx
        .get("Ticker")
        .or_else(|| tx.get("ticker"))
        .and_then(|v| v.as_str())
        .ok_or("Missing ticker")?
        .to_uppercase();

    let tx_type = tx
        .get("Type")
        .or_else(|| tx.get("type"))
        .and_then(|v| v.as_str())
        .unwrap_or("buy")
        .to_lowercase();

    // Validate transaction type
    if tx_type != "buy" && tx_type != "sell" {
        return Err(format!(
            "{}: Invalid type '{}' (must be 'buy' or 'sell')",
            ticker, tx_type
        ));
    }

    let raw_quantity = tx
        .get("Quantity")
        .or_else(|| tx.get("quantity"))
        .and_then(|v| {
            v.as_str().or_else(|| {
                v.as_f64()
                    .map(|n| Box::leak(n.to_string().into_boxed_str()) as &str)
            })
        })
        .ok_or(format!("{}: Missing quantity", ticker))?;

    // Sanitize quantity (take first non-whitespace part, replace comma with dot)
    let quantity = raw_quantity
        .split_whitespace()
        .next()
        .unwrap_or("0")
        .replace(',', ".");

    // Validate quantity is a positive number
    let qty_value: f64 = quantity
        .parse()
        .map_err(|_| format!("{}: Invalid quantity '{}'", ticker, raw_quantity))?;
    if qty_value <= 0.0 {
        return Err(format!(
            "{}: Quantity must be positive (got {})",
            ticker, raw_quantity
        ));
    }

    let raw_price = tx
        .get("Price")
        .or_else(|| tx.get("price"))
        .and_then(|v| {
            v.as_str().or_else(|| {
                v.as_f64()
                    .map(|n| Box::leak(n.to_string().into_boxed_str()) as &str)
            })
        })
        .ok_or(format!("{}: Missing price", ticker))?;

    // Sanitize price (take first non-whitespace part, replace comma with dot)
    let price = raw_price
        .split_whitespace()
        .next()
        .unwrap_or("0")
        .replace(',', ".");

    // Validate price is a positive number
    let price_value: f64 = price
        .parse()
        .map_err(|_| format!("{}: Invalid price '{}'", ticker, raw_price))?;
    if price_value <= 0.0 {
        return Err(format!(
            "{}: Price must be positive (got {})",
            ticker, raw_price
        ));
    }

    let raw_currency = tx
        .get("Currency")
        .or_else(|| tx.get("currency"))
        .and_then(|v| v.as_str())
        .unwrap_or(default_currency);
    let mut currency = raw_currency
        .split_whitespace()
        .next()
        .unwrap_or(default_currency);

    // If currency is numeric (e.g. "45"), fallback to default
    if currency.chars().all(char::is_numeric) {
        currency = default_currency;
    }

    let date_str = tx
        .get("Date")
        .or_else(|| tx.get("date"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    // Parse date or use current timestamp
    let transaction_date = if !date_str.is_empty() {
        chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
            .or_else(|_| chrono::NaiveDate::parse_from_str(date_str, "%d.%m.%Y"))
            .or_else(|_| chrono::NaiveDate::parse_from_str(date_str, "%d/%m/%Y"))
            .map(|d| d.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp())
            .map_err(|_| {
                format!(
                    "{}: Invalid date format '{}' (use YYYY-MM-DD, DD.MM.YYYY, or DD/MM/YYYY)",
                    ticker, date_str
                )
            })?
    } else {
        chrono::Utc::now().timestamp()
    };

    // Check if investment exists
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM stock_investments WHERE ticker = ?1",
            [&ticker],
            |row| row.get(0),
        )
        .ok();

    // For sell transactions, require existing investment
    if tx_type == "sell" && existing.is_none() {
        return Err(format!(
            "{}: Cannot sell - no existing position found",
            ticker
        ));
    }

    let investment_id = match existing {
        Some(id) => id,
        None => {
            // Only create new investment for buy transactions
            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![id, ticker, ticker.clone(), "0", "0"],
            )
            .map_err(|e| format!("{}: Failed to create investment - {}", ticker, e))?;
            id
        }
    };

    // Create transaction
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
            ticker.clone(),
            quantity,
            price,
            currency,
            transaction_date,
            now,
        ],
    ).map_err(|e| format!("{}: Failed to create transaction - {}", ticker, e))?;

    recalculate_investment(conn, &investment_id)
        .map_err(|e| format!("{}: Failed to recalculate investment - {}", ticker, e))?;

    Ok(format!(
        "{} {} {} @ {}",
        tx_type.to_uppercase(),
        quantity,
        ticker,
        price
    ))
}

/// Set manual price override
#[tauri::command]
pub async fn set_manual_price(
    db: State<'_, Database>,
    ticker: String,
    price: String,
    currency: String,
) -> Result<StockPriceOverride> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let ticker = ticker.to_uppercase();

    let id_clone = id.clone();
    let ticker_clone = ticker.clone();
    let price_clone = price.clone();
    let currency_clone = currency.clone();

    db.with_conn(move |conn| {
        conn.execute(
            "INSERT INTO stock_price_overrides (id, ticker, price, currency, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(ticker) DO UPDATE SET price = ?3, currency = ?4, updated_at = ?5",
            rusqlite::params![id, ticker, price, currency, now],
        )?;

        Ok(StockPriceOverride {
            id,
            ticker,
            price,
            currency,
            updated_at: now,
        })
    })?;

    // Update portfolio snapshot
    crate::commands::portfolio::update_todays_snapshot(&db).await?;

    Ok(StockPriceOverride {
        id: id_clone,
        ticker: ticker_clone,
        price: price_clone,
        currency: currency_clone,
        updated_at: now,
    })
}

/// Delete manual price override
#[tauri::command]
pub async fn delete_manual_price(db: State<'_, Database>, ticker: String) -> Result<()> {
    db.with_conn(|conn| {
        conn.execute(
            "DELETE FROM stock_price_overrides WHERE ticker = ?1",
            [&ticker.to_uppercase()],
        )?;
        Ok(())
    })
}

/// Set manual dividend override
#[tauri::command]
pub async fn set_manual_dividend(
    db: State<'_, Database>,
    ticker: String,
    amount: String,
    currency: String,
) -> Result<DividendOverride> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let ticker = ticker.to_uppercase();

    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO dividend_overrides (id, ticker, yearly_dividend_sum, currency, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(ticker) DO UPDATE SET yearly_dividend_sum = ?3, currency = ?4, updated_at = ?5",
            rusqlite::params![id, ticker, amount, currency, now],
        )?;

        Ok(DividendOverride {
            id,
            ticker,
            yearly_dividend_sum: amount,
            currency,
            updated_at: now,
        })
    })
}

/// Delete manual dividend override
#[tauri::command]
pub async fn delete_manual_dividend(db: State<'_, Database>, ticker: String) -> Result<()> {
    db.with_conn(|conn| {
        conn.execute(
            "DELETE FROM dividend_overrides WHERE ticker = ?1",
            [&ticker.to_uppercase()],
        )?;
        Ok(())
    })
}

/// Recalculate investment quantity and average price from transactions
fn recalculate_investment(conn: &rusqlite::Connection, investment_id: &str) -> Result<()> {
    // 1. Get all transactions
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

    for (tx_type, qty, price, currency) in txs {
        // Convert price to CZK for uniform calculation
        let price_czk = convert_to_czk(price, &currency);

        if tx_type == "buy" {
            total_quantity += qty;
            weighted_buy_sum += qty * price_czk;
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
