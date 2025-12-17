//! Loan models

use serde::{Deserialize, Serialize};

/// Loan
#[derive(Debug, Clone, Serialize, Deserialize)]
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
#[derive(Debug, Clone, Deserialize)]
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
