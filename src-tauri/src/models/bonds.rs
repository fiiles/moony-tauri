//! Bond models

use serde::{Deserialize, Serialize};
use specta::Type;

/// Bond holding
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Bond {
    pub id: String,
    pub name: String,
    pub isin: String,
    #[serde(rename = "couponValue")]
    pub coupon_value: String,
    pub quantity: String,
    pub currency: String,
    #[serde(rename = "interestRate")]
    pub interest_rate: String,
    #[serde(rename = "maturityDate")]
    pub maturity_date: Option<i64>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// Data for creating/updating bond
#[derive(Debug, Clone, Deserialize, Type)]
pub struct InsertBond {
    pub name: String,
    pub isin: String,
    #[serde(rename = "couponValue")]
    pub coupon_value: String,
    pub quantity: Option<String>,
    pub currency: Option<String>,
    #[serde(rename = "interestRate")]
    pub interest_rate: Option<String>,
    #[serde(rename = "maturityDate")]
    pub maturity_date: Option<i64>,
}

// Input validation at trust boundary
use crate::error::{AppError, Result};

impl InsertBond {
    /// Validate input data at the trust boundary
    pub fn validate(&self) -> Result<()> {
        // Name validation
        if self.name.is_empty() {
            return Err(AppError::Validation("Bond name cannot be empty".into()));
        }
        if self.name.len() > 100 {
            return Err(AppError::Validation(
                "Bond name too long (max 100 characters)".into(),
            ));
        }

        // ISIN validation (12 characters: 2 letter country code + 9 alphanumeric + 1 check digit)
        if self.isin.is_empty() {
            return Err(AppError::Validation("ISIN cannot be empty".into()));
        }
        if self.isin.len() != 12 {
            return Err(AppError::Validation("ISIN must be 12 characters".into()));
        }

        // Coupon value validation
        if self.coupon_value.is_empty() {
            return Err(AppError::Validation("Coupon value cannot be empty".into()));
        }
        let coupon: f64 = self.coupon_value.parse().map_err(|_| {
            AppError::Validation(format!("Invalid coupon value '{}'", self.coupon_value))
        })?;
        if coupon < 0.0 {
            return Err(AppError::Validation(
                "Coupon value cannot be negative".into(),
            ));
        }

        // Quantity validation (if provided)
        if let Some(ref qty) = self.quantity {
            if !qty.is_empty() {
                let qty_val: f64 = qty
                    .parse()
                    .map_err(|_| AppError::Validation(format!("Invalid quantity '{}'", qty)))?;
                if qty_val <= 0.0 {
                    return Err(AppError::Validation("Quantity must be positive".into()));
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

        // Interest rate validation (if provided)
        if let Some(ref rate) = self.interest_rate {
            if !rate.is_empty() {
                let rate_val: f64 = rate.parse().map_err(|_| {
                    AppError::Validation(format!("Invalid interest rate '{}'", rate))
                })?;
                if !(0.0..=100.0).contains(&rate_val) {
                    return Err(AppError::Validation(
                        "Interest rate must be between 0 and 100".into(),
                    ));
                }
            }
        }

        Ok(())
    }
}
