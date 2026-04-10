//! Local HTTP API server for MCP integration
//!
//! Starts a lightweight read-only HTTP server on a random local port when the user
//! unlocks Moony. Writes a session.json file so the MCP server can discover the port
//! and authenticate with a per-session bearer token.

use axum::{
    extract::{Path, Query, State as AxumState},
    http::{HeaderMap, StatusCode},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tokio::task::JoinHandle;

use crate::db::Database;
use crate::models::InsertInsurancePolicy;

// ============================================================================
// Session file
// ============================================================================

#[derive(Serialize)]
struct SessionFile {
    port: u16,
    token: String,
    pid: u32,
    version: u32,
}

fn write_session(data_dir: &std::path::Path, port: u16, token: &str) -> std::io::Result<()> {
    let session = SessionFile {
        port,
        token: token.to_string(),
        pid: std::process::id(),
        version: 1,
    };
    let json = serde_json::to_string_pretty(&session).unwrap();

    // Atomic write: write to temp file then rename
    let tmp = data_dir.join("session.json.tmp");
    let dest = data_dir.join("session.json");
    std::fs::write(&tmp, json)?;
    std::fs::rename(tmp, dest)?;
    Ok(())
}

fn delete_session(data_dir: &std::path::Path) {
    let _ = std::fs::remove_file(data_dir.join("session.json"));
}

// ============================================================================
// Shared app state
// ============================================================================

struct ApiState {
    db: Database,
    token: String,
}

// ============================================================================
// Auth helper
// ============================================================================

fn verify_token(headers: &HeaderMap, token: &str) -> bool {
    if let Some(auth) = headers.get("authorization") {
        if let Ok(val) = auth.to_str() {
            return val == format!("Bearer {}", token);
        }
    }
    false
}

macro_rules! auth {
    ($headers:expr, $state:expr) => {
        if !verify_token(&$headers, &$state.token) {
            return Err(StatusCode::UNAUTHORIZED);
        }
    };
}

type ApiResult = Result<Json<Value>, StatusCode>;

fn db_err(_e: impl std::fmt::Debug) -> StatusCode {
    StatusCode::INTERNAL_SERVER_ERROR
}

/// Convert a rusqlite Value (supports NULL, INTEGER, REAL, TEXT) to serde_json::Value
fn sql_to_json(v: rusqlite::types::Value) -> Value {
    match v {
        rusqlite::types::Value::Null => Value::Null,
        rusqlite::types::Value::Integer(i) => serde_json::json!(i),
        rusqlite::types::Value::Real(f) => serde_json::json!(f),
        rusqlite::types::Value::Text(s) => serde_json::json!(s),
        rusqlite::types::Value::Blob(_) => Value::Null,
    }
}

// ============================================================================
// Query params structs
// ============================================================================

#[derive(Deserialize)]
struct PortfolioHistoryParams {
    #[serde(rename = "startDate")]
    start_date: Option<i64>,
    #[serde(rename = "endDate")]
    end_date: Option<i64>,
    limit: Option<i64>,
}

#[derive(Deserialize)]
struct PortfolioMetricsParams {
    #[serde(rename = "excludePersonalRealEstate")]
    exclude_personal_real_estate: Option<bool>,
}

#[derive(Deserialize)]
struct TransactionsParams {
    ticker: Option<String>,
    limit: Option<i64>,
}

#[derive(Deserialize)]
struct HistoryParams {
    #[serde(rename = "startDate")]
    start_date: Option<i64>,
    #[serde(rename = "endDate")]
    end_date: Option<i64>,
}

#[derive(Deserialize)]
struct BankTransactionsParams {
    #[serde(rename = "dateFrom")]
    date_from: Option<i64>,
    #[serde(rename = "dateTo")]
    date_to: Option<i64>,
    #[serde(rename = "categoryId")]
    category_id: Option<String>,
    #[serde(rename = "txType")]
    tx_type: Option<String>,
    search: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Deserialize)]
struct CashflowParams {
    #[serde(rename = "viewType")]
    view_type: Option<String>,
}

#[derive(Deserialize)]
struct BudgetingParams {
    #[serde(rename = "startDate")]
    start_date: Option<i64>,
    #[serde(rename = "endDate")]
    end_date: Option<i64>,
    timeframe: Option<String>,
}

#[derive(Deserialize)]
struct TagMetricsParams {
    #[serde(rename = "tagIds")]
    tag_ids: Option<String>, // comma-separated
}

// ============================================================================
// Endpoints
// ============================================================================

async fn health(AxumState(state): AxumState<Arc<ApiState>>, headers: HeaderMap) -> ApiResult {
    auth!(headers, state);
    Ok(Json(serde_json::json!({
        "status": "ok",
        "pid": std::process::id()
    })))
}

async fn portfolio_metrics(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Query(params): Query<PortfolioMetricsParams>,
) -> ApiResult {
    auth!(headers, state);
    let exclude = params.exclude_personal_real_estate.unwrap_or(false);
    state
        .db
        .with_conn(|conn| {
            // Exchange rates
            let rates: Vec<(String, f64)> = {
                let mut stmt = conn.prepare("SELECT currency, rate FROM exchange_rates")?;
                let result = stmt
                    .query_map([], |row| {
                        Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
                    })?
                    .filter_map(|r| r.ok())
                    .collect();
                result
            };
            let czk_rate = |currency: &str, amount: f64| -> f64 {
                if currency == "CZK" {
                    return amount;
                }
                let rate = rates
                    .iter()
                    .find(|(c, _)| c == currency)
                    .map(|(_, r)| *r)
                    .unwrap_or(1.0);
                amount * rate
            };

            // Bank accounts (savings)
            let savings: f64 = {
                let mut stmt = conn.prepare(
                    "SELECT balance, currency FROM bank_accounts WHERE exclude_from_balance = 0",
                )?;
                let result = stmt
                    .query_map([], |row| {
                        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                    })?
                    .filter_map(|r| r.ok())
                    .map(|(bal, cur)| czk_rate(&cur, bal.parse::<f64>().unwrap_or(0.0)))
                    .sum();
                result
            };

            // Loans
            let loans: f64 = {
                let mut stmt = conn.prepare("SELECT principal, currency FROM loans")?;
                let result = stmt
                    .query_map([], |row| {
                        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                    })?
                    .filter_map(|r| r.ok())
                    .map(|(p, c)| czk_rate(&c, p.parse::<f64>().unwrap_or(0.0)))
                    .sum();
                result
            };

            // Stocks
            let investments: f64 = {
                let mut stmt = conn.prepare(
                    "SELECT si.quantity, COALESCE(spo.price, sd.original_price, '0') AS cp,
                        COALESCE(spo.currency, sd.currency, 'USD') AS cc
                 FROM stock_investments si
                 LEFT JOIN stock_data sd ON si.ticker = sd.ticker
                 LEFT JOIN stock_price_overrides spo ON si.ticker = spo.ticker",
                )?;
                let result = stmt
                    .query_map([], |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, String>(2)?,
                        ))
                    })?
                    .filter_map(|r| r.ok())
                    .map(|(q, cp, cc)| {
                        let val =
                            q.parse::<f64>().unwrap_or(0.0) * cp.parse::<f64>().unwrap_or(0.0);
                        czk_rate(&cc, val)
                    })
                    .sum();
                result
            };

            // Crypto
            let crypto: f64 = {
                let mut stmt = conn.prepare(
                    "SELECT ci.quantity, COALESCE(cpo.price, cp.price, '0') AS cp,
                        COALESCE(cpo.currency, cp.currency, 'USD') AS cc
                 FROM crypto_investments ci
                 LEFT JOIN crypto_prices cp ON ci.ticker = cp.symbol
                 LEFT JOIN crypto_price_overrides cpo ON ci.ticker = cpo.symbol",
                )?;
                let result = stmt
                    .query_map([], |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, String>(2)?,
                        ))
                    })?
                    .filter_map(|r| r.ok())
                    .map(|(q, cp, cc)| {
                        let val =
                            q.parse::<f64>().unwrap_or(0.0) * cp.parse::<f64>().unwrap_or(0.0);
                        czk_rate(&cc, val)
                    })
                    .sum();
                result
            };

            // Bonds
            let bonds: f64 = {
                let mut stmt =
                    conn.prepare("SELECT coupon_value, quantity, currency FROM bonds")?;
                let result = stmt
                    .query_map([], |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, String>(2)?,
                        ))
                    })?
                    .filter_map(|r| r.ok())
                    .map(|(cv, q, c)| {
                        let val =
                            cv.parse::<f64>().unwrap_or(0.0) * q.parse::<f64>().unwrap_or(0.0);
                        czk_rate(&c, val)
                    })
                    .sum();
                result
            };

            // Real estate
            let (re_personal, re_investment): (f64, f64) = {
                let mut stmt = conn
                    .prepare("SELECT market_price, market_price_currency, type FROM real_estate")?;
                let rows: Vec<(String, String, String)> = stmt
                    .query_map([], |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, String>(2)?,
                        ))
                    })?
                    .filter_map(|r| r.ok())
                    .collect();

                let mut personal = 0.0_f64;
                let mut investment = 0.0_f64;
                for (price, cur, typ) in rows {
                    let val = czk_rate(&cur, price.parse::<f64>().unwrap_or(0.0));
                    if typ == "personal" {
                        personal += val;
                    } else {
                        investment += val;
                    }
                }
                (personal, investment)
            };

            let re_personal_final = if exclude { 0.0 } else { re_personal };

            // Other assets
            let other: f64 = {
                let mut stmt =
                    conn.prepare("SELECT quantity, market_price, currency FROM other_assets")?;
                let result = stmt
                    .query_map([], |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, String>(2)?,
                        ))
                    })?
                    .filter_map(|r| r.ok())
                    .map(|(q, mp, c)| {
                        let val =
                            q.parse::<f64>().unwrap_or(0.0) * mp.parse::<f64>().unwrap_or(0.0);
                        czk_rate(&c, val)
                    })
                    .sum();
                result
            };

            let total_assets =
                savings + investments + crypto + bonds + re_personal_final + re_investment + other;
            let net_worth = total_assets - loans;

            Ok(serde_json::json!({
                "net_worth_czk": format!("{:.2}", net_worth),
                "total_assets_czk": format!("{:.2}", total_assets),
                "total_liabilities_czk": format!("{:.2}", loans),
                "breakdown": {
                    "savings_czk": format!("{:.2}", savings),
                    "investments_czk": format!("{:.2}", investments),
                    "crypto_czk": format!("{:.2}", crypto),
                    "bonds_czk": format!("{:.2}", bonds),
                    "real_estate_personal_czk": format!("{:.2}", re_personal_final),
                    "real_estate_investment_czk": format!("{:.2}", re_investment),
                    "other_assets_czk": format!("{:.2}", other),
                    "loans_czk": format!("{:.2}", loans),
                },
                "note": "All values in CZK."
            }))
        })
        .map(Json)
        .map_err(db_err)
}

async fn portfolio_history(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Query(params): Query<PortfolioHistoryParams>,
) -> ApiResult {
    auth!(headers, state);
    let limit = params.limit.unwrap_or(365);
    state
        .db
        .with_conn(|conn| {
            let mut conditions = Vec::new();
            let mut p: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
            if let Some(s) = params.start_date {
                conditions.push("recorded_at >= ?");
                p.push(Box::new(s));
            }
            if let Some(e) = params.end_date {
                conditions.push("recorded_at <= ?");
                p.push(Box::new(e));
            }
            let where_clause = if conditions.is_empty() {
                String::new()
            } else {
                format!("WHERE {}", conditions.join(" AND "))
            };
            let sql = format!(
                "SELECT id, total_savings, total_loans_principal, total_investments,
                    total_crypto, total_bonds, total_real_estate_personal,
                    total_real_estate_investment, total_other_assets, recorded_at
             FROM portfolio_metrics_history {} ORDER BY recorded_at DESC LIMIT ?",
                where_clause
            );
            p.push(Box::new(limit));
            let refs: Vec<&dyn rusqlite::ToSql> = p.iter().map(|x| x.as_ref()).collect();
            let mut stmt = conn.prepare(&sql)?;
            let rows: Vec<Value> = stmt
                .query_map(refs.as_slice(), |row| {
                    Ok(serde_json::json!({
                        "id": row.get::<_, String>(0)?,
                        "totalSavings": row.get::<_, String>(1)?,
                        "totalLoansPrincipal": row.get::<_, String>(2)?,
                        "totalInvestments": row.get::<_, String>(3)?,
                        "totalCrypto": row.get::<_, String>(4)?,
                        "totalBonds": row.get::<_, String>(5)?,
                        "totalRealEstatePersonal": row.get::<_, String>(6)?,
                        "totalRealEstateInvestment": row.get::<_, String>(7)?,
                        "totalOtherAssets": row.get::<_, String>(8)?,
                        "recordedAt": row.get::<_, i64>(9)?,
                    }))
                })?
                .filter_map(|r| r.ok())
                .collect();
            Ok(Value::Array(rows))
        })
        .map(Json)
        .map_err(db_err)
}

async fn investments_list(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
) -> ApiResult {
    auth!(headers, state);
    state.db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT si.id, si.ticker, si.company_name, si.quantity,
                    si.average_price, si.currency,
                    COALESCE(spo.price, sd.original_price) AS current_price,
                    COALESCE(spo.currency, sd.currency, 'USD') AS price_currency,
                    sd.short_name, sd.sector, sd.industry, sd.pe_ratio, sd.market_cap, sd.beta,
                    sd.fifty_two_week_high, sd.fifty_two_week_low, sd.fetched_at
             FROM stock_investments si
             LEFT JOIN stock_data sd ON si.ticker = sd.ticker
             LEFT JOIN stock_price_overrides spo ON si.ticker = spo.ticker
             ORDER BY si.company_name"
        )?;
        let rows: Vec<Value> = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "ticker": row.get::<_, String>(1)?,
                "companyName": row.get::<_, String>(2)?,
                "quantity": row.get::<_, String>(3)?,
                "averagePrice": row.get::<_, String>(4)?,
                "currency": row.get::<_, String>(5)?,
                "currentPrice": sql_to_json(row.get::<_, rusqlite::types::Value>(6).unwrap_or(rusqlite::types::Value::Null)),
                "priceCurrency": row.get::<_, String>(7)?,
                "shortName": sql_to_json(row.get::<_, rusqlite::types::Value>(8).unwrap_or(rusqlite::types::Value::Null)),
                "sector": sql_to_json(row.get::<_, rusqlite::types::Value>(9).unwrap_or(rusqlite::types::Value::Null)),
                "industry": sql_to_json(row.get::<_, rusqlite::types::Value>(10).unwrap_or(rusqlite::types::Value::Null)),
                "peRatio": sql_to_json(row.get::<_, rusqlite::types::Value>(11).unwrap_or(rusqlite::types::Value::Null)),
                "marketCap": sql_to_json(row.get::<_, rusqlite::types::Value>(12).unwrap_or(rusqlite::types::Value::Null)),
                "beta": sql_to_json(row.get::<_, rusqlite::types::Value>(13).unwrap_or(rusqlite::types::Value::Null)),
                "fiftyTwoWeekHigh": sql_to_json(row.get::<_, rusqlite::types::Value>(14).unwrap_or(rusqlite::types::Value::Null)),
                "fiftyTwoWeekLow": sql_to_json(row.get::<_, rusqlite::types::Value>(15).unwrap_or(rusqlite::types::Value::Null)),
                "priceFetchedAt": sql_to_json(row.get::<_, rusqlite::types::Value>(16).unwrap_or(rusqlite::types::Value::Null)),
            }))
        })?.filter_map(|r| r.ok()).collect();
        Ok(Value::Array(rows))
    }).map(Json).map_err(db_err)
}

async fn investment_detail(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult {
    auth!(headers, state);
    state.db.with_conn(|conn| {
        let inv = conn.query_row(
            "SELECT si.id, si.ticker, si.company_name, si.quantity,
                    si.average_price, si.currency,
                    COALESCE(spo.price, sd.original_price) AS current_price,
                    COALESCE(spo.currency, sd.currency, 'USD') AS price_currency
             FROM stock_investments si
             LEFT JOIN stock_data sd ON si.ticker = sd.ticker
             LEFT JOIN stock_price_overrides spo ON si.ticker = spo.ticker
             WHERE si.id = ?",
            [&id],
            |row| Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "ticker": row.get::<_, String>(1)?,
                "companyName": row.get::<_, String>(2)?,
                "quantity": row.get::<_, String>(3)?,
                "averagePrice": row.get::<_, String>(4)?,
                "currency": row.get::<_, String>(5)?,
                "currentPrice": sql_to_json(row.get::<_, rusqlite::types::Value>(6).unwrap_or(rusqlite::types::Value::Null)),
                "priceCurrency": row.get::<_, String>(7)?,
            })),
        );
        match inv {
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                Ok(serde_json::json!({ "error": format!("Investment {} not found", id) }))
            }
            Err(e) => Err(e.into()),
            Ok(mut obj) => {
                let txs: Vec<Value> = {
                    let mut s = conn.prepare(
                        "SELECT id, type, ticker, company_name, quantity, price_per_unit,
                                currency, transaction_date, created_at
                         FROM investment_transactions WHERE investment_id = ?
                         ORDER BY transaction_date DESC"
                    )?;
                    let result = s.query_map([&id], |row| Ok(serde_json::json!({
                        "id": row.get::<_, String>(0)?,
                        "type": row.get::<_, String>(1)?,
                        "ticker": row.get::<_, String>(2)?,
                        "companyName": row.get::<_, String>(3)?,
                        "quantity": row.get::<_, String>(4)?,
                        "pricePerUnit": row.get::<_, String>(5)?,
                        "currency": row.get::<_, String>(6)?,
                        "transactionDate": row.get::<_, i64>(7)?,
                        "createdAt": row.get::<_, i64>(8)?,
                    })))?.filter_map(|r| r.ok()).collect();
                    result
                };
                obj["transactions"] = Value::Array(txs);
                Ok(obj)
            }
        }
    }).map(Json).map_err(db_err)
}

async fn investment_transactions(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Query(params): Query<TransactionsParams>,
) -> ApiResult {
    auth!(headers, state);
    let limit = params.limit.unwrap_or(200);
    state
        .db
        .with_conn(|conn| {
            let sql = if params.ticker.is_some() {
                "SELECT id, investment_id, type, ticker, company_name, quantity,
                    price_per_unit, currency, transaction_date, created_at
             FROM investment_transactions WHERE ticker = ? ORDER BY transaction_date DESC LIMIT ?"
            } else {
                "SELECT id, investment_id, type, ticker, company_name, quantity,
                    price_per_unit, currency, transaction_date, created_at
             FROM investment_transactions ORDER BY transaction_date DESC LIMIT ?"
            };
            let rows: Vec<Value> = if let Some(ref t) = params.ticker {
                let mut stmt = conn.prepare(sql)?;
                let result = stmt
                    .query_map(rusqlite::params![t, limit], |row| {
                        Ok(serde_json::json!({
                            "id": row.get::<_, String>(0)?,
                            "investmentId": row.get::<_, String>(1)?,
                            "type": row.get::<_, String>(2)?,
                            "ticker": row.get::<_, String>(3)?,
                            "companyName": row.get::<_, String>(4)?,
                            "quantity": row.get::<_, String>(5)?,
                            "pricePerUnit": row.get::<_, String>(6)?,
                            "currency": row.get::<_, String>(7)?,
                            "transactionDate": row.get::<_, i64>(8)?,
                            "createdAt": row.get::<_, i64>(9)?,
                        }))
                    })?
                    .filter_map(|r| r.ok())
                    .collect();
                result
            } else {
                let mut stmt = conn.prepare(sql)?;
                let result = stmt
                    .query_map(rusqlite::params![limit], |row| {
                        Ok(serde_json::json!({
                            "id": row.get::<_, String>(0)?,
                            "investmentId": row.get::<_, String>(1)?,
                            "type": row.get::<_, String>(2)?,
                            "ticker": row.get::<_, String>(3)?,
                            "companyName": row.get::<_, String>(4)?,
                            "quantity": row.get::<_, String>(5)?,
                            "pricePerUnit": row.get::<_, String>(6)?,
                            "currency": row.get::<_, String>(7)?,
                            "transactionDate": row.get::<_, i64>(8)?,
                            "createdAt": row.get::<_, i64>(9)?,
                        }))
                    })?
                    .filter_map(|r| r.ok())
                    .collect();
                result
            };
            Ok(Value::Array(rows))
        })
        .map(Json)
        .map_err(db_err)
}

async fn stock_value_history(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Path(ticker): Path<String>,
    Query(params): Query<HistoryParams>,
) -> ApiResult {
    auth!(headers, state);
    state.db.with_conn(|conn| {
        let mut conditions = vec!["ticker = ?".to_string()];
        let mut p: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(ticker.clone())];
        if let Some(s) = params.start_date { conditions.push("recorded_at >= ?".into()); p.push(Box::new(s)); }
        if let Some(e) = params.end_date { conditions.push("recorded_at <= ?".into()); p.push(Box::new(e)); }
        let sql = format!(
            "SELECT id, ticker, recorded_at, value_czk, quantity, price, currency
             FROM stock_value_history WHERE {} ORDER BY recorded_at ASC",
            conditions.join(" AND ")
        );
        let refs: Vec<&dyn rusqlite::ToSql> = p.iter().map(|x| x.as_ref()).collect();
        let mut stmt = conn.prepare(&sql)?;
        let rows: Vec<Value> = stmt.query_map(refs.as_slice(), |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "ticker": row.get::<_, String>(1)?,
            "recordedAt": row.get::<_, i64>(2)?,
            "valueCzk": sql_to_json(row.get::<_, rusqlite::types::Value>(3).unwrap_or(rusqlite::types::Value::Null)),
            "quantity": sql_to_json(row.get::<_, rusqlite::types::Value>(4).unwrap_or(rusqlite::types::Value::Null)),
            "price": sql_to_json(row.get::<_, rusqlite::types::Value>(5).unwrap_or(rusqlite::types::Value::Null)),
            "currency": sql_to_json(row.get::<_, rusqlite::types::Value>(6).unwrap_or(rusqlite::types::Value::Null)),
        })))?.filter_map(|r| r.ok()).collect();
        Ok(Value::Array(rows))
    }).map(Json).map_err(db_err)
}

async fn crypto_list(AxumState(state): AxumState<Arc<ApiState>>, headers: HeaderMap) -> ApiResult {
    auth!(headers, state);
    state.db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT ci.id, ci.ticker, ci.coingecko_id, ci.name, ci.quantity,
                    ci.average_price, ci.currency,
                    COALESCE(cpo.price, cp.price) AS current_price,
                    COALESCE(cpo.currency, cp.currency, 'USD') AS price_currency,
                    cp.fetched_at
             FROM crypto_investments ci
             LEFT JOIN crypto_prices cp ON ci.ticker = cp.symbol
             LEFT JOIN crypto_price_overrides cpo ON ci.ticker = cpo.symbol
             ORDER BY ci.name"
        )?;
        let rows: Vec<Value> = stmt.query_map([], |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "ticker": row.get::<_, String>(1)?,
            "coingeckoId": sql_to_json(row.get::<_, rusqlite::types::Value>(2).unwrap_or(rusqlite::types::Value::Null)),
            "name": row.get::<_, String>(3)?,
            "quantity": row.get::<_, String>(4)?,
            "averagePrice": row.get::<_, String>(5)?,
            "currency": row.get::<_, String>(6)?,
            "currentPrice": sql_to_json(row.get::<_, rusqlite::types::Value>(7).unwrap_or(rusqlite::types::Value::Null)),
            "priceCurrency": row.get::<_, String>(8)?,
            "priceFetchedAt": sql_to_json(row.get::<_, rusqlite::types::Value>(9).unwrap_or(rusqlite::types::Value::Null)),
        })))?.filter_map(|r| r.ok()).collect();
        Ok(Value::Array(rows))
    }).map(Json).map_err(db_err)
}

async fn crypto_transactions(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Query(params): Query<TransactionsParams>,
) -> ApiResult {
    auth!(headers, state);
    let limit = params.limit.unwrap_or(200);
    state
        .db
        .with_conn(|conn| {
            let rows: Vec<Value> = if let Some(ref t) = params.ticker {
                let mut stmt = conn.prepare(
                    "SELECT id, investment_id, type, ticker, name, quantity,
                        price_per_unit, currency, transaction_date, created_at
                 FROM crypto_transactions WHERE ticker = ? ORDER BY transaction_date DESC LIMIT ?",
                )?;
                let result = stmt
                    .query_map(rusqlite::params![t, limit], |row| {
                        Ok(serde_json::json!({
                            "id": row.get::<_, String>(0)?,
                            "investmentId": row.get::<_, String>(1)?,
                            "type": row.get::<_, String>(2)?,
                            "ticker": row.get::<_, String>(3)?,
                            "name": row.get::<_, String>(4)?,
                            "quantity": row.get::<_, String>(5)?,
                            "pricePerUnit": row.get::<_, String>(6)?,
                            "currency": row.get::<_, String>(7)?,
                            "transactionDate": row.get::<_, i64>(8)?,
                            "createdAt": row.get::<_, i64>(9)?,
                        }))
                    })?
                    .filter_map(|r| r.ok())
                    .collect();
                result
            } else {
                let mut stmt = conn.prepare(
                    "SELECT id, investment_id, type, ticker, name, quantity,
                        price_per_unit, currency, transaction_date, created_at
                 FROM crypto_transactions ORDER BY transaction_date DESC LIMIT ?",
                )?;
                let result = stmt
                    .query_map(rusqlite::params![limit], |row| {
                        Ok(serde_json::json!({
                            "id": row.get::<_, String>(0)?,
                            "investmentId": row.get::<_, String>(1)?,
                            "type": row.get::<_, String>(2)?,
                            "ticker": row.get::<_, String>(3)?,
                            "name": row.get::<_, String>(4)?,
                            "quantity": row.get::<_, String>(5)?,
                            "pricePerUnit": row.get::<_, String>(6)?,
                            "currency": row.get::<_, String>(7)?,
                            "transactionDate": row.get::<_, i64>(8)?,
                            "createdAt": row.get::<_, i64>(9)?,
                        }))
                    })?
                    .filter_map(|r| r.ok())
                    .collect();
                result
            };
            Ok(Value::Array(rows))
        })
        .map(Json)
        .map_err(db_err)
}

async fn crypto_value_history(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Path(ticker): Path<String>,
    Query(params): Query<HistoryParams>,
) -> ApiResult {
    auth!(headers, state);
    state.db.with_conn(|conn| {
        let mut conditions = vec!["ticker = ?".to_string()];
        let mut p: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(ticker.clone())];
        if let Some(s) = params.start_date { conditions.push("recorded_at >= ?".into()); p.push(Box::new(s)); }
        if let Some(e) = params.end_date { conditions.push("recorded_at <= ?".into()); p.push(Box::new(e)); }
        let sql = format!(
            "SELECT id, ticker, recorded_at, value_czk, quantity, price, currency
             FROM crypto_value_history WHERE {} ORDER BY recorded_at ASC",
            conditions.join(" AND ")
        );
        let refs: Vec<&dyn rusqlite::ToSql> = p.iter().map(|x| x.as_ref()).collect();
        let mut stmt = conn.prepare(&sql)?;
        let rows: Vec<Value> = stmt.query_map(refs.as_slice(), |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "ticker": row.get::<_, String>(1)?,
            "recordedAt": row.get::<_, i64>(2)?,
            "valueCzk": sql_to_json(row.get::<_, rusqlite::types::Value>(3).unwrap_or(rusqlite::types::Value::Null)),
            "quantity": sql_to_json(row.get::<_, rusqlite::types::Value>(4).unwrap_or(rusqlite::types::Value::Null)),
            "price": sql_to_json(row.get::<_, rusqlite::types::Value>(5).unwrap_or(rusqlite::types::Value::Null)),
            "currency": sql_to_json(row.get::<_, rusqlite::types::Value>(6).unwrap_or(rusqlite::types::Value::Null)),
        })))?.filter_map(|r| r.ok()).collect();
        Ok(Value::Array(rows))
    }).map(Json).map_err(db_err)
}

async fn bank_accounts_list(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
) -> ApiResult {
    auth!(headers, state);
    state.db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT ba.id, ba.name, ba.account_type, ba.iban, ba.bban,
                    ba.currency, ba.balance, ba.interest_rate,
                    ba.has_zone_designation, ba.exclude_from_balance,
                    ba.created_at, ba.updated_at,
                    i.id, i.name, i.bic, i.country
             FROM bank_accounts ba
             LEFT JOIN institutions i ON ba.institution_id = i.id
             ORDER BY ba.name"
        )?;
        let rows: Vec<Value> = stmt.query_map([], |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "accountType": row.get::<_, String>(2)?,
            "iban": sql_to_json(row.get::<_, rusqlite::types::Value>(3).unwrap_or(rusqlite::types::Value::Null)),
            "bban": sql_to_json(row.get::<_, rusqlite::types::Value>(4).unwrap_or(rusqlite::types::Value::Null)),
            "currency": row.get::<_, String>(5)?,
            "balance": row.get::<_, String>(6)?,
            "interestRate": sql_to_json(row.get::<_, rusqlite::types::Value>(7).unwrap_or(rusqlite::types::Value::Null)),
            "hasZoneDesignation": row.get::<_, i32>(8)? != 0,
            "excludeFromBalance": row.get::<_, i32>(9)? != 0,
            "createdAt": row.get::<_, i64>(10)?,
            "updatedAt": row.get::<_, i64>(11)?,
            "institutionId": sql_to_json(row.get::<_, rusqlite::types::Value>(12).unwrap_or(rusqlite::types::Value::Null)),
            "institutionName": sql_to_json(row.get::<_, rusqlite::types::Value>(13).unwrap_or(rusqlite::types::Value::Null)),
            "bic": sql_to_json(row.get::<_, rusqlite::types::Value>(14).unwrap_or(rusqlite::types::Value::Null)),
            "country": sql_to_json(row.get::<_, rusqlite::types::Value>(15).unwrap_or(rusqlite::types::Value::Null)),
        })))?.filter_map(|r| r.ok()).collect();
        Ok(Value::Array(rows))
    }).map(Json).map_err(db_err)
}

async fn bank_transactions(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Path(account_id): Path<String>,
    Query(params): Query<BankTransactionsParams>,
) -> ApiResult {
    auth!(headers, state);
    let limit = params.limit.unwrap_or(100);
    let offset = params.offset.unwrap_or(0);
    state.db.with_conn(|conn| {
        let mut conditions = vec!["bt.bank_account_id = ?".to_string()];
        let mut p: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(account_id.clone())];
        if let Some(v) = params.date_from { conditions.push("bt.booking_date >= ?".into()); p.push(Box::new(v)); }
        if let Some(v) = params.date_to { conditions.push("bt.booking_date <= ?".into()); p.push(Box::new(v)); }
        if let Some(ref v) = params.category_id { conditions.push("bt.category_id = ?".into()); p.push(Box::new(v.clone())); }
        if let Some(ref v) = params.tx_type { conditions.push("bt.tx_type = ?".into()); p.push(Box::new(v.clone())); }
        if let Some(ref v) = params.search {
            conditions.push("(bt.description LIKE ? OR bt.counterparty_name LIKE ?)".into());
            let pat = format!("%{}%", v);
            p.push(Box::new(pat.clone()));
            p.push(Box::new(pat));
        }
        let where_clause = conditions.join(" AND ");
        let count_sql = format!("SELECT count(*) FROM bank_transactions bt WHERE {}", where_clause);
        let count_refs: Vec<&dyn rusqlite::ToSql> = p.iter().map(|x| x.as_ref()).collect();
        let total: i64 = conn.query_row(&count_sql, count_refs.as_slice(), |r| r.get(0))?;

        let sql = format!(
            "SELECT bt.id, bt.tx_type, bt.amount, bt.currency, bt.description,
                    bt.counterparty_name, bt.counterparty_iban, bt.booking_date,
                    bt.value_date, bt.status, bt.remittance_info, bt.variable_symbol,
                    bt.categorization_source, bt.created_at,
                    tc.name, tc.icon, tc.color
             FROM bank_transactions bt
             LEFT JOIN transaction_categories tc ON bt.category_id = tc.id
             WHERE {} ORDER BY bt.booking_date DESC LIMIT ? OFFSET ?",
            where_clause
        );
        p.push(Box::new(limit));
        p.push(Box::new(offset));
        let refs: Vec<&dyn rusqlite::ToSql> = p.iter().map(|x| x.as_ref()).collect();
        let mut stmt = conn.prepare(&sql)?;
        let txs: Vec<Value> = stmt.query_map(refs.as_slice(), |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "txType": row.get::<_, String>(1)?,
            "amount": row.get::<_, String>(2)?,
            "currency": row.get::<_, String>(3)?,
            "description": sql_to_json(row.get::<_, rusqlite::types::Value>(4).unwrap_or(rusqlite::types::Value::Null)),
            "counterpartyName": sql_to_json(row.get::<_, rusqlite::types::Value>(5).unwrap_or(rusqlite::types::Value::Null)),
            "counterpartyIban": sql_to_json(row.get::<_, rusqlite::types::Value>(6).unwrap_or(rusqlite::types::Value::Null)),
            "bookingDate": row.get::<_, i64>(7)?,
            "valueDate": sql_to_json(row.get::<_, rusqlite::types::Value>(8).unwrap_or(rusqlite::types::Value::Null)),
            "status": sql_to_json(row.get::<_, rusqlite::types::Value>(9).unwrap_or(rusqlite::types::Value::Null)),
            "remittanceInfo": sql_to_json(row.get::<_, rusqlite::types::Value>(10).unwrap_or(rusqlite::types::Value::Null)),
            "variableSymbol": sql_to_json(row.get::<_, rusqlite::types::Value>(11).unwrap_or(rusqlite::types::Value::Null)),
            "categorizationSource": sql_to_json(row.get::<_, rusqlite::types::Value>(12).unwrap_or(rusqlite::types::Value::Null)),
            "createdAt": row.get::<_, i64>(13)?,
            "categoryName": sql_to_json(row.get::<_, rusqlite::types::Value>(14).unwrap_or(rusqlite::types::Value::Null)),
            "categoryIcon": sql_to_json(row.get::<_, rusqlite::types::Value>(15).unwrap_or(rusqlite::types::Value::Null)),
            "categoryColor": sql_to_json(row.get::<_, rusqlite::types::Value>(16).unwrap_or(rusqlite::types::Value::Null)),
        })))?.filter_map(|r| r.ok()).collect();
        Ok(serde_json::json!({ "total": total, "limit": limit, "offset": offset, "transactions": txs }))
    }).map(Json).map_err(db_err)
}

async fn bank_categories(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
) -> ApiResult {
    auth!(headers, state);
    state.db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, icon, color, parent_id, sort_order, is_system, created_at
             FROM transaction_categories ORDER BY sort_order ASC"
        )?;
        let rows: Vec<Value> = stmt.query_map([], |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "icon": sql_to_json(row.get::<_, rusqlite::types::Value>(2).unwrap_or(rusqlite::types::Value::Null)),
            "color": sql_to_json(row.get::<_, rusqlite::types::Value>(3).unwrap_or(rusqlite::types::Value::Null)),
            "parentId": sql_to_json(row.get::<_, rusqlite::types::Value>(4).unwrap_or(rusqlite::types::Value::Null)),
            "sortOrder": sql_to_json(row.get::<_, rusqlite::types::Value>(5).unwrap_or(rusqlite::types::Value::Null)),
            "isSystem": row.get::<_, i32>(6)? != 0,
            "createdAt": row.get::<_, i64>(7)?,
        })))?.filter_map(|r| r.ok()).collect();
        Ok(Value::Array(rows))
    }).map(Json).map_err(db_err)
}

async fn bonds_list(AxumState(state): AxumState<Arc<ApiState>>, headers: HeaderMap) -> ApiResult {
    auth!(headers, state);
    state.db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, isin, coupon_value, quantity, currency,
                    interest_rate, maturity_date, created_at, updated_at
             FROM bonds ORDER BY name"
        )?;
        let rows: Vec<Value> = stmt.query_map([], |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "isin": sql_to_json(row.get::<_, rusqlite::types::Value>(2).unwrap_or(rusqlite::types::Value::Null)),
            "couponValue": row.get::<_, String>(3)?,
            "quantity": row.get::<_, String>(4)?,
            "currency": row.get::<_, String>(5)?,
            "interestRate": sql_to_json(row.get::<_, rusqlite::types::Value>(6).unwrap_or(rusqlite::types::Value::Null)),
            "maturityDate": sql_to_json(row.get::<_, rusqlite::types::Value>(7).unwrap_or(rusqlite::types::Value::Null)),
            "createdAt": row.get::<_, i64>(8)?,
            "updatedAt": row.get::<_, i64>(9)?,
        })))?.filter_map(|r| r.ok()).collect();
        Ok(Value::Array(rows))
    }).map(Json).map_err(db_err)
}

async fn loans_list(AxumState(state): AxumState<Arc<ApiState>>, headers: HeaderMap) -> ApiResult {
    auth!(headers, state);
    state.db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, principal, currency, interest_rate,
                    monthly_payment, start_date, end_date, created_at, updated_at
             FROM loans ORDER BY name"
        )?;
        let rows: Vec<Value> = stmt.query_map([], |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "principal": row.get::<_, String>(2)?,
            "currency": row.get::<_, String>(3)?,
            "interestRate": sql_to_json(row.get::<_, rusqlite::types::Value>(4).unwrap_or(rusqlite::types::Value::Null)),
            "monthlyPayment": sql_to_json(row.get::<_, rusqlite::types::Value>(5).unwrap_or(rusqlite::types::Value::Null)),
            "startDate": sql_to_json(row.get::<_, rusqlite::types::Value>(6).unwrap_or(rusqlite::types::Value::Null)),
            "endDate": sql_to_json(row.get::<_, rusqlite::types::Value>(7).unwrap_or(rusqlite::types::Value::Null)),
            "createdAt": row.get::<_, i64>(8)?,
            "updatedAt": row.get::<_, i64>(9)?,
        })))?.filter_map(|r| r.ok()).collect();
        Ok(Value::Array(rows))
    }).map(Json).map_err(db_err)
}

async fn savings_list(AxumState(state): AxumState<Arc<ApiState>>, headers: HeaderMap) -> ApiResult {
    auth!(headers, state);
    state.db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT ba.id, ba.name, ba.account_type, ba.iban, ba.currency, ba.balance,
                    ba.interest_rate, ba.has_zone_designation, ba.termination_date,
                    ba.exclude_from_balance, ba.created_at, ba.updated_at,
                    i.name
             FROM bank_accounts ba
             LEFT JOIN institutions i ON ba.institution_id = i.id
             ORDER BY ba.name"
        )?;
        let rows: Vec<Value> = stmt.query_map([], |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "accountType": row.get::<_, String>(2)?,
            "iban": sql_to_json(row.get::<_, rusqlite::types::Value>(3).unwrap_or(rusqlite::types::Value::Null)),
            "currency": row.get::<_, String>(4)?,
            "balance": row.get::<_, String>(5)?,
            "interestRate": sql_to_json(row.get::<_, rusqlite::types::Value>(6).unwrap_or(rusqlite::types::Value::Null)),
            "hasZoneDesignation": row.get::<_, i32>(7)? != 0,
            "terminationDate": sql_to_json(row.get::<_, rusqlite::types::Value>(8).unwrap_or(rusqlite::types::Value::Null)),
            "excludeFromBalance": row.get::<_, i32>(9)? != 0,
            "createdAt": row.get::<_, i64>(10)?,
            "updatedAt": row.get::<_, i64>(11)?,
            "institutionName": sql_to_json(row.get::<_, rusqlite::types::Value>(12).unwrap_or(rusqlite::types::Value::Null)),
        })))?.filter_map(|r| r.ok()).collect();
        Ok(Value::Array(rows))
    }).map(Json).map_err(db_err)
}

async fn real_estate_list(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
) -> ApiResult {
    auth!(headers, state);
    state.db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, address, type, purchase_price, purchase_price_currency,
                    market_price, market_price_currency, monthly_rent, monthly_rent_currency,
                    recurring_costs, notes, created_at, updated_at
             FROM real_estate ORDER BY name"
        )?;
        let rows: Vec<Value> = stmt.query_map([], |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "address": sql_to_json(row.get::<_, rusqlite::types::Value>(2).unwrap_or(rusqlite::types::Value::Null)),
            "type": row.get::<_, String>(3)?,
            "purchasePrice": sql_to_json(row.get::<_, rusqlite::types::Value>(4).unwrap_or(rusqlite::types::Value::Null)),
            "purchasePriceCurrency": sql_to_json(row.get::<_, rusqlite::types::Value>(5).unwrap_or(rusqlite::types::Value::Null)),
            "marketPrice": row.get::<_, String>(6)?,
            "marketPriceCurrency": row.get::<_, String>(7)?,
            "monthlyRent": sql_to_json(row.get::<_, rusqlite::types::Value>(8).unwrap_or(rusqlite::types::Value::Null)),
            "monthlyRentCurrency": sql_to_json(row.get::<_, rusqlite::types::Value>(9).unwrap_or(rusqlite::types::Value::Null)),
            "recurringCosts": sql_to_json(row.get::<_, rusqlite::types::Value>(10).unwrap_or(rusqlite::types::Value::Null)),
            "notes": sql_to_json(row.get::<_, rusqlite::types::Value>(11).unwrap_or(rusqlite::types::Value::Null)),
            "createdAt": row.get::<_, i64>(12)?,
            "updatedAt": row.get::<_, i64>(13)?,
        })))?.filter_map(|r| r.ok()).collect();
        Ok(Value::Array(rows))
    }).map(Json).map_err(db_err)
}

async fn real_estate_detail(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult {
    auth!(headers, state);
    state.db.with_conn(|conn| {
        let prop = conn.query_row(
            "SELECT id, name, address, type, purchase_price, purchase_price_currency,
                    market_price, market_price_currency, monthly_rent, monthly_rent_currency,
                    recurring_costs, notes, created_at, updated_at
             FROM real_estate WHERE id = ?",
            [&id],
            |row| Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "address": sql_to_json(row.get::<_, rusqlite::types::Value>(2).unwrap_or(rusqlite::types::Value::Null)),
                "type": row.get::<_, String>(3)?,
                "marketPrice": row.get::<_, String>(6)?,
                "marketPriceCurrency": row.get::<_, String>(7)?,
                "createdAt": row.get::<_, i64>(12)?,
                "updatedAt": row.get::<_, i64>(13)?,
            })),
        );
        match prop {
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                Ok(serde_json::json!({ "error": format!("Property {} not found", id) }))
            }
            Err(e) => Err(e.into()),
            Ok(mut obj) => {
                let costs: Vec<Value> = {
                    let mut s = conn.prepare(
                        "SELECT id, name, description, amount, currency, date, created_at
                         FROM real_estate_one_time_costs WHERE real_estate_id = ?
                         ORDER BY date DESC"
                    )?;
                    let result = s.query_map([&id], |row| Ok(serde_json::json!({
                        "id": row.get::<_, String>(0)?,
                        "name": row.get::<_, String>(1)?,
                        "description": sql_to_json(row.get::<_, rusqlite::types::Value>(2).unwrap_or(rusqlite::types::Value::Null)),
                        "amount": row.get::<_, String>(3)?,
                        "currency": row.get::<_, String>(4)?,
                        "date": row.get::<_, i64>(5)?,
                        "createdAt": row.get::<_, i64>(6)?,
                    })))?.filter_map(|r| r.ok()).collect();
                    result
                };
                obj["costs"] = Value::Array(costs);
                Ok(obj)
            }
        }
    }).map(Json).map_err(db_err)
}

async fn insurance_list(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
) -> ApiResult {
    auth!(headers, state);
    state.db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, type, provider, policy_name, policy_number,
                    start_date, end_date, payment_frequency,
                    one_time_payment, one_time_payment_currency,
                    regular_payment, regular_payment_currency,
                    limits, notes, status, created_at, updated_at
             FROM insurance_policies ORDER BY policy_name"
        )?;
        let rows: Vec<Value> = stmt.query_map([], |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "type": row.get::<_, String>(1)?,
            "provider": sql_to_json(row.get::<_, rusqlite::types::Value>(2).unwrap_or(rusqlite::types::Value::Null)),
            "policyName": row.get::<_, String>(3)?,
            "policyNumber": sql_to_json(row.get::<_, rusqlite::types::Value>(4).unwrap_or(rusqlite::types::Value::Null)),
            "startDate": sql_to_json(row.get::<_, rusqlite::types::Value>(5).unwrap_or(rusqlite::types::Value::Null)),
            "endDate": sql_to_json(row.get::<_, rusqlite::types::Value>(6).unwrap_or(rusqlite::types::Value::Null)),
            "paymentFrequency": sql_to_json(row.get::<_, rusqlite::types::Value>(7).unwrap_or(rusqlite::types::Value::Null)),
            "oneTimePayment": sql_to_json(row.get::<_, rusqlite::types::Value>(8).unwrap_or(rusqlite::types::Value::Null)),
            "oneTimePaymentCurrency": sql_to_json(row.get::<_, rusqlite::types::Value>(9).unwrap_or(rusqlite::types::Value::Null)),
            "regularPayment": sql_to_json(row.get::<_, rusqlite::types::Value>(10).unwrap_or(rusqlite::types::Value::Null)),
            "regularPaymentCurrency": sql_to_json(row.get::<_, rusqlite::types::Value>(11).unwrap_or(rusqlite::types::Value::Null)),
            "limits": sql_to_json(row.get::<_, rusqlite::types::Value>(12).unwrap_or(rusqlite::types::Value::Null)),
            "notes": sql_to_json(row.get::<_, rusqlite::types::Value>(13).unwrap_or(rusqlite::types::Value::Null)),
            "status": row.get::<_, String>(14)?,
            "createdAt": row.get::<_, i64>(15)?,
            "updatedAt": row.get::<_, i64>(16)?,
        })))?.filter_map(|r| r.ok()).collect();
        Ok(Value::Array(rows))
    }).map(Json).map_err(db_err)
}

async fn insurance_detail(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult {
    auth!(headers, state);
    state.db.with_conn(|conn| {
        let pol = conn.query_row(
            "SELECT id, type, provider, policy_name, policy_number, status, created_at, updated_at
             FROM insurance_policies WHERE id = ?",
            [&id],
            |row| Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "type": row.get::<_, String>(1)?,
                "provider": sql_to_json(row.get::<_, rusqlite::types::Value>(2).unwrap_or(rusqlite::types::Value::Null)),
                "policyName": row.get::<_, String>(3)?,
                "policyNumber": sql_to_json(row.get::<_, rusqlite::types::Value>(4).unwrap_or(rusqlite::types::Value::Null)),
                "status": row.get::<_, String>(5)?,
                "createdAt": row.get::<_, i64>(6)?,
                "updatedAt": row.get::<_, i64>(7)?,
            })),
        );
        match pol {
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                Ok(serde_json::json!({ "error": format!("Insurance {} not found", id) }))
            }
            Err(e) => Err(e.into()),
            Ok(mut obj) => {
                let docs: Vec<Value> = {
                    let mut s = conn.prepare(
                        "SELECT id, name, description, file_type, file_size, uploaded_at
                         FROM insurance_documents WHERE insurance_id = ? ORDER BY uploaded_at DESC"
                    )?;
                    let result = s.query_map([&id], |row| Ok(serde_json::json!({
                        "id": row.get::<_, String>(0)?,
                        "name": row.get::<_, String>(1)?,
                        "description": sql_to_json(row.get::<_, rusqlite::types::Value>(2).unwrap_or(rusqlite::types::Value::Null)),
                        "fileType": sql_to_json(row.get::<_, rusqlite::types::Value>(3).unwrap_or(rusqlite::types::Value::Null)),
                        "fileSize": sql_to_json(row.get::<_, rusqlite::types::Value>(4).unwrap_or(rusqlite::types::Value::Null)),
                        "uploadedAt": row.get::<_, i64>(5)?,
                    })))?.filter_map(|r| r.ok()).collect();
                    result
                };
                obj["documents"] = Value::Array(docs);
                Ok(obj)
            }
        }
    }).map(Json).map_err(db_err)
}

async fn insurance_create(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Json(body): Json<InsertInsurancePolicy>,
) -> ApiResult {
    auth!(headers, state);

    body.validate()
        .map_err(|_| StatusCode::UNPROCESSABLE_ENTITY)?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let limits_json = serde_json::to_string(&body.limits.unwrap_or_default())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    state
        .db
        .with_conn(|conn| {
            conn.execute(
                "INSERT INTO insurance_policies
                 (id, type, provider, policy_name, policy_number, start_date, end_date,
                  payment_frequency, one_time_payment, one_time_payment_currency,
                  regular_payment, regular_payment_currency, limits, notes, status,
                  created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?16)",
                rusqlite::params![
                    id,
                    body.policy_type,
                    body.provider,
                    body.policy_name,
                    body.policy_number,
                    body.start_date,
                    body.end_date,
                    body.payment_frequency,
                    body.one_time_payment,
                    body.one_time_payment_currency,
                    body.regular_payment.unwrap_or_else(|| "0".to_string()),
                    body.regular_payment_currency.unwrap_or_else(|| "CZK".to_string()),
                    limits_json,
                    body.notes,
                    body.status.unwrap_or_else(|| "active".to_string()),
                    now
                ],
            )?;

            Ok(conn.query_row(
                "SELECT id, type, provider, policy_name, policy_number,
                        start_date, end_date, payment_frequency,
                        one_time_payment, one_time_payment_currency,
                        regular_payment, regular_payment_currency,
                        limits, notes, status, created_at, updated_at
                 FROM insurance_policies WHERE id = ?1",
                [&id],
                |row| {
                    Ok(serde_json::json!({
                        "id": row.get::<_, String>(0)?,
                        "type": row.get::<_, String>(1)?,
                        "provider": sql_to_json(row.get::<_, rusqlite::types::Value>(2).unwrap_or(rusqlite::types::Value::Null)),
                        "policyName": row.get::<_, String>(3)?,
                        "policyNumber": sql_to_json(row.get::<_, rusqlite::types::Value>(4).unwrap_or(rusqlite::types::Value::Null)),
                        "startDate": row.get::<_, i64>(5)?,
                        "endDate": sql_to_json(row.get::<_, rusqlite::types::Value>(6).unwrap_or(rusqlite::types::Value::Null)),
                        "paymentFrequency": row.get::<_, String>(7)?,
                        "oneTimePayment": sql_to_json(row.get::<_, rusqlite::types::Value>(8).unwrap_or(rusqlite::types::Value::Null)),
                        "oneTimePaymentCurrency": sql_to_json(row.get::<_, rusqlite::types::Value>(9).unwrap_or(rusqlite::types::Value::Null)),
                        "regularPayment": sql_to_json(row.get::<_, rusqlite::types::Value>(10).unwrap_or(rusqlite::types::Value::Null)),
                        "regularPaymentCurrency": sql_to_json(row.get::<_, rusqlite::types::Value>(11).unwrap_or(rusqlite::types::Value::Null)),
                        "limits": sql_to_json(row.get::<_, rusqlite::types::Value>(12).unwrap_or(rusqlite::types::Value::Null)),
                        "notes": sql_to_json(row.get::<_, rusqlite::types::Value>(13).unwrap_or(rusqlite::types::Value::Null)),
                        "status": row.get::<_, String>(14)?,
                        "createdAt": row.get::<_, i64>(15)?,
                        "updatedAt": row.get::<_, i64>(16)?,
                    }))
                },
            )?)
        })
        .map(Json)
        .map_err(db_err)
}

async fn other_assets_list(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
) -> ApiResult {
    auth!(headers, state);
    state.db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, quantity, market_price, currency,
                    average_purchase_price, yield_type, yield_value, created_at, updated_at
             FROM other_assets ORDER BY name"
        )?;
        let rows: Vec<Value> = stmt.query_map([], |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "quantity": row.get::<_, String>(2)?,
            "marketPrice": row.get::<_, String>(3)?,
            "currency": row.get::<_, String>(4)?,
            "averagePurchasePrice": sql_to_json(row.get::<_, rusqlite::types::Value>(5).unwrap_or(rusqlite::types::Value::Null)),
            "yieldType": sql_to_json(row.get::<_, rusqlite::types::Value>(6).unwrap_or(rusqlite::types::Value::Null)),
            "yieldValue": sql_to_json(row.get::<_, rusqlite::types::Value>(7).unwrap_or(rusqlite::types::Value::Null)),
            "createdAt": row.get::<_, i64>(8)?,
            "updatedAt": row.get::<_, i64>(9)?,
        })))?.filter_map(|r| r.ok()).collect();
        Ok(Value::Array(rows))
    }).map(Json).map_err(db_err)
}

async fn other_assets_transactions(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Path(asset_id): Path<String>,
) -> ApiResult {
    auth!(headers, state);
    state
        .db
        .with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, asset_id, type, quantity, price_per_unit, currency,
                    transaction_date, created_at
             FROM other_asset_transactions WHERE asset_id = ?
             ORDER BY transaction_date DESC",
            )?;
            let rows: Vec<Value> = stmt
                .query_map([&asset_id], |row| {
                    Ok(serde_json::json!({
                        "id": row.get::<_, String>(0)?,
                        "assetId": row.get::<_, String>(1)?,
                        "type": row.get::<_, String>(2)?,
                        "quantity": row.get::<_, String>(3)?,
                        "pricePerUnit": row.get::<_, String>(4)?,
                        "currency": row.get::<_, String>(5)?,
                        "transactionDate": row.get::<_, i64>(6)?,
                        "createdAt": row.get::<_, i64>(7)?,
                    }))
                })?
                .filter_map(|r| r.ok())
                .collect();
            Ok(Value::Array(rows))
        })
        .map(Json)
        .map_err(db_err)
}

async fn exchange_rates(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
) -> ApiResult {
    auth!(headers, state);
    state
        .db
        .with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT currency, rate, fetched_at FROM exchange_rates ORDER BY currency",
            )?;
            let rows: Vec<Value> = stmt
                .query_map([], |row| {
                    Ok(serde_json::json!({
                        "currency": row.get::<_, String>(0)?,
                        "rate": row.get::<_, f64>(1)?,
                        "fetchedAt": row.get::<_, i64>(2)?,
                    }))
                })?
                .filter_map(|r| r.ok())
                .collect();
            Ok(serde_json::json!({
                "baseCurrency": "CZK",
                "rates": rows,
                "note": "Multiply amount in currency by rate to get CZK equivalent."
            }))
        })
        .map(Json)
        .map_err(db_err)
}

async fn cashflow_report(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Query(params): Query<CashflowParams>,
) -> ApiResult {
    auth!(headers, state);
    let view_type = params.view_type.unwrap_or_else(|| "monthly".to_string());
    let multiplier: f64 = if view_type == "yearly" { 12.0 } else { 1.0 };

    state.db.with_conn(|conn| {
        let rates: std::collections::HashMap<String, f64> = {
            let mut stmt = conn.prepare("SELECT currency, rate FROM exchange_rates")?;
            let result = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?)))?
                .filter_map(|r| r.ok())
                .collect();
                result
        };
        let czk = |currency: &str, amount: f64| -> f64 {
            if currency == "CZK" { return amount; }
            amount * rates.get(currency).copied().unwrap_or(1.0)
        };
        let to_monthly = |amount: f64, currency: &str, frequency: &str| -> f64 {
            let v = czk(currency, amount);
            match frequency {
                "monthly" => v,
                "quarterly" => v / 3.0,
                "semi_annual" => v / 6.0,
                "annual" => v / 12.0,
                "weekly" => v * 4.33,
                "daily" => v * 30.0,
                _ => v,
            }
        };

        let mut income: Vec<Value> = Vec::new();
        let mut expenses: Vec<Value> = Vec::new();

        // Cashflow items
        {
            let mut stmt = conn.prepare("SELECT name, amount, currency, frequency, item_type, category FROM cashflow_items")?;
            let items: Vec<(String, f64, String, String, String, String)> = stmt.query_map([], |row| {
                Ok((row.get(0)?, row.get::<_, f64>(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?))
            })?.filter_map(|r| r.ok()).collect();
            for (name, amount, currency, frequency, item_type, category) in items {
                if frequency == "one_time" { continue; }
                let monthly = to_monthly(amount, &currency, &frequency);
                let entry = serde_json::json!({ "name": name, "monthly_czk": monthly, "category": category });
                if item_type == "income" { income.push(entry); } else { expenses.push(entry); }
            }
        }

        // Loan payments
        {
            let mut stmt = conn.prepare("SELECT name, monthly_payment, currency FROM loans WHERE monthly_payment > 0")?;
            let items: Vec<(String, f64, String)> = stmt.query_map([], |row| Ok((row.get(0)?, row.get::<_, f64>(1)?, row.get(2)?)))?.filter_map(|r| r.ok()).collect();
            for (name, payment, currency) in items {
                let monthly = czk(&currency, payment);
                if monthly > 0.0 {
                    expenses.push(serde_json::json!({ "name": format!("Loan: {}", name), "monthly_czk": monthly, "category": "loan_payment" }));
                }
            }
        }

        // Insurance premiums
        {
            let mut stmt = conn.prepare("SELECT policy_name, regular_payment, regular_payment_currency, payment_frequency FROM insurance_policies WHERE status = 'active' AND regular_payment > 0")?;
            let items: Vec<(String, f64, String, String)> = stmt.query_map([], |row| Ok((row.get(0)?, row.get::<_, f64>(1)?, row.get(2)?, row.get(3)?)))?.filter_map(|r| r.ok()).collect();
            for (name, payment, currency, frequency) in items {
                let monthly = to_monthly(payment, &currency, &frequency);
                if monthly > 0.0 {
                    expenses.push(serde_json::json!({ "name": format!("Insurance: {}", name), "monthly_czk": monthly, "category": "insurance" }));
                }
            }
        }

        // Savings interest
        {
            let mut stmt = conn.prepare("SELECT name, balance, currency, interest_rate FROM bank_accounts WHERE interest_rate IS NOT NULL AND CAST(interest_rate AS REAL) > 0 AND exclude_from_balance = 0")?;
            let items: Vec<(String, f64, String, f64)> = stmt.query_map([], |row| Ok((row.get(0)?, row.get::<_, f64>(1)?, row.get(2)?, row.get::<_, f64>(3)?)))?.filter_map(|r| r.ok()).collect();
            for (name, balance, currency, rate) in items {
                let balance_czk = czk(&currency, balance);
                let monthly = balance_czk * (rate / 100.0) / 12.0;
                if monthly > 0.0 {
                    income.push(serde_json::json!({ "name": format!("Interest: {}", name), "monthly_czk": monthly, "category": "interest" }));
                }
            }
        }

        let total_income: f64 = income.iter().filter_map(|v| v["monthly_czk"].as_f64()).sum();
        let total_expenses: f64 = expenses.iter().filter_map(|v| v["monthly_czk"].as_f64()).sum();

        let fmt_income: Vec<Value> = income.iter().map(|v| serde_json::json!({
            "name": v["name"], "category": v["category"],
            "amount_czk": format!("{:.2}", v["monthly_czk"].as_f64().unwrap_or(0.0) * multiplier)
        })).collect();
        let fmt_expenses: Vec<Value> = expenses.iter().map(|v| serde_json::json!({
            "name": v["name"], "category": v["category"],
            "amount_czk": format!("{:.2}", v["monthly_czk"].as_f64().unwrap_or(0.0) * multiplier)
        })).collect();

        Ok(serde_json::json!({
            "viewType": view_type,
            "summary": {
                "totalIncomeCzk": format!("{:.2}", total_income * multiplier),
                "totalExpensesCzk": format!("{:.2}", total_expenses * multiplier),
                "netCashflowCzk": format!("{:.2}", (total_income - total_expenses) * multiplier),
            },
            "income": fmt_income,
            "expenses": fmt_expenses,
        }))
    }).map(Json).map_err(db_err)
}

async fn budgeting_report(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Query(params): Query<BudgetingParams>,
) -> ApiResult {
    auth!(headers, state);
    let timeframe = params.timeframe.unwrap_or_else(|| "monthly".to_string());
    let start_date = params.start_date.unwrap_or(0);
    let end_date = params.end_date.unwrap_or(i64::MAX);

    state.db.with_conn(|conn| {
        let rates: std::collections::HashMap<String, f64> = {
            let mut stmt = conn.prepare("SELECT currency, rate FROM exchange_rates")?;
            let result = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?)))?
                .filter_map(|r| r.ok()).collect();
                result
        };
        let czk = |currency: &str, amount: f64| -> f64 {
            if currency == "CZK" { return amount; }
            amount * rates.get(currency).copied().unwrap_or(1.0)
        };

        // Goals
        let goals: Vec<(String, String, f64, String)> = {
            let mut stmt = conn.prepare(
                "SELECT bg.category_id, tc.name, bg.amount, bg.currency
                 FROM budget_goals bg JOIN transaction_categories tc ON bg.category_id = tc.id
                 WHERE bg.timeframe = ?"
            )?;
            let result = stmt.query_map([&timeframe], |row| Ok((row.get(0)?, row.get(1)?, row.get::<_, f64>(2)?, row.get(3)?)))?
                .filter_map(|r| r.ok()).collect();
                result
        };

        // Actual spending
        let spending: Vec<(String, f64, String)> = {
            let mut stmt = conn.prepare(
                "SELECT bt.category_id, SUM(CAST(bt.amount AS REAL)), bt.currency
                 FROM bank_transactions bt
                 WHERE bt.booking_date >= ? AND bt.booking_date <= ? AND bt.tx_type = 'debit' AND bt.category_id IS NOT NULL
                 GROUP BY bt.category_id, bt.currency"
            )?;
            let result = stmt.query_map(rusqlite::params![start_date, end_date], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?, row.get::<_, String>(2)?))
            })?.filter_map(|r| r.ok()).collect();
            result
        };

        let mut spending_map: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
        for (cat_id, amount, currency) in spending {
            *spending_map.entry(cat_id).or_insert(0.0) += czk(&currency, amount);
        }

        let report: Vec<Value> = goals.iter().map(|(cat_id, cat_name, goal_amount, goal_currency)| {
            let budget_czk = czk(goal_currency, *goal_amount);
            let actual_czk = spending_map.get(cat_id).copied().unwrap_or(0.0);
            serde_json::json!({
                "categoryId": cat_id,
                "categoryName": cat_name,
                "budgetCzk": format!("{:.2}", budget_czk),
                "actualCzk": format!("{:.2}", actual_czk),
                "remainingCzk": format!("{:.2}", budget_czk - actual_czk),
                "usagePercent": if budget_czk > 0.0 { format!("{:.1}", (actual_czk / budget_czk) * 100.0) } else { "N/A".to_string() },
                "overBudget": actual_czk > budget_czk,
            })
        }).collect();

        Ok(serde_json::json!({ "timeframe": timeframe, "budgetCategories": report }))
    }).map(Json).map_err(db_err)
}

async fn stocks_analysis(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
) -> ApiResult {
    auth!(headers, state);
    state.db.with_conn(|conn| {
        let rates: std::collections::HashMap<String, f64> = {
            let mut stmt = conn.prepare("SELECT currency, rate FROM exchange_rates")?;
            let result = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?)))?
                .filter_map(|r| r.ok()).collect();
                result
        };
        let czk = |currency: &str, amount: f64| -> f64 {
            if currency == "CZK" { return amount; }
            amount * rates.get(currency).copied().unwrap_or(1.0)
        };

        let mut stmt = conn.prepare(
            "SELECT si.id, si.ticker, si.company_name, si.quantity,
                    si.average_price, si.currency,
                    COALESCE(spo.price, sd.original_price, '0') AS current_price,
                    COALESCE(spo.currency, sd.currency, 'USD') AS price_currency,
                    COALESCE(do2.yearly_dividend_sum, dd.yearly_dividend_sum, '0') AS yearly_dividend,
                    COALESCE(do2.currency, dd.currency, 'USD') AS dividend_currency
             FROM stock_investments si
             LEFT JOIN stock_data sd ON si.ticker = sd.ticker
             LEFT JOIN stock_price_overrides spo ON si.ticker = spo.ticker
             LEFT JOIN dividend_data dd ON si.ticker = dd.ticker
             LEFT JOIN dividend_overrides do2 ON si.ticker = do2.ticker"
        )?;

        let stocks: Vec<Value> = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            let ticker: String = row.get(1)?;
            let company: String = row.get(2)?;
            let qty: f64 = row.get::<_, String>(3)?.parse().unwrap_or(0.0);
            let avg: f64 = row.get::<_, String>(4)?.parse().unwrap_or(0.0);
            let currency: String = row.get(5)?;
            let curr_price: f64 = row.get::<_, String>(6)?.parse().unwrap_or(0.0);
            let price_currency: String = row.get(7)?;
            let yearly_div: f64 = row.get::<_, String>(8)?.parse().unwrap_or(0.0);
            let div_currency: String = row.get(9)?;
            Ok((id, ticker, company, qty, avg, currency, curr_price, price_currency, yearly_div, div_currency))
        })?.filter_map(|r| r.ok()).map(|(id, ticker, company, qty, avg, currency, curr_price, price_currency, yearly_div, div_currency)| {
            let curr_val_czk = czk(&price_currency, qty * curr_price);
            let cost_czk = czk(&currency, qty * avg);
            let gain_czk = curr_val_czk - cost_czk;
            let gain_pct = if cost_czk > 0.0 { (gain_czk / cost_czk) * 100.0 } else { 0.0 };
            let div_czk = czk(&div_currency, qty * yearly_div);
            let div_yield = if curr_val_czk > 0.0 { (div_czk / curr_val_czk) * 100.0 } else { 0.0 };
            serde_json::json!({
                "id": id,
                "ticker": ticker,
                "companyName": company,
                "quantity": qty,
                "currentValueCzk": format!("{:.2}", curr_val_czk),
                "costBasisCzk": format!("{:.2}", cost_czk),
                "gainLossCzk": format!("{:.2}", gain_czk),
                "gainLossPct": format!("{:.2}", gain_pct),
                "annualDividendCzk": format!("{:.2}", div_czk),
                "dividendYieldPct": format!("{:.2}", div_yield),
            })
        }).collect();

        let total_val: f64 = stocks.iter().filter_map(|v| v["currentValueCzk"].as_str()?.parse::<f64>().ok()).sum();
        let total_gain: f64 = stocks.iter().filter_map(|v| v["gainLossCzk"].as_str()?.parse::<f64>().ok()).sum();
        let total_div: f64 = stocks.iter().filter_map(|v| v["annualDividendCzk"].as_str()?.parse::<f64>().ok()).sum();

        Ok(serde_json::json!({
            "summary": {
                "totalValueCzk": format!("{:.2}", total_val),
                "totalGainLossCzk": format!("{:.2}", total_gain),
                "annualDividendsCzk": format!("{:.2}", total_div),
            },
            "stocks": stocks,
        }))
    }).map(Json).map_err(db_err)
}

async fn tag_metrics(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Query(params): Query<TagMetricsParams>,
) -> ApiResult {
    auth!(headers, state);
    state
        .db
        .with_conn(|conn| {
            let rates: std::collections::HashMap<String, f64> = {
                let mut stmt = conn.prepare("SELECT currency, rate FROM exchange_rates")?;
                let result = stmt
                    .query_map([], |row| {
                        Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
                    })?
                    .filter_map(|r| r.ok())
                    .collect();
                result
            };
            let czk = |currency: &str, amount: f64| -> f64 {
                if currency == "CZK" {
                    return amount;
                }
                amount * rates.get(currency).copied().unwrap_or(1.0)
            };

            let tags: Vec<(String, String)> = if let Some(ref ids_str) = params.tag_ids {
                let ids: Vec<&str> = ids_str.split(',').collect();
                let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                let sql = format!(
                    "SELECT id, name FROM stock_tags WHERE id IN ({}) ORDER BY name",
                    placeholders
                );
                let mut stmt = conn.prepare(&sql)?;
                let p: Vec<Box<dyn rusqlite::ToSql>> = ids
                    .iter()
                    .map(|id| Box::new(id.to_string()) as Box<dyn rusqlite::ToSql>)
                    .collect();
                let refs: Vec<&dyn rusqlite::ToSql> = p.iter().map(|x| x.as_ref()).collect();
                let result = stmt
                    .query_map(refs.as_slice(), |row| Ok((row.get(0)?, row.get(1)?)))?
                    .filter_map(|r| r.ok())
                    .collect();
                result
            } else {
                let mut stmt = conn.prepare("SELECT id, name FROM stock_tags ORDER BY name")?;
                let result = stmt
                    .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
                    .filter_map(|r| r.ok())
                    .collect();
                result
            };

            let result: Vec<Value> = tags
                .iter()
                .filter_map(|(tag_id, tag_name)| {
                    let stocks: Vec<(f64, f64, String, f64, String, f64, String)> = {
                        let mut s = conn.prepare(
                    "SELECT si.quantity, COALESCE(spo.price, sd.original_price, '0') AS cp,
                            COALESCE(spo.currency, sd.currency, 'USD') AS cc,
                            si.average_price, si.currency,
                            COALESCE(do2.yearly_dividend_sum, dd.yearly_dividend_sum, '0') AS yd,
                            COALESCE(do2.currency, dd.currency, 'USD') AS dc
                     FROM stock_investments si
                     JOIN stock_investment_tags sit ON si.id = sit.investment_id
                     LEFT JOIN stock_data sd ON si.ticker = sd.ticker
                     LEFT JOIN stock_price_overrides spo ON si.ticker = spo.ticker
                     LEFT JOIN dividend_data dd ON si.ticker = dd.ticker
                     LEFT JOIN dividend_overrides do2 ON si.ticker = do2.ticker
                     WHERE sit.tag_id = ?"
                ).ok()?;
                        let result = s
                            .query_map([tag_id], |row| {
                                Ok((
                                    row.get::<_, String>(0)?.parse::<f64>().unwrap_or(0.0),
                                    row.get::<_, String>(1)?.parse::<f64>().unwrap_or(0.0),
                                    row.get::<_, String>(2)?,
                                    row.get::<_, String>(3)?.parse::<f64>().unwrap_or(0.0),
                                    row.get::<_, String>(4)?,
                                    row.get::<_, String>(5)?.parse::<f64>().unwrap_or(0.0),
                                    row.get::<_, String>(6)?,
                                ))
                            })
                            .ok()?
                            .filter_map(|r| r.ok())
                            .collect();
                        result
                    };

                    let mut val = 0.0_f64;
                    let mut cost = 0.0_f64;
                    let mut div = 0.0_f64;
                    for (qty, cp, cc, avg, currency, yd, dc) in &stocks {
                        val += czk(cc, qty * cp);
                        cost += czk(currency, qty * avg);
                        div += czk(dc, qty * yd);
                    }
                    let gain = val - cost;
                    let gain_pct = if cost > 0.0 {
                        (gain / cost) * 100.0
                    } else {
                        0.0
                    };
                    let div_yield = if val > 0.0 { (div / val) * 100.0 } else { 0.0 };

                    Some(serde_json::json!({
                        "tagId": tag_id,
                        "tagName": tag_name,
                        "stockCount": stocks.len(),
                        "totalValueCzk": format!("{:.2}", val),
                        "costBasisCzk": format!("{:.2}", cost),
                        "gainLossCzk": format!("{:.2}", gain),
                        "gainLossPct": format!("{:.2}", gain_pct),
                        "annualDividendCzk": format!("{:.2}", div),
                        "dividendYieldPct": format!("{:.2}", div_yield),
                    }))
                })
                .collect();

            Ok(Value::Array(result))
        })
        .map(Json)
        .map_err(db_err)
}

// ============================================================================
// Server state management
// ============================================================================

pub struct LocalApiServer {
    handle: Mutex<Option<JoinHandle<()>>>,
    token: Mutex<Option<String>>,
    port: Mutex<Option<u16>>,
}

impl Default for LocalApiServer {
    fn default() -> Self {
        Self::new()
    }
}

impl LocalApiServer {
    pub fn new() -> Self {
        Self {
            handle: Mutex::new(None),
            token: Mutex::new(None),
            port: Mutex::new(None),
        }
    }

    pub fn is_running(&self) -> bool {
        self.handle.lock().unwrap().is_some()
    }

    pub fn get_port(&self) -> Option<u16> {
        *self.port.lock().unwrap()
    }

    pub fn get_token(&self) -> Option<String> {
        self.token.lock().unwrap().clone()
    }

    pub async fn start(&self, db: Database, data_dir: PathBuf) -> crate::error::Result<()> {
        if self.is_running() {
            return Ok(());
        }

        // Generate token and find free port
        let token = uuid::Uuid::new_v4().to_string();
        // Bind directly with tokio (async-safe, no blocking socket conversion)
        let tokio_listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| {
                crate::error::AppError::Internal(format!("Failed to bind local API server: {}", e))
            })?;
        let port = tokio_listener
            .local_addr()
            .map_err(|e| {
                crate::error::AppError::Internal(format!("Failed to get local address: {}", e))
            })?
            .port();

        // Write session file
        write_session(data_dir.as_path(), port, &token).map_err(|e| {
            crate::error::AppError::Internal(format!("Failed to write session.json: {}", e))
        })?;

        // Build router
        let state = Arc::new(ApiState {
            db,
            token: token.clone(),
        });
        let app = Router::new()
            .route("/health", get(health))
            .route("/portfolio/metrics", get(portfolio_metrics))
            .route("/portfolio/history", get(portfolio_history))
            .route("/investments", get(investments_list))
            .route("/investments/{id}", get(investment_detail))
            .route("/investments/transactions", get(investment_transactions))
            .route("/investments/{ticker}/history", get(stock_value_history))
            .route("/crypto", get(crypto_list))
            .route("/crypto/transactions", get(crypto_transactions))
            .route("/crypto/{ticker}/history", get(crypto_value_history))
            .route("/bank-accounts", get(bank_accounts_list))
            .route("/bank-accounts/{id}/transactions", get(bank_transactions))
            .route("/bank-categories", get(bank_categories))
            .route("/bonds", get(bonds_list))
            .route("/loans", get(loans_list))
            .route("/savings", get(savings_list))
            .route("/real-estate", get(real_estate_list))
            .route("/real-estate/{id}", get(real_estate_detail))
            .route("/insurance", get(insurance_list).post(insurance_create))
            .route("/insurance/{id}", get(insurance_detail))
            .route("/other-assets", get(other_assets_list))
            .route(
                "/other-assets/{id}/transactions",
                get(other_assets_transactions),
            )
            .route("/analytics/cashflow", get(cashflow_report))
            .route("/analytics/budgeting", get(budgeting_report))
            .route("/analytics/stocks", get(stocks_analysis))
            .route("/analytics/tags", get(tag_metrics))
            .route("/exchange-rates", get(exchange_rates))
            .with_state(state);

        let handle = tokio::spawn(async move {
            if let Err(e) = axum::serve(tokio_listener, app).await {
                eprintln!("[local-api] Server error: {}", e);
            }
        });

        *self.handle.lock().unwrap() = Some(handle);
        *self.token.lock().unwrap() = Some(token);
        *self.port.lock().unwrap() = Some(port);

        println!("[local-api] Started on port {}", port);
        Ok(())
    }

    pub async fn stop(&self, data_dir: PathBuf) {
        if let Some(handle) = self.handle.lock().unwrap().take() {
            handle.abort();
        }
        *self.token.lock().unwrap() = None;
        *self.port.lock().unwrap() = None;
        delete_session(data_dir.as_path());
        println!("[local-api] Stopped");
    }
}
