//! Cryptocurrency models

use serde::{Deserialize, Serialize};

/// Crypto investment holding
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CryptoInvestment {
    pub id: String,
    pub ticker: String,
    #[serde(rename = "coingeckoId")]
    pub coingecko_id: String,
    pub name: String,
    pub quantity: String,
    #[serde(rename = "averagePrice")]
    pub average_price: String,
}

/// Enriched crypto with current price
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrichedCryptoInvestment {
    pub id: String,
    pub ticker: String,
    #[serde(rename = "coingeckoId")]
    pub coingecko_id: String,
    pub name: String,
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
}

/// Data for creating crypto investment
#[derive(Debug, Clone, Deserialize)]
pub struct InsertCryptoInvestment {
    pub ticker: String,
    #[serde(rename = "coingeckoId")]
    pub coingecko_id: String,
    pub name: String,
    pub quantity: Option<String>,
    #[serde(rename = "averagePrice")]
    pub average_price: Option<String>,
}

/// Crypto transaction (buy/sell)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CryptoTransaction {
    pub id: String,
    #[serde(rename = "investmentId")]
    pub investment_id: String,
    #[serde(rename = "type")]
    pub tx_type: String,
    pub ticker: String,
    pub name: String,
    pub quantity: String,
    #[serde(rename = "pricePerUnit")]
    pub price_per_unit: String,
    pub currency: String,
    #[serde(rename = "transactionDate")]
    pub transaction_date: i64,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

/// Data for creating crypto transaction
#[derive(Debug, Clone, Deserialize)]
pub struct InsertCryptoTransaction {
    #[serde(rename = "investmentId")]
    pub investment_id: Option<String>,
    #[serde(rename = "type")]
    pub tx_type: String,
    pub ticker: String,
    pub name: String,
    pub quantity: String,
    #[serde(rename = "pricePerUnit")]
    pub price_per_unit: String,
    pub currency: String,
    #[serde(rename = "transactionDate")]
    pub transaction_date: i64,
}

/// Crypto price cache
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CryptoPrice {
    pub id: String,
    pub symbol: String,
    #[serde(rename = "coingeckoId")]
    pub coingecko_id: Option<String>,
    pub price: String,
    pub currency: String,
    #[serde(rename = "fetchedAt")]
    pub fetched_at: i64,
}
