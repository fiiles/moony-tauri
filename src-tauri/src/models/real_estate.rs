//! Real estate models

use serde::{Deserialize, Serialize};

/// Recurring cost for real estate
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecurringCost {
    pub name: String,
    pub amount: f64,
    pub frequency: String,
    pub currency: Option<String>,
}

/// Real estate property
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealEstate {
    pub id: String,
    pub name: String,
    pub address: String,
    #[serde(rename = "type")]
    pub property_type: String,
    #[serde(rename = "purchasePrice")]
    pub purchase_price: String,
    #[serde(rename = "purchasePriceCurrency")]
    pub purchase_price_currency: String,
    #[serde(rename = "marketPrice")]
    pub market_price: String,
    #[serde(rename = "marketPriceCurrency")]
    pub market_price_currency: String,
    #[serde(rename = "monthlyRent")]
    pub monthly_rent: Option<String>,
    #[serde(rename = "monthlyRentCurrency")]
    pub monthly_rent_currency: Option<String>,
    #[serde(rename = "recurringCosts")]
    pub recurring_costs: Vec<RecurringCost>,
    pub photos: Vec<String>,
    pub notes: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// Data for creating/updating real estate
#[derive(Debug, Clone, Deserialize)]
pub struct InsertRealEstate {
    pub name: String,
    pub address: String,
    #[serde(rename = "type")]
    pub property_type: String,
    #[serde(rename = "purchasePrice")]
    pub purchase_price: Option<String>,
    #[serde(rename = "purchasePriceCurrency")]
    pub purchase_price_currency: Option<String>,
    #[serde(rename = "marketPrice")]
    pub market_price: Option<String>,
    #[serde(rename = "marketPriceCurrency")]
    pub market_price_currency: Option<String>,
    #[serde(rename = "monthlyRent")]
    pub monthly_rent: Option<String>,
    #[serde(rename = "monthlyRentCurrency")]
    pub monthly_rent_currency: Option<String>,
    #[serde(rename = "recurringCosts")]
    pub recurring_costs: Option<Vec<RecurringCost>>,
    pub photos: Option<Vec<String>>,
    pub notes: Option<String>,
}

/// One-time cost for real estate
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealEstateOneTimeCost {
    pub id: String,
    #[serde(rename = "realEstateId")]
    pub real_estate_id: String,
    pub name: String,
    pub description: Option<String>,
    pub amount: String,
    pub currency: String,
    pub date: i64,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

/// Data for creating one-time cost
#[derive(Debug, Clone, Deserialize)]
pub struct InsertRealEstateOneTimeCost {
    #[serde(rename = "realEstateId")]
    pub real_estate_id: String,
    pub name: String,
    pub description: Option<String>,
    pub amount: String,
    pub currency: Option<String>,
    pub date: i64,
}

/// Photo batch (groups photos by date and description)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealEstatePhotoBatch {
    pub id: String,
    #[serde(rename = "realEstateId")]
    pub real_estate_id: String,
    #[serde(rename = "photoDate")]
    pub photo_date: i64,
    pub description: Option<String>,
    pub photos: Vec<RealEstatePhoto>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

/// Individual photo within a batch
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealEstatePhoto {
    pub id: String,
    #[serde(rename = "batchId")]
    pub batch_id: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "thumbnailPath")]
    pub thumbnail_path: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

/// Data for creating a photo batch
#[derive(Debug, Clone, Deserialize)]
pub struct InsertPhotoBatch {
    #[serde(rename = "photoDate")]
    pub photo_date: i64,
    pub description: Option<String>,
}

/// Data for updating a photo batch
#[derive(Debug, Clone, Deserialize)]
pub struct UpdatePhotoBatch {
    #[serde(rename = "photoDate")]
    pub photo_date: Option<i64>,
    pub description: Option<String>,
}
