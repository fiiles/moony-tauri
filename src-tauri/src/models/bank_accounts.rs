//! Bank account models for managing bank accounts and their transactions

use serde::{Deserialize, Serialize};

/// Bank account types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum AccountType {
    #[default]
    Checking,
    Savings,
    CreditCard,
    Investment,
}

impl std::fmt::Display for AccountType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AccountType::Checking => write!(f, "checking"),
            AccountType::Savings => write!(f, "savings"),
            AccountType::CreditCard => write!(f, "credit_card"),
            AccountType::Investment => write!(f, "investment"),
        }
    }
}

impl std::str::FromStr for AccountType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "checking" => Ok(AccountType::Checking),
            "savings" => Ok(AccountType::Savings),
            "credit_card" => Ok(AccountType::CreditCard),
            "investment" => Ok(AccountType::Investment),
            _ => Err(format!("Unknown account type: {}", s)),
        }
    }
}

/// Data source for accounts and transactions
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum DataSource {
    #[default]
    Manual,
    CsvImport,
    ApiSync,
}

impl std::fmt::Display for DataSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DataSource::Manual => write!(f, "manual"),
            DataSource::CsvImport => write!(f, "csv_import"),
            DataSource::ApiSync => write!(f, "api_sync"),
        }
    }
}

impl std::str::FromStr for DataSource {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "manual" => Ok(DataSource::Manual),
            "csv_import" => Ok(DataSource::CsvImport),
            "api_sync" => Ok(DataSource::ApiSync),
            _ => Err(format!("Unknown data source: {}", s)),
        }
    }
}

/// Bank account entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BankAccount {
    pub id: String,
    pub name: String,
    #[serde(rename = "accountType")]
    pub account_type: String,
    pub iban: Option<String>,
    pub bban: Option<String>,
    pub currency: String,
    pub balance: String,
    #[serde(rename = "institutionId")]
    pub institution_id: Option<String>,
    #[serde(rename = "externalAccountId")]
    pub external_account_id: Option<String>,
    #[serde(rename = "dataSource")]
    pub data_source: String,
    #[serde(rename = "lastSyncedAt")]
    pub last_synced_at: Option<i64>,
    // Savings-specific fields
    #[serde(rename = "interestRate")]
    pub interest_rate: Option<String>,
    #[serde(rename = "hasZoneDesignation")]
    pub has_zone_designation: bool,
    #[serde(rename = "terminationDate")]
    pub termination_date: Option<i64>,
    /// Exclude from portfolio balance (for operational/checking accounts)
    #[serde(rename = "excludeFromBalance")]
    pub exclude_from_balance: bool,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// Data for creating/updating a bank account
#[derive(Debug, Clone, Deserialize)]
pub struct InsertBankAccount {
    pub name: String,
    #[serde(rename = "accountType")]
    pub account_type: Option<String>,
    pub iban: Option<String>,
    pub bban: Option<String>,
    pub currency: Option<String>,
    pub balance: Option<String>,
    #[serde(rename = "institutionId")]
    pub institution_id: Option<String>,
    #[serde(rename = "interestRate")]
    pub interest_rate: Option<String>,
    #[serde(rename = "hasZoneDesignation")]
    pub has_zone_designation: Option<bool>,
    #[serde(rename = "terminationDate")]
    pub termination_date: Option<i64>,
    /// Exclude from portfolio balance (for operational/checking accounts)
    #[serde(rename = "excludeFromBalance")]
    pub exclude_from_balance: Option<bool>,
}

/// Financial institution (bank)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Institution {
    pub id: String,
    pub name: String,
    pub bic: Option<String>,
    pub country: Option<String>,
    #[serde(rename = "logoUrl")]
    pub logo_url: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

/// Data for creating an institution
#[derive(Debug, Clone, Deserialize)]
pub struct InsertInstitution {
    pub name: String,
    pub bic: Option<String>,
    pub country: Option<String>,
    #[serde(rename = "logoUrl")]
    pub logo_url: Option<String>,
}

/// Bank account with institution data (enriched)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BankAccountWithInstitution {
    #[serde(flatten)]
    pub account: BankAccount,
    pub institution: Option<Institution>,
    // Computed fields for savings accounts
    #[serde(rename = "effectiveInterestRate")]
    pub effective_interest_rate: Option<f64>,
    #[serde(rename = "projectedEarnings")]
    pub projected_earnings: Option<f64>,
}
