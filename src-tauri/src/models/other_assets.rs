//! Other assets models

use serde::{Deserialize, Serialize};

/// Other asset (commodities, collectibles, etc.)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OtherAsset {
    pub id: String,
    pub name: String,
    pub quantity: String,
    #[serde(rename = "marketPrice")]
    pub market_price: String,
    pub currency: String,
    #[serde(rename = "averagePurchasePrice")]
    pub average_purchase_price: String,
    #[serde(rename = "yieldType")]
    pub yield_type: String,
    #[serde(rename = "yieldValue")]
    pub yield_value: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// Data for creating/updating other asset
#[derive(Debug, Clone, Deserialize)]
pub struct InsertOtherAsset {
    pub name: String,
    pub quantity: Option<String>,
    #[serde(rename = "marketPrice")]
    pub market_price: Option<String>,
    pub currency: Option<String>,
    #[serde(rename = "averagePurchasePrice")]
    pub average_purchase_price: Option<String>,
    #[serde(rename = "yieldType")]
    pub yield_type: Option<String>,
    #[serde(rename = "yieldValue")]
    pub yield_value: Option<String>,
}

/// Transaction for other asset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OtherAssetTransaction {
    pub id: String,
    #[serde(rename = "assetId")]
    pub asset_id: String,
    #[serde(rename = "type")]
    pub tx_type: String,
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
pub struct InsertOtherAssetTransaction {
    #[serde(rename = "assetId")]
    pub asset_id: Option<String>,
    #[serde(rename = "type")]
    pub tx_type: String,
    pub quantity: String,
    #[serde(rename = "pricePerUnit")]
    pub price_per_unit: String,
    pub currency: String,
    #[serde(rename = "transactionDate")]
    pub transaction_date: i64,
}
