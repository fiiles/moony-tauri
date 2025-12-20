//! Bond models

use serde::{Deserialize, Serialize};

/// Bond holding
#[derive(Debug, Clone, Serialize, Deserialize)]
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
#[derive(Debug, Clone, Deserialize)]
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
