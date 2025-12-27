//! Crypto commands

use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{
    CryptoInvestment, CryptoTransaction, EnrichedCryptoInvestment, InsertCryptoInvestment,
    InsertCryptoTransaction,
};
use crate::services::currency::convert_to_czk;
use tauri::State;
use uuid::Uuid;

/// Get all crypto investments with current prices
#[tauri::command]
pub async fn get_all_crypto(db: State<'_, Database>) -> Result<Vec<EnrichedCryptoInvestment>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, ticker, coingecko_id, name, quantity, average_price FROM crypto_investments"
        )?;

        let investments: Vec<CryptoInvestment> = stmt
            .query_map([], |row| {
                Ok(CryptoInvestment {
                    id: row.get(0)?,
                    ticker: row.get(1)?,
                    coingecko_id: row.get(2)?,
                    name: row.get(3)?,
                    quantity: row.get(4)?,
                    average_price: row.get(5)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        let mut enriched = Vec::new();
        for inv in investments {
            // Get price override (manual price) - same pattern as stocks
            let override_price: Option<(String, String, i64)> = conn
                .query_row(
                    "SELECT price, currency, updated_at FROM crypto_price_overrides WHERE symbol = ?1",
                    [&inv.ticker],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                )
                .ok();

            // Get global (API) price
            let global_price: Option<(String, String, i64)> = conn
                .query_row(
                    "SELECT price, currency, fetched_at FROM crypto_prices WHERE symbol = ?1",
                    [&inv.ticker],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                )
                .ok();

            // Determine active price - prefer override if it exists (same as stocks)
            let (original_price, currency, current_price, fetched_at, is_manual) =
                match (&override_price, &global_price) {
                    (Some((op, oc, ou)), _) => (
                        op.clone(),
                        oc.clone(),
                        convert_to_czk(op.parse().unwrap_or(0.0), oc),
                        Some(*ou),
                        true,
                    ),
                    (None, Some((gp, gc, gu))) => (
                        gp.clone(),
                        gc.clone(),
                        convert_to_czk(gp.parse().unwrap_or(0.0), gc),
                        Some(*gu),
                        false,
                    ),
                    _ => ("0".to_string(), "USD".to_string(), 0.0, None, false),
                };

            enriched.push(EnrichedCryptoInvestment {
                id: inv.id,
                ticker: inv.ticker,
                coingecko_id: inv.coingecko_id,
                name: inv.name,
                quantity: inv.quantity,
                average_price: inv.average_price,
                current_price: current_price.to_string(),
                original_price,
                currency,
                fetched_at,
                is_manual_price: is_manual,
            });
        }

        Ok(enriched)
    })
}

/// Create crypto investment
#[tauri::command]
pub async fn create_crypto(
    db: State<'_, Database>,
    data: InsertCryptoInvestment,
    initial_transaction: Option<InsertCryptoTransaction>,
) -> Result<CryptoInvestment> {
    let ticker = data.ticker.to_uppercase();

    db.with_conn(|conn| {
        // Check if exists
        let existing: Option<String> = conn.query_row(
            "SELECT id FROM crypto_investments WHERE ticker = ?1",
            [&ticker],
            |row| row.get(0),
        ).ok();

        let investment_id = if let Some(id) = existing {
            id
        } else {
            let id = Uuid::new_v4().to_string();
            let qty = data.quantity.unwrap_or_else(|| "0".to_string());
            let avg = data.average_price.unwrap_or_else(|| "0".to_string());

            conn.execute(
                "INSERT INTO crypto_investments (id, ticker, coingecko_id, name, quantity, average_price)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![id, ticker, data.coingecko_id, data.name, qty, avg],
            )?;
            id
        };

        if let Some(tx) = initial_transaction {
            let tx_id = Uuid::new_v4().to_string();
            let now = chrono::Utc::now().timestamp();

            conn.execute(
                "INSERT INTO crypto_transactions
                 (id, investment_id, type, ticker, name, quantity, price_per_unit, currency, transaction_date, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                rusqlite::params![
                    tx_id, investment_id, tx.tx_type, ticker, data.name,
                    tx.quantity, tx.price_per_unit, tx.currency, tx.transaction_date, now,
                ],
            )?;

            // Recalculate crypto investment metrics
            recalculate_crypto_investment(conn, &investment_id)?;
        }

        let inv = conn.query_row(
            "SELECT id, ticker, coingecko_id, name, quantity, average_price FROM crypto_investments WHERE id = ?1",
            [&investment_id],
            |row| Ok(CryptoInvestment {
                id: row.get(0)?,
                ticker: row.get(1)?,
                coingecko_id: row.get(2)?,
                name: row.get(3)?,
                quantity: row.get(4)?,
                average_price: row.get(5)?,
            }),
        )?;

        Ok(inv)
    })
}

/// Delete crypto investment
#[tauri::command]
pub async fn delete_crypto(db: State<'_, Database>, id: String) -> Result<()> {
    db.with_conn(|conn| {
        // Delete transactions first to avoid FK constraint violation
        conn.execute(
            "DELETE FROM crypto_transactions WHERE investment_id = ?1",
            [&id],
        )?;

        let changes = conn.execute("DELETE FROM crypto_investments WHERE id = ?1", [&id])?;
        if changes == 0 {
            return Err(AppError::NotFound("Crypto investment not found".into()));
        }
        Ok(())
    })
}

/// Get transactions for crypto
#[tauri::command]
pub async fn get_crypto_transactions(
    db: State<'_, Database>,
    investment_id: String,
) -> Result<Vec<CryptoTransaction>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, investment_id, type, ticker, name, quantity, price_per_unit,
                    currency, transaction_date, created_at
             FROM crypto_transactions WHERE investment_id = ?1
             ORDER BY transaction_date DESC",
        )?;

        let txs = stmt
            .query_map([&investment_id], |row| {
                Ok(CryptoTransaction {
                    id: row.get(0)?,
                    investment_id: row.get(1)?,
                    tx_type: row.get(2)?,
                    ticker: row.get(3)?,
                    name: row.get(4)?,
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

/// Recalculate crypto investment metrics from transactions
fn recalculate_crypto_investment(conn: &rusqlite::Connection, investment_id: &str) -> Result<()> {
    // Get all transactions for this investment (including currency)
    let mut stmt = conn.prepare(
        "SELECT type, quantity, price_per_unit, currency FROM crypto_transactions WHERE investment_id = ?1"
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
    let mut total_cost_czk = 0.0f64;

    for (tx_type, qty, price, currency) in txs {
        // Convert price to CZK
        let price_czk = convert_to_czk(price, &currency);

        if tx_type == "buy" {
            total_cost_czk += qty * price_czk;
            total_qty += qty;
        } else if tx_type == "sell" {
            // Reduce quantity, adjust cost proportionally
            if total_qty > 0.0 {
                let avg_cost = total_cost_czk / total_qty;
                total_cost_czk -= qty * avg_cost;
            }
            total_qty -= qty;
        }
    }

    // Prevent negative values
    if total_qty < 0.0 {
        total_qty = 0.0;
    }
    if total_cost_czk < 0.0 {
        total_cost_czk = 0.0;
    }

    let avg_price_czk = if total_qty > 0.0 {
        total_cost_czk / total_qty
    } else {
        0.0
    };

    conn.execute(
        "UPDATE crypto_investments SET quantity = ?1, average_price = ?2 WHERE id = ?3",
        rusqlite::params![
            total_qty.to_string(),
            avg_price_czk.to_string(),
            investment_id
        ],
    )?;

    Ok(())
}

/// Create crypto transaction
#[tauri::command]
pub async fn create_crypto_transaction(
    db: State<'_, Database>,
    investment_id: String,
    data: InsertCryptoTransaction,
) -> Result<CryptoTransaction> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    let result = db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO crypto_transactions
             (id, investment_id, type, ticker, name, quantity, price_per_unit, currency, transaction_date, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                id, investment_id, data.tx_type, data.ticker, data.name,
                data.quantity, data.price_per_unit, data.currency, data.transaction_date, now,
            ],
        )?;

        // Recalculate crypto investment metrics
        recalculate_crypto_investment(conn, &investment_id)?;

        Ok(CryptoTransaction {
            id,
            investment_id,
            tx_type: data.tx_type,
            ticker: data.ticker,
            name: data.name,
            quantity: data.quantity,
            price_per_unit: data.price_per_unit,
            currency: data.currency,
            transaction_date: data.transaction_date,
            created_at: now,
        })
    })?;

    // Update portfolio snapshot
    crate::commands::portfolio::update_todays_snapshot(&db)
        .await
        .ok();

    Ok(result)
}

/// Delete crypto transaction
#[tauri::command]
pub async fn delete_crypto_transaction(db: State<'_, Database>, tx_id: String) -> Result<()> {
    db.with_conn(|conn| {
        // Get investment_id before deleting
        let investment_id: String = conn.query_row(
            "SELECT investment_id FROM crypto_transactions WHERE id = ?1",
            [&tx_id],
            |row| row.get(0),
        )?;

        conn.execute("DELETE FROM crypto_transactions WHERE id = ?1", [&tx_id])?;

        // Check if any transactions remain
        let tx_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM crypto_transactions WHERE investment_id = ?1",
            [&investment_id],
            |row| row.get(0),
        )?;

        if tx_count == 0 {
            // No transactions left - delete the crypto investment entirely
            conn.execute(
                "DELETE FROM crypto_investments WHERE id = ?1",
                [&investment_id],
            )?;
        } else {
            // Recalculate crypto investment metrics
            recalculate_crypto_investment(conn, &investment_id)?;
        }

        Ok(())
    })?;

    // Update portfolio snapshot
    crate::commands::portfolio::update_todays_snapshot(&db)
        .await
        .ok();

    Ok(())
}

/// Update crypto price manually (creates or updates override)
#[tauri::command]
pub async fn update_crypto_price(
    db: State<'_, Database>,
    symbol: String,
    price: String,
    currency: String,
    _coingecko_id: Option<String>,
) -> Result<()> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let symbol_upper = symbol.to_uppercase();

    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO crypto_price_overrides (id, symbol, price, currency, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(symbol) DO UPDATE SET price = ?3, currency = ?4, updated_at = ?5",
            rusqlite::params![id, symbol_upper, price, currency, now],
        )?;
        Ok(())
    })?;

    // Update portfolio snapshot
    crate::commands::portfolio::update_todays_snapshot(&db).await?;

    Ok(())
}

/// Delete manual crypto price override (revert to API price)
#[tauri::command]
pub async fn delete_crypto_manual_price(db: State<'_, Database>, symbol: String) -> Result<()> {
    db.with_conn(|conn| {
        conn.execute(
            "DELETE FROM crypto_price_overrides WHERE symbol = ?1",
            [symbol.to_uppercase()],
        )?;
        Ok(())
    })?;

    Ok(())
}
