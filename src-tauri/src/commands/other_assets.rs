//! Other assets commands

use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{
    InsertOtherAsset, InsertOtherAssetTransaction, OtherAsset, OtherAssetTransaction,
};
use tauri::State;
use uuid::Uuid;

/// Get all other assets
#[tauri::command]
pub async fn get_all_other_assets(db: State<'_, Database>) -> Result<Vec<OtherAsset>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, quantity, market_price, currency, average_purchase_price,
                    yield_type, yield_value, created_at, updated_at
             FROM other_assets ORDER BY name",
        )?;

        let assets = stmt
            .query_map([], |row| {
                Ok(OtherAsset {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    quantity: row.get(2)?,
                    market_price: row.get(3)?,
                    currency: row.get(4)?,
                    average_purchase_price: row.get(5)?,
                    yield_type: row.get(6)?,
                    yield_value: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(assets)
    })
}

/// Create other asset
#[tauri::command]
pub async fn create_other_asset(
    db: State<'_, Database>,
    data: InsertOtherAsset,
    initial_transaction: Option<InsertOtherAssetTransaction>,
) -> Result<OtherAsset> {
    // Validate inputs at the trust boundary
    data.validate()?;
    if let Some(ref tx) = initial_transaction {
        tx.validate()?;
    }

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO other_assets
             (id, name, quantity, market_price, currency, average_purchase_price, yield_type, yield_value, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
            rusqlite::params![
                id,
                data.name,
                data.quantity.unwrap_or_else(|| "0".to_string()),
                data.market_price.unwrap_or_else(|| "0".to_string()),
                data.currency.unwrap_or_else(|| "CZK".to_string()),
                data.average_purchase_price.unwrap_or_else(|| "0".to_string()),
                data.yield_type.unwrap_or_else(|| "none".to_string()),
                data.yield_value,
                now,
            ],
        )?;

        if let Some(tx) = initial_transaction {
            let tx_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO other_asset_transactions
                 (id, asset_id, type, quantity, price_per_unit, currency, transaction_date, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                rusqlite::params![
                    tx_id, id, tx.tx_type, tx.quantity, tx.price_per_unit, tx.currency, tx.transaction_date, now
                ],
            )?;
        }

        conn.query_row(
            "SELECT id, name, quantity, market_price, currency, average_purchase_price,
                    yield_type, yield_value, created_at, updated_at
             FROM other_assets WHERE id = ?1",
            [&id],
            |row| Ok(OtherAsset {
                id: row.get(0)?,
                name: row.get(1)?,
                quantity: row.get(2)?,
                market_price: row.get(3)?,
                currency: row.get(4)?,
                average_purchase_price: row.get(5)?,
                yield_type: row.get(6)?,
                yield_value: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            }),
        ).map_err(|e| e.into())
    })
}

/// Update other asset
#[tauri::command]
pub async fn update_other_asset(
    db: State<'_, Database>,
    id: String,
    data: InsertOtherAsset,
) -> Result<OtherAsset> {
    // Validate inputs at the trust boundary
    data.validate()?;

    let now = chrono::Utc::now().timestamp();

    db.with_conn(|conn| {
        conn.execute(
            "UPDATE other_assets SET name = ?1,
             quantity = COALESCE(?2, quantity), market_price = COALESCE(?3, market_price),
             currency = COALESCE(?4, currency), average_purchase_price = COALESCE(?5, average_purchase_price),
             yield_type = COALESCE(?6, yield_type), yield_value = ?7, updated_at = ?8
             WHERE id = ?9",
            rusqlite::params![
                data.name, data.quantity, data.market_price, data.currency,
                data.average_purchase_price, data.yield_type, data.yield_value, now, id
            ],
        )?;

        conn.query_row(
            "SELECT id, name, quantity, market_price, currency, average_purchase_price,
                    yield_type, yield_value, created_at, updated_at
             FROM other_assets WHERE id = ?1",
            [&id],
            |row| Ok(OtherAsset {
                id: row.get(0)?,
                name: row.get(1)?,
                quantity: row.get(2)?,
                market_price: row.get(3)?,
                currency: row.get(4)?,
                average_purchase_price: row.get(5)?,
                yield_type: row.get(6)?,
                yield_value: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            }),
        ).map_err(|_| AppError::NotFound("Other asset not found".into()))
    })
}

/// Delete other asset
#[tauri::command]
pub async fn delete_other_asset(db: State<'_, Database>, id: String) -> Result<()> {
    // Get earliest transaction date before deleting (for historical recalc)
    let earliest_tx_date: Option<i64> = db.with_conn(|conn| {
        Ok(conn
            .query_row(
                "SELECT MIN(transaction_date) FROM other_asset_transactions WHERE asset_id = ?1",
                [&id],
                |row| row.get(0),
            )
            .ok()
            .flatten())
    })?;

    db.with_conn(|conn| {
        // Delete transactions first (due to foreign key)
        conn.execute(
            "DELETE FROM other_asset_transactions WHERE asset_id = ?1",
            [&id],
        )?;

        let changes = conn.execute("DELETE FROM other_assets WHERE id = ?1", [&id])?;
        if changes == 0 {
            return Err(AppError::NotFound("Other asset not found".into()));
        }
        Ok(())
    })?;

    // Update portfolio snapshot
    crate::commands::portfolio::update_todays_snapshot(&db)
        .await
        .ok();

    // Trigger historical recalculation if there were transactions
    if let Some(tx_date) = earliest_tx_date {
        crate::commands::portfolio::trigger_historical_recalculation_for_asset(
            &db,
            tx_date,
            crate::commands::portfolio::AssetType::OtherAssets,
        )
        .await
        .ok();
    }

    Ok(())
}

/// Get transactions for other asset
#[tauri::command]
pub async fn get_other_asset_transactions(
    db: State<'_, Database>,
    asset_id: String,
) -> Result<Vec<OtherAssetTransaction>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, asset_id, type, quantity, price_per_unit, currency, transaction_date, created_at
             FROM other_asset_transactions WHERE asset_id = ?1 ORDER BY transaction_date DESC"
        )?;

        let txs = stmt.query_map([&asset_id], |row| {
            Ok(OtherAssetTransaction {
                id: row.get(0)?,
                asset_id: row.get(1)?,
                tx_type: row.get(2)?,
                quantity: row.get(3)?,
                price_per_unit: row.get(4)?,
                currency: row.get(5)?,
                transaction_date: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?.filter_map(|r| r.ok()).collect();

        Ok(txs)
    })
}

/// Create other asset transaction
#[tauri::command]
pub async fn create_other_asset_transaction(
    db: State<'_, Database>,
    asset_id: String,
    data: InsertOtherAssetTransaction,
) -> Result<OtherAssetTransaction> {
    // Validate inputs at the trust boundary
    data.validate()?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let transaction_date = data.transaction_date;

    let result = db.with_conn(|conn| {
        // 1. Insert Transaction
        conn.execute(
            "INSERT INTO other_asset_transactions
             (id, asset_id, type, quantity, price_per_unit, currency, transaction_date, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                id,
                asset_id,
                data.tx_type,
                data.quantity,
                data.price_per_unit,
                data.currency,
                data.transaction_date,
                now
            ],
        )?;

        // 2. Recalculate Asset Totals
        recalculate_asset_totals(conn, &asset_id)?;

        Ok(OtherAssetTransaction {
            id,
            asset_id,
            tx_type: data.tx_type,
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

    // Trigger historical recalculation if transaction is retrospective
    crate::commands::portfolio::trigger_historical_recalculation_for_asset(
        &db,
        transaction_date,
        crate::commands::portfolio::AssetType::OtherAssets,
    )
    .await
    .ok();

    Ok(result)
}

/// Delete other asset transaction
#[tauri::command]
pub async fn delete_other_asset_transaction(db: State<'_, Database>, tx_id: String) -> Result<()> {
    // Get transaction date before deleting (for historical recalc)
    let tx_date: Option<i64> = db.with_conn(|conn| {
        Ok(conn
            .query_row(
                "SELECT transaction_date FROM other_asset_transactions WHERE id = ?1",
                [&tx_id],
                |row| row.get(0),
            )
            .ok())
    })?;

    db.with_conn(|conn| {
        // 1. Get asset_id before deleting
        let asset_id: String = conn.query_row(
            "SELECT asset_id FROM other_asset_transactions WHERE id = ?1",
            [&tx_id],
            |row| row.get(0),
        )?;

        // 2. Delete Transaction
        conn.execute(
            "DELETE FROM other_asset_transactions WHERE id = ?1",
            [&tx_id],
        )?;

        // 3. Recalculate Asset Totals
        recalculate_asset_totals(conn, &asset_id)?;

        Ok(())
    })?;

    // Update portfolio snapshot
    crate::commands::portfolio::update_todays_snapshot(&db)
        .await
        .ok();

    // Trigger historical recalculation if transaction was historical
    if let Some(date) = tx_date {
        crate::commands::portfolio::trigger_historical_recalculation_for_asset(
            &db,
            date,
            crate::commands::portfolio::AssetType::OtherAssets,
        )
        .await
        .ok();
    }

    Ok(())
}

// Helper function to recalculate and update asset totals
fn recalculate_asset_totals(conn: &rusqlite::Connection, asset_id: &str) -> Result<()> {
    let mut stmt = conn.prepare(
        "SELECT type, quantity, price_per_unit FROM other_asset_transactions WHERE asset_id = ?1",
    )?;

    let rows = stmt.query_map([asset_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;

    let mut total_quantity = 0.0;
    let mut total_cost = 0.0;
    let mut total_buy_quantity = 0.0;

    for row in rows {
        let (tx_type, qty_str, price_str) = row?;
        let qty = qty_str.parse::<f64>().unwrap_or(0.0);
        let price = price_str.parse::<f64>().unwrap_or(0.0);

        if tx_type == "buy" {
            total_quantity += qty;
            total_buy_quantity += qty;
            total_cost += qty * price;
        } else if tx_type == "sell" {
            total_quantity -= qty;
        }
    }

    let average_purchase_price = if total_buy_quantity > 0.0 {
        total_cost / total_buy_quantity
    } else {
        0.0
    };

    conn.execute(
        "UPDATE other_assets SET quantity = ?1, average_purchase_price = ?2, updated_at = ?3 WHERE id = ?4",
        rusqlite::params![
            total_quantity.to_string(),
            average_purchase_price.to_string(),
            chrono::Utc::now().timestamp(),
            asset_id
        ],
    )?;

    Ok(())
}
