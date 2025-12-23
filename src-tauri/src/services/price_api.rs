//! External API services for price fetching
//!
//! - Yahoo Finance API for stock prices and dividends (via yahoo_finance_api crate)
//! - CoinGecko API for cryptocurrency prices and search

use crate::db::Database;
use crate::error::{AppError, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
// Dividend Cache Configuration
// ============================================================================

const DIVIDEND_CACHE_DAYS: i64 = 1; // TODO: Change back to 30 after testing

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

/// Result from stock price refresh
#[derive(Debug, Serialize)]
pub struct StockPriceRefreshResult {
    pub updated: Vec<StockPriceResult>,
    pub remaining_tickers: Vec<String>,
    pub rate_limit_hit: bool,
}

/// Refresh stock prices from Yahoo Finance using yahoo_finance_api crate
/// This crate handles the cookie/crumb authentication that Yahoo requires
/// Works for US, European (.DE, .PA, .MI, etc.) and HK (.HK) stocks
pub async fn refresh_stock_prices_yahoo(
    db: &Database,
    tickers: Vec<String>,
) -> Result<StockPriceRefreshResult> {
    use yahoo_finance_api as yahoo;

    if tickers.is_empty() {
        return Ok(StockPriceRefreshResult {
            updated: vec![],
            remaining_tickers: vec![],
            rate_limit_hit: false,
        });
    }

    let mut updated_prices = Vec::new();
    let mut failed_tickers: Vec<(String, String)> = Vec::new();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    println!(
        "[YAHOO FINANCE] Fetching prices for {} tickers",
        tickers.len()
    );
    println!("[YAHOO FINANCE] Tickers: {:?}", tickers);

    // Create Yahoo connector (handles cookies and authentication)
    let provider = yahoo::YahooConnector::new()
        .map_err(|e| AppError::ExternalApi(format!("Yahoo connector failed: {}", e)))?;

    // Process each ticker
    for ticker in &tickers {
        // Use get_latest_quotes for real-time price
        match provider.get_latest_quotes(ticker, "1d").await {
            Ok(response) => {
                match response.last_quote() {
                    Ok(quote) => {
                        let price = quote.close;
                        if price > 0.0 {
                            // Determine currency from ticker suffix
                            let currency = get_currency_from_ticker(ticker);
                            let ticker_upper = ticker.to_uppercase();

                            // Upsert into stock_prices table
                            if let Err(e) = db.with_conn(|conn| {
                                conn.execute(
                                    "INSERT INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at)
                                     VALUES (?1, ?2, ?3, ?4, ?5, ?5)
                                     ON CONFLICT(ticker) DO UPDATE SET
                                       original_price = ?3, currency = ?4, price_date = ?5, fetched_at = ?5",
                                    rusqlite::params![
                                        uuid::Uuid::new_v4().to_string(),
                                        &ticker_upper,
                                        format!("{:.2}", price),
                                        &currency,
                                        now,
                                    ],
                                )?;
                                Ok(())
                            }) {
                                failed_tickers.push((ticker.clone(), format!("DB error: {}", e)));
                                continue;
                            }

                            updated_prices.push(StockPriceResult {
                                ticker: ticker_upper,
                                price,
                                currency: currency.to_string(),
                            });
                        } else {
                            failed_tickers.push((ticker.clone(), "price=0".to_string()));
                        }
                    }
                    Err(e) => {
                        failed_tickers.push((ticker.clone(), format!("no quote: {}", e)));
                    }
                }
            }
            Err(e) => {
                failed_tickers.push((ticker.clone(), format!("{}", e)));
            }
        }
    }

    // Summary logging
    println!("[YAHOO FINANCE] ========== SUMMARY ==========");
    println!("[YAHOO FINANCE] Updated: {} tickers", updated_prices.len());
    if !updated_prices.is_empty() {
        let updated_list: Vec<_> = updated_prices.iter().map(|p| p.ticker.as_str()).collect();
        println!("[YAHOO FINANCE] Successfully updated: {:?}", updated_list);
    }
    if !failed_tickers.is_empty() {
        println!("[YAHOO FINANCE] Failed: {} tickers", failed_tickers.len());
        for (ticker, reason) in &failed_tickers {
            println!("[YAHOO FINANCE]   - {}: {}", ticker, reason);
        }
    }
    println!("[YAHOO FINANCE] ==============================");

    Ok(StockPriceRefreshResult {
        updated: updated_prices,
        remaining_tickers: vec![],
        rate_limit_hit: false,
    })
}

/// Get currency from ticker suffix
fn get_currency_from_ticker(ticker: &str) -> &'static str {
    if let Some(suffix) = ticker.split('.').nth(1) {
        match suffix.to_uppercase().as_str() {
            "L" | "LON" => "GBP",          // London
            "PA" => "EUR",                 // Paris
            "AS" => "EUR",                 // Amsterdam
            "BR" => "EUR",                 // Brussels
            "DE" | "F" | "XETRA" => "EUR", // Germany
            "SW" => "CHF",                 // Swiss
            "ST" => "SEK",                 // Stockholm
            "HE" => "EUR",                 // Helsinki
            "MI" => "EUR",                 // Milan
            "VI" => "EUR",                 // Vienna
            "PR" => "CZK",                 // Prague
            "T" | "TYO" => "JPY",          // Tokyo
            "HK" => "HKD",                 // Hong Kong
            "SS" | "SZ" => "CNY",          // Shanghai/Shenzhen
            "AM" => "EUR",                 // Amsterdam
            _ => "USD",
        }
    } else {
        "USD" // Default for US tickers without suffix
    }
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
// Dividend Refresh (Yahoo Finance)
// ============================================================================

/// Refresh dividends from Yahoo Finance
/// Only fetches if data is older than 30 days
/// No API key required - uses yahoo_finance_api crate
pub async fn refresh_dividends(db: &Database, tickers: Vec<String>) -> Result<Vec<DividendResult>> {
    use yahoo_finance_api as yahoo;

    if tickers.is_empty() {
        return Ok(vec![]);
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let mut results = Vec::new();
    let mut failed_tickers: Vec<(String, String)> = Vec::new();

    println!(
        "[YAHOO DIVIDENDS] Fetching dividends for {} tickers",
        tickers.len()
    );

    // Create Yahoo connector
    let provider = yahoo::YahooConnector::new()
        .map_err(|e| AppError::ExternalApi(format!("Yahoo connector failed: {}", e)))?;

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
                println!("[YAHOO DIVIDENDS] Using cached dividend for {}", ticker);
                results.push(DividendResult {
                    ticker,
                    yearly_sum: sum.parse().unwrap_or(0.0),
                    currency,
                });
            }
            continue;
        }

        // Fetch dividend history from Yahoo Finance (last 1 year + 1 day to ensure we get all)
        // yahoo_finance_api uses time::OffsetDateTime, not chrono
        let now_ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let start_ts = now_ts - (366 * 24 * 60 * 60); // 366 days ago

        let start = time::OffsetDateTime::from_unix_timestamp(start_ts)
            .unwrap_or(time::OffsetDateTime::now_utc());
        let end = time::OffsetDateTime::now_utc();

        match provider.get_quote_history(&ticker, start, end).await {
            Ok(response) => {
                // Get dividends from the response - dividends() returns Result, not Option
                match response.dividends() {
                    Ok(div_data) => {
                        let yearly_sum: f64 = div_data.iter().map(|d| d.amount).sum();
                        let currency = get_currency_from_ticker(&ticker).to_string();

                        // Store in database
                        if let Err(e) = db.with_conn(|conn| {
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
                        }) {
                            failed_tickers.push((ticker.clone(), format!("DB error: {}", e)));
                            continue;
                        }

                        results.push(DividendResult {
                            ticker: ticker.clone(),
                            yearly_sum,
                            currency,
                        });
                    }
                    Err(_) => {
                        // No dividends found - store as 0
                        let currency = get_currency_from_ticker(&ticker).to_string();

                        db.with_conn(|conn| {
                            conn.execute(
                                "INSERT INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at)
                                 VALUES (?1, ?2, ?3, ?4, ?5)
                                 ON CONFLICT(ticker) DO UPDATE SET
                                   yearly_dividend_sum = ?3, currency = ?4, last_fetched_at = ?5",
                                rusqlite::params![
                                    uuid::Uuid::new_v4().to_string(),
                                    &ticker,
                                    "0.00",
                                    &currency,
                                    now,
                                ],
                            )?;
                            Ok(())
                        })?;

                        results.push(DividendResult {
                            ticker: ticker.clone(),
                            yearly_sum: 0.0,
                            currency,
                        });
                    }
                }
            }
            Err(e) => {
                failed_tickers.push((ticker.clone(), format!("{}", e)));
            }
        }
    }

    // Summary logging
    println!("[YAHOO DIVIDENDS] ========== SUMMARY ==========");
    println!("[YAHOO DIVIDENDS] Updated: {} tickers", results.len());
    if !failed_tickers.is_empty() {
        println!("[YAHOO DIVIDENDS] Failed: {} tickers", failed_tickers.len());
        for (ticker, reason) in &failed_tickers {
            println!("[YAHOO DIVIDENDS]   - {}: {}", ticker, reason);
        }
    }
    println!("[YAHOO DIVIDENDS] ==============================");

    Ok(results)
}

// ============================================================================
// Historical Price Fetching (for snapshot backfill)
// ============================================================================

/// Historical price data for a single ticker
#[derive(Debug, Clone, Serialize)]
pub struct HistoricalPrice {
    pub timestamp: i64,
    pub price: f64,
    pub currency: String,
}

/// Result of historical price backfill
#[derive(Debug, Serialize)]
pub struct BackfillProgress {
    pub days_processed: i32,
    pub total_days: i32,
    pub completed: bool,
}

/// Get historical stock prices from Yahoo Finance for a date range
/// Returns a map of ticker -> (date_timestamp -> price)
/// Uses batched requests with throttling to avoid rate limits
pub async fn get_historical_stock_prices_yahoo(
    tickers: &[String],
    start_timestamp: i64,
    end_timestamp: i64,
) -> Result<HashMap<String, Vec<HistoricalPrice>>> {
    use yahoo_finance_api as yahoo;

    if tickers.is_empty() {
        return Ok(HashMap::new());
    }

    let mut results: HashMap<String, Vec<HistoricalPrice>> = HashMap::new();

    println!(
        "[YAHOO HISTORICAL] Fetching historical prices for {} tickers from {} to {}",
        tickers.len(),
        start_timestamp,
        end_timestamp
    );

    // Create Yahoo connector
    let provider = yahoo::YahooConnector::new()
        .map_err(|e| AppError::ExternalApi(format!("Yahoo connector failed: {}", e)))?;

    // Convert timestamps to time::OffsetDateTime
    let start = time::OffsetDateTime::from_unix_timestamp(start_timestamp)
        .unwrap_or(time::OffsetDateTime::now_utc());
    let end = time::OffsetDateTime::from_unix_timestamp(end_timestamp)
        .unwrap_or(time::OffsetDateTime::now_utc());

    // Process in batches of 5 with 500ms delay between batches
    for (batch_idx, chunk) in tickers.chunks(5).enumerate() {
        if batch_idx > 0 {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        }

        for ticker in chunk {
            match provider.get_quote_history(ticker, start, end).await {
                Ok(response) => {
                    // quotes() returns a Result, not an Option
                    match response.quotes() {
                        Ok(quotes) => {
                            let currency = get_currency_from_ticker(ticker).to_string();
                            let prices: Vec<HistoricalPrice> = quotes
                                .iter()
                                .map(|q| HistoricalPrice {
                                    timestamp: q.timestamp as i64,
                                    price: q.close,
                                    currency: currency.clone(),
                                })
                                .collect();

                            if !prices.is_empty() {
                                println!(
                                    "[YAHOO HISTORICAL] {} - got {} historical prices",
                                    ticker,
                                    prices.len()
                                );
                                results.insert(ticker.clone(), prices);
                            }
                        }
                        Err(e) => {
                            println!("[YAHOO HISTORICAL] {} - no quotes: {}", ticker, e);
                        }
                    }
                }
                Err(e) => {
                    println!("[YAHOO HISTORICAL] {} - error: {}", ticker, e);
                }
            }
        }
    }

    println!(
        "[YAHOO HISTORICAL] Fetched historical data for {} tickers",
        results.len()
    );

    Ok(results)
}

/// Get historical crypto prices from CoinGecko for a specific date
/// CoinGecko's /history endpoint returns price for a specific date
pub async fn get_historical_crypto_price_coingecko(
    api_key: Option<&str>,
    coingecko_id: &str,
    date: &str, // Format: "dd-mm-yyyy"
) -> Result<Option<f64>> {
    let url = format!(
        "https://api.coingecko.com/api/v3/coins/{}/history?date={}&localization=false",
        coingecko_id, date
    );

    let client = reqwest::Client::new();
    let mut request = client.get(&url);

    if let Some(key) = api_key {
        if !key.is_empty() {
            request = request.header("x-cg-demo-api-key", key);
        }
    }

    let response = request.send().await.map_err(|e| {
        AppError::ExternalApi(format!("CoinGecko historical request failed: {}", e))
    })?;

    if !response.status().is_success() {
        return Ok(None);
    }

    #[derive(Deserialize)]
    struct MarketData {
        current_price: Option<HashMap<String, f64>>,
    }

    #[derive(Deserialize)]
    struct HistoryResponse {
        market_data: Option<MarketData>,
    }

    let data: HistoryResponse = response
        .json()
        .await
        .map_err(|e| AppError::ExternalApi(format!("CoinGecko historical parse error: {}", e)))?;

    if let Some(market_data) = data.market_data {
        if let Some(prices) = market_data.current_price {
            return Ok(prices.get("usd").copied());
        }
    }

    Ok(None)
}

/// Get historical crypto prices for multiple coins over a date range
/// Uses CoinGecko's market_chart/range endpoint which is more efficient
pub async fn get_historical_crypto_prices_coingecko(
    api_key: Option<&str>,
    id_to_ticker: &HashMap<String, String>,
    start_timestamp: i64,
    end_timestamp: i64,
) -> Result<HashMap<String, Vec<HistoricalPrice>>> {
    if id_to_ticker.is_empty() {
        return Ok(HashMap::new());
    }

    let mut results: HashMap<String, Vec<HistoricalPrice>> = HashMap::new();

    println!(
        "[COINGECKO HISTORICAL] Fetching historical prices for {} cryptos",
        id_to_ticker.len()
    );

    let client = reqwest::Client::new();

    // Process each crypto with a small delay to avoid rate limits
    for (idx, (coingecko_id, ticker)) in id_to_ticker.iter().enumerate() {
        if idx > 0 {
            tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
        }

        let url = format!(
            "https://api.coingecko.com/api/v3/coins/{}/market_chart/range?vs_currency=usd&from={}&to={}",
            coingecko_id, start_timestamp, end_timestamp
        );

        let mut request = client.get(&url);

        if let Some(key) = api_key {
            if !key.is_empty() {
                request = request.header("x-cg-demo-api-key", key);
            }
        }

        match request.send().await {
            Ok(response) => {
                if response.status().is_success() {
                    #[derive(Deserialize)]
                    struct RangeResponse {
                        prices: Option<Vec<(f64, f64)>>, // [[timestamp_ms, price], ...]
                    }

                    if let Ok(data) = response.json::<RangeResponse>().await {
                        if let Some(prices) = data.prices {
                            // Convert to daily prices (CoinGecko returns hourly for short ranges)
                            // Group by day and take the last price for each day
                            let mut daily_prices: HashMap<i64, f64> = HashMap::new();
                            for (ts_ms, price) in prices {
                                let ts = (ts_ms / 1000.0) as i64;
                                // Round to start of day (UTC)
                                let day_start = (ts / 86400) * 86400;
                                daily_prices.insert(day_start, price);
                            }

                            let historical: Vec<HistoricalPrice> = daily_prices
                                .into_iter()
                                .map(|(ts, price)| HistoricalPrice {
                                    timestamp: ts,
                                    price,
                                    currency: "USD".to_string(),
                                })
                                .collect();

                            if !historical.is_empty() {
                                println!(
                                    "[COINGECKO HISTORICAL] {} - got {} daily prices",
                                    ticker,
                                    historical.len()
                                );
                                results.insert(ticker.clone(), historical);
                            }
                        }
                    }
                } else {
                    println!(
                        "[COINGECKO HISTORICAL] {} - HTTP error: {}",
                        ticker,
                        response.status()
                    );
                }
            }
            Err(e) => {
                println!("[COINGECKO HISTORICAL] {} - error: {}", ticker, e);
            }
        }
    }

    println!(
        "[COINGECKO HISTORICAL] Fetched historical data for {} cryptos",
        results.len()
    );

    Ok(results)
}

// ============================================================================
// API Key Storage
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct ApiKeys {
    pub marketstack: Option<String>,
    pub finnhub: Option<String>,
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

        let finnhub: Option<String> = conn
            .query_row(
                "SELECT value FROM app_config WHERE key = 'api_key_finnhub'",
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
            finnhub,
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

        if let Some(ref key) = keys.finnhub {
            conn.execute(
                "INSERT INTO app_config (key, value) VALUES ('api_key_finnhub', ?1)
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
