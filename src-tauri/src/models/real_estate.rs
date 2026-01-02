//! Real estate models

use serde::{Deserialize, Serialize};
use specta::Type;

/// Recurring cost for real estate
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RecurringCost {
    pub name: String,
    pub amount: f64,
    pub frequency: String,
    pub currency: Option<String>,
}

/// Real estate property
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
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
#[derive(Debug, Clone, Deserialize, Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
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

/// Real estate document (attached contracts, deeds, etc.)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RealEstateDocument {
    pub id: String,
    #[serde(rename = "realEstateId")]
    pub real_estate_id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "fileType")]
    pub file_type: String,
    #[serde(rename = "fileSize")]
    pub file_size: Option<i64>,
    #[serde(rename = "uploadedAt")]
    pub uploaded_at: i64,
}

/// Data for creating real estate document
#[derive(Debug, Clone, Deserialize)]
pub struct InsertRealEstateDocument {
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "fileType")]
    pub file_type: Option<String>,
}

// Input validation at trust boundary
use crate::error::{AppError, Result};

impl InsertRealEstate {
    /// Validate input data at the trust boundary
    pub fn validate(&self) -> Result<()> {
        // Name validation
        if self.name.is_empty() {
            return Err(AppError::Validation("Property name cannot be empty".into()));
        }
        if self.name.len() > 100 {
            return Err(AppError::Validation(
                "Property name too long (max 100 characters)".into(),
            ));
        }

        // Address validation
        if self.address.is_empty() {
            return Err(AppError::Validation("Address cannot be empty".into()));
        }

        // Property type validation
        if self.property_type.is_empty() {
            return Err(AppError::Validation("Property type cannot be empty".into()));
        }

        // Purchase price validation (if provided)
        if let Some(ref price) = self.purchase_price {
            if !price.is_empty() {
                let price_val: f64 = price.parse().map_err(|_| {
                    AppError::Validation(format!("Invalid purchase price '{}'", price))
                })?;
                if price_val < 0.0 {
                    return Err(AppError::Validation(
                        "Purchase price cannot be negative".into(),
                    ));
                }
            }
        }

        // Market price validation (if provided)
        if let Some(ref price) = self.market_price {
            if !price.is_empty() {
                let price_val: f64 = price.parse().map_err(|_| {
                    AppError::Validation(format!("Invalid market price '{}'", price))
                })?;
                if price_val < 0.0 {
                    return Err(AppError::Validation(
                        "Market price cannot be negative".into(),
                    ));
                }
            }
        }

        // Monthly rent validation (if provided)
        if let Some(ref rent) = self.monthly_rent {
            if !rent.is_empty() {
                let rent_val: f64 = rent.parse().map_err(|_| {
                    AppError::Validation(format!("Invalid monthly rent '{}'", rent))
                })?;
                if rent_val < 0.0 {
                    return Err(AppError::Validation(
                        "Monthly rent cannot be negative".into(),
                    ));
                }
            }
        }

        // Currency validations (if provided)
        if let Some(ref currency) = self.purchase_price_currency {
            if currency.len() != 3 {
                return Err(AppError::Validation(
                    "Purchase price currency must be 3 letters".into(),
                ));
            }
        }
        if let Some(ref currency) = self.market_price_currency {
            if currency.len() != 3 {
                return Err(AppError::Validation(
                    "Market price currency must be 3 letters".into(),
                ));
            }
        }

        Ok(())
    }
}

impl InsertRealEstateOneTimeCost {
    /// Validate input data at the trust boundary
    pub fn validate(&self) -> Result<()> {
        // Real estate ID validation
        if self.real_estate_id.is_empty() {
            return Err(AppError::Validation(
                "Real estate ID cannot be empty".into(),
            ));
        }

        // Name validation
        if self.name.is_empty() {
            return Err(AppError::Validation("Cost name cannot be empty".into()));
        }

        // Amount validation
        if self.amount.is_empty() {
            return Err(AppError::Validation("Amount cannot be empty".into()));
        }
        let amount: f64 = self
            .amount
            .parse()
            .map_err(|_| AppError::Validation(format!("Invalid amount '{}'", self.amount)))?;
        if amount < 0.0 {
            return Err(AppError::Validation("Amount cannot be negative".into()));
        }

        // Currency validation (if provided)
        if let Some(ref currency) = self.currency {
            if currency.len() != 3 {
                return Err(AppError::Validation(
                    "Currency must be 3 letters (e.g., USD, EUR)".into(),
                ));
            }
        }

        Ok(())
    }
}

impl InsertRealEstateDocument {
    /// Validate input data at the trust boundary
    pub fn validate(&self) -> Result<()> {
        // Name validation
        if self.name.is_empty() {
            return Err(AppError::Validation("Document name cannot be empty".into()));
        }
        if self.name.len() > 200 {
            return Err(AppError::Validation(
                "Document name too long (max 200 characters)".into(),
            ));
        }

        Ok(())
    }
}
