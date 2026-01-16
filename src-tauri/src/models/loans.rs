//! Loan models

use serde::{Deserialize, Serialize};
use specta::Type;

/// Loan
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Loan {
    pub id: String,
    pub name: String,
    pub principal: String,
    pub currency: String,
    #[serde(rename = "interestRate")]
    pub interest_rate: String,
    #[serde(rename = "interestRateValidityDate")]
    pub interest_rate_validity_date: Option<i64>,
    #[serde(rename = "monthlyPayment")]
    pub monthly_payment: String,
    #[serde(rename = "startDate")]
    pub start_date: i64,
    #[serde(rename = "endDate")]
    pub end_date: Option<i64>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// Data for creating/updating loan
#[derive(Debug, Clone, Deserialize, Type)]
pub struct InsertLoan {
    pub name: String,
    pub principal: String,
    pub currency: Option<String>,
    #[serde(rename = "interestRate")]
    pub interest_rate: Option<String>,
    #[serde(rename = "interestRateValidityDate")]
    pub interest_rate_validity_date: Option<i64>,
    #[serde(rename = "monthlyPayment")]
    pub monthly_payment: Option<String>,
    #[serde(rename = "startDate")]
    pub start_date: Option<i64>,
    #[serde(rename = "endDate")]
    pub end_date: Option<i64>,
}

// Input validation at trust boundary
use crate::error::{AppError, Result};

impl InsertLoan {
    /// Validate input data at the trust boundary
    pub fn validate(&self) -> Result<()> {
        // Name validation
        if self.name.is_empty() {
            return Err(AppError::Validation("validation.loanNameRequired".into()));
        }
        if self.name.len() > 100 {
            return Err(AppError::Validation("validation.loanNameRequired".into()));
        }

        // Principal validation
        if self.principal.is_empty() {
            return Err(AppError::Validation("validation.principalPositive".into()));
        }
        let principal: f64 = self
            .principal
            .parse()
            .map_err(|_| AppError::Validation("validation.invalidAmount".into()))?;
        if principal <= 0.0 {
            return Err(AppError::Validation("validation.principalPositive".into()));
        }

        // Currency validation (if provided)
        if let Some(ref currency) = self.currency {
            if currency.len() != 3 {
                return Err(AppError::Validation("validation.currencyInvalid".into()));
            }
        }

        // Interest rate validation (if provided)
        if let Some(ref rate) = self.interest_rate {
            if !rate.is_empty() {
                let rate_val: f64 = rate
                    .parse()
                    .map_err(|_| AppError::Validation("validation.interestRatePositive".into()))?;
                if !(0.0..=100.0).contains(&rate_val) {
                    return Err(AppError::Validation(
                        "validation.interestRatePositive".into(),
                    ));
                }
            }
        }

        // Monthly payment validation (if provided)
        if let Some(ref payment) = self.monthly_payment {
            if !payment.is_empty() {
                let payment_val: f64 = payment
                    .parse()
                    .map_err(|_| AppError::Validation("validation.invalidAmount".into()))?;
                if payment_val < 0.0 {
                    return Err(AppError::Validation(
                        "validation.monthlyPaymentPositive".into(),
                    ));
                }
            }
        }

        // Date validation
        if let (Some(start), Some(end)) = (self.start_date, self.end_date) {
            if end <= start {
                return Err(AppError::Validation("validation.endDateAfterStart".into()));
            }
        }

        Ok(())
    }
}
