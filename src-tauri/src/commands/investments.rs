//! Investment commands

use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{
    StockInvestment, InsertStockInvestment, EnrichedStockInvestment,
    InvestmentTransaction, InsertInvestmentTransaction,
    StockPriceOverride, DividendOverride,
};
use crate::services::currency::convert_to_czk;
use tauri::State;
use uuid::Uuid;

/// Get all investments with enriched price data
#[tauri::command]
pub async fn get_all_investments(db: State<'_, Database>) -> Result<Vec<EnrichedStockInvestment>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, ticker, company_name, quantity, average_price FROM stock_investments"
        )?;
        
        let investments: Vec<StockInvestment> = stmt.query_map([], |row| {
            Ok(StockInvestment {
                id: row.get(0)?,
                ticker: row.get(1)?,
                company_name: row.get(2)?,
                quantity: row.get(3)?,
                average_price: row.get(4)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        
        // Enrich with price data
        let mut enriched = Vec::new();
        for inv in investments {
            // Get price override
            let override_price: Option<(String, String, i64)> = conn.query_row(
                "SELECT price, currency, updated_at FROM stock_price_overrides WHERE ticker = ?1",
                [&inv.ticker],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            ).ok();
            
            // Get global price
            let global_price: Option<(String, String, i64)> = conn.query_row(
                "SELECT original_price, currency, fetched_at FROM stock_prices WHERE ticker = ?1",
                [&inv.ticker],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            ).ok();
            
            // Determine active price
            let (current_price, fetched_at, is_manual) = match (&override_price, &global_price) {
                (Some((op, oc, ou)), Some((_, _, gu))) if *ou > *gu => {
                    (convert_to_czk(op.parse().unwrap_or(0.0), oc), Some(*ou), true)
                }
                (Some((op, oc, ou)), None) => {
                    (convert_to_czk(op.parse().unwrap_or(0.0), oc), Some(*ou), true)
                }
                (_, Some((gp, gc, gu))) => {
                    (convert_to_czk(gp.parse().unwrap_or(0.0), gc), Some(*gu), false)
                }
                _ => (0.0, None, false),
            };
            
            // Get dividend data
            let user_dividend: Option<(String, String)> = conn.query_row(
                "SELECT yearly_dividend_sum, currency FROM dividend_overrides WHERE ticker = ?1",
                [&inv.ticker],
                |row| Ok((row.get(0)?, row.get(1)?)),
            ).ok();
            
            let global_dividend: Option<(String, String)> = conn.query_row(
                "SELECT yearly_dividend_sum, currency FROM dividend_data WHERE ticker = ?1",
                [&inv.ticker],
                |row| Ok((row.get(0)?, row.get(1)?)),
            ).ok();
            
            let (dividend_yield, is_manual_dividend) = match (&user_dividend, &global_dividend) {
                (Some((sum, curr)), _) => {
                    (convert_to_czk(sum.parse().unwrap_or(0.0), curr), true)
                }
                (None, Some((sum, curr))) => {
                    (convert_to_czk(sum.parse().unwrap_or(0.0), curr), false)
                }
                _ => (0.0, false),
            };
            
            enriched.push(EnrichedStockInvestment {
                id: inv.id,
                ticker: inv.ticker,
                company_name: inv.company_name,
                quantity: inv.quantity,
                average_price: inv.average_price,
                current_price: current_price.to_string(),
                fetched_at,
                is_manual_price: is_manual,
                dividend_yield,
                dividend_currency: "CZK".to_string(),
                is_manual_dividend,
            });
        }
        
        Ok(enriched)
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
            
            // Recalculate metrics would go here
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
             ORDER BY transaction_date DESC"
        )?;
        
        let txs = stmt.query_map([&investment_id], |row| {
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
        })?.filter_map(|r| r.ok()).collect();
        
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
    
    db.with_conn(|conn| {
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
    })
}

/// Delete transaction
#[tauri::command]
pub async fn delete_investment_transaction(db: State<'_, Database>, tx_id: String) -> Result<()> {
    db.with_conn(|conn| {
        conn.execute("DELETE FROM investment_transactions WHERE id = ?1", [&tx_id])?;
        Ok(())
    })
}

/// Update transaction
#[tauri::command]
pub async fn update_investment_transaction(
    db: State<'_, Database>,
    tx_id: String,
    data: InsertInvestmentTransaction,
) -> Result<InvestmentTransaction> {
    db.with_conn(|conn| {
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
        
        // Fetch updated transaction
        let tx = conn.query_row(
            "SELECT id, investment_id, type, ticker, company_name, quantity, price_per_unit, 
                    currency, transaction_date, created_at 
             FROM investment_transactions WHERE id = ?1",
            [&tx_id],
            |row| Ok(InvestmentTransaction {
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
            }),
        )?;
        
        Ok(tx)
    })
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
    
    db.with_conn(|conn| {
        for (index, tx) in transactions.iter().enumerate() {
            let result = process_import_transaction(conn, tx, &default_currency);
            match result {
                Ok(_) => success_count += 1,
                Err(e) => errors.push(format!("Row {}: {}", index + 1, e)),
            }
        }
        
        Ok(serde_json::json!({
            "success": success_count,
            "errors": errors
        }))
    })
}

fn process_import_transaction(
    conn: &rusqlite::Connection,
    tx: &serde_json::Value,
    default_currency: &str,
) -> std::result::Result<(), String> {
    // Extract fields from the transaction object
    let ticker = tx.get("Ticker").or_else(|| tx.get("ticker"))
        .and_then(|v| v.as_str())
        .ok_or("Missing ticker")?
        .to_uppercase();
    
    let tx_type = tx.get("Type").or_else(|| tx.get("type"))
        .and_then(|v| v.as_str())
        .unwrap_or("buy")
        .to_lowercase();
    
    let quantity = tx.get("Quantity").or_else(|| tx.get("quantity"))
        .and_then(|v| v.as_str().or_else(|| v.as_f64().map(|n| Box::leak(n.to_string().into_boxed_str()) as &str)))
        .ok_or("Missing quantity")?;
    
    let price = tx.get("Price").or_else(|| tx.get("price"))
        .and_then(|v| v.as_str().or_else(|| v.as_f64().map(|n| Box::leak(n.to_string().into_boxed_str()) as &str)))
        .ok_or("Missing price")?;
    
    let currency = tx.get("Currency").or_else(|| tx.get("currency"))
        .and_then(|v| v.as_str())
        .unwrap_or(default_currency);
    
    let date_str = tx.get("Date").or_else(|| tx.get("date"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    
    // Parse date or use current timestamp
    let transaction_date = if !date_str.is_empty() {
        chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
            .or_else(|_| chrono::NaiveDate::parse_from_str(date_str, "%d.%m.%Y"))
            .or_else(|_| chrono::NaiveDate::parse_from_str(date_str, "%d/%m/%Y"))
            .map(|d| d.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp())
            .unwrap_or_else(|_| chrono::Utc::now().timestamp())
    } else {
        chrono::Utc::now().timestamp()
    };
    
    // Check if investment exists, create if not
    let existing: Option<String> = conn.query_row(
        "SELECT id FROM stock_investments WHERE ticker = ?1",
        [&ticker],
        |row| row.get(0),
    ).ok();
    
    let investment_id = match existing {
        Some(id) => id,
        None => {
            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) 
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![id, ticker, ticker.clone(), "0", "0"],
            ).map_err(|e| e.to_string())?;
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
    ).map_err(|e| e.to_string())?;
    
    Ok(())
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
        conn.execute("DELETE FROM stock_price_overrides WHERE ticker = ?1", [&ticker.to_uppercase()])?;
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
        conn.execute("DELETE FROM dividend_overrides WHERE ticker = ?1", [&ticker.to_uppercase()])?;
        Ok(())
    })
}
