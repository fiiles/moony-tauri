//! Savings account models

use serde::{Deserialize, Serialize};
use specta::Type;

/// Savings account
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SavingsAccount {
    pub id: String,
    pub name: String,
    pub balance: String,
    pub currency: String,
    #[serde(rename = "interestRate")]
    pub interest_rate: String,
    #[serde(rename = "hasZoneDesignation")]
    pub has_zone_designation: bool,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    #[serde(
        rename = "effectiveInterestRate",
        skip_serializing_if = "Option::is_none"
    )]
    pub effective_interest_rate: Option<f64>,
    #[serde(rename = "projectedEarnings", skip_serializing_if = "Option::is_none")]
    pub projected_earnings: Option<f64>,
    #[serde(rename = "terminationDate", skip_serializing_if = "Option::is_none")]
    pub termination_date: Option<i64>,
}

/// Data for creating/updating savings account
#[derive(Debug, Clone, Deserialize, Type)]
pub struct InsertSavingsAccount {
    pub name: String,
    pub balance: String,
    pub currency: Option<String>,
    #[serde(rename = "interestRate")]
    pub interest_rate: Option<String>,
    #[serde(rename = "hasZoneDesignation")]
    pub has_zone_designation: Option<bool>,
    #[serde(rename = "terminationDate")]
    pub termination_date: Option<i64>,
}

/// Interest rate zone for tiered accounts
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SavingsAccountZone {
    pub id: String,
    #[serde(rename = "savingsAccountId")]
    pub savings_account_id: String,
    #[serde(rename = "fromAmount")]
    pub from_amount: String,
    #[serde(rename = "toAmount")]
    pub to_amount: Option<String>,
    #[serde(rename = "interestRate")]
    pub interest_rate: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

/// Data for creating/updating zone
#[derive(Debug, Clone, Deserialize)]
pub struct InsertSavingsAccountZone {
    #[serde(rename = "savingsAccountId")]
    pub savings_account_id: String,
    #[serde(rename = "fromAmount")]
    pub from_amount: String,
    #[serde(rename = "toAmount")]
    pub to_amount: Option<String>,
    #[serde(rename = "interestRate")]
    pub interest_rate: String,
}

// Input validation at trust boundary
use crate::error::{AppError, Result};

impl InsertSavingsAccount {
    /// Validate input data at the trust boundary
    pub fn validate(&self) -> Result<()> {
        // Name validation
        if self.name.is_empty() {
            return Err(AppError::Validation("Account name cannot be empty".into()));
        }
        if self.name.len() > 100 {
            return Err(AppError::Validation(
                "Account name too long (max 100 characters)".into(),
            ));
        }

        // Balance validation
        if self.balance.is_empty() {
            return Err(AppError::Validation("Balance cannot be empty".into()));
        }
        self.balance
            .parse::<f64>()
            .map_err(|_| AppError::Validation(format!("Invalid balance '{}'", self.balance)))?;

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

impl InsertSavingsAccountZone {
    /// Validate input data at the trust boundary
    pub fn validate(&self) -> Result<()> {
        // Savings account ID validation
        if self.savings_account_id.is_empty() {
            return Err(AppError::Validation(
                "Savings account ID cannot be empty".into(),
            ));
        }

        // From amount validation
        let from: f64 = self.from_amount.parse().map_err(|_| {
            AppError::Validation(format!("Invalid from amount '{}'", self.from_amount))
        })?;
        if from < 0.0 {
            return Err(AppError::Validation(
                "From amount cannot be negative".into(),
            ));
        }

        // To amount validation (if provided)
        if let Some(ref to_amount) = self.to_amount {
            if !to_amount.is_empty() {
                let to: f64 = to_amount.parse().map_err(|_| {
                    AppError::Validation(format!("Invalid to amount '{}'", to_amount))
                })?;
                if to <= from {
                    return Err(AppError::Validation(
                        "To amount must be greater than from amount".into(),
                    ));
                }
            }
        }

        // Interest rate validation
        let rate: f64 = self.interest_rate.parse().map_err(|_| {
            AppError::Validation(format!("Invalid interest rate '{}'", self.interest_rate))
        })?;
        if !(0.0..=100.0).contains(&rate) {
            return Err(AppError::Validation(
                "Interest rate must be between 0 and 100".into(),
            ));
        }

        Ok(())
    }
}
