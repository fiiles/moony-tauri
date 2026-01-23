//! Portfolio metrics commands

use crate::db::Database;
use crate::error::Result;
use crate::models::PortfolioMetricsHistory;
use crate::services::currency::convert_to_czk;
use serde::Serialize;
use specta::Type;
use tauri::State;
use uuid::Uuid;

/// Current portfolio metrics
#[derive(Debug, Clone, Serialize, Type)]
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
        // Calculate total savings from bank_accounts
        let mut bank_stmt = conn.prepare("SELECT balance, currency FROM bank_accounts")?;
        let total_savings: f64 = bank_stmt
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
                    (SELECT original_price FROM stock_data WHERE ticker = ?1)
                ),
                COALESCE(
                    (SELECT currency FROM stock_price_overrides WHERE ticker = ?1),
                    (SELECT currency FROM stock_data WHERE ticker = ?1)
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

            // Try to get price - prefer override (manual) over API price
            let price_data: rusqlite::Result<(Option<String>, Option<String>)> = conn.query_row(
                "SELECT COALESCE(
                    (SELECT price FROM crypto_price_overrides WHERE symbol = ?1),
                    (SELECT price FROM crypto_prices WHERE symbol = ?1)
                ),
                COALESCE(
                    (SELECT currency FROM crypto_price_overrides WHERE symbol = ?1),
                    (SELECT currency FROM crypto_prices WHERE symbol = ?1)
                )",
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

/// Record today's per-ticker values to stock_value_history and crypto_value_history tables
/// This is called alongside update_todays_snapshot to ensure per-ticker chart data is available
fn record_todays_ticker_values(db: &Database) -> Result<()> {
    use crate::services::currency::convert_to_czk;

    let now = chrono::Utc::now();
    let today_start = now
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .expect("Valid date should have valid midnight time")
        .and_utc()
        .timestamp();

    db.with_conn(|conn| {
        // Record stock values
        let mut inv_stmt = conn.prepare(
            "SELECT si.ticker, si.quantity FROM stock_investments si"
        )?;
        let investments: Vec<(String, String)> = inv_stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .filter_map(|r| r.ok())
            .collect();

        for (ticker, qty_str) in investments {
            let qty: f64 = qty_str.parse().unwrap_or(0.0);
            if qty <= 0.0 {
                continue;
            }

            // Get current price
            let price_data: Option<(String, String)> = conn.query_row(
                "SELECT COALESCE(
                    (SELECT price FROM stock_price_overrides WHERE ticker = ?1),
                    (SELECT original_price FROM stock_data WHERE ticker = ?1)
                ),
                COALESCE(
                    (SELECT currency FROM stock_price_overrides WHERE ticker = ?1),
                    (SELECT currency FROM stock_data WHERE ticker = ?1)
                )",
                [&ticker],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            ).ok();

            if let Some((price_str, currency)) = price_data {
                let price: f64 = price_str.parse().unwrap_or(0.0);
                if price <= 0.0 {
                    continue;
                }
                let value_czk = convert_to_czk(qty * price, &currency);
                let id = Uuid::new_v4().to_string();

                conn.execute(
                    "INSERT INTO stock_value_history (id, ticker, recorded_at, value_czk, quantity, price, currency)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                     ON CONFLICT(ticker, recorded_at) DO UPDATE SET
                         value_czk = excluded.value_czk,
                         quantity = excluded.quantity,
                         price = excluded.price,
                         currency = excluded.currency",
                    rusqlite::params![
                        id,
                        ticker,
                        today_start,
                        value_czk.to_string(),
                        qty.to_string(),
                        price.to_string(),
                        currency,
                    ],
                )?;
            }
        }

        // Record crypto values
        let mut crypto_stmt = conn.prepare(
            "SELECT ticker, quantity FROM crypto_investments"
        )?;
        let cryptos: Vec<(String, String)> = crypto_stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .filter_map(|r| r.ok())
            .collect();

        for (ticker, qty_str) in cryptos {
            let qty: f64 = qty_str.parse().unwrap_or(0.0);
            if qty <= 0.0 {
                continue;
            }

            // Get current price - prefer override over API price
            let price_data: Option<(String, String)> = conn.query_row(
                "SELECT COALESCE(
                    (SELECT price FROM crypto_price_overrides WHERE symbol = ?1),
                    (SELECT price FROM crypto_prices WHERE symbol = ?1)
                ),
                COALESCE(
                    (SELECT currency FROM crypto_price_overrides WHERE symbol = ?1),
                    (SELECT currency FROM crypto_prices WHERE symbol = ?1)
                )",
                [&ticker],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            ).ok();

            if let Some((price_str, currency)) = price_data {
                let price: f64 = price_str.parse().unwrap_or(0.0);
                if price <= 0.0 {
                    continue;
                }
                let value_czk = convert_to_czk(qty * price, &currency);
                let id = Uuid::new_v4().to_string();

                conn.execute(
                    "INSERT INTO crypto_value_history (id, ticker, recorded_at, value_czk, quantity, price, currency)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                     ON CONFLICT(ticker, recorded_at) DO UPDATE SET
                         value_czk = excluded.value_czk,
                         quantity = excluded.quantity,
                         price = excluded.price,
                         currency = excluded.currency",
                    rusqlite::params![
                        id,
                        ticker,
                        today_start,
                        value_czk.to_string(),
                        qty.to_string(),
                        price.to_string(),
                        currency,
                    ],
                )?;
            }
        }

        Ok(())
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
        .expect("Valid date should have valid midnight time")
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
    })?;

    // Also record per-ticker values for stock and crypto history charts
    record_todays_ticker_values(db)?;

    Ok(())
}

/// Record current portfolio snapshot
#[tauri::command]
pub async fn record_portfolio_snapshot(db: State<'_, Database>) -> Result<()> {
    update_todays_snapshot(&db).await
}

/// Update exchange rates from ECB and return them
#[tauri::command]
pub async fn refresh_exchange_rates(
    db: State<'_, Database>,
) -> Result<std::collections::HashMap<String, f64>> {
    let rates = crate::services::currency::fetch_ecb_rates().await?;

    // Persist to database for offline use
    db.with_conn(|conn| crate::services::currency::save_rates_to_db(conn, &rates))?;

    Ok(rates)
}

/// Get current exchange rates (without fetching)
#[tauri::command]
pub fn get_exchange_rates() -> std::collections::HashMap<String, f64> {
    crate::services::currency::get_all_rates()
}

// ============================================================================
// Price Status (for stale indicator)
// ============================================================================

/// Status of prices and exchange rates freshness
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PriceStatus {
    /// Are any stock prices considered stale (older than 24 hours)?
    pub stocks_stale: bool,
    /// Are any crypto prices considered stale (older than 12 hours)?
    pub crypto_stale: bool,
    /// Are exchange rates considered stale (older than 48 hours)?
    pub exchange_rates_stale: bool,
    /// Age of oldest stock price in hours (None if no stocks)
    pub oldest_stock_price_age_hours: Option<i64>,
    /// Age of oldest crypto price in hours (None if no crypto)
    pub oldest_crypto_price_age_hours: Option<i64>,
    /// Age of exchange rates in hours (None if never fetched)
    pub exchange_rates_age_hours: Option<i64>,
    /// Number of stocks without any price data
    pub stocks_missing_price: i32,
    /// Number of cryptos without any price data
    pub crypto_missing_price: i32,
}

/// Staleness thresholds in hours
const STOCKS_STALE_THRESHOLD_HOURS: i64 = 24;
const CRYPTO_STALE_THRESHOLD_HOURS: i64 = 12;
const EXCHANGE_RATES_STALE_THRESHOLD_HOURS: i64 = 48;

/// Get the status of prices and exchange rates freshness
#[tauri::command]
pub fn get_price_status(db: State<'_, Database>) -> Result<PriceStatus> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("Time went backwards")
        .as_secs() as i64;

    db.with_conn(|conn| {
        // Check stock prices
        let (oldest_stock_fetched_at, stocks_missing): (Option<i64>, i32) = {
            // Get oldest fetched_at from stock_data for investments we actually hold
            let oldest: Option<i64> = conn
                .query_row(
                    "SELECT MIN(sd.fetched_at) FROM stock_investments si
                 LEFT JOIN stock_data sd ON si.ticker = sd.ticker
                 WHERE sd.fetched_at IS NOT NULL",
                    [],
                    |row| row.get(0),
                )
                .ok()
                .flatten();

            // Count stocks without price data
            let missing: i32 = conn
                .query_row(
                    "SELECT COUNT(*) FROM stock_investments si
                 LEFT JOIN stock_data sd ON si.ticker = sd.ticker
                 WHERE sd.ticker IS NULL",
                    [],
                    |row| row.get(0),
                )
                .unwrap_or(0);

            (oldest, missing)
        };

        // Check crypto prices
        let (oldest_crypto_fetched_at, crypto_missing): (Option<i64>, i32) = {
            let oldest: Option<i64> = conn
                .query_row(
                    "SELECT MIN(cp.fetched_at) FROM crypto_investments ci
                 LEFT JOIN crypto_prices cp ON ci.ticker = cp.symbol
                 WHERE cp.fetched_at IS NOT NULL",
                    [],
                    |row| row.get(0),
                )
                .ok()
                .flatten();

            let missing: i32 = conn
                .query_row(
                    "SELECT COUNT(*) FROM crypto_investments ci
                 LEFT JOIN crypto_prices cp ON ci.ticker = cp.symbol
                 WHERE cp.symbol IS NULL",
                    [],
                    |row| row.get(0),
                )
                .unwrap_or(0);

            (oldest, missing)
        };

        // Get exchange rates fetched_at from memory
        let exchange_rates_fetched_at = crate::services::currency::get_exchange_rates_fetched_at();

        // Calculate ages in hours
        let oldest_stock_price_age_hours = oldest_stock_fetched_at.map(|t| (now - t) / 3600);
        let oldest_crypto_price_age_hours = oldest_crypto_fetched_at.map(|t| (now - t) / 3600);
        let exchange_rates_age_hours = exchange_rates_fetched_at.map(|t| (now - t) / 3600);

        // Determine staleness
        let stocks_stale = oldest_stock_price_age_hours
            .map(|h| h > STOCKS_STALE_THRESHOLD_HOURS)
            .unwrap_or(false)
            || stocks_missing > 0;

        let crypto_stale = oldest_crypto_price_age_hours
            .map(|h| h > CRYPTO_STALE_THRESHOLD_HOURS)
            .unwrap_or(false)
            || crypto_missing > 0;

        let exchange_rates_stale = exchange_rates_age_hours
            .map(|h| h > EXCHANGE_RATES_STALE_THRESHOLD_HOURS)
            .unwrap_or(true); // Stale if never fetched

        Ok(PriceStatus {
            stocks_stale,
            crypto_stale,
            exchange_rates_stale,
            oldest_stock_price_age_hours,
            oldest_crypto_price_age_hours,
            exchange_rates_age_hours,
            stocks_missing_price: stocks_missing,
            crypto_missing_price: crypto_missing,
        })
    })
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
    last_known_stock_prices: &mut HashMap<String, (f64, String)>,
    last_known_crypto_prices: &mut HashMap<String, (f64, String)>,
) -> Result<PortfolioMetrics> {
    use crate::services::currency::convert_to_czk;

    db.with_conn(|conn| {
        // Calculate total savings from bank_accounts
        let mut bank_stmt = conn.prepare("SELECT balance, currency FROM bank_accounts")?;
        let total_savings: f64 = bank_stmt
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

        // Calculate investments using historical prices with fallback
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
            let (price, currency) = if let Some(prices) = stock_prices.get(&ticker) {
                if let Some(price) = find_closest_price(prices, day_timestamp) {
                    // Update last known
                    last_known_stock_prices
                        .insert(ticker.clone(), (price.price, price.currency.clone()));
                    (price.price, price.currency.as_str())
                } else if let Some((last_price, last_curr)) = last_known_stock_prices.get(&ticker) {
                    (*last_price, last_curr.as_str())
                } else {
                    (0.0, "USD")
                }
            } else if let Some((last_price, last_curr)) = last_known_stock_prices.get(&ticker) {
                (*last_price, last_curr.as_str())
            } else {
                (0.0, "USD")
            };

            if price > 0.0 {
                let value_in_czk = convert_to_czk(price * qty, currency);
                total_investments += value_in_czk;
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
            let (price, currency) = if let Some(prices) = crypto_prices.get(&ticker) {
                if let Some(price) = find_closest_price(prices, day_timestamp) {
                    // Update last known
                    last_known_crypto_prices
                        .insert(ticker.clone(), (price.price, price.currency.clone()));
                    (price.price, price.currency.as_str())
                } else if let Some((last_price, last_curr)) = last_known_crypto_prices.get(&ticker)
                {
                    (*last_price, last_curr.as_str())
                } else {
                    (0.0, "USD")
                }
            } else if let Some((last_price, last_curr)) = last_known_crypto_prices.get(&ticker) {
                (*last_price, last_curr.as_str())
            } else {
                (0.0, "USD")
            };

            if price > 0.0 {
                let value_in_czk = convert_to_czk(price * qty, currency);
                total_crypto += value_in_czk;
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

    // Initialize last known prices for fallback
    // Try to get current prices as a baseline if no history available
    let mut last_known_crypto_prices: HashMap<String, (f64, String)> = HashMap::new();
    let mut last_known_stock_prices: HashMap<String, (f64, String)> = HashMap::new();

    // Seed crypto with current prices
    if !crypto_id_map.is_empty() {
        let current_prices = db.with_conn(|conn| {
            let mut stmt = conn.prepare("SELECT symbol, price, currency FROM crypto_prices")?;
            let prices: HashMap<String, (f64, String)> = stmt
                .query_map([], |row| {
                    let symbol: String = row.get(0)?;
                    let price: f64 = row.get::<_, String>(1)?.parse().unwrap_or(0.0);
                    let currency: String = row.get(2)?;
                    Ok((symbol, (price, currency)))
                })?
                .filter_map(|r| r.ok())
                .collect();
            Ok(prices)
        })?;

        last_known_crypto_prices = current_prices;
    }

    // Seed stocks with current prices
    if !stock_tickers.is_empty() {
        let current_stock_prices = db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT ticker, COALESCE(
                    (SELECT price FROM stock_price_overrides WHERE ticker = sd.ticker),
                    sd.original_price
                ), COALESCE(
                    (SELECT currency FROM stock_price_overrides WHERE ticker = sd.ticker),
                    sd.currency
                ) FROM stock_data sd",
            )?;
            let prices: HashMap<String, (f64, String)> = stmt
                .query_map([], |row| {
                    let ticker: String = row.get(0)?;
                    let price: f64 = row.get::<_, String>(1)?.parse().unwrap_or(0.0);
                    let currency: String = row.get(2)?;
                    Ok((ticker, (price, currency)))
                })?
                .filter_map(|r| r.ok())
                .collect();
            Ok(prices)
        })?;

        last_known_stock_prices = current_stock_prices;
    }

    for day_timestamp in missing_days.clone() {
        // Calculate metrics for this day using historical prices
        let metrics = calculate_metrics_for_day(
            db,
            day_timestamp,
            &stock_prices,
            &crypto_prices,
            &mut last_known_stock_prices,
            &mut last_known_crypto_prices,
        )?;

        // Insert snapshot
        insert_snapshot_for_day(db, &metrics, day_timestamp)?;

        days_processed += 1;

        println!(
            "[BACKFILL] Created snapshot for day {}/{}",
            days_processed, total_missing
        );
    }

    // Also populate per-ticker history tables
    println!("[BACKFILL] Populating per-ticker history tables...");

    // Populate stock_value_history
    for ticker in &stock_tickers {
        db.with_conn(|conn| {
            for day_timestamp in &missing_days {
                let quantity = get_stock_quantity_at_date(conn, ticker, *day_timestamp);

                if quantity <= 0.0 {
                    continue;
                }

                let (price, currency) = if let Some(prices) = stock_prices.get(ticker) {
                    if let Some(hp) = find_closest_price(prices, *day_timestamp) {
                        (hp.price, hp.currency.clone())
                    } else {
                        continue;
                    }
                } else {
                    continue;
                };

                let value_czk = convert_to_czk(quantity * price, &currency);
                let id = Uuid::new_v4().to_string();

                conn.execute(
                    "INSERT INTO stock_value_history (id, ticker, recorded_at, value_czk, quantity, price, currency)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                     ON CONFLICT(ticker, recorded_at) DO UPDATE SET
                         value_czk = excluded.value_czk,
                         quantity = excluded.quantity,
                         price = excluded.price,
                         currency = excluded.currency",
                    rusqlite::params![
                        id,
                        ticker,
                        day_timestamp,
                        value_czk.to_string(),
                        quantity.to_string(),
                        price.to_string(),
                        currency,
                    ],
                )?;
            }
            Ok(())
        })?;
    }

    // Populate crypto_value_history
    for ticker in crypto_id_map.keys() {
        db.with_conn(|conn| {
            for day_timestamp in &missing_days {
                let quantity = get_crypto_quantity_at_date(conn, ticker, *day_timestamp);

                if quantity <= 0.0 {
                    continue;
                }

                let (price, currency) = if let Some(prices) = crypto_prices.get(ticker) {
                    if let Some(hp) = find_closest_price(prices, *day_timestamp) {
                        (hp.price, hp.currency.clone())
                    } else {
                        continue;
                    }
                } else {
                    continue;
                };

                let value_czk = convert_to_czk(quantity * price, &currency);
                let id = Uuid::new_v4().to_string();

                conn.execute(
                    "INSERT INTO crypto_value_history (id, ticker, recorded_at, value_czk, quantity, price, currency)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                     ON CONFLICT(ticker, recorded_at) DO UPDATE SET
                         value_czk = excluded.value_czk,
                         quantity = excluded.quantity,
                         price = excluded.price,
                         currency = excluded.currency",
                    rusqlite::params![
                        id,
                        ticker,
                        day_timestamp,
                        value_czk.to_string(),
                        quantity.to_string(),
                        price.to_string(),
                        currency,
                    ],
                )?;
            }
            Ok(())
        })?;
    }

    println!(
        "[BACKFILL] Backfill complete! Created {} snapshots",
        days_processed
    );

    Ok(BackfillResult {
        days_processed,
        total_days: total_missing,
        completed: true,
        message: if api_keys.coingecko.is_none() || api_keys.coingecko.as_deref() == Some("") {
            format!(
                "Backfilled {} days. WARNING: CoinGecko API key missing, used fallback prices.",
                days_processed
            )
        } else {
            format!("Created {} historical snapshots", days_processed)
        },
    })
}

/// Tauri command to start snapshot backfill
#[tauri::command]
pub async fn start_snapshot_backfill(db: State<'_, Database>) -> Result<BackfillResult> {
    backfill_missing_snapshots(&db).await
}

/// Tauri command to recalculate all portfolio history from scratch
/// This is useful when historical data has been corrupted or needs to be regenerated
#[tauri::command]
pub async fn recalculate_all_portfolio_history(db: State<'_, Database>) -> Result<BackfillResult> {
    println!("[RECALC] Starting full portfolio recalculation from oldest snapshot...");

    // Get the oldest snapshot date
    let (min_date, _, _) = get_snapshot_date_info(&db)?;

    let from_timestamp = match min_date {
        Some(date) => date,
        None => {
            // No snapshots exist, nothing to recalculate
            return Ok(BackfillResult {
                days_processed: 0,
                total_days: 0,
                completed: true,
                message: "No existing snapshots to recalculate".to_string(),
            });
        }
    };

    // Trigger full recalculation
    recalculate_history_from_date(&db, from_timestamp).await?;

    let now = chrono::Utc::now().timestamp();
    let today_start = (now / 86400) * 86400;
    let from_day = (from_timestamp / 86400) * 86400;
    let days_recalculated = ((today_start - from_day) / 86400) as i32;

    Ok(BackfillResult {
        days_processed: days_recalculated,
        total_days: days_recalculated,
        completed: true,
        message: format!(
            "Recalculated {} days of portfolio history",
            days_recalculated
        ),
    })
}

/// Tauri command to backfill a specific stock ticker's value history on demand
/// This is called when the user views a stock detail page to ensure the chart has data
#[tauri::command]
pub async fn backfill_stock_ticker_history(
    db: State<'_, Database>,
    ticker: String,
) -> Result<BackfillResult> {
    println!(
        "[BACKFILL] On-demand backfill requested for stock ticker: {}",
        ticker
    );

    // Get the oldest transaction date for this ticker to determine backfill range
    let oldest_tx_date: Option<i64> = db.with_conn(|conn| {
        let result: Option<i64> = conn
            .query_row(
                "SELECT MIN(transaction_date) FROM investment_transactions WHERE ticker = ?1",
                [&ticker.to_uppercase()],
                |row| row.get(0),
            )
            .ok()
            .flatten();
        Ok(result)
    })?;

    let from_timestamp = match oldest_tx_date {
        Some(date) => date,
        None => {
            println!(
                "[BACKFILL] No transactions found for ticker {}, nothing to backfill",
                ticker
            );
            return Ok(BackfillResult {
                days_processed: 0,
                total_days: 0,
                completed: true,
                message: "No transactions found for this ticker".to_string(),
            });
        }
    };

    // Limit to last 365 days to avoid too many API calls
    let now = chrono::Utc::now().timestamp();
    let one_year_ago = now - (365 * 86400);
    let effective_from = from_timestamp.max(one_year_ago);

    let from_day = (effective_from / 86400) * 86400;
    let today_start = (now / 86400) * 86400;

    // Count days to process
    let total_days = ((today_start - from_day) / 86400 + 1) as i32;

    // Call the existing recalculation function
    recalculate_stock_ticker_history(&db, &ticker, effective_from).await?;

    println!(
        "[BACKFILL] On-demand backfill completed for ticker {}",
        ticker
    );

    Ok(BackfillResult {
        days_processed: total_days,
        total_days,
        completed: true,
        message: format!("Backfilled {} days for {}", total_days, ticker),
    })
}

/// Tauri command to backfill a specific crypto ticker's value history on demand
/// This is called when the user views a crypto detail page to ensure the chart has data
#[tauri::command]
pub async fn backfill_crypto_ticker_history(
    db: State<'_, Database>,
    ticker: String,
) -> Result<BackfillResult> {
    println!(
        "[BACKFILL] On-demand backfill requested for crypto ticker: {}",
        ticker
    );

    // Get the coingecko_id and oldest transaction date for this ticker
    let (coingecko_id, oldest_tx_date): (Option<String>, Option<i64>) = db.with_conn(|conn| {
        let cg_id: Option<String> = conn
            .query_row(
                "SELECT coingecko_id FROM crypto_investments WHERE ticker = ?1",
                [&ticker.to_uppercase()],
                |row| row.get(0),
            )
            .ok()
            .flatten();

        let oldest: Option<i64> = conn
            .query_row(
                "SELECT MIN(transaction_date) FROM crypto_transactions WHERE ticker = ?1",
                [&ticker.to_uppercase()],
                |row| row.get(0),
            )
            .ok()
            .flatten();

        Ok((cg_id, oldest))
    })?;

    let coingecko_id = match coingecko_id {
        Some(id) if !id.is_empty() => id,
        _ => {
            println!(
                "[BACKFILL] No coingecko_id found for crypto {}, skipping",
                ticker
            );
            return Ok(BackfillResult {
                days_processed: 0,
                total_days: 0,
                completed: true,
                message: "No CoinGecko ID configured for this crypto".to_string(),
            });
        }
    };

    let from_timestamp = match oldest_tx_date {
        Some(date) => date,
        None => {
            println!(
                "[BACKFILL] No transactions found for crypto {}, nothing to backfill",
                ticker
            );
            return Ok(BackfillResult {
                days_processed: 0,
                total_days: 0,
                completed: true,
                message: "No transactions found for this crypto".to_string(),
            });
        }
    };

    // Limit to last 365 days
    let now = chrono::Utc::now().timestamp();
    let one_year_ago = now - (365 * 86400);
    let effective_from = from_timestamp.max(one_year_ago);

    let from_day = (effective_from / 86400) * 86400;
    let today_start = (now / 86400) * 86400;

    let total_days = ((today_start - from_day) / 86400 + 1) as i32;

    recalculate_crypto_ticker_history(&db, &ticker, &coingecko_id, effective_from).await?;

    println!(
        "[BACKFILL] On-demand backfill completed for crypto {}",
        ticker
    );

    Ok(BackfillResult {
        days_processed: total_days,
        total_days,
        completed: true,
        message: format!("Backfilled {} days for {}", total_days, ticker),
    })
}

// ============================================================================
// Historical Recalculation for Retrospective Transactions
// ============================================================================

/// Calculate stock quantity at a specific point in time by summing transactions
fn get_stock_quantity_at_date(
    conn: &rusqlite::Connection,
    ticker: &str,
    date_timestamp: i64,
) -> f64 {
    let result: rusqlite::Result<f64> = conn.query_row(
        "SELECT COALESCE(
            SUM(CASE WHEN type = 'buy' THEN CAST(quantity AS REAL) ELSE -CAST(quantity AS REAL) END),
            0.0
        ) FROM investment_transactions 
        WHERE ticker = ?1 AND transaction_date <= ?2",
        rusqlite::params![ticker, date_timestamp],
        |row| row.get(0),
    );
    result.unwrap_or(0.0).max(0.0)
}

/// Calculate crypto quantity at a specific point in time by summing transactions
fn get_crypto_quantity_at_date(
    conn: &rusqlite::Connection,
    ticker: &str,
    date_timestamp: i64,
) -> f64 {
    let result: rusqlite::Result<f64> = conn.query_row(
        "SELECT COALESCE(
            SUM(CASE WHEN type = 'buy' THEN CAST(quantity AS REAL) ELSE -CAST(quantity AS REAL) END),
            0.0
        ) FROM crypto_transactions 
        WHERE ticker = ?1 AND transaction_date <= ?2",
        rusqlite::params![ticker, date_timestamp],
        |row| row.get(0),
    );
    result.unwrap_or(0.0).max(0.0)
}

/// Calculate other asset quantity at a specific point in time by summing transactions
fn get_other_asset_quantity_at_date(
    conn: &rusqlite::Connection,
    asset_id: &str,
    date_timestamp: i64,
) -> f64 {
    let result: rusqlite::Result<f64> = conn.query_row(
        "SELECT COALESCE(
            SUM(CASE WHEN type = 'buy' THEN CAST(quantity AS REAL) ELSE -CAST(quantity AS REAL) END),
            0.0
        ) FROM other_asset_transactions 
        WHERE asset_id = ?1 AND transaction_date <= ?2",
        rusqlite::params![asset_id, date_timestamp],
        |row| row.get(0),
    );
    result.unwrap_or(0.0).max(0.0)
}

/// Calculate portfolio metrics for a specific day using historical quantities
fn calculate_metrics_for_day_historical(
    db: &Database,
    day_timestamp: i64,
    stock_prices: &HashMap<String, Vec<HistoricalPrice>>,
    crypto_prices: &HashMap<String, Vec<HistoricalPrice>>,
) -> Result<PortfolioMetrics> {
    use crate::services::currency::convert_to_czk;

    db.with_conn(|conn| {
        // Calculate total savings from bank_accounts (current values - static)
        let mut bank_stmt = conn.prepare(
            "SELECT balance, currency FROM bank_accounts WHERE exclude_from_balance = 0",
        )?;
        let total_savings: f64 = bank_stmt
            .query_map([], |row| {
                let balance: f64 = row.get::<_, String>(0)?.parse().unwrap_or(0.0);
                let currency: String = row.get(1)?;
                Ok(convert_to_czk(balance, &currency))
            })?
            .filter_map(|r| r.ok())
            .sum();

        // Calculate total bonds (static values)
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

        // Calculate total loans (static values)
        let mut loans_stmt = conn.prepare("SELECT principal, currency FROM loans")?;
        let total_liabilities: f64 = loans_stmt
            .query_map([], |row| {
                let principal: f64 = row.get::<_, String>(0)?.parse().unwrap_or(0.0);
                let currency: String = row.get(1)?;
                Ok(convert_to_czk(principal, &currency))
            })?
            .filter_map(|r| r.ok())
            .sum();

        // Calculate real estate (static values)
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

        // Calculate other assets using HISTORICAL quantities
        let mut other_stmt = conn.prepare("SELECT id, market_price, currency FROM other_assets")?;
        let mut total_other_assets = 0.0;
        let other_rows: Vec<(String, f64, String)> = other_stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?.parse().unwrap_or(0.0),
                    row.get::<_, String>(2)?,
                ))
            })?
            .filter_map(|r| r.ok())
            .collect();

        for (asset_id, price, currency) in other_rows {
            let qty = get_other_asset_quantity_at_date(conn, &asset_id, day_timestamp);
            total_other_assets += convert_to_czk(qty * price, &currency);
        }

        // Calculate investments using HISTORICAL quantities and prices
        let mut total_investments = 0.0;
        let mut inv_stmt = conn.prepare("SELECT DISTINCT ticker FROM stock_investments")?;
        let tickers: Vec<String> = inv_stmt
            .query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        for ticker in tickers {
            let qty = get_stock_quantity_at_date(conn, &ticker, day_timestamp);
            if qty > 0.0 {
                if let Some(prices) = stock_prices.get(&ticker) {
                    if let Some(price) = find_closest_price(prices, day_timestamp) {
                        let value_in_czk = convert_to_czk(price.price * qty, &price.currency);
                        total_investments += value_in_czk;
                    }
                }
            }
        }

        // Calculate crypto using HISTORICAL quantities and prices
        let mut total_crypto = 0.0;
        let mut crypto_stmt = conn.prepare("SELECT DISTINCT ticker FROM crypto_investments")?;
        let crypto_tickers: Vec<String> = crypto_stmt
            .query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        for ticker in crypto_tickers {
            let qty = get_crypto_quantity_at_date(conn, &ticker, day_timestamp);
            if qty > 0.0 {
                if let Some(prices) = crypto_prices.get(&ticker) {
                    if let Some(price) = find_closest_price(prices, day_timestamp) {
                        let value_in_czk = convert_to_czk(price.price * qty, &price.currency);
                        total_crypto += value_in_czk;
                    }
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

/// Update or insert a snapshot for a specific day
fn update_or_insert_snapshot(
    db: &Database,
    metrics: &PortfolioMetrics,
    day_timestamp: i64,
) -> Result<()> {
    db.with_conn(|conn| {
        // Normalize to start of day
        let day_start = (day_timestamp / 86400) * 86400;
        let day_end = day_start + 86399;

        // Check if snapshot exists for this day
        let existing_id: Option<String> = conn
            .query_row(
                "SELECT id FROM portfolio_metrics_history WHERE recorded_at >= ?1 AND recorded_at <= ?2 LIMIT 1",
                [day_start, day_end],
                |row| row.get(0),
            )
            .ok();

        if let Some(id) = existing_id {
            // Update existing snapshot
            conn.execute(
                "UPDATE portfolio_metrics_history
                 SET total_savings = ?2, total_loans_principal = ?3, total_investments = ?4,
                     total_crypto = ?5, total_bonds = ?6, total_real_estate_personal = ?7,
                     total_real_estate_investment = ?8, total_other_assets = ?9
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
                ],
            )?;
        } else {
            // Insert new snapshot
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
                    day_start,
                ],
            )?;
        }
        Ok(())
    })
}

/// Recalculate portfolio history from a given date
/// This is called when a retrospective transaction is created/deleted
/// Will create new snapshots for dates before the oldest existing snapshot
pub async fn recalculate_history_from_date(db: &Database, from_timestamp: i64) -> Result<()> {
    println!(
        "[RECALC] Starting historical recalculation from timestamp {}",
        from_timestamp
    );

    // Get the oldest snapshot date (if any)
    let (min_date, _, _) = get_snapshot_date_info(db)?;
    let oldest_snapshot = min_date.map(|d| (d / 86400) * 86400);

    // Start recalculation from the transaction date
    // This allows creating new snapshots for dates before any existing snapshots
    let from_day = (from_timestamp / 86400) * 86400;
    let recalc_start = from_day;

    let now = chrono::Utc::now().timestamp();
    let today_start = (now / 86400) * 86400;

    // Log whether we're extending history backwards
    if let Some(oldest) = oldest_snapshot {
        if from_day < oldest {
            println!(
                "[RECALC] Extending history backwards from {} to {} (creating {} new days)",
                oldest,
                from_day,
                (oldest - from_day) / 86400
            );
        }
    } else {
        println!(
            "[RECALC] No existing snapshots, will create new history from {}",
            from_day
        );
    }

    // Build list of days to recalculate
    let mut days_to_recalc: Vec<i64> = Vec::new();
    let mut check_day = recalc_start;
    while check_day <= today_start {
        days_to_recalc.push(check_day);
        check_day += 86400;
    }

    if days_to_recalc.is_empty() {
        println!("[RECALC] No days to recalculate");
        return Ok(());
    }

    println!(
        "[RECALC] Recalculating {} days from {} to {}",
        days_to_recalc.len(),
        recalc_start,
        today_start
    );

    // Get tickers for fetching historical prices
    let stock_tickers = get_stock_tickers(db)?;
    let crypto_id_map = get_crypto_id_map(db)?;

    // Fetch historical prices for the date range
    let fetch_start = recalc_start;
    let fetch_end = today_start;

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

    // Recalculate each day
    let mut days_processed = 0;
    for day_timestamp in days_to_recalc {
        let metrics =
            calculate_metrics_for_day_historical(db, day_timestamp, &stock_prices, &crypto_prices)?;

        update_or_insert_snapshot(db, &metrics, day_timestamp)?;
        days_processed += 1;
    }

    println!(
        "[RECALC] Historical recalculation complete! Recalculated {} snapshots",
        days_processed
    );

    Ok(())
}

/// Asset type for targeted recalculation
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AssetType {
    Stocks,
    Crypto,
    OtherAssets,
    Savings,
}

/// Calculate historical value for a specific asset type on a given day
/// Calculate historical value for a specific asset type on a given day
fn calculate_asset_value_for_day(
    db: &Database,
    day_timestamp: i64,
    asset_type: AssetType,
    stock_prices: Option<&HashMap<String, Vec<HistoricalPrice>>>,
    crypto_prices: Option<&HashMap<String, Vec<HistoricalPrice>>>,
) -> Result<f64> {
    use crate::services::currency::convert_to_czk;

    match asset_type {
        AssetType::Stocks => {
            let empty_map = HashMap::new();
            let prices_map = stock_prices.unwrap_or(&empty_map);
            let stock_tickers = get_stock_tickers(db)?;

            db.with_conn(move |conn| {
                let mut total = 0.0;
                for ticker in &stock_tickers {
                    let qty = get_stock_quantity_at_date(conn, ticker, day_timestamp);
                    if qty > 0.0 {
                        if let Some(prices) = prices_map.get(ticker) {
                            if let Some(price) = find_closest_price(prices, day_timestamp) {
                                total += convert_to_czk(price.price * qty, &price.currency);
                            }
                        }
                    }
                }
                Ok(total)
            })
        }
        AssetType::Crypto => {
            let empty_map = HashMap::new();
            let prices_map = crypto_prices.unwrap_or(&empty_map);

            db.with_conn(move |conn| {
                let mut total = 0.0;
                let mut stmt = conn.prepare("SELECT DISTINCT ticker FROM crypto_investments")?;
                let crypto_tickers: Vec<String> = stmt
                    .query_map([], |row| row.get(0))?
                    .filter_map(|r| r.ok())
                    .collect();

                for ticker in crypto_tickers {
                    let qty = get_crypto_quantity_at_date(conn, &ticker, day_timestamp);
                    if qty > 0.0 {
                        if let Some(prices) = prices_map.get(&ticker) {
                            if let Some(price) = find_closest_price(prices, day_timestamp) {
                                total += convert_to_czk(price.price * qty, &price.currency);
                            }
                        }
                    }
                }
                Ok(total)
            })
        }
        AssetType::OtherAssets => db.with_conn(|conn| {
            let mut stmt = conn.prepare("SELECT id, market_price, currency FROM other_assets")?;
            let mut total = 0.0;
            let rows: Vec<(String, f64, String)> = stmt
                .query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?.parse().unwrap_or(0.0),
                        row.get::<_, String>(2)?,
                    ))
                })?
                .filter_map(|r| r.ok())
                .collect();

            for (asset_id, price, currency) in rows {
                let qty = get_other_asset_quantity_at_date(conn, &asset_id, day_timestamp);
                total += convert_to_czk(qty * price, &currency);
            }
            Ok(total)
        }),
        AssetType::Savings => db.with_conn(|conn| {
            // Calculate total savings from bank_accounts (current values - static for now)
            let mut bank_stmt = conn.prepare(
                "SELECT balance, currency FROM bank_accounts WHERE exclude_from_balance = 0",
            )?;
            let total_savings: f64 = bank_stmt
                .query_map([], |row| {
                    let balance: f64 = row.get::<_, String>(0)?.parse().unwrap_or(0.0);
                    let currency: String = row.get(1)?;
                    Ok(convert_to_czk(balance, &currency))
                })?
                .filter_map(|r| r.ok())
                .sum();
            Ok(total_savings)
        }),
    }
}

/// Update only a specific asset column in portfolio_metrics_history
fn update_asset_column_for_day(
    db: &Database,
    day_timestamp: i64,
    asset_type: AssetType,
    value: f64,
) -> Result<()> {
    db.with_conn(|conn| {
        let day_start = (day_timestamp / 86400) * 86400;
        let day_end = day_start + 86399;

        let column_name = match asset_type {
            AssetType::Stocks => "total_investments",
            AssetType::Crypto => "total_crypto",
            AssetType::OtherAssets => "total_other_assets",
            AssetType::Savings => "total_savings",
        };

        // Check if snapshot exists for this day
        let existing: bool = conn
            .query_row(
                "SELECT 1 FROM portfolio_metrics_history WHERE recorded_at >= ?1 AND recorded_at <= ?2 LIMIT 1",
                [day_start, day_end],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if existing {
            // Update only the specific column
            let sql = format!(
                "UPDATE portfolio_metrics_history SET {} = ?1 WHERE recorded_at >= ?2 AND recorded_at <= ?3",
                column_name
            );
            conn.execute(&sql, rusqlite::params![value.to_string(), day_start, day_end])?;
        }
        // If no snapshot exists, we don't create one - the full recalc will handle it

        Ok(())
    })
}

/// Recalculate only a specific asset type's history from a given date
/// If the date is before existing snapshots, creates full snapshots for those days
pub async fn recalculate_asset_history_from_date(
    db: &Database,
    from_timestamp: i64,
    asset_type: AssetType,
) -> Result<()> {
    println!(
        "[RECALC] Starting {:?} recalculation from timestamp {}",
        asset_type, from_timestamp
    );

    // Get the oldest snapshot date (if any)
    let (min_date, _, _) = get_snapshot_date_info(db)?;
    let oldest_snapshot = min_date.map(|d| (d / 86400) * 86400);

    let from_day = (from_timestamp / 86400) * 86400;
    let now = chrono::Utc::now().timestamp();
    let today_start = (now / 86400) * 86400;

    // If from_day is before oldest_snapshot (or no snapshots exist),
    // we need to create full snapshots using recalculate_history_from_date
    let needs_full_recalc = match oldest_snapshot {
        Some(oldest) => from_day < oldest,
        None => true,
    };

    if needs_full_recalc {
        println!("[RECALC] Transaction date precedes existing snapshots, using full recalculation");
        // Fall back to full recalculation which creates complete snapshots
        return recalculate_history_from_date(db, from_timestamp).await;
    }

    // If we're only updating existing snapshots, proceed with asset-specific update
    let recalc_start = from_day;

    // Build list of days to recalculate
    let mut days_to_recalc: Vec<i64> = Vec::new();
    let mut check_day = recalc_start;
    while check_day <= today_start {
        days_to_recalc.push(check_day);
        check_day += 86400;
    }

    if days_to_recalc.is_empty() {
        println!("[RECALC] No days to recalculate");
        return Ok(());
    }

    println!(
        "[RECALC] Recalculating {:?} for {} days",
        asset_type,
        days_to_recalc.len()
    );

    // Fetch necessary prices upfront
    let stock_prices = if asset_type == AssetType::Stocks {
        // Get tickers for fetching historical prices
        let stock_tickers = get_stock_tickers(db)?;
        if !stock_tickers.is_empty() {
            Some(
                get_historical_stock_prices_yahoo(&stock_tickers, recalc_start, today_start)
                    .await?,
            )
        } else {
            None
        }
    } else {
        None
    };

    let crypto_prices = if asset_type == AssetType::Crypto {
        let crypto_id_map = get_crypto_id_map(db)?;
        if !crypto_id_map.is_empty() {
            let api_keys = get_api_keys(db)?;
            Some(
                get_historical_crypto_prices_coingecko(
                    api_keys.coingecko.as_deref(),
                    &crypto_id_map,
                    recalc_start,
                    today_start,
                )
                .await?,
            )
        } else {
            None
        }
    } else {
        None
    };

    // Recalculate each day
    for day_timestamp in days_to_recalc {
        let value = calculate_asset_value_for_day(
            db,
            day_timestamp,
            asset_type,
            stock_prices.as_ref(),
            crypto_prices.as_ref(), // Passed as Optional references
        )?;
        update_asset_column_for_day(db, day_timestamp, asset_type, value)?;
    }

    println!("[RECALC] {:?} recalculation complete!", asset_type);

    Ok(())
}

/// Trigger historical recalculation for a specific asset type
/// Only triggers if transaction_date is before today
pub async fn trigger_historical_recalculation_for_asset(
    db: &Database,
    transaction_date: i64,
    asset_type: AssetType,
) -> Result<()> {
    let now = chrono::Utc::now().timestamp();
    let today_start = (now / 86400) * 86400;
    let tx_day = (transaction_date / 86400) * 86400;

    // Only recalculate if transaction is historical (before today)
    if tx_day < today_start {
        println!(
            "[RECALC] Transaction date {} is historical, triggering {:?} recalculation",
            tx_day, asset_type
        );
        recalculate_asset_history_from_date(db, transaction_date, asset_type).await?;
    }

    Ok(())
}

/// Legacy function - recalculates all asset types (kept for backward compatibility)
pub async fn trigger_historical_recalculation(db: &Database, transaction_date: i64) -> Result<()> {
    let now = chrono::Utc::now().timestamp();
    let today_start = (now / 86400) * 86400;
    let tx_day = (transaction_date / 86400) * 86400;

    // Only recalculate if transaction is historical (before today)
    if tx_day < today_start {
        println!(
            "[RECALC] Transaction date {} is historical, triggering recalculation",
            tx_day
        );
        recalculate_history_from_date(db, transaction_date).await?;
    }

    Ok(())
}

// ============================================================================
// Per-Ticker Historical Recalculation
// ============================================================================

/// Recalculate stock value history for a single ticker from a given date
pub async fn recalculate_stock_ticker_history(
    db: &Database,
    ticker: &str,
    from_timestamp: i64,
) -> Result<()> {
    println!(
        "[RECALC] Starting ticker-specific recalculation for {} from {}",
        ticker, from_timestamp
    );

    let from_day = (from_timestamp / 86400) * 86400;
    let now = chrono::Utc::now().timestamp();
    let today_start = (now / 86400) * 86400;

    // Build list of days to recalculate
    let mut days_to_recalc: Vec<i64> = Vec::new();
    let mut check_day = from_day;
    while check_day <= today_start {
        days_to_recalc.push(check_day);
        check_day += 86400;
    }

    if days_to_recalc.is_empty() {
        println!("[RECALC] No days to recalculate for {}", ticker);
        return Ok(());
    }

    println!(
        "[RECALC] Recalculating {} days for ticker {}",
        days_to_recalc.len(),
        ticker
    );

    // Fetch historical prices for just this ticker
    let stock_prices = crate::services::price_api::get_historical_stock_prices_yahoo(
        &[ticker.to_string()],
        from_day,
        today_start,
    )
    .await?;

    // Calculate and store value for each day
    let ticker_clone = ticker.to_string();
    db.with_conn(move |conn| {
        for day_timestamp in days_to_recalc {
            // Get quantity at this date
            let quantity = get_stock_quantity_at_date(conn, &ticker_clone, day_timestamp);

            if quantity <= 0.0 {
                // No holdings at this date, delete any existing entry
                conn.execute(
                    "DELETE FROM stock_value_history WHERE ticker = ?1 AND recorded_at = ?2",
                    rusqlite::params![ticker_clone, day_timestamp],
                )?;
                continue;
            }

            // Get price for this ticker at this date
            let (price, currency) = if let Some(prices) = stock_prices.get(&ticker_clone) {
                if let Some(hp) = find_closest_price(prices, day_timestamp) {
                    (hp.price, hp.currency.clone())
                } else {
                    continue; // No price data available
                }
            } else {
                continue; // No price data available
            };

            let value_czk = convert_to_czk(quantity * price, &currency);

            // Upsert into stock_value_history
            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO stock_value_history (id, ticker, recorded_at, value_czk, quantity, price, currency)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(ticker, recorded_at) DO UPDATE SET
                     value_czk = excluded.value_czk,
                     quantity = excluded.quantity,
                     price = excluded.price,
                     currency = excluded.currency",
                rusqlite::params![
                    id,
                    ticker_clone,
                    day_timestamp,
                    value_czk.to_string(),
                    quantity.to_string(),
                    price.to_string(),
                    currency,
                ],
            )?;
        }
        Ok(())
    })?;

    println!("[RECALC] Ticker {} history recalculation complete!", ticker);

    Ok(())
}

/// Recalculate crypto value history for a single ticker from a given date
pub async fn recalculate_crypto_ticker_history(
    db: &Database,
    ticker: &str,
    coingecko_id: &str,
    from_timestamp: i64,
) -> Result<()> {
    println!(
        "[RECALC] Starting crypto ticker-specific recalculation for {} from {}",
        ticker, from_timestamp
    );

    let from_day = (from_timestamp / 86400) * 86400;
    let now = chrono::Utc::now().timestamp();
    let today_start = (now / 86400) * 86400;

    // Build list of days to recalculate
    let mut days_to_recalc: Vec<i64> = Vec::new();
    let mut check_day = from_day;
    while check_day <= today_start {
        days_to_recalc.push(check_day);
        check_day += 86400;
    }

    if days_to_recalc.is_empty() {
        println!("[RECALC] No days to recalculate for crypto {}", ticker);
        return Ok(());
    }

    // Fetch historical prices for just this crypto
    // Note: id_to_ticker map uses coingecko_id as key, ticker as value
    let mut crypto_map = HashMap::new();
    crypto_map.insert(coingecko_id.to_string(), ticker.to_string());

    let api_keys = crate::services::price_api::get_api_keys(db)?;
    let crypto_prices = crate::services::price_api::get_historical_crypto_prices_coingecko(
        api_keys.coingecko.as_deref(),
        &crypto_map,
        from_day,
        today_start,
    )
    .await?;

    // Get the last known price before the recalculation start date to seed the fallback
    // This ensures continuity if the API fails for the first few days
    let mut last_known_price: Option<(f64, String)> = db.with_conn(|conn| {
        let res = conn
            .query_row(
                "SELECT price, currency FROM crypto_value_history 
             WHERE ticker = ?1 AND recorded_at < ?2 
             ORDER BY recorded_at DESC LIMIT 1",
                rusqlite::params![ticker, from_day],
                |row| {
                    let price: f64 = row.get::<_, String>(0)?.parse().unwrap_or(0.0);
                    let currency: String = row.get(1)?;
                    Ok((price, currency))
                },
            )
            .ok();
        Ok(res)
    })?;

    // If no history exists, try to use the current price as a fallback seed
    // This is useful if we're backfilling for the first time and API fails immediately
    if last_known_price.is_none() {
        last_known_price = db.with_conn(|conn| {
            let res = conn
                .query_row(
                    "SELECT price, currency FROM crypto_prices WHERE symbol = ?1",
                    rusqlite::params![ticker],
                    |row| {
                        let price: f64 = row.get::<_, String>(0)?.parse().unwrap_or(0.0);
                        let currency: String = row.get(1)?;
                        Ok((price, currency))
                    },
                )
                .ok();
            Ok(res)
        })?;
    }

    // Calculate and store value for each day
    let ticker_clone = ticker.to_string();
    db.with_conn(move |conn| {
        for day_timestamp in days_to_recalc {
            let quantity = get_crypto_quantity_at_date(conn, &ticker_clone, day_timestamp);

            if quantity <= 0.0 {
                conn.execute(
                    "DELETE FROM crypto_value_history WHERE ticker = ?1 AND recorded_at = ?2",
                    rusqlite::params![ticker_clone, day_timestamp],
                )?;
                continue;
            }

            // Determine price to use
            let (price, currency) = if let Some(prices) = crypto_prices.get(&ticker_clone) {
                if let Some(hp) = find_closest_price(prices, day_timestamp) {
                    // Found price in API data, update last known
                    last_known_price = Some((hp.price, hp.currency.clone()));
                    (hp.price, hp.currency.clone())
                } else if let Some((last_price, last_currency)) = &last_known_price {
                    // Gap in API data, use last known
                    (*last_price, last_currency.clone())
                } else {
                    // No API data and no last known, skip
                    continue;
                }
            } else if let Some((last_price, last_currency)) = &last_known_price {
                 // No API data keys at all for this ticker, use last known
                 (*last_price, last_currency.clone())
            } else {
                continue;
            };

            let value_czk = convert_to_czk(quantity * price, &currency);

            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO crypto_value_history (id, ticker, recorded_at, value_czk, quantity, price, currency)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(ticker, recorded_at) DO UPDATE SET
                     value_czk = excluded.value_czk,
                     quantity = excluded.quantity,
                     price = excluded.price,
                     currency = excluded.currency",
                rusqlite::params![
                    id,
                    ticker_clone,
                    day_timestamp,
                    value_czk.to_string(),
                    quantity.to_string(),
                    price.to_string(),
                    currency,
                ],
            )?;
        }
        Ok(())
    })?;

    println!(
        "[RECALC] Crypto ticker {} history recalculation complete!",
        ticker
    );

    Ok(())
}

/// Update only stock investments in portfolio_metrics_history from stock_value_history
/// Ensures all stock tickers have their history populated before aggregating
pub async fn update_portfolio_stocks_from_ticker_table(
    db: &Database,
    from_timestamp: i64,
) -> Result<()> {
    let from_day = (from_timestamp / 86400) * 86400;
    let now = chrono::Utc::now().timestamp();
    let today_start = (now / 86400) * 86400;

    // Get all stock tickers that have holdings
    let stock_tickers = get_stock_tickers(db)?;

    if stock_tickers.is_empty() {
        return Ok(());
    }

    // For each ticker, check if it has history data for the date range
    // If not, backfill it from Yahoo API
    for ticker in &stock_tickers {
        let has_data = db.with_conn(|conn| {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM stock_value_history 
                     WHERE ticker = ?1 AND recorded_at >= ?2 AND recorded_at <= ?3",
                    rusqlite::params![ticker, from_day, today_start],
                    |row| row.get(0),
                )
                .unwrap_or(0);
            Ok(count > 0)
        })?;

        if !has_data {
            println!(
                "[BACKFILL] Ticker {} missing history data for date range, fetching...",
                ticker
            );
            // Backfill this ticker's history
            recalculate_stock_ticker_history(db, ticker, from_timestamp).await?;
        }
    }

    // Now aggregate from the populated stock_value_history table
    db.with_conn(|conn| {
        // Get all distinct dates that have stock data in the range
        let mut stmt = conn.prepare(
            "SELECT DISTINCT recorded_at FROM stock_value_history 
             WHERE recorded_at >= ?1 AND recorded_at <= ?2",
        )?;
        let dates: Vec<i64> = stmt
            .query_map([from_day, today_start], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        for day_timestamp in dates {
            // Sum stock values for this day
            let total_investments: f64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(CAST(value_czk AS REAL)), 0) FROM stock_value_history WHERE recorded_at = ?1",
                    [day_timestamp],
                    |row| row.get(0),
                )
                .unwrap_or(0.0);

            // Update only total_investments column
            conn.execute(
                "UPDATE portfolio_metrics_history 
                 SET total_investments = ?2 
                 WHERE (recorded_at / 86400) * 86400 = ?1",
                rusqlite::params![day_timestamp, total_investments.to_string()],
            )?;
        }
        Ok(())
    })
}

/// Update only crypto in portfolio_metrics_history from crypto_value_history
/// Ensures all crypto tickers have their history populated before aggregating
pub async fn update_portfolio_crypto_from_ticker_table(
    db: &Database,
    from_timestamp: i64,
) -> Result<()> {
    let from_day = (from_timestamp / 86400) * 86400;
    let now = chrono::Utc::now().timestamp();
    let today_start = (now / 86400) * 86400;

    // Get all crypto tickers that have holdings
    let crypto_id_map = get_crypto_id_map(db)?;

    if crypto_id_map.is_empty() {
        return Ok(());
    }

    // For each ticker, check if it has history data for the date range
    // If not, backfill it from CoinGecko API
    for (coingecko_id, ticker) in &crypto_id_map {
        let has_data = db.with_conn(|conn| {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM crypto_value_history 
                     WHERE ticker = ?1 AND recorded_at >= ?2 AND recorded_at <= ?3",
                    rusqlite::params![ticker, from_day, today_start],
                    |row| row.get(0),
                )
                .unwrap_or(0);
            Ok(count > 0)
        })?;

        if !has_data {
            println!(
                "[BACKFILL] Crypto {} missing history data for date range, fetching...",
                ticker
            );
            // Backfill this ticker's history
            recalculate_crypto_ticker_history(db, ticker, coingecko_id, from_timestamp).await?;
        }
    }

    // Now aggregate from the populated crypto_value_history table
    db.with_conn(|conn| {
        // Get all distinct dates that have crypto data in the range
        let mut stmt = conn.prepare(
            "SELECT DISTINCT recorded_at FROM crypto_value_history 
             WHERE recorded_at >= ?1 AND recorded_at <= ?2",
        )?;
        let dates: Vec<i64> = stmt
            .query_map([from_day, today_start], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        for day_timestamp in dates {
            // Sum crypto values for this day
            let total_crypto: f64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(CAST(value_czk AS REAL)), 0) FROM crypto_value_history WHERE recorded_at = ?1",
                    [day_timestamp],
                    |row| row.get(0),
                )
                .unwrap_or(0.0);

            // Update only total_crypto column
            conn.execute(
                "UPDATE portfolio_metrics_history 
                 SET total_crypto = ?2 
                 WHERE (recorded_at / 86400) * 86400 = ?1",
                rusqlite::params![day_timestamp, total_crypto.to_string()],
            )?;
        }
        Ok(())
    })
}

/// Update portfolio_metrics_history by summing values from per-ticker history tables
/// This updates BOTH stocks and crypto - use only when both asset types need updating
pub async fn update_portfolio_history_from_ticker_tables(
    db: &Database,
    from_timestamp: i64,
) -> Result<()> {
    update_portfolio_stocks_from_ticker_table(db, from_timestamp).await?;
    update_portfolio_crypto_from_ticker_table(db, from_timestamp).await?;
    Ok(())
}

/// Trigger historical recalculation for a specific stock ticker
/// Only triggers if transaction_date is before today
pub async fn trigger_historical_recalculation_for_stock_ticker(
    db: &Database,
    transaction_date: i64,
    ticker: &str,
) -> Result<()> {
    let now = chrono::Utc::now().timestamp();
    let today_start = (now / 86400) * 86400;
    let tx_day = (transaction_date / 86400) * 86400;

    // Only recalculate if transaction is historical (before today)
    if tx_day < today_start {
        println!(
            "[RECALC] Stock transaction for {} on {} is historical, triggering ticker recalculation",
            ticker, tx_day
        );

        // Recalculate just this ticker's history
        recalculate_stock_ticker_history(db, ticker, transaction_date).await?;

        // Update only stock values in aggregate portfolio history
        update_portfolio_stocks_from_ticker_table(db, transaction_date).await?;
    }

    Ok(())
}

/// Trigger historical recalculation for a specific crypto ticker
pub async fn trigger_historical_recalculation_for_crypto_ticker(
    db: &Database,
    transaction_date: i64,
    ticker: &str,
    coingecko_id: &str,
) -> Result<()> {
    let now = chrono::Utc::now().timestamp();
    let today_start = (now / 86400) * 86400;
    let tx_day = (transaction_date / 86400) * 86400;

    if tx_day < today_start {
        println!(
            "[RECALC] Crypto transaction for {} on {} is historical, triggering ticker recalculation",
            ticker, tx_day
        );

        recalculate_crypto_ticker_history(db, ticker, coingecko_id, transaction_date).await?;
        // Update only crypto values in aggregate portfolio history
        update_portfolio_crypto_from_ticker_table(db, transaction_date).await?;
    }

    Ok(())
}
