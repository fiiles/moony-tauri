//! Portfolio metrics commands

use crate::db::Database;
use crate::error::Result;
use crate::models::PortfolioMetricsHistory;
use crate::services::currency::convert_to_czk;
use serde::Serialize;
use tauri::State;
use uuid::Uuid;

/// Current portfolio metrics
#[derive(Debug, Clone, Serialize)]
pub struct PortfolioMetrics {
    #[serde(rename = "totalSavings")]
    pub total_savings: f64,
    #[serde(rename = "totalInvestments")]
    pub total_investments: f64,
    #[serde(rename = "totalCrypto")]
    pub total_crypto: f64,
    #[serde(rename = "totalBonds")]
    pub total_bonds: f64,
    #[serde(rename = "totalRealEstatePersonal")]
    pub total_real_estate_personal: f64,
    #[serde(rename = "totalRealEstateInvestment")]
    pub total_real_estate_investment: f64,
    #[serde(rename = "totalRealEstate")]
    pub total_real_estate: f64,
    #[serde(rename = "totalOtherAssets")]
    pub total_other_assets: f64,
    #[serde(rename = "totalLiabilities")]
    pub total_liabilities: f64,
    #[serde(rename = "totalAssets")]
    pub total_assets: f64,
    #[serde(rename = "netWorth")]
    pub net_worth: f64,
}

/// Get current portfolio metrics
#[tauri::command]
pub async fn get_portfolio_metrics(
    db: State<'_, Database>,
    exclude_personal_real_estate: bool,
) -> Result<PortfolioMetrics> {
    calculate_portfolio_metrics(&db, exclude_personal_real_estate)
}

fn calculate_portfolio_metrics(
    db: &Database,
    exclude_personal_real_estate: bool,
) -> Result<PortfolioMetrics> {
    db.with_conn(|conn| {
        // Calculate total savings
        let mut savings_stmt = conn.prepare("SELECT balance, currency FROM savings_accounts")?;
        let total_savings: f64 = savings_stmt
            .query_map([], |row| {
                let balance: f64 = row.get::<_, String>(0)?.parse().unwrap_or(0.0);
                let currency: String = row.get(1)?;
                Ok(convert_to_czk(balance, &currency))
            })?
            .filter_map(|r| r.ok())
            .sum();

        // Calculate total bonds
        let mut bonds_stmt = conn.prepare("SELECT coupon_value, quantity, currency FROM bonds")?;
        let total_bonds: f64 = bonds_stmt
            .query_map([], |row| {
                let value: f64 = row.get::<_, String>(0)?.parse().unwrap_or(0.0);
                let quantity: f64 = row.get::<_, String>(1)?.parse().unwrap_or(1.0);
                let currency: String = row.get(2)?;
                Ok(convert_to_czk(value * quantity, &currency))
            })?
            .filter_map(|r| r.ok())
            .sum();

        // Calculate total loans (liabilities)
        let mut loans_stmt = conn.prepare("SELECT principal, currency FROM loans")?;
        let total_liabilities: f64 = loans_stmt
            .query_map([], |row| {
                let principal: f64 = row.get::<_, String>(0)?.parse().unwrap_or(0.0);
                let currency: String = row.get(1)?;
                Ok(convert_to_czk(principal, &currency))
            })?
            .filter_map(|r| r.ok())
            .sum();

        // Calculate real estate
        let mut stmt =
            conn.prepare("SELECT type, market_price, market_price_currency FROM real_estate")?;
        let mut total_re_personal = 0.0;
        let mut total_re_investment = 0.0;

        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?;

        for row in rows.filter_map(|r| r.ok()) {
            let price: f64 = row.1.parse().unwrap_or(0.0);
            let price_czk = convert_to_czk(price, &row.2);
            if row.0 == "personal" {
                total_re_personal += price_czk;
            } else {
                total_re_investment += price_czk;
            }
        }

        // Calculate investments value
        let mut total_investments = 0.0;
        let mut inv_stmt = conn.prepare("SELECT ticker, quantity FROM stock_investments")?;
        let investments = inv_stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        for inv in investments.filter_map(|r| r.ok()) {
            let qty: f64 = inv.1.parse().unwrap_or(0.0);

            // Try to get price
            let price_data: rusqlite::Result<(Option<String>, Option<String>)> = conn.query_row(
                "SELECT COALESCE(
                    (SELECT price FROM stock_price_overrides WHERE ticker = ?1),
                    (SELECT original_price FROM stock_prices WHERE ticker = ?1)
                ),
                COALESCE(
                    (SELECT currency FROM stock_price_overrides WHERE ticker = ?1),
                    (SELECT currency FROM stock_prices WHERE ticker = ?1)
                )",
                [&inv.0],
                |row| Ok((row.get(0)?, row.get(1)?)),
            );

            if let Ok((Some(price_str), Some(currency))) = price_data {
                let price: f64 = price_str.parse().unwrap_or(0.0);
                let value_in_czk = convert_to_czk(price * qty, &currency);
                total_investments += value_in_czk;
            }
        }

        // Calculate crypto value
        let mut total_crypto = 0.0;
        let mut crypto_stmt = conn.prepare("SELECT ticker, quantity FROM crypto_investments")?;
        let cryptos = crypto_stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        for crypto in cryptos.filter_map(|r| r.ok()) {
            let qty: f64 = crypto.1.parse().unwrap_or(0.0);

            let price_data: rusqlite::Result<(Option<String>, Option<String>)> = conn.query_row(
                "SELECT price, currency FROM crypto_prices WHERE symbol = ?1",
                [&crypto.0],
                |row| Ok((row.get(0)?, row.get(1)?)),
            );

            if let Ok((Some(price_str), Some(currency))) = price_data {
                let price: f64 = price_str.parse().unwrap_or(0.0);
                let value_in_czk = convert_to_czk(price * qty, &currency);
                total_crypto += value_in_czk;
            }
        }

        // Calculate details
        let mut total_other_assets = 0.0;
        let mut other_stmt =
            conn.prepare("SELECT quantity, market_price, currency FROM other_assets")?;
        let other_assets = other_stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?;

        for asset in other_assets.filter_map(|r| r.ok()) {
            let qty: f64 = asset.0.parse().unwrap_or(0.0);
            let price: f64 = asset.1.parse().unwrap_or(0.0);
            let currency = asset.2;
            total_other_assets += convert_to_czk(qty * price, &currency);
        }

        // Calculate totals
        let total_real_estate = if exclude_personal_real_estate {
            total_re_investment
        } else {
            total_re_personal + total_re_investment
        };

        let total_assets = total_savings
            + total_investments
            + total_crypto
            + total_bonds
            + total_real_estate
            + total_other_assets;
        let net_worth = total_assets - total_liabilities;

        Ok(PortfolioMetrics {
            total_savings,
            total_investments,
            total_crypto,
            total_bonds,
            total_real_estate_personal: total_re_personal,
            total_real_estate_investment: total_re_investment,
            total_real_estate,
            total_other_assets,
            total_liabilities,
            total_assets,
            net_worth,
        })
    })
}

/// Get portfolio history
#[tauri::command]
pub async fn get_portfolio_history(
    db: State<'_, Database>,
    start_date: Option<i64>,
    end_date: Option<i64>,
) -> Result<Vec<PortfolioMetricsHistory>> {
    db.with_conn(|conn| {
        let sql = match (start_date, end_date) {
            (Some(start), Some(end)) => {
                format!(
                    "SELECT id, total_savings, total_loans_principal, total_investments, total_crypto,
                            total_bonds, total_real_estate_personal, total_real_estate_investment, total_other_assets, recorded_at
                     FROM portfolio_metrics_history
                     WHERE recorded_at >= {} AND recorded_at <= {}
                     ORDER BY recorded_at DESC",
                    start, end
                )
            }
            (Some(start), None) => {
                format!(
                    "SELECT id, total_savings, total_loans_principal, total_investments, total_crypto,
                            total_bonds, total_real_estate_personal, total_real_estate_investment, total_other_assets, recorded_at
                     FROM portfolio_metrics_history
                     WHERE recorded_at >= {}
                     ORDER BY recorded_at DESC",
                    start
                )
            }
            _ => {
                "SELECT id, total_savings, total_loans_principal, total_investments, total_crypto,
                        total_bonds, total_real_estate_personal, total_real_estate_investment, total_other_assets, recorded_at
                 FROM portfolio_metrics_history ORDER BY recorded_at DESC".to_string()
            }
        };

        let mut stmt = conn.prepare(&sql)?;
        let history = stmt.query_map([], |row| {
            Ok(PortfolioMetricsHistory {
                id: row.get(0)?,
                total_savings: row.get(1)?,
                total_loans_principal: row.get(2)?,
                total_investments: row.get(3)?,
                total_crypto: row.get(4)?,
                total_bonds: row.get(5)?,
                total_real_estate_personal: row.get(6)?,
                total_real_estate_investment: row.get(7)?,
                total_other_assets: row.get(8).unwrap_or("0".to_string()),
                recorded_at: row.get(9)?,
            })
        })?.filter_map(|r| r.ok()).collect();

        Ok(history)
    })
}

/// Update today's portfolio snapshot (or create one if it doesn't exist)
pub async fn update_todays_snapshot(db: &Database) -> Result<()> {
    // We need to calculate metrics first.
    // Since get_portfolio_metrics asks for State, we can't easily call it.
    // We'll reimplement specific parts or refactor get_portfolio_metrics to take &Database.
    // For now, let's look at get_portfolio_metrics implementation.
    // It uses db.with_conn.

    // Check if we can refactor get_portfolio_metrics to take &Database first.
    // Actually, asking for State in arguments is for Tauri command handler.
    // We should separate the logic.

    let metrics = calculate_portfolio_metrics(db, false)?;
    let now = chrono::Utc::now();
    let today_start = now
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc()
        .timestamp();
    let now_ts = now.timestamp();

    db.with_conn(move |conn| {
        // Check for existing snapshot for today
        // We look for any record created after today_start
        let existing_id: Option<String> = conn.query_row(
            "SELECT id FROM portfolio_metrics_history WHERE recorded_at >= ?1 LIMIT 1",
            [today_start],
            |row| row.get(0),
        ).ok();

        if let Some(id) = existing_id {
            // Update existing
            conn.execute(
                "UPDATE portfolio_metrics_history
                 SET total_savings = ?2, total_loans_principal = ?3, total_investments = ?4,
                     total_crypto = ?5, total_bonds = ?6, total_real_estate_personal = ?7,
                     total_real_estate_investment = ?8, total_other_assets = ?9, recorded_at = ?10
                 WHERE id = ?1",
                rusqlite::params![
                    id,
                    metrics.total_savings.to_string(),
                    metrics.total_liabilities.to_string(),
                    metrics.total_investments.to_string(),
                    metrics.total_crypto.to_string(),
                    metrics.total_bonds.to_string(),
                    metrics.total_real_estate_personal.to_string(),
                    metrics.total_real_estate_investment.to_string(),
                    metrics.total_other_assets.to_string(),
                    now_ts,
                ],
            )?;
        } else {
            // Insert new
            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO portfolio_metrics_history
                 (id, total_savings, total_loans_principal, total_investments, total_crypto,
                  total_bonds, total_real_estate_personal, total_real_estate_investment, total_other_assets, recorded_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                rusqlite::params![
                    id,
                    metrics.total_savings.to_string(),
                    metrics.total_liabilities.to_string(),
                    metrics.total_investments.to_string(),
                    metrics.total_crypto.to_string(),
                    metrics.total_bonds.to_string(),
                    metrics.total_real_estate_personal.to_string(),
                    metrics.total_real_estate_investment.to_string(),
                    metrics.total_other_assets.to_string(),
                    now_ts,
                ],
            )?;
        }
        Ok(())
    })
}

/// Record current portfolio snapshot
#[tauri::command]
pub async fn record_portfolio_snapshot(db: State<'_, Database>) -> Result<()> {
    update_todays_snapshot(&db).await
}

/// Update exchange rates from ECB and return them
#[tauri::command]
pub async fn refresh_exchange_rates() -> Result<std::collections::HashMap<String, f64>> {
    let rates = crate::services::currency::fetch_ecb_rates().await?;
    Ok(rates)
}

/// Get current exchange rates (without fetching)
#[tauri::command]
pub fn get_exchange_rates() -> std::collections::HashMap<String, f64> {
    crate::services::currency::get_all_rates()
}

// ============================================================================
// Historical Snapshot Backfill
// ============================================================================

use crate::services::price_api::{
    get_api_keys, get_historical_crypto_prices_coingecko, get_historical_stock_prices_yahoo,
    HistoricalPrice,
};
use std::collections::HashMap;

/// Result returned by the backfill command
#[derive(Debug, Clone, serde::Serialize)]
pub struct BackfillResult {
    pub days_processed: i32,
    pub total_days: i32,
    pub completed: bool,
    pub message: String,
}

/// Get snapshot date range (oldest and newest) and all existing day timestamps
fn get_snapshot_date_info(db: &Database) -> Result<(Option<i64>, Option<i64>, Vec<i64>)> {
    db.with_conn(|conn| {
        let min_date: Option<i64> = conn
            .query_row(
                "SELECT MIN(recorded_at) FROM portfolio_metrics_history",
                [],
                |row| row.get(0),
            )
            .ok()
            .flatten();

        let max_date: Option<i64> = conn
            .query_row(
                "SELECT MAX(recorded_at) FROM portfolio_metrics_history",
                [],
                |row| row.get(0),
            )
            .ok()
            .flatten();

        // Get all existing day timestamps (normalized to start of day)
        let mut stmt = conn.prepare(
            "SELECT DISTINCT (recorded_at / 86400) * 86400 FROM portfolio_metrics_history",
        )?;
        let existing_days: Vec<i64> = stmt
            .query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        Ok((min_date, max_date, existing_days))
    })
}

/// Get all tickers for stocks
fn get_stock_tickers(db: &Database) -> Result<Vec<String>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare("SELECT DISTINCT ticker FROM stock_investments")?;
        let tickers: Vec<String> = stmt
            .query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(tickers)
    })
}

/// Get crypto investments with their coingecko IDs
fn get_crypto_id_map(db: &Database) -> Result<HashMap<String, String>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT ticker, coingecko_id FROM crypto_investments WHERE coingecko_id IS NOT NULL",
        )?;
        let map: HashMap<String, String> = stmt
            .query_map([], |row| {
                let ticker: String = row.get(0)?;
                let coingecko_id: String = row.get(1)?;
                Ok((coingecko_id, ticker))
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(map)
    })
}

/// Calculate portfolio metrics for a specific day using historical prices
fn calculate_metrics_for_day(
    db: &Database,
    day_timestamp: i64,
    stock_prices: &HashMap<String, Vec<HistoricalPrice>>,
    crypto_prices: &HashMap<String, Vec<HistoricalPrice>>,
) -> Result<PortfolioMetrics> {
    use crate::services::currency::convert_to_czk;

    db.with_conn(|conn| {
        // Calculate total savings (same as current - static values)
        let mut savings_stmt = conn.prepare("SELECT balance, currency FROM savings_accounts")?;
        let total_savings: f64 = savings_stmt
            .query_map([], |row| {
                let balance: f64 = row.get::<_, String>(0)?.parse().unwrap_or(0.0);
                let currency: String = row.get(1)?;
                Ok(convert_to_czk(balance, &currency))
            })?
            .filter_map(|r| r.ok())
            .sum();

        // Calculate total bonds (same as current - static values)
        let mut bonds_stmt = conn.prepare("SELECT coupon_value, quantity, currency FROM bonds")?;
        let total_bonds: f64 = bonds_stmt
            .query_map([], |row| {
                let value: f64 = row.get::<_, String>(0)?.parse().unwrap_or(0.0);
                let quantity: f64 = row.get::<_, String>(1)?.parse().unwrap_or(1.0);
                let currency: String = row.get(2)?;
                Ok(convert_to_czk(value * quantity, &currency))
            })?
            .filter_map(|r| r.ok())
            .sum();

        // Calculate total loans (same as current - static values)
        let mut loans_stmt = conn.prepare("SELECT principal, currency FROM loans")?;
        let total_liabilities: f64 = loans_stmt
            .query_map([], |row| {
                let principal: f64 = row.get::<_, String>(0)?.parse().unwrap_or(0.0);
                let currency: String = row.get(1)?;
                Ok(convert_to_czk(principal, &currency))
            })?
            .filter_map(|r| r.ok())
            .sum();

        // Calculate real estate (same as current - static values)
        let mut re_stmt =
            conn.prepare("SELECT type, market_price, market_price_currency FROM real_estate")?;
        let mut total_re_personal = 0.0;
        let mut total_re_investment = 0.0;

        let re_rows = re_stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?;

        for row in re_rows.filter_map(|r| r.ok()) {
            let price: f64 = row.1.parse().unwrap_or(0.0);
            let price_czk = convert_to_czk(price, &row.2);
            if row.0 == "personal" {
                total_re_personal += price_czk;
            } else {
                total_re_investment += price_czk;
            }
        }

        // Calculate other assets (static values)
        let mut other_stmt =
            conn.prepare("SELECT quantity, market_price, currency FROM other_assets")?;
        let total_other_assets: f64 = other_stmt
            .query_map([], |row| {
                let qty: f64 = row.get::<_, String>(0)?.parse().unwrap_or(0.0);
                let price: f64 = row.get::<_, String>(1)?.parse().unwrap_or(0.0);
                let currency = row.get::<_, String>(2)?;
                Ok(convert_to_czk(qty * price, &currency))
            })?
            .filter_map(|r| r.ok())
            .sum();

        // Calculate investments using historical prices
        let mut total_investments = 0.0;
        let mut inv_stmt = conn.prepare("SELECT ticker, quantity FROM stock_investments")?;
        let investments: Vec<(String, f64)> = inv_stmt
            .query_map([], |row| {
                let ticker: String = row.get(0)?;
                let qty: f64 = row.get::<_, String>(1)?.parse().unwrap_or(0.0);
                Ok((ticker, qty))
            })?
            .filter_map(|r| r.ok())
            .collect();

        for (ticker, qty) in investments {
            if let Some(prices) = stock_prices.get(&ticker) {
                // Find the closest price to this day
                if let Some(price) = find_closest_price(prices, day_timestamp) {
                    let value_in_czk = convert_to_czk(price.price * qty, &price.currency);
                    total_investments += value_in_czk;
                }
            }
        }

        // Calculate crypto using historical prices
        let mut total_crypto = 0.0;
        let mut crypto_stmt = conn.prepare("SELECT ticker, quantity FROM crypto_investments")?;
        let cryptos: Vec<(String, f64)> = crypto_stmt
            .query_map([], |row| {
                let ticker: String = row.get(0)?;
                let qty: f64 = row.get::<_, String>(1)?.parse().unwrap_or(0.0);
                Ok((ticker, qty))
            })?
            .filter_map(|r| r.ok())
            .collect();

        for (ticker, qty) in cryptos {
            if let Some(prices) = crypto_prices.get(&ticker) {
                if let Some(price) = find_closest_price(prices, day_timestamp) {
                    let value_in_czk = convert_to_czk(price.price * qty, &price.currency);
                    total_crypto += value_in_czk;
                }
            }
        }

        // Calculate totals
        let total_real_estate = total_re_personal + total_re_investment;
        let total_assets = total_savings
            + total_investments
            + total_crypto
            + total_bonds
            + total_real_estate
            + total_other_assets;
        let net_worth = total_assets - total_liabilities;

        Ok(PortfolioMetrics {
            total_savings,
            total_investments,
            total_crypto,
            total_bonds,
            total_real_estate_personal: total_re_personal,
            total_real_estate_investment: total_re_investment,
            total_real_estate,
            total_other_assets,
            total_liabilities,
            total_assets,
            net_worth,
        })
    })
}

/// Find the closest price to a given timestamp
fn find_closest_price(
    prices: &[HistoricalPrice],
    target_timestamp: i64,
) -> Option<&HistoricalPrice> {
    if prices.is_empty() {
        return None;
    }

    // Find price with closest timestamp
    prices
        .iter()
        .min_by_key(|p| (p.timestamp - target_timestamp).abs())
}

/// Insert a snapshot for a specific day
fn insert_snapshot_for_day(
    db: &Database,
    metrics: &PortfolioMetrics,
    day_timestamp: i64,
) -> Result<()> {
    db.with_conn(|conn| {
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO portfolio_metrics_history
             (id, total_savings, total_loans_principal, total_investments, total_crypto,
              total_bonds, total_real_estate_personal, total_real_estate_investment, total_other_assets, recorded_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                id,
                metrics.total_savings.to_string(),
                metrics.total_liabilities.to_string(),
                metrics.total_investments.to_string(),
                metrics.total_crypto.to_string(),
                metrics.total_bonds.to_string(),
                metrics.total_real_estate_personal.to_string(),
                metrics.total_real_estate_investment.to_string(),
                metrics.total_other_assets.to_string(),
                day_timestamp,
            ],
        )?;
        Ok(())
    })
}

/// Backfill missing portfolio snapshots
/// This is the main function that orchestrates the backfill process
/// It finds gaps between the oldest and newest snapshot and fills them
pub async fn backfill_missing_snapshots(db: &Database) -> Result<BackfillResult> {
    println!("[BACKFILL] Starting snapshot backfill...");

    // Get snapshot date range and existing days
    let (min_date, _max_date, existing_days) = get_snapshot_date_info(db)?;

    let now = chrono::Utc::now().timestamp();
    let today_start = (now / 86400) * 86400; // Start of today (UTC)

    // Need at least one snapshot to backfill from
    let oldest_day = match min_date {
        Some(date) => (date / 86400) * 86400,
        None => {
            println!("[BACKFILL] No existing snapshots found, skipping backfill");
            return Ok(BackfillResult {
                days_processed: 0,
                total_days: 0,
                completed: true,
                message: "No previous snapshots to backfill from".to_string(),
            });
        }
    };

    // Convert existing days to a HashSet for O(1) lookup
    // IMPORTANT: Remove today from the set - we want to fill gaps up to yesterday
    // because today's snapshot may have been created by price refresh before we got here
    let mut existing_days_set: std::collections::HashSet<i64> = existing_days.into_iter().collect();
    existing_days_set.remove(&today_start);

    println!(
        "[BACKFILL] Oldest snapshot: {}, existing days (excluding today): {}",
        oldest_day,
        existing_days_set.len()
    );

    // Find all missing days between oldest snapshot and yesterday (not today)
    let yesterday_start = today_start - 86400;
    let mut missing_days: Vec<i64> = Vec::new();
    let mut check_day = oldest_day + 86400; // Start from day after oldest

    while check_day <= yesterday_start {
        if !existing_days_set.contains(&check_day) {
            missing_days.push(check_day);
        }
        check_day += 86400;
    }

    if missing_days.is_empty() {
        println!("[BACKFILL] No missing days to backfill");
        return Ok(BackfillResult {
            days_processed: 0,
            total_days: 0,
            completed: true,
            message: "No missing days".to_string(),
        });
    }

    // Limit backfill to last 30 days to avoid too many API calls
    let max_backfill_days = 30;
    if missing_days.len() > max_backfill_days {
        // Keep only the most recent 30 missing days
        let skip_count = missing_days.len() - max_backfill_days;
        missing_days = missing_days.into_iter().skip(skip_count).collect();
    }

    let total_missing = missing_days.len() as i32;

    println!(
        "[BACKFILL] Found {} missing days to backfill",
        total_missing
    );

    // Get the date range for fetching historical prices
    let fetch_start = *missing_days.first().unwrap_or(&today_start);
    let fetch_end = today_start;

    // Get tickers for fetching
    let stock_tickers = get_stock_tickers(db)?;
    let crypto_id_map = get_crypto_id_map(db)?;

    println!(
        "[BACKFILL] Found {} stock tickers and {} crypto tickers",
        stock_tickers.len(),
        crypto_id_map.len()
    );

    // Fetch historical prices
    let stock_prices = if !stock_tickers.is_empty() {
        get_historical_stock_prices_yahoo(&stock_tickers, fetch_start, fetch_end).await?
    } else {
        HashMap::new()
    };

    let api_keys = get_api_keys(db)?;
    let crypto_prices = if !crypto_id_map.is_empty() {
        get_historical_crypto_prices_coingecko(
            api_keys.coingecko.as_deref(),
            &crypto_id_map,
            fetch_start,
            fetch_end,
        )
        .await?
    } else {
        HashMap::new()
    };

    // Create snapshots for each missing day
    let mut days_processed = 0;

    for day_timestamp in missing_days {
        // Calculate metrics for this day using historical prices
        let metrics = calculate_metrics_for_day(db, day_timestamp, &stock_prices, &crypto_prices)?;

        // Insert snapshot
        insert_snapshot_for_day(db, &metrics, day_timestamp)?;

        days_processed += 1;

        println!(
            "[BACKFILL] Created snapshot for day {}/{}",
            days_processed, total_missing
        );
    }

    println!(
        "[BACKFILL] Backfill complete! Created {} snapshots",
        days_processed
    );

    Ok(BackfillResult {
        days_processed,
        total_days: total_missing,
        completed: true,
        message: format!("Created {} historical snapshots", days_processed),
    })
}

/// Tauri command to start snapshot backfill
#[tauri::command]
pub async fn start_snapshot_backfill(db: State<'_, Database>) -> Result<BackfillResult> {
    backfill_missing_snapshots(&db).await
}
