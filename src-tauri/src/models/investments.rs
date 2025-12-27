//! Stock investment models

use serde::{Deserialize, Serialize};

/// Stock investment holding
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockInvestment {
    pub id: String,
    pub ticker: String,
    #[serde(rename = "companyName")]
    pub company_name: String,
    pub quantity: String,
    #[serde(rename = "averagePrice")]
    pub average_price: String,
}

/// Enriched investment with current price data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrichedStockInvestment {
    pub id: String,
    pub ticker: String,
    #[serde(rename = "companyName")]
    pub company_name: String,
    pub quantity: String,
    #[serde(rename = "averagePrice")]
    pub average_price: String,
    #[serde(rename = "currentPrice")]
    pub current_price: String,
    /// Original price in its source currency (before conversion to CZK)
    #[serde(rename = "originalPrice")]
    pub original_price: String,
    /// Currency of the original price (e.g., USD, EUR)
    pub currency: String,
    #[serde(rename = "fetchedAt")]
    pub fetched_at: Option<i64>,
    #[serde(rename = "isManualPrice")]
    pub is_manual_price: bool,
    #[serde(rename = "dividendYield")]
    pub dividend_yield: f64,
    /// Original dividend amount before conversion
    #[serde(rename = "originalDividendYield")]
    pub original_dividend_yield: f64,
    #[serde(rename = "dividendCurrency")]
    pub dividend_currency: String,
    #[serde(rename = "isManualDividend")]
    pub is_manual_dividend: bool,
}

/// Data for creating stock investment
#[derive(Debug, Clone, Deserialize)]
pub struct InsertStockInvestment {
    pub ticker: String,
    #[serde(rename = "companyName")]
    pub company_name: String,
    pub quantity: Option<String>,
    #[serde(rename = "averagePrice")]
    pub average_price: Option<String>,
}

/// Investment transaction (buy/sell)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvestmentTransaction {
    pub id: String,
    #[serde(rename = "investmentId")]
    pub investment_id: String,
    #[serde(rename = "type")]
    pub tx_type: String,
    pub ticker: String,
    #[serde(rename = "companyName")]
    pub company_name: String,
    pub quantity: String,
    #[serde(rename = "pricePerUnit")]
    pub price_per_unit: String,
    pub currency: String,
    #[serde(rename = "transactionDate")]
    pub transaction_date: i64,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

/// Data for creating transaction
#[derive(Debug, Clone, Deserialize)]
pub struct InsertInvestmentTransaction {
    #[serde(rename = "investmentId")]
    pub investment_id: Option<String>,
    #[serde(rename = "type")]
    pub tx_type: String,
    pub ticker: String,
    #[serde(rename = "companyName")]
    pub company_name: String,
    pub quantity: String,
    #[serde(rename = "pricePerUnit")]
    pub price_per_unit: String,
    pub currency: String,
    #[serde(rename = "transactionDate")]
    pub transaction_date: i64,
}

/// Stock data cache (price + Yahoo Finance metadata)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockData {
    pub id: String,
    pub ticker: String,
    #[serde(rename = "originalPrice")]
    pub original_price: String,
    pub currency: String,
    #[serde(rename = "priceDate")]
    pub price_date: i64,
    #[serde(rename = "fetchedAt")]
    pub fetched_at: i64,
    // Metadata fields
    #[serde(rename = "shortName")]
    pub short_name: Option<String>,
    #[serde(rename = "longName")]
    pub long_name: Option<String>,
    pub sector: Option<String>,
    pub industry: Option<String>,
    #[serde(rename = "peRatio")]
    pub pe_ratio: Option<String>,
    #[serde(rename = "forwardPe")]
    pub forward_pe: Option<String>,
    #[serde(rename = "marketCap")]
    pub market_cap: Option<String>,
    pub beta: Option<String>,
    #[serde(rename = "fiftyTwoWeekHigh")]
    pub fifty_two_week_high: Option<String>,
    #[serde(rename = "fiftyTwoWeekLow")]
    pub fifty_two_week_low: Option<String>,
    #[serde(rename = "trailingDividendRate")]
    pub trailing_dividend_rate: Option<String>,
    #[serde(rename = "trailingDividendYield")]
    pub trailing_dividend_yield: Option<String>,
    #[serde(rename = "exDividendDate")]
    pub ex_dividend_date: Option<i64>,
    pub description: Option<String>,
    pub exchange: Option<String>,
    #[serde(rename = "quoteType")]
    pub quote_type: Option<String>,
    #[serde(rename = "metadataFetchedAt")]
    pub metadata_fetched_at: Option<i64>,
}

/// User price override
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockPriceOverride {
    pub id: String,
    pub ticker: String,
    pub price: String,
    pub currency: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// Dividend data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DividendData {
    pub id: String,
    pub ticker: String,
    #[serde(rename = "yearlyDividendSum")]
    pub yearly_dividend_sum: String,
    pub currency: String,
    #[serde(rename = "lastFetchedAt")]
    pub last_fetched_at: i64,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

/// User dividend override
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DividendOverride {
    pub id: String,
    pub ticker: String,
    #[serde(rename = "yearlyDividendSum")]
    pub yearly_dividend_sum: String,
    pub currency: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}
