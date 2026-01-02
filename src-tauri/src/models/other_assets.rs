//! Other assets models

use serde::{Deserialize, Serialize};
use specta::Type;

/// Other asset (commodities, collectibles, etc.)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
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
#[derive(Debug, Clone, Deserialize, Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
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
#[derive(Debug, Clone, Deserialize, Type)]
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

// Input validation at trust boundary
use crate::error::{AppError, Result};

impl InsertOtherAsset {
    /// Validate input data at the trust boundary
    pub fn validate(&self) -> Result<()> {
        // Name validation
        if self.name.is_empty() {
            return Err(AppError::Validation("Asset name cannot be empty".into()));
        }
        if self.name.len() > 100 {
            return Err(AppError::Validation(
                "Asset name too long (max 100 characters)".into(),
            ));
        }

        // Quantity validation (if provided)
        if let Some(ref qty) = self.quantity {
            if !qty.is_empty() {
                let qty_val: f64 = qty
                    .parse()
                    .map_err(|_| AppError::Validation(format!("Invalid quantity '{}'", qty)))?;
                if qty_val < 0.0 {
                    return Err(AppError::Validation("Quantity cannot be negative".into()));
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

        // Average purchase price validation (if provided)
        if let Some(ref price) = self.average_purchase_price {
            if !price.is_empty() {
                let price_val: f64 = price.parse().map_err(|_| {
                    AppError::Validation(format!("Invalid average purchase price '{}'", price))
                })?;
                if price_val < 0.0 {
                    return Err(AppError::Validation(
                        "Average purchase price cannot be negative".into(),
                    ));
                }
            }
        }

        // Currency validation (if provided)
        if let Some(ref currency) = self.currency {
            if currency.len() != 3 {
                return Err(AppError::Validation(
                    "Currency must be 3 letters (e.g., USD, EUR)".into(),
                ));
            }
        }

        // Yield type validation (if provided)
        if let Some(ref yield_type) = self.yield_type {
            let valid_types = ["none", "percentage", "fixed"];
            if !valid_types.contains(&yield_type.to_lowercase().as_str()) {
                return Err(AppError::Validation(format!(
                    "Invalid yield type '{}' (must be none, percentage, or fixed)",
                    yield_type
                )));
            }
        }

        // Yield value validation (if provided)
        if let Some(ref yield_val) = self.yield_value {
            if !yield_val.is_empty() {
                let yv: f64 = yield_val.parse().map_err(|_| {
                    AppError::Validation(format!("Invalid yield value '{}'", yield_val))
                })?;
                if yv < 0.0 {
                    return Err(AppError::Validation(
                        "Yield value cannot be negative".into(),
                    ));
                }
            }
        }

        Ok(())
    }
}

impl InsertOtherAssetTransaction {
    /// Validate input data at the trust boundary
    pub fn validate(&self) -> Result<()> {
        // Transaction type validation
        let tx_type = self.tx_type.to_lowercase();
        if tx_type != "buy" && tx_type != "sell" {
            return Err(AppError::Validation(format!(
                "Invalid transaction type '{}' (must be 'buy' or 'sell')",
                self.tx_type
            )));
        }

        // Quantity validation
        let qty: f64 = self
            .quantity
            .parse()
            .map_err(|_| AppError::Validation(format!("Invalid quantity '{}'", self.quantity)))?;
        if qty <= 0.0 {
            return Err(AppError::Validation("Quantity must be positive".into()));
        }

        // Price validation
        let price: f64 = self.price_per_unit.parse().map_err(|_| {
            AppError::Validation(format!("Invalid price '{}'", self.price_per_unit))
        })?;
        if price <= 0.0 {
            return Err(AppError::Validation("Price must be positive".into()));
        }

        // Currency validation
        if self.currency.len() != 3 {
            return Err(AppError::Validation(
                "Currency must be 3 letters (e.g., USD, EUR)".into(),
            ));
        }
        if !self.currency.chars().all(|c| c.is_ascii_alphabetic()) {
            return Err(AppError::Validation(
                "Currency must contain only letters".into(),
            ));
        }

        Ok(())
    }
}
