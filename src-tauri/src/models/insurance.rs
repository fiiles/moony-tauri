//! Insurance policy models

use serde::{Deserialize, Serialize};

/// Insurance limit
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsuranceLimit {
    pub title: String,
    pub amount: f64,
    pub currency: String,
}

/// Insurance policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsurancePolicy {
    pub id: String,
    #[serde(rename = "type")]
    pub policy_type: String,
    pub provider: String,
    #[serde(rename = "policyName")]
    pub policy_name: String,
    #[serde(rename = "policyNumber")]
    pub policy_number: String,
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
#[derive(Debug, Clone, Deserialize)]
pub struct InsertInsurancePolicy {
    #[serde(rename = "type")]
    pub policy_type: String,
    pub provider: String,
    #[serde(rename = "policyName")]
    pub policy_name: String,
    #[serde(rename = "policyNumber")]
    pub policy_number: String,
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
