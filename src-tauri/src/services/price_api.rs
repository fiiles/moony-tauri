//! External API services for price fetching
//!
//! - MarketStack API for stock prices
//! - CoinGecko API for cryptocurrency prices and search

use crate::db::Database;
use crate::error::{AppError, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Exchange to Currency Mapping (from Moony-local price-service.ts)
// ============================================================================

fn get_currency_from_exchange(exchange: Option<&str>) -> &'static str {
    match exchange {
        // US Exchanges
        Some("XNAS") => "USD", // NASDAQ
        Some("XNYS") => "USD", // NYSE
        Some("BATS") => "USD",
        Some("ARCX") => "USD", // NYSE Arca
        Some("IEXG") => "USD", // IEX

        // European Exchanges
        Some("XLON") => "GBP", // London
        Some("XPAR") => "EUR", // Paris
        Some("XAMS") => "EUR", // Amsterdam
        Some("XBRU") => "EUR", // Brussels
        Some("XLIS") => "EUR", // Lisbon
        Some("XFRA") => "EUR", // Frankfurt
        Some("XETR") => "EUR", // XETRA
        Some("XSWX") => "CHF", // Swiss
        Some("XSTO") => "USD", // Stockholm (SEK not supported)
        Some("XHEL") => "EUR", // Helsinki
        Some("XMIL") => "EUR", // Milan

        // Czech
        Some("XPRA") => "CZK", // Prague

        // Asian
        Some("XTKS") => "JPY", // Tokyo
        Some("XHKG") => "HKD", // Hong Kong
        Some("XSHG") => "CNY", // Shanghai
        Some("XSHE") => "CNY", // Shenzhen

        _ => "USD", // Default
    }
}

// ============================================================================
// MarketStack API Types
// ============================================================================

#[derive(Debug, Deserialize)]
struct MarketstackResponse {
    data: Option<Vec<MarketstackEod>>,
    error: Option<MarketstackError>,
}

#[derive(Debug, Deserialize)]
struct MarketstackEod {
    symbol: String,
    close: Option<f64>,
    exchange: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MarketstackError {
    message: Option<String>,
}

// ============================================================================
// CoinGecko API Types
// ============================================================================

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct CoinGeckoSearchResult {
    pub id: String,
    pub symbol: String,
    pub name: String,
    pub market_cap_rank: Option<i32>,
    pub thumb: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CoinGeckoSearchResponse {
    coins: Option<Vec<CoinGeckoSearchResult>>,
}

// ============================================================================
// MarketStack Dividend API Types
// ============================================================================

const DIVIDEND_CACHE_DAYS: i64 = 30;

#[derive(Debug, Deserialize)]
struct MarketstackDividendResponse {
    data: Option<Vec<MarketstackDividend>>,
    error: Option<MarketstackError>,
}

#[derive(Debug, Deserialize)]
struct MarketstackDividend {
    dividend: f64,
}

#[derive(Debug, Serialize)]
pub struct DividendResult {
    pub ticker: String,
    pub yearly_sum: f64,
    pub currency: String,
}

#[derive(Debug, Serialize)]
pub struct StockPriceResult {
    pub ticker: String,
    pub price: f64,
    pub currency: String,
}

/// Refresh stock prices from MarketStack API
/// Returns list of updated prices
pub async fn refresh_stock_prices(
    db: &Database,
    api_key: &str,
    tickers: Vec<String>,
) -> Result<Vec<StockPriceResult>> {
    if tickers.is_empty() {
        return Ok(vec![]);
    }

    let symbols = tickers.join(",");
    let url = format!(
        "http://api.marketstack.com/v1/eod/latest?access_key={}&symbols={}",
        api_key, symbols
    );

    log::info!("[PRICE API] Fetching stock prices for: {}", symbols);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::ExternalApi(format!("MarketStack request failed: {}", e)))?;

    let data: MarketstackResponse = response
        .json::<MarketstackResponse>()
        .await
        .map_err(|e| AppError::ExternalApi(format!("MarketStack parse error: {}", e)))?;

    if let Some(error) = data.error {
        return Err(AppError::ExternalApi(format!(
            "MarketStack API error: {}",
            error.message.unwrap_or_default()
        )));
    }

    let results = data.data.unwrap_or_default();
    let mut updated_prices = Vec::new();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    for result in results {
        if let Some(close_price) = result.close {
            let currency = get_currency_from_exchange(result.exchange.as_deref());
            let ticker = result.symbol.to_uppercase();

            // Upsert into stock_prices table
            db.with_conn(|conn| {
                conn.execute(
                    "INSERT INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?5)
                     ON CONFLICT(ticker) DO UPDATE SET
                       original_price = ?3, currency = ?4, price_date = ?5, fetched_at = ?5",
                    rusqlite::params![
                        uuid::Uuid::new_v4().to_string(),
                        &ticker,
                        format!("{:.2}", close_price),
                        currency,
                        now,
                    ],
                )?;
                Ok(())
            })?;

            log::info!(
                "[PRICE API] Updated {}: {} {}",
                ticker,
                close_price,
                currency
            );

            updated_prices.push(StockPriceResult {
                ticker,
                price: close_price,
                currency: currency.to_string(),
            });
        }
    }

    Ok(updated_prices)
}

// ============================================================================
// Crypto Price Refresh (CoinGecko)
// ============================================================================

#[derive(Debug, Serialize)]
pub struct CryptoPriceResult {
    pub ticker: String,
    pub price: f64,
    pub currency: String,
}

/// Refresh crypto prices from CoinGecko API
/// Takes coingecko_id -> ticker mapping
pub async fn refresh_crypto_prices(
    db: &Database,
    api_key: Option<&str>,
    id_to_ticker: HashMap<String, String>,
) -> Result<Vec<CryptoPriceResult>> {
    if id_to_ticker.is_empty() {
        return Ok(vec![]);
    }

    let ids: Vec<&str> = id_to_ticker.keys().map(|s| s.as_str()).collect();
    let ids_param = ids.join(",");
    let url = format!(
        "https://api.coingecko.com/api/v3/simple/price?ids={}&vs_currencies=usd",
        ids_param
    );

    log::info!("[PRICE API] Fetching crypto prices for: {}", ids_param);

    let client = reqwest::Client::new();
    let mut request = client.get(&url);

    // Add API key header if provided
    if let Some(key) = api_key {
        if !key.is_empty() {
            request = request.header("x-cg-demo-api-key", key);
        }
    }

    let response = request
        .send()
        .await
        .map_err(|e| AppError::ExternalApi(format!("CoinGecko request failed: {}", e)))?;

    // CoinGecko returns { "bitcoin": { "usd": 12345.67 }, ... }
    let price_data: HashMap<String, HashMap<String, f64>> = response
        .json::<HashMap<String, HashMap<String, f64>>>()
        .await
        .map_err(|e| AppError::ExternalApi(format!("CoinGecko parse error: {}", e)))?;

    let mut updated_prices = Vec::new();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    for (coingecko_id, prices) in price_data {
        if let Some(usd_price) = prices.get("usd") {
            if let Some(ticker) = id_to_ticker.get(&coingecko_id) {
                let ticker_upper = ticker.to_uppercase();

                // Upsert into crypto_prices table
                db.with_conn(|conn| {
                    conn.execute(
                        "INSERT INTO crypto_prices (id, symbol, coingecko_id, price, currency, fetched_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                         ON CONFLICT(symbol) DO UPDATE SET
                           price = ?4, currency = ?5, coingecko_id = ?3, fetched_at = ?6",
                        rusqlite::params![
                            uuid::Uuid::new_v4().to_string(),
                            &ticker_upper,
                            &coingecko_id,
                            format!("{:.2}", usd_price),
                            "USD",
                            now,
                        ],
                    )?;
                    Ok(())
                })?;

                log::info!("[PRICE API] Updated {}: {} USD", ticker_upper, usd_price);

                updated_prices.push(CryptoPriceResult {
                    ticker: ticker_upper,
                    price: *usd_price,
                    currency: "USD".to_string(),
                });
            }
        }
    }

    Ok(updated_prices)
}

// ============================================================================
// Stock Ticker Search (Yahoo Finance)
// ============================================================================

#[derive(Debug, Serialize)]
pub struct StockSearchResult {
    pub symbol: String,
    pub shortname: String,
    pub exchange: String,
}

/// Search for stock tickers using Yahoo Finance
/// Filters for EQUITY and ETF types only
pub async fn search_stock_tickers(query: &str) -> Result<Vec<StockSearchResult>> {
    use yahoo_finance_api as yahoo;

    log::info!("[TICKER SEARCH] Searching for: {}", query);

    let provider = yahoo::YahooConnector::new()
        .map_err(|e| AppError::ExternalApi(format!("Yahoo connector failed: {}", e)))?;

    let search_result = provider
        .search_ticker(query)
        .await
        .map_err(|e| AppError::ExternalApi(format!("Yahoo Finance search failed: {}", e)))?;

    let results: Vec<StockSearchResult> = search_result
        .quotes
        .into_iter()
        .filter(|quote| quote.quote_type == "EQUITY" || quote.quote_type == "ETF")
        .map(|quote| {
            let shortname = if !quote.short_name.is_empty() {
                quote.short_name
            } else if !quote.long_name.is_empty() {
                quote.long_name
            } else {
                quote.symbol.clone()
            };

            StockSearchResult {
                symbol: quote.symbol,
                shortname,
                exchange: quote.exchange,
            }
        })
        .collect();

    log::info!(
        "[TICKER SEARCH] Found {} results for '{}'",
        results.len(),
        query
    );

    Ok(results)
}

// ============================================================================
// Crypto Search (CoinGecko)
// ============================================================================

/// Search for cryptocurrencies by name/symbol
pub async fn search_crypto(
    api_key: Option<&str>,
    query: &str,
) -> Result<Vec<CoinGeckoSearchResult>> {
    let url = format!(
        "https://api.coingecko.com/api/v3/search?query={}",
        urlencoding::encode(query)
    );

    log::info!("[PRICE API] Searching crypto: {}", query);

    let client = reqwest::Client::new();
    let mut request = client.get(&url);

    if let Some(key) = api_key {
        if !key.is_empty() {
            request = request.header("x-cg-demo-api-key", key);
        }
    }

    let response = request
        .send()
        .await
        .map_err(|e| AppError::ExternalApi(format!("CoinGecko search failed: {}", e)))?;

    let data: CoinGeckoSearchResponse = response
        .json::<CoinGeckoSearchResponse>()
        .await
        .map_err(|e| AppError::ExternalApi(format!("CoinGecko search parse error: {}", e)))?;

    let mut results: Vec<CoinGeckoSearchResult> = data
        .coins
        .unwrap_or_default()
        .into_iter()
        .map(|c| CoinGeckoSearchResult {
            id: c.id,
            symbol: c.symbol.to_uppercase(),
            name: c.name,
            market_cap_rank: c.market_cap_rank,
            thumb: c.thumb,
        })
        .collect();

    // Sort by market cap rank (lower = better)
    results.sort_by_key(|r| r.market_cap_rank.unwrap_or(99999));

    Ok(results)
}

// ============================================================================
// Dividend Refresh (MarketStack)
// ============================================================================

/// Refresh dividends from MarketStack API
/// Only fetches if data is older than 30 days
pub async fn refresh_dividends(
    db: &Database,
    api_key: &str,
    tickers: Vec<String>,
) -> Result<Vec<DividendResult>> {
    if tickers.is_empty() {
        return Ok(vec![]);
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    // Calculate date range (last 365 days)
    let today = chrono::Utc::now();
    let one_year_ago = today - chrono::Duration::days(365);
    let date_from = one_year_ago.format("%Y-%m-%d").to_string();
    let date_to = today.format("%Y-%m-%d").to_string();

    let mut results = Vec::new();

    for ticker in tickers {
        // Check if we need to refresh (data older than 30 days)
        let should_fetch = db.with_conn(|conn| {
            let last_fetched: Option<i64> = conn
                .query_row(
                    "SELECT last_fetched_at FROM dividend_data WHERE ticker = ?1",
                    [&ticker],
                    |row| row.get(0),
                )
                .ok();

            if let Some(fetched_at) = last_fetched {
                let days_since = (now - fetched_at) / (60 * 60 * 24);
                Ok(days_since >= DIVIDEND_CACHE_DAYS)
            } else {
                Ok(true)
            }
        })?;

        if !should_fetch {
            // Return cached data
            let cached: Option<(String, String)> = db.with_conn(|conn| {
                conn.query_row(
                    "SELECT yearly_dividend_sum, currency FROM dividend_data WHERE ticker = ?1",
                    [&ticker],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .ok()
                .map(Ok)
                .transpose()
            })?;

            if let Some((sum, currency)) = cached {
                log::info!("[DIVIDEND API] Using cached dividend for {}", ticker);
                results.push(DividendResult {
                    ticker,
                    yearly_sum: sum.parse().unwrap_or(0.0),
                    currency,
                });
            }
            continue;
        }

        // Fetch from MarketStack API
        log::info!(
            "[DIVIDEND API] Fetching dividends for {} from {} to {}",
            ticker,
            date_from,
            date_to
        );

        let url = format!(
            "http://api.marketstack.com/v1/dividends?access_key={}&symbols={}&date_from={}&date_to={}",
            api_key, ticker, date_from, date_to
        );

        let client = reqwest::Client::new();
        let response = match client.get(&url).send().await {
            Ok(r) => r,
            Err(e) => {
                log::error!("[DIVIDEND API] Request failed for {}: {}", ticker, e);
                continue;
            }
        };

        let data: MarketstackDividendResponse = match response.json().await {
            Ok(d) => d,
            Err(e) => {
                log::error!("[DIVIDEND API] Parse failed for {}: {}", ticker, e);
                continue;
            }
        };

        if let Some(error) = data.error {
            log::error!(
                "[DIVIDEND API] API error for {}: {}",
                ticker,
                error.message.unwrap_or_default()
            );
            continue;
        }

        let dividends = data.data.unwrap_or_default();
        let yearly_sum: f64 = dividends.iter().map(|d| d.dividend).sum();
        let currency = "USD".to_string(); // MarketStack dividends are in USD

        // Store in database
        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(ticker) DO UPDATE SET
                   yearly_dividend_sum = ?3, currency = ?4, last_fetched_at = ?5",
                rusqlite::params![
                    uuid::Uuid::new_v4().to_string(),
                    &ticker,
                    format!("{:.2}", yearly_sum),
                    &currency,
                    now,
                ],
            )?;
            Ok(())
        })?;

        log::info!(
            "[DIVIDEND API] Updated {}: {} {} annual dividends ({} payments)",
            ticker,
            yearly_sum,
            currency,
            dividends.len()
        );

        results.push(DividendResult {
            ticker,
            yearly_sum,
            currency,
        });
    }

    Ok(results)
}

// ============================================================================
// API Key Storage
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct ApiKeys {
    pub marketstack: Option<String>,
    pub coingecko: Option<String>,
}

/// Get API keys from app_config table
pub fn get_api_keys(db: &Database) -> Result<ApiKeys> {
    db.with_conn(|conn| {
        let marketstack: Option<String> = conn
            .query_row(
                "SELECT value FROM app_config WHERE key = 'api_key_marketstack'",
                [],
                |row| row.get(0),
            )
            .ok();

        let coingecko: Option<String> = conn
            .query_row(
                "SELECT value FROM app_config WHERE key = 'api_key_coingecko'",
                [],
                |row| row.get(0),
            )
            .ok();

        Ok(ApiKeys {
            marketstack,
            coingecko,
        })
    })
}

/// Save API keys to app_config table
pub fn set_api_keys(db: &Database, keys: &ApiKeys) -> Result<()> {
    db.with_conn(|conn| {
        if let Some(ref key) = keys.marketstack {
            conn.execute(
                "INSERT INTO app_config (key, value) VALUES ('api_key_marketstack', ?1)
                 ON CONFLICT(key) DO UPDATE SET value = ?1",
                [key],
            )?;
        }

        if let Some(ref key) = keys.coingecko {
            conn.execute(
                "INSERT INTO app_config (key, value) VALUES ('api_key_coingecko', ?1)
                 ON CONFLICT(key) DO UPDATE SET value = ?1",
                [key],
            )?;
        }

        Ok(())
    })
}
