//! Bank transaction models for tracking account transactions

use serde::{Deserialize, Serialize};

/// Transaction type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransactionType {
    Credit,
    Debit,
}

impl std::fmt::Display for TransactionType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransactionType::Credit => write!(f, "credit"),
            TransactionType::Debit => write!(f, "debit"),
        }
    }
}

impl std::str::FromStr for TransactionType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "credit" => Ok(TransactionType::Credit),
            "debit" => Ok(TransactionType::Debit),
            _ => Err(format!("Unknown transaction type: {}", s)),
        }
    }
}

/// Transaction status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransactionStatus {
    Booked,
    Pending,
}

impl Default for TransactionStatus {
    fn default() -> Self {
        TransactionStatus::Booked
    }
}

impl std::fmt::Display for TransactionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransactionStatus::Booked => write!(f, "booked"),
            TransactionStatus::Pending => write!(f, "pending"),
        }
    }
}

/// Bank transaction entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BankTransaction {
    pub id: String,
    #[serde(rename = "bankAccountId")]
    pub bank_account_id: String,
    #[serde(rename = "transactionId")]
    pub transaction_id: Option<String>,
    #[serde(rename = "type")]
    pub tx_type: String,
    pub amount: String,
    pub currency: String,
    pub description: Option<String>,
    #[serde(rename = "counterpartyName")]
    pub counterparty_name: Option<String>,
    #[serde(rename = "counterpartyIban")]
    pub counterparty_iban: Option<String>,
    #[serde(rename = "bookingDate")]
    pub booking_date: i64,
    #[serde(rename = "valueDate")]
    pub value_date: Option<i64>,
    #[serde(rename = "categoryId")]
    pub category_id: Option<String>,
    #[serde(rename = "merchantCategoryCode")]
    pub merchant_category_code: Option<String>,
    #[serde(rename = "remittanceInfo")]
    pub remittance_info: Option<String>,
    #[serde(rename = "variableSymbol")]
    pub variable_symbol: Option<String>,
    pub status: String,
    #[serde(rename = "dataSource")]
    pub data_source: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

/// Data for creating/updating a transaction
#[derive(Debug, Clone, Deserialize)]
pub struct InsertBankTransaction {
    #[serde(rename = "bankAccountId")]
    pub bank_account_id: String,
    #[serde(rename = "transactionId")]
    pub transaction_id: Option<String>,
    #[serde(rename = "type")]
    pub tx_type: String,
    pub amount: String,
    pub currency: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "counterpartyName")]
    pub counterparty_name: Option<String>,
    #[serde(rename = "counterpartyIban")]
    pub counterparty_iban: Option<String>,
    #[serde(rename = "bookingDate")]
    pub booking_date: i64,
    #[serde(rename = "valueDate")]
    pub value_date: Option<i64>,
    #[serde(rename = "categoryId")]
    pub category_id: Option<String>,
    #[serde(rename = "variableSymbol")]
    pub variable_symbol: Option<String>,
    pub status: Option<String>,
}

/// Transaction category
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionCategory {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    #[serde(rename = "parentId")]
    pub parent_id: Option<String>,
    #[serde(rename = "sortOrder")]
    pub sort_order: i32,
    #[serde(rename = "isSystem")]
    pub is_system: bool,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

/// Data for creating/updating a category
#[derive(Debug, Clone, Deserialize)]
pub struct InsertTransactionCategory {
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    #[serde(rename = "parentId")]
    pub parent_id: Option<String>,
    #[serde(rename = "sortOrder")]
    pub sort_order: Option<i32>,
}

/// Transaction categorization rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionRule {
    pub id: String,
    pub name: String,
    #[serde(rename = "ruleType")]
    pub rule_type: String,
    pub pattern: String,
    #[serde(rename = "categoryId")]
    pub category_id: String,
    pub priority: i32,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

/// Data for creating/updating a rule
#[derive(Debug, Clone, Deserialize)]
pub struct InsertTransactionRule {
    pub name: String,
    #[serde(rename = "ruleType")]
    pub rule_type: String,
    pub pattern: String,
    #[serde(rename = "categoryId")]
    pub category_id: String,
    pub priority: Option<i32>,
    #[serde(rename = "isActive")]
    pub is_active: Option<bool>,
}

/// CSV import preset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvImportPreset {
    pub id: String,
    pub name: String,
    #[serde(rename = "institutionId")]
    pub institution_id: Option<String>,
    pub delimiter: String,
    pub encoding: String,
    #[serde(rename = "skipRows")]
    pub skip_rows: i32,
    #[serde(rename = "dateColumn")]
    pub date_column: String,
    #[serde(rename = "dateFormat")]
    pub date_format: String,
    #[serde(rename = "amountColumn")]
    pub amount_column: String,
    #[serde(rename = "descriptionColumn")]
    pub description_column: Option<String>,
    #[serde(rename = "counterpartyColumn")]
    pub counterparty_column: Option<String>,
    #[serde(rename = "variableSymbolColumn")]
    pub variable_symbol_column: Option<String>,
    #[serde(rename = "isSystem")]
    pub is_system: bool,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

/// Transaction with category info (enriched)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BankTransactionWithCategory {
    #[serde(flatten)]
    pub transaction: BankTransaction,
    pub category: Option<TransactionCategory>,
}

/// Filters for querying transactions
#[derive(Debug, Clone, Default, Deserialize)]
pub struct TransactionFilters {
    #[serde(rename = "dateFrom")]
    pub date_from: Option<i64>,
    #[serde(rename = "dateTo")]
    pub date_to: Option<i64>,
    #[serde(rename = "categoryId")]
    pub category_id: Option<String>,
    #[serde(rename = "txType")]
    pub tx_type: Option<String>,
    pub search: Option<String>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

/// Result of transaction query with pagination
#[derive(Debug, Clone, Serialize)]
pub struct TransactionQueryResult {
    pub transactions: Vec<BankTransaction>,
    pub total: i64,
}
