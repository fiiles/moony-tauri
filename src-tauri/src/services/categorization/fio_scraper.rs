//! Fio Transparent Account Data Fetcher
//!
//! Optional tool to fetch real transaction data from Fio banka transparent accounts
//! to augment the synthetic training dataset.
//!
//! Note: Transparent accounts are publicly available and this tool only reads
//! data that is intentionally made public by account owners.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Fio API transaction record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FioTransaction {
    #[serde(rename = "column22")]
    pub id: Option<FioColumn>,
    #[serde(rename = "column0")]
    pub date: Option<FioColumn>,
    #[serde(rename = "column1")]
    pub amount: Option<FioColumn>,
    #[serde(rename = "column14")]
    pub currency: Option<FioColumn>,
    #[serde(rename = "column2")]
    pub counterparty_account: Option<FioColumn>,
    #[serde(rename = "column10")]
    pub counterparty_name: Option<FioColumn>,
    #[serde(rename = "column4")]
    pub constant_symbol: Option<FioColumn>,
    #[serde(rename = "column5")]
    pub variable_symbol: Option<FioColumn>,
    #[serde(rename = "column6")]
    pub specific_symbol: Option<FioColumn>,
    #[serde(rename = "column7")]
    pub user_identification: Option<FioColumn>,
    #[serde(rename = "column8")]
    pub tx_type: Option<FioColumn>,
    #[serde(rename = "column9")]
    pub executor: Option<FioColumn>,
    #[serde(rename = "column16")]
    pub message_for_recipient: Option<FioColumn>,
    #[serde(rename = "column25")]
    pub comment: Option<FioColumn>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FioColumn {
    pub value: Option<serde_json::Value>,
    pub name: Option<String>,
    pub id: Option<i64>,
}

impl FioColumn {
    pub fn as_string(&self) -> Option<String> {
        self.value.as_ref().and_then(|v| match v {
            serde_json::Value::String(s) => Some(s.clone()),
            serde_json::Value::Number(n) => Some(n.to_string()),
            _ => None,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FioAccountStatement {
    #[serde(rename = "accountStatement")]
    pub account_statement: FioAccountStatementInner,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FioAccountStatementInner {
    pub info: FioAccountInfo,
    #[serde(rename = "transactionList")]
    pub transaction_list: Option<FioTransactionList>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FioAccountInfo {
    #[serde(rename = "accountId")]
    pub account_id: Option<String>,
    #[serde(rename = "bankId")]
    pub bank_id: Option<String>,
    pub currency: Option<String>,
    pub iban: Option<String>,
    #[serde(rename = "dateStart")]
    pub date_start: Option<String>,
    #[serde(rename = "dateEnd")]
    pub date_end: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FioTransactionList {
    pub transaction: Option<Vec<FioTransactionWrapper>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FioTransactionWrapper {
    #[serde(flatten)]
    pub columns: HashMap<String, FioColumn>,
}

/// Cleaned transaction for training
#[derive(Debug, Clone)]
pub struct CleanedTransaction {
    pub description: String,
    pub counterparty: Option<String>,
    pub amount: f64,
    pub is_credit: bool,
}

/// List of known transparent accounts (political parties, nonprofits, etc.)
/// These are publicly listed on fio.cz
pub fn get_known_transparent_accounts() -> Vec<(&'static str, &'static str)> {
    vec![
        // These are example account numbers - actual transparent accounts
        // can be found at https://ib.fio.cz/ib/transparent
        // Format: (account_number, name/description)
        ("2000000000", "Example Transparent Account"),
    ]
}

/// Fetch transactions from a Fio transparent account
///
/// # Arguments
/// * `account_number` - Account number without bank code (e.g., "2000000000")
/// * `year` - Year to fetch
///
/// # Returns
/// JSON response from Fio API or error
pub async fn fetch_transparent_account(
    client: &reqwest::Client,
    account_number: &str,
    year: i32,
) -> Result<FioAccountStatement> {
    // Fio transparent account API endpoint
    let url = format!(
        "https://www.fio.cz/ib_api/rest/periods/{}/2010-01-01/{}-12-31/transactions.json",
        account_number, year
    );

    let response = client
        .get(&url)
        .header("User-Agent", "Moony Finance App")
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(anyhow::anyhow!(
            "Failed to fetch account {}: HTTP {}",
            account_number,
            response.status()
        ));
    }

    let statement: FioAccountStatement = response.json().await?;
    Ok(statement)
}

/// Extract training samples from Fio transactions
pub fn extract_training_samples(
    transactions: &[FioTransactionWrapper],
    manual_categorizations: &HashMap<String, String>,
) -> Vec<(String, String)> {
    let mut samples = Vec::new();

    for tx in transactions {
        // Extract description from various fields
        let mut parts = Vec::new();

        // Try message for recipient
        if let Some(col) = tx.columns.get("column16") {
            if let Some(msg) = col.as_string() {
                if !msg.is_empty() {
                    parts.push(msg);
                }
            }
        }

        // Try user identification
        if let Some(col) = tx.columns.get("column7") {
            if let Some(msg) = col.as_string() {
                if !msg.is_empty() {
                    parts.push(msg);
                }
            }
        }

        // Try counterparty name
        if let Some(col) = tx.columns.get("column10") {
            if let Some(name) = col.as_string() {
                if !name.is_empty() {
                    parts.push(name);
                }
            }
        }

        // Try comment
        if let Some(col) = tx.columns.get("column25") {
            if let Some(comment) = col.as_string() {
                if !comment.is_empty() {
                    parts.push(comment);
                }
            }
        }

        let description = parts.join(" ");
        if description.is_empty() {
            continue;
        }

        // Look up manual categorization if available
        if let Some(category) = manual_categorizations.get(&description) {
            samples.push((description, category.clone()));
        }
    }

    samples
}

/// Helper to build categorization training set from user's existing categorized transactions
pub fn build_training_from_user_data(
    categorized_transactions: Vec<(String, String, String)>, // (description, counterparty, category_id)
) -> Vec<(String, String)> {
    categorized_transactions
        .into_iter()
        .map(|(desc, counterparty, category)| {
            let text = if counterparty.is_empty() {
                desc
            } else {
                format!("{} {}", desc, counterparty)
            };
            (text, category)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_column_as_string() {
        let col = FioColumn {
            value: Some(serde_json::Value::String("Test".to_string())),
            name: Some("test".to_string()),
            id: Some(1),
        };
        assert_eq!(col.as_string(), Some("Test".to_string()));

        let num_col = FioColumn {
            value: Some(serde_json::Value::Number(serde_json::Number::from(123))),
            name: None,
            id: None,
        };
        assert_eq!(num_col.as_string(), Some("123".to_string()));
    }
}
