//! Insurance policy models

use serde::{Deserialize, Serialize};
use specta::Type;

/// Insurance limit
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct InsuranceLimit {
    pub title: String,
    pub amount: f64,
    pub currency: String,
}

/// Insurance policy
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct InsurancePolicy {
    pub id: String,
    #[serde(rename = "type")]
    pub policy_type: String,
    pub provider: String,
    #[serde(rename = "policyName")]
    pub policy_name: String,
    #[serde(rename = "policyNumber")]
    pub policy_number: Option<String>,
    #[serde(rename = "startDate")]
    pub start_date: i64,
    #[serde(rename = "endDate")]
    pub end_date: Option<i64>,
    #[serde(rename = "paymentFrequency")]
    pub payment_frequency: String,
    #[serde(rename = "oneTimePayment")]
    pub one_time_payment: Option<String>,
    #[serde(rename = "oneTimePaymentCurrency")]
    pub one_time_payment_currency: Option<String>,
    #[serde(rename = "regularPayment")]
    pub regular_payment: String,
    #[serde(rename = "regularPaymentCurrency")]
    pub regular_payment_currency: String,
    pub limits: Vec<InsuranceLimit>,
    pub notes: Option<String>,
    pub status: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// Data for creating/updating insurance policy
#[derive(Debug, Clone, Deserialize, Type)]
pub struct InsertInsurancePolicy {
    #[serde(rename = "type")]
    pub policy_type: String,
    pub provider: String,
    #[serde(rename = "policyName")]
    pub policy_name: String,
    #[serde(rename = "policyNumber")]
    pub policy_number: Option<String>,
    #[serde(rename = "startDate")]
    pub start_date: i64,
    #[serde(rename = "endDate")]
    pub end_date: Option<i64>,
    #[serde(rename = "paymentFrequency")]
    pub payment_frequency: String,
    #[serde(rename = "oneTimePayment")]
    pub one_time_payment: Option<String>,
    #[serde(rename = "oneTimePaymentCurrency")]
    pub one_time_payment_currency: Option<String>,
    #[serde(rename = "regularPayment")]
    pub regular_payment: Option<String>,
    #[serde(rename = "regularPaymentCurrency")]
    pub regular_payment_currency: Option<String>,
    pub limits: Option<Vec<InsuranceLimit>>,
    pub notes: Option<String>,
    pub status: Option<String>,
}

/// Insurance document (attached contracts, certificates, etc.)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct InsuranceDocument {
    pub id: String,
    #[serde(rename = "insuranceId")]
    pub insurance_id: String,
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

/// Data for creating insurance document
#[derive(Debug, Clone, Deserialize)]
pub struct InsertInsuranceDocument {
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "fileType")]
    pub file_type: Option<String>,
}

// Input validation at trust boundary
use crate::error::{AppError, Result};

impl InsertInsurancePolicy {
    /// Validate input data at the trust boundary
    pub fn validate(&self) -> Result<()> {
        // Policy type validation
        if self.policy_type.is_empty() {
            return Err(AppError::Validation(
                "validation.insuranceTypeRequired".into(),
            ));
        }

        // Provider validation
        if self.provider.is_empty() {
            return Err(AppError::Validation("validation.providerRequired".into()));
        }
        if self.provider.len() > 100 {
            return Err(AppError::Validation("validation.nameTooLong".into()));
        }

        // Policy name validation
        if self.policy_name.is_empty() {
            return Err(AppError::Validation("validation.policyNameRequired".into()));
        }

        // Payment frequency validation
        let valid_frequencies = [
            "monthly",
            "quarterly",
            "semi_annually",
            "annually",
            "one_time",
        ];
        if !valid_frequencies.contains(&self.payment_frequency.to_lowercase().as_str()) {
            return Err(AppError::Validation(
                "validation.paymentFrequencyInvalid".into(),
            ));
        }

        // Regular payment validation (if provided)
        if let Some(ref payment) = self.regular_payment {
            if !payment.is_empty() {
                let payment_val: f64 = payment
                    .parse()
                    .map_err(|_| AppError::Validation("validation.invalidAmount".into()))?;
                if payment_val < 0.0 {
                    return Err(AppError::Validation("validation.paymentNonNegative".into()));
                }
            }
        }

        // One-time payment validation (if provided)
        if let Some(ref payment) = self.one_time_payment {
            if !payment.is_empty() {
                let payment_val: f64 = payment
                    .parse()
                    .map_err(|_| AppError::Validation("validation.invalidAmount".into()))?;
                if payment_val < 0.0 {
                    return Err(AppError::Validation("validation.paymentNonNegative".into()));
                }
            }
        }

        // Currency validations
        if let Some(ref currency) = self.regular_payment_currency {
            if currency.len() != 3 {
                return Err(AppError::Validation("validation.currencyInvalid".into()));
            }
        }
        if let Some(ref currency) = self.one_time_payment_currency {
            if currency.len() != 3 {
                return Err(AppError::Validation("validation.currencyInvalid".into()));
            }
        }

        // Date validation
        if let Some(end) = self.end_date {
            if end <= self.start_date {
                return Err(AppError::Validation("validation.endDateAfterStart".into()));
            }
        }

        Ok(())
    }
}

impl InsertInsuranceDocument {
    /// Validate input data at the trust boundary
    pub fn validate(&self) -> Result<()> {
        // Name validation
        if self.name.is_empty() {
            return Err(AppError::Validation(
                "validation.documentNameRequired".into(),
            ));
        }
        if self.name.len() > 200 {
            return Err(AppError::Validation("validation.nameTooLong".into()));
        }

        Ok(())
    }
}
