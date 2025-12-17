//! Savings account models

use serde::{Deserialize, Serialize};

/// Savings account
#[derive(Debug, Clone, Serialize, Deserialize)]
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
}

/// Data for creating/updating savings account
#[derive(Debug, Clone, Deserialize)]
pub struct InsertSavingsAccount {
    pub name: String,
    pub balance: String,
    pub currency: Option<String>,
    #[serde(rename = "interestRate")]
    pub interest_rate: Option<String>,
    #[serde(rename = "hasZoneDesignation")]
    pub has_zone_designation: Option<bool>,
}

/// Interest rate zone for tiered accounts
#[derive(Debug, Clone, Serialize, Deserialize)]
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
