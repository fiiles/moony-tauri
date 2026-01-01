//! Investment commands

use crate::commands::portfolio;
use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{
    DividendOverride, EnrichedStockInvestment, InsertInvestmentTransaction, InsertStockInvestment,
    InvestmentTransaction, StockInvestment, StockPriceOverride,
};
use crate::services::currency::convert_to_czk;
use tauri::{AppHandle, Emitter, State};
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
        current_price,
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
    app: AppHandle,
    data: InsertStockInvestment,
    initial_transaction: Option<InsertInvestmentTransaction>,
) -> Result<StockInvestment> {
    let ticker = data.ticker.to_uppercase();
    let ticker_for_recalc = ticker.clone();
    let initial_transaction_clone = initial_transaction.clone();

    let inv_result = db.with_conn(move |conn| {
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
        if let Some(tx) = initial_transaction_clone {
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
    });

    // We need to resolve the Result from db.with_conn
    let inv = match inv_result {
        Ok(i) => i,
        Err(e) => return Err(e),
    };

    // Update portfolio snapshot
    portfolio::update_todays_snapshot(&db).await.ok();

    // Trigger ticker-specific historical recalculation if there was an initial transaction
    if let Some(tx) = initial_transaction {
        portfolio::trigger_historical_recalculation_for_stock_ticker(
            &db,
            tx.transaction_date,
            &ticker_for_recalc,
        )
        .await
        .ok();

        app.emit("recalculation-complete", ()).ok();
    }

    Ok(inv)
}

/// Delete investment
#[tauri::command]
pub async fn delete_investment(db: State<'_, Database>, app: AppHandle, id: String) -> Result<()> {
    // Get earliest transaction date and ticker before deleting (for historical recalc)
    let tx_info: Option<(i64, String)> = db.with_conn(|conn| {
        Ok(conn
            .query_row(
                "SELECT MIN(transaction_date), ticker FROM investment_transactions WHERE investment_id = ?1",
                [&id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok())
    })?;

    // Also get ticker from the investment itself (in case there are no transactions)
    let ticker: Option<String> = db.with_conn(|conn| {
        Ok(conn
            .query_row(
                "SELECT ticker FROM stock_investments WHERE id = ?1",
                [&id],
                |row| row.get(0),
            )
            .ok())
    })?;

    db.with_conn(|conn| {
        // Delete transactions first (due to foreign key)
        conn.execute(
            "DELETE FROM investment_transactions WHERE investment_id = ?1",
            [&id],
        )?;

        let changes = conn.execute("DELETE FROM stock_investments WHERE id = ?1", [&id])?;
        if changes == 0 {
            return Err(AppError::NotFound("Investment not found".into()));
        }
        Ok(())
    })?;

    // Delete this ticker's history from stock_value_history
    if let Some(ref t) = ticker {
        db.with_conn(|conn| {
            conn.execute("DELETE FROM stock_value_history WHERE ticker = ?1", [t])?;
            Ok(())
        })?;
    }

    // Update portfolio snapshot
    portfolio::update_todays_snapshot(&db).await.ok();

    // Update aggregate portfolio history from ticker tables
    if let Some((tx_date, _)) = tx_info {
        portfolio::update_portfolio_history_from_ticker_tables(&db, tx_date)?;
    }

    app.emit("recalculation-complete", ()).ok();

    Ok(())
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

/// Get all stock transactions across all investments
#[tauri::command]
pub async fn get_all_stock_transactions(
    db: State<'_, Database>,
) -> Result<Vec<InvestmentTransaction>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, investment_id, type, ticker, company_name, quantity, price_per_unit,
                    currency, transaction_date, created_at
             FROM investment_transactions
             ORDER BY transaction_date DESC",
        )?;

        let txs = stmt
            .query_map([], |row| {
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
    app: AppHandle,
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

    // Trigger ticker-specific historical recalculation
    portfolio::trigger_historical_recalculation_for_stock_ticker(
        &db,
        result.transaction_date,
        &result.ticker,
    )
    .await
    .ok();

    app.emit("recalculation-complete", ()).ok();

    Ok(result)
}

/// Delete transaction
#[tauri::command]
pub async fn delete_investment_transaction(
    db: State<'_, Database>,
    app: AppHandle,
    tx_id: String,
) -> Result<()> {
    // Get transaction date and ticker before deleting (for historical recalc)
    let tx_info: Option<(i64, String)> = db.with_conn(|conn| {
        Ok(conn
            .query_row(
                "SELECT transaction_date, ticker FROM investment_transactions WHERE id = ?1",
                [&tx_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok())
    })?;

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

    // Trigger ticker-specific historical recalculation if transaction was historical
    if let Some((date, ticker)) = tx_info {
        portfolio::trigger_historical_recalculation_for_stock_ticker(&db, date, &ticker)
            .await
            .ok();

        app.emit("recalculation-complete", ()).ok();
    }

    Ok(())
}

/// Update transaction
#[tauri::command]
pub async fn update_investment_transaction(
    db: State<'_, Database>,
    app: AppHandle,
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

    // Trigger ticker-specific historical recalculation
    portfolio::trigger_historical_recalculation_for_stock_ticker(
        &db,
        result.transaction_date,
        &result.ticker,
    )
    .await
    .ok();

    app.emit("recalculation-complete", ()).ok();

    Ok(result)
}

/// Import investment transactions from CSV data
#[tauri::command]
pub async fn import_investment_transactions(
    db: State<'_, Database>,
    app: AppHandle,
    transactions: Vec<serde_json::Value>,
    default_currency: String,
) -> Result<serde_json::Value> {
    use crate::services::price_api;
    use std::collections::HashMap;

    let mut success_count = 0;
    let mut errors: Vec<String> = Vec::new();
    let mut imported: Vec<String> = Vec::new();
    // Track earliest date per ticker for per-ticker recalculation
    let mut ticker_earliest_dates: HashMap<String, i64> = HashMap::new();

    // First pass: collect tickers that need name lookup
    let mut name_cache: HashMap<String, String> = HashMap::new();
    let mut tickers_needing_lookup: Vec<String> = Vec::new();

    for tx in &transactions {
        if let Some(ticker) = tx
            .get("Ticker")
            .or_else(|| tx.get("ticker"))
            .and_then(|v| v.as_str())
        {
            let ticker_upper = ticker.to_uppercase();

            // Check if name is provided and not empty/same as ticker
            let name = tx
                .get("Name")
                .or_else(|| tx.get("name"))
                .or_else(|| tx.get("Company_name"))
                .or_else(|| tx.get("company_name"))
                .and_then(|v| v.as_str())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty() && s.to_uppercase() != ticker_upper);

            if name.is_none() && !name_cache.contains_key(&ticker_upper) {
                // Check if investment already exists with a name
                let existing_name: Option<String> = db
                    .with_conn(|conn| {
                        conn.query_row(
                            "SELECT company_name FROM stock_investments WHERE ticker = ?1",
                            [&ticker_upper],
                            |row| row.get(0),
                        )
                        .ok()
                        .map(Ok)
                        .transpose()
                    })
                    .ok()
                    .flatten();

                if let Some(existing) = existing_name {
                    // Use existing company name from database
                    name_cache.insert(ticker_upper.clone(), existing);
                } else if !tickers_needing_lookup.contains(&ticker_upper) {
                    tickers_needing_lookup.push(ticker_upper.clone());
                }
            } else if let Some(n) = name {
                name_cache.insert(ticker_upper, n);
            }
        }
    }

    // Look up company names from Yahoo Finance for tickers without names
    if !tickers_needing_lookup.is_empty() {
        println!(
            "[IMPORT] Looking up company names for {} tickers from Yahoo Finance",
            tickers_needing_lookup.len()
        );

        for ticker in &tickers_needing_lookup {
            // Add small delay between lookups to avoid rate limiting
            tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

            match price_api::search_stock_tickers(ticker).await {
                Ok(results) => {
                    // Find exact match or first result
                    if let Some(result) = results
                        .iter()
                        .find(|r| r.symbol.to_uppercase() == ticker.to_uppercase())
                        .or_else(|| results.first())
                    {
                        println!("[IMPORT] Found name for {}: {}", ticker, result.shortname);
                        name_cache.insert(ticker.clone(), result.shortname.clone());
                    } else {
                        println!("[IMPORT] No name found for {}, using ticker", ticker);
                        name_cache.insert(ticker.clone(), ticker.clone());
                    }
                }
                Err(e) => {
                    println!("[IMPORT] Failed to lookup {}: {}, using ticker", ticker, e);
                    name_cache.insert(ticker.clone(), ticker.clone());
                }
            }
        }
    }

    // Second pass: process transactions with enriched names
    db.with_conn(|conn| {
        for (index, tx) in transactions.iter().enumerate() {
            let result = process_import_transaction(conn, tx, &default_currency, &name_cache);
            match result {
                Ok((description, tx_date, ticker)) => {
                    success_count += 1;
                    imported.push(format!("Row {}: {}", index + 1, description));
                    // Track the earliest transaction date per ticker
                    if let Some(date) = tx_date {
                        ticker_earliest_dates
                            .entry(ticker)
                            .and_modify(|e| *e = (*e).min(date))
                            .or_insert(date);
                    }
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

    // Trigger ticker-specific historical recalculation for each imported ticker
    for (ticker, earliest_date) in ticker_earliest_dates.iter() {
        println!(
            "[IMPORT] Triggering ticker-specific recalculation for {} from {}",
            ticker, earliest_date
        );
        portfolio::trigger_historical_recalculation_for_stock_ticker(&db, *earliest_date, ticker)
            .await
            .ok();
    }

    app.emit("recalculation-complete", ()).ok();

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
    name_cache: &std::collections::HashMap<String, String>,
) -> std::result::Result<(String, Option<i64>, String), String> {
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

    // Get name from cache (with Yahoo Finance lookup), CSV value, or fall back to ticker
    let name = name_cache
        .get(&ticker)
        .cloned()
        .or_else(|| {
            tx.get("Name")
                .or_else(|| tx.get("name"))
                .or_else(|| tx.get("Company_name"))
                .or_else(|| tx.get("company_name"))
                .and_then(|v| v.as_str())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
        })
        .unwrap_or_else(|| ticker.clone());

    let investment_id = match existing {
        Some(id) => id,
        None => {
            // Only create new investment for buy transactions
            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![id, ticker, name, "0", "0"],
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
            name,
            quantity,
            price,
            currency,
            transaction_date,
            now,
        ],
    ).map_err(|e| format!("{}: Failed to create transaction - {}", ticker, e))?;

    recalculate_investment(conn, &investment_id)
        .map_err(|e| format!("{}: Failed to recalculate investment - {}", ticker, e))?;

    Ok((
        format!(
            "{} {} {} @ {}",
            tx_type.to_uppercase(),
            quantity,
            ticker,
            price
        ),
        Some(transaction_date),
        ticker.to_string(),
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

/// Get value history for a specific stock ticker
#[tauri::command]
pub async fn get_stock_value_history(
    db: State<'_, Database>,
    ticker: String,
    start_date: Option<i64>,
    end_date: Option<i64>,
) -> Result<Vec<crate::models::TickerValueHistory>> {
    let ticker_upper = ticker.to_uppercase();

    db.with_conn(|conn| {
        let mut query = String::from(
            "SELECT ticker, recorded_at, value_czk, quantity, price, currency 
             FROM stock_value_history 
             WHERE ticker = ?1",
        );

        if start_date.is_some() {
            query.push_str(" AND recorded_at >= ?2");
        }
        if end_date.is_some() {
            query.push_str(" AND recorded_at <= ?3");
        }

        query.push_str(" ORDER BY recorded_at DESC");

        let mut stmt = conn.prepare(&query)?;

        let histories: Vec<crate::models::TickerValueHistory> =
            if start_date.is_some() && end_date.is_some() {
                stmt.query_map(
                    rusqlite::params![&ticker_upper, start_date.unwrap(), end_date.unwrap()],
                    |row| {
                        Ok(crate::models::TickerValueHistory {
                            ticker: row.get(0)?,
                            recorded_at: row.get(1)?,
                            value_czk: row.get(2)?,
                            quantity: row.get(3)?,
                            price: row.get(4)?,
                            currency: row.get(5)?,
                        })
                    },
                )?
                .filter_map(|r| r.ok())
                .collect()
            } else if start_date.is_some() {
                stmt.query_map(
                    rusqlite::params![&ticker_upper, start_date.unwrap()],
                    |row| {
                        Ok(crate::models::TickerValueHistory {
                            ticker: row.get(0)?,
                            recorded_at: row.get(1)?,
                            value_czk: row.get(2)?,
                            quantity: row.get(3)?,
                            price: row.get(4)?,
                            currency: row.get(5)?,
                        })
                    },
                )?
                .filter_map(|r| r.ok())
                .collect()
            } else if end_date.is_some() {
                // This branch won't be used as we check end_date.is_some() only after start_date
                stmt.query_map(rusqlite::params![&ticker_upper], |row| {
                    Ok(crate::models::TickerValueHistory {
                        ticker: row.get(0)?,
                        recorded_at: row.get(1)?,
                        value_czk: row.get(2)?,
                        quantity: row.get(3)?,
                        price: row.get(4)?,
                        currency: row.get(5)?,
                    })
                })?
                .filter_map(|r| r.ok())
                .collect()
            } else {
                stmt.query_map(rusqlite::params![&ticker_upper], |row| {
                    Ok(crate::models::TickerValueHistory {
                        ticker: row.get(0)?,
                        recorded_at: row.get(1)?,
                        value_czk: row.get(2)?,
                        quantity: row.get(3)?,
                        price: row.get(4)?,
                        currency: row.get(5)?,
                    })
                })?
                .filter_map(|r| r.ok())
                .collect()
            };

        Ok(histories)
    })
}
