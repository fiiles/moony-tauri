//! Bank account Tauri commands for managing accounts, transactions, and categories

use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{
    BankAccount, BankAccountWithInstitution, BankTransaction, InsertBankAccount,
    InsertBankTransaction, InsertTransactionCategory, InsertTransactionRule, Institution,
    TransactionCategory, TransactionFilters, TransactionQueryResult, TransactionRule,
};
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

// ============================================================================
// Bank Account Commands
// ============================================================================

use crate::commands::portfolio;
use crate::services::bank_accounts as bank_service;

/// Get all bank accounts with optional institution data
#[tauri::command]
pub async fn get_all_bank_accounts(
    db: State<'_, Database>,
) -> Result<Vec<BankAccountWithInstitution>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT 
                ba.id, ba.name, ba.account_type, ba.iban, ba.bban, ba.currency, ba.balance,
                ba.institution_id, ba.external_account_id, ba.data_source, ba.last_synced_at,
                ba.interest_rate, ba.has_zone_designation, ba.termination_date,
                ba.created_at, ba.updated_at,
                i.id, i.name, i.bic, i.country, i.logo_url, i.created_at
            FROM bank_accounts ba
            LEFT JOIN institutions i ON ba.institution_id = i.id
            ORDER BY ba.name ASC",
        )?;

        let accounts: Vec<BankAccountWithInstitution> = stmt
            .query_map([], |row| {
                let account = BankAccount {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    account_type: row.get(2)?,
                    iban: row.get(3)?,
                    bban: row.get(4)?,
                    currency: row.get(5)?,
                    balance: row.get(6)?,
                    institution_id: row.get(7)?,
                    external_account_id: row.get(8)?,
                    data_source: row.get(9)?,
                    last_synced_at: row.get(10)?,
                    interest_rate: row.get(11)?,
                    has_zone_designation: row.get::<_, i32>(12)? != 0,
                    termination_date: row.get(13)?,
                    created_at: row.get(14)?,
                    updated_at: row.get(15)?,
                };

                let institution: Option<Institution> =
                    if row.get::<_, Option<String>>(16)?.is_some() {
                        Some(Institution {
                            id: row.get(16)?,
                            name: row.get(17)?,
                            bic: row.get(18)?,
                            country: row.get(19)?,
                            logo_url: row.get(20)?,
                            created_at: row.get(21)?,
                        })
                    } else {
                        None
                    };

                Ok(BankAccountWithInstitution {
                    account,
                    institution,
                    effective_interest_rate: None,
                    projected_earnings: None,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(accounts)
    })
}

/// Get a single bank account by ID
#[tauri::command]
pub async fn get_bank_account(
    db: State<'_, Database>,
    id: String,
) -> Result<Option<BankAccountWithInstitution>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT 
                ba.id, ba.name, ba.account_type, ba.iban, ba.bban, ba.currency, ba.balance,
                ba.institution_id, ba.external_account_id, ba.data_source, ba.last_synced_at,
                ba.interest_rate, ba.has_zone_designation, ba.termination_date,
                ba.created_at, ba.updated_at,
                i.id, i.name, i.bic, i.country, i.logo_url, i.created_at
            FROM bank_accounts ba
            LEFT JOIN institutions i ON ba.institution_id = i.id
            WHERE ba.id = ?1",
        )?;

        let result = stmt.query_row([&id], |row| {
            let account = BankAccount {
                id: row.get(0)?,
                name: row.get(1)?,
                account_type: row.get(2)?,
                iban: row.get(3)?,
                bban: row.get(4)?,
                currency: row.get(5)?,
                balance: row.get(6)?,
                institution_id: row.get(7)?,
                external_account_id: row.get(8)?,
                data_source: row.get(9)?,
                last_synced_at: row.get(10)?,
                interest_rate: row.get(11)?,
                has_zone_designation: row.get::<_, i32>(12)? != 0,
                termination_date: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            };

            let institution: Option<Institution> = if row.get::<_, Option<String>>(16)?.is_some() {
                Some(Institution {
                    id: row.get(16)?,
                    name: row.get(17)?,
                    bic: row.get(18)?,
                    country: row.get(19)?,
                    logo_url: row.get(20)?,
                    created_at: row.get(21)?,
                })
            } else {
                None
            };

            Ok(BankAccountWithInstitution {
                account,
                institution,
                effective_interest_rate: None,
                projected_earnings: None,
            })
        });

        match result {
            Ok(account) => Ok(Some(account)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    })
}

/// Create a new bank account
#[tauri::command]
pub async fn create_bank_account(
    db: State<'_, Database>,
    data: InsertBankAccount,
) -> Result<BankAccount> {
    // 1. Validate inputs at the trust boundary
    data.validate()?;

    // 2. Delegate to service layer
    let result = db.with_conn(|conn| bank_service::create_account(conn, &data))?;

    // 3. Handle side effects (portfolio updates)
    portfolio::update_todays_snapshot(&db).await.ok();

    Ok(result)
}

/// Update an existing bank account
#[tauri::command]
pub async fn update_bank_account(
    db: State<'_, Database>,
    id: String,
    data: InsertBankAccount,
) -> Result<BankAccount> {
    // 1. Validate inputs at the trust boundary
    data.validate()?;

    // 2. Delegate to service layer
    let result = db.with_conn(|conn| bank_service::update_account(conn, &id, &data))?;

    // 3. Handle side effects (portfolio updates)
    portfolio::update_todays_snapshot(&db).await.ok();

    Ok(result)
}

/// Delete a bank account and all its transactions
#[tauri::command]
pub async fn delete_bank_account(db: State<'_, Database>, id: String) -> Result<()> {
    // 1. Delegate to service layer
    db.with_conn(|conn| bank_service::delete_account(conn, &id))?;

    // 2. Handle side effects (portfolio updates)
    portfolio::update_todays_snapshot(&db).await.ok();

    Ok(())
}

// ============================================================================
// Institution Commands
// ============================================================================

/// Get all institutions
#[tauri::command]
pub async fn get_all_institutions(db: State<'_, Database>) -> Result<Vec<Institution>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, bic, country, logo_url, created_at 
             FROM institutions 
             ORDER BY name ASC",
        )?;

        let institutions: Vec<Institution> = stmt
            .query_map([], |row| {
                Ok(Institution {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    bic: row.get(2)?,
                    country: row.get(3)?,
                    logo_url: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(institutions)
    })
}

/// Create a new institution
#[tauri::command]
pub async fn create_institution(db: State<'_, Database>, name: String) -> Result<Institution> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO institutions (id, name, created_at) VALUES (?1, ?2, ?3)",
            rusqlite::params![id, name, now],
        )?;

        Ok(Institution {
            id,
            name,
            bic: None,
            country: None,
            logo_url: None,
            created_at: now,
        })
    })
}

// ============================================================================
// Transaction Commands
// ============================================================================

/// Get transactions for a bank account with optional filters
#[tauri::command]
pub async fn get_bank_transactions(
    db: State<'_, Database>,
    account_id: String,
    filters: Option<TransactionFilters>,
) -> Result<TransactionQueryResult> {
    let filters = filters.unwrap_or_default();
    let limit = filters.limit.unwrap_or(50);
    let offset = filters.offset.unwrap_or(0);

    db.with_conn(|conn| {
        // Build base query
        let mut sql = String::from(
            "SELECT id, bank_account_id, transaction_id, tx_type, amount, currency,
             description, counterparty_name, counterparty_iban, booking_date, value_date,
             category_id, merchant_category_code, remittance_info, variable_symbol,
             status, data_source, created_at
             FROM bank_transactions WHERE bank_account_id = ?",
        );

        let mut count_sql =
            String::from("SELECT COUNT(*) FROM bank_transactions WHERE bank_account_id = ?");

        // Build dynamic filters
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(account_id.clone())];

        if let Some(date_from) = filters.date_from {
            sql.push_str(" AND booking_date >= ?");
            count_sql.push_str(" AND booking_date >= ?");
            params_vec.push(Box::new(date_from));
        }
        if let Some(date_to) = filters.date_to {
            sql.push_str(" AND booking_date <= ?");
            count_sql.push_str(" AND booking_date <= ?");
            params_vec.push(Box::new(date_to));
        }
        if let Some(ref category_id) = filters.category_id {
            sql.push_str(" AND category_id = ?");
            count_sql.push_str(" AND category_id = ?");
            params_vec.push(Box::new(category_id.clone()));
        }
        if let Some(ref tx_type) = filters.tx_type {
            sql.push_str(" AND tx_type = ?");
            count_sql.push_str(" AND tx_type = ?");
            params_vec.push(Box::new(tx_type.clone()));
        }
        if let Some(ref search) = filters.search {
            sql.push_str(" AND (description LIKE ? OR counterparty_name LIKE ?)");
            count_sql.push_str(" AND (description LIKE ? OR counterparty_name LIKE ?)");
            let pattern = format!("%{}%", search);
            params_vec.push(Box::new(pattern.clone()));
            params_vec.push(Box::new(pattern));
        }

        sql.push_str(" ORDER BY booking_date DESC");
        sql.push_str(&format!(" LIMIT {} OFFSET {}", limit, offset));

        // Execute query
        let params_refs: Vec<&dyn rusqlite::ToSql> =
            params_vec.iter().map(|p| p.as_ref()).collect();

        let mut stmt = conn.prepare(&sql)?;
        let transactions: Vec<BankTransaction> = stmt
            .query_map(params_refs.as_slice(), |row| {
                Ok(BankTransaction {
                    id: row.get(0)?,
                    bank_account_id: row.get(1)?,
                    transaction_id: row.get(2)?,
                    tx_type: row.get(3)?,
                    amount: row.get(4)?,
                    currency: row.get(5)?,
                    description: row.get(6)?,
                    counterparty_name: row.get(7)?,
                    counterparty_iban: row.get(8)?,
                    booking_date: row.get(9)?,
                    value_date: row.get(10)?,
                    category_id: row.get(11)?,
                    merchant_category_code: row.get(12)?,
                    remittance_info: row.get(13)?,
                    variable_symbol: row.get(14)?,
                    status: row.get(15)?,
                    data_source: row.get(16)?,
                    created_at: row.get(17)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        // Get total count (reuse params without search duplicates)
        let count_params: Vec<&dyn rusqlite::ToSql> =
            params_vec.iter().map(|p| p.as_ref()).collect();
        let total: i64 = conn.query_row(&count_sql, count_params.as_slice(), |row| row.get(0))?;

        Ok(TransactionQueryResult {
            transactions,
            total,
        })
    })
}

/// Create a new transaction
#[tauri::command]
pub async fn create_bank_transaction(
    db: State<'_, Database>,
    data: InsertBankTransaction,
) -> Result<BankTransaction> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    db.with_conn(|conn| {
        // Get account currency if not provided
        let currency = if let Some(ref c) = data.currency {
            c.clone()
        } else {
            conn.query_row(
                "SELECT currency FROM bank_accounts WHERE id = ?1",
                [&data.bank_account_id],
                |row| row.get::<_, String>(0),
            )?
        };

        conn.execute(
            "INSERT INTO bank_transactions (
                id, bank_account_id, transaction_id, tx_type, amount, currency,
                description, counterparty_name, counterparty_iban, booking_date, value_date,
                category_id, variable_symbol, status, data_source, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![
                id,
                data.bank_account_id,
                data.transaction_id,
                data.tx_type,
                data.amount,
                currency,
                data.description,
                data.counterparty_name,
                data.counterparty_iban,
                data.booking_date,
                data.value_date,
                data.category_id,
                data.variable_symbol,
                data.status.as_deref().unwrap_or("booked"),
                "manual",
                now,
            ],
        )?;

        Ok(BankTransaction {
            id,
            bank_account_id: data.bank_account_id,
            transaction_id: data.transaction_id,
            tx_type: data.tx_type,
            amount: data.amount,
            currency,
            description: data.description,
            counterparty_name: data.counterparty_name,
            counterparty_iban: data.counterparty_iban,
            booking_date: data.booking_date,
            value_date: data.value_date,
            category_id: data.category_id,
            merchant_category_code: None,
            remittance_info: None,
            variable_symbol: data.variable_symbol,
            status: data.status.unwrap_or_else(|| "booked".to_string()),
            data_source: "manual".to_string(),
            created_at: now,
        })
    })
}

/// Delete a transaction
#[tauri::command]
pub async fn delete_bank_transaction(db: State<'_, Database>, id: String) -> Result<()> {
    db.with_conn(|conn| {
        conn.execute("DELETE FROM bank_transactions WHERE id = ?1", [&id])?;
        Ok(())
    })
}

/// Update a transaction's category
#[tauri::command]
pub async fn update_transaction_category(
    db: State<'_, Database>,
    transaction_id: String,
    category_id: Option<String>,
) -> Result<()> {
    db.with_conn(|conn| {
        conn.execute(
            "UPDATE bank_transactions SET category_id = ?1 WHERE id = ?2",
            rusqlite::params![category_id, transaction_id],
        )?;
        Ok(())
    })
}

// ============================================================================
// Category Commands
// ============================================================================

/// Get all transaction categories
#[tauri::command]
pub async fn get_transaction_categories(
    db: State<'_, Database>,
) -> Result<Vec<TransactionCategory>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, icon, color, parent_id, sort_order, is_system, created_at
             FROM transaction_categories
             ORDER BY sort_order ASC, name ASC",
        )?;

        let categories: Vec<TransactionCategory> = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                println!("[DEBUG] Category found: id={:?}", id); // Debug logging
                Ok(TransactionCategory {
                    id,
                    name: row.get(1)?,
                    icon: row.get(2)?,
                    color: row.get(3)?,
                    parent_id: row.get(4)?,
                    sort_order: row.get(5)?,
                    is_system: row.get::<_, i32>(6)? != 0,
                    created_at: row.get(7)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(categories)
    })
}

/// Create a custom category
#[tauri::command]
pub async fn create_transaction_category(
    db: State<'_, Database>,
    data: InsertTransactionCategory,
) -> Result<TransactionCategory> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let sort_order = data.sort_order.unwrap_or(50);

    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO transaction_categories (id, name, icon, color, parent_id, sort_order, is_system, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7)",
            params![id, data.name, data.icon, data.color, data.parent_id, sort_order, now],
        )?;

        Ok(TransactionCategory {
            id,
            name: data.name,
            icon: data.icon,
            color: data.color,
            parent_id: data.parent_id,
            sort_order,
            is_system: false,
            created_at: now,
        })
    })
}

/// Delete a custom category (cannot delete system categories)
#[tauri::command]
pub async fn delete_transaction_category(db: State<'_, Database>, id: String) -> Result<()> {
    db.with_conn(|conn| {
        // Check if system category
        let is_system: i32 = conn.query_row(
            "SELECT is_system FROM transaction_categories WHERE id = ?1",
            [&id],
            |row| row.get(0),
        )?;

        if is_system != 0 {
            return Err(AppError::Database(
                "Cannot delete system category".to_string(),
            ));
        }

        // Set transactions with this category to NULL
        conn.execute(
            "UPDATE bank_transactions SET category_id = NULL WHERE category_id = ?1",
            [&id],
        )?;

        conn.execute("DELETE FROM transaction_categories WHERE id = ?1", [&id])?;
        Ok(())
    })
}

// ============================================================================
// Rule Commands
// ============================================================================

/// Get all transaction rules
#[tauri::command]
pub async fn get_transaction_rules(db: State<'_, Database>) -> Result<Vec<TransactionRule>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, rule_type, pattern, category_id, priority, is_active, created_at
             FROM transaction_rules
             ORDER BY priority DESC, name ASC",
        )?;

        let rules: Vec<TransactionRule> = stmt
            .query_map([], |row| {
                Ok(TransactionRule {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    rule_type: row.get(2)?,
                    pattern: row.get(3)?,
                    category_id: row.get(4)?,
                    priority: row.get(5)?,
                    is_active: row.get::<_, i32>(6)? != 0,
                    created_at: row.get(7)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(rules)
    })
}

/// Create a new categorization rule
#[tauri::command]
pub async fn create_transaction_rule(
    db: State<'_, Database>,
    data: InsertTransactionRule,
) -> Result<TransactionRule> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let priority = data.priority.unwrap_or(0);
    let is_active = data.is_active.unwrap_or(true);

    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO transaction_rules (id, name, rule_type, pattern, category_id, priority, is_active, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id, data.name, data.rule_type, data.pattern, data.category_id, priority, is_active as i32, now],
        )?;

        Ok(TransactionRule {
            id,
            name: data.name,
            rule_type: data.rule_type,
            pattern: data.pattern,
            category_id: data.category_id,
            priority,
            is_active,
            created_at: now,
        })
    })
}

/// Delete a rule
#[tauri::command]
pub async fn delete_transaction_rule(db: State<'_, Database>, id: String) -> Result<()> {
    db.with_conn(|conn| {
        conn.execute("DELETE FROM transaction_rules WHERE id = ?1", [&id])?;
        Ok(())
    })
}

// ============================================================================
// CSV Import Commands
// ============================================================================

/// Get all bank CSV presets
#[tauri::command]
pub async fn get_csv_presets() -> Result<Vec<crate::services::csv_import::BankCsvPreset>> {
    Ok(crate::services::csv_import::get_bank_presets())
}

/// Get CSV preset for a specific institution
#[tauri::command]
pub async fn get_csv_preset_by_institution(
    institution_id: String,
) -> Result<Option<crate::services::csv_import::BankCsvPreset>> {
    Ok(crate::services::csv_import::get_preset_by_institution(
        &institution_id,
    ))
}

/// Parse CSV file and return headers and sample rows for preview
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvPreviewResult {
    pub headers: Vec<String>,
    pub sample_rows: Vec<Vec<String>>,
    pub total_rows: usize,
    pub delimiter: String,
    pub suggested_mappings: std::collections::HashMap<String, (String, f32)>,
}

#[tauri::command]
pub async fn parse_csv_file(
    file_path: String,
    delimiter: Option<String>,
    skip_rows: Option<usize>,
) -> Result<CsvPreviewResult> {
    use std::fs;
    use std::io::Cursor;

    // Read file as bytes to handle encoding
    let bytes =
        fs::read(&file_path).map_err(|e| AppError::Internal(format!("Cannot open file: {}", e)))?;

    // Try to decode with different encodings
    let content = decode_csv_content(&bytes)?;

    // Auto-detect delimiter if not specified
    // Convert String to char, use first character
    let delim = delimiter
        .and_then(|s| s.chars().next())
        .unwrap_or_else(|| detect_csv_delimiter(&content));
    let skip = skip_rows.unwrap_or(0);

    let mut csv_reader = csv::ReaderBuilder::new()
        .delimiter(delim as u8)
        .has_headers(true)
        .flexible(true)
        .from_reader(Cursor::new(content.as_bytes()));

    // Skip rows if needed
    for _ in 0..skip {
        let _ = csv_reader.records().next();
    }

    // Get headers
    let headers: Vec<String> = csv_reader
        .headers()
        .map_err(|e| AppError::Internal(format!("Cannot read headers: {}", e)))?
        .iter()
        .map(|s| s.to_string())
        .collect();

    // Get sample rows (first 5)
    let mut sample_rows: Vec<Vec<String>> = Vec::new();
    let mut total_rows = 0;

    for result in csv_reader.records() {
        match result {
            Ok(record) => {
                total_rows += 1;
                if sample_rows.len() < 5 {
                    sample_rows.push(record.iter().map(|s| s.to_string()).collect());
                }
            }
            Err(_) => continue,
        }
    }

    // Get suggested column mappings
    let suggested_mappings = crate::services::csv_import::suggest_column_mappings(&headers);

    Ok(CsvPreviewResult {
        headers,
        sample_rows,
        total_rows,
        delimiter: delim.to_string(),
        suggested_mappings,
    })
}

/// Decode CSV content trying multiple encodings
fn decode_csv_content(bytes: &[u8]) -> Result<String> {
    // Check for UTF-8 BOM and strip it
    let bytes = if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        &bytes[3..]
    } else {
        bytes
    };

    // Try UTF-8 first
    if let Ok(s) = std::str::from_utf8(bytes) {
        return Ok(s.to_string());
    }

    // Try Windows-1252 (common for Czech bank exports)
    let (decoded, _, had_errors) = encoding_rs::WINDOWS_1252.decode(bytes);
    if !had_errors {
        return Ok(decoded.into_owned());
    }

    // Try ISO-8859-2 (Central European)
    let (decoded, _, had_errors) = encoding_rs::ISO_8859_2.decode(bytes);
    if !had_errors {
        return Ok(decoded.into_owned());
    }

    // Fallback: force Windows-1252 even with errors
    let (decoded, _, _) = encoding_rs::WINDOWS_1252.decode(bytes);
    Ok(decoded.into_owned())
}

/// Detect CSV delimiter by testing common delimiters on the first line
/// Returns the delimiter that produces the most columns
fn detect_csv_delimiter(content: &str) -> char {
    // Get first non-empty line
    let first_line = content.lines().find(|l| !l.trim().is_empty()).unwrap_or("");

    let delimiters = [',', ';', '\t'];
    let mut best_delimiter = ';';
    let mut best_count = 0;

    for delim in delimiters {
        // Count columns by parsing with this delimiter
        // Handle quoted fields properly
        let count = count_csv_columns(first_line, delim);
        if count > best_count {
            best_count = count;
            best_delimiter = delim;
        }
    }

    best_delimiter
}

/// Count CSV columns in a line, handling quoted fields
fn count_csv_columns(line: &str, delimiter: char) -> usize {
    use std::io::Cursor;

    let mut reader = csv::ReaderBuilder::new()
        .delimiter(delimiter as u8)
        .has_headers(false)
        .from_reader(Cursor::new(line.as_bytes()));

    if let Some(Ok(record)) = reader.records().next() {
        // Filter out empty fields to get a better count
        record.iter().filter(|s| !s.trim().is_empty()).count()
    } else {
        0
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvImportConfig {
    pub delimiter: String, // String for JS compatibility, convert to char internally
    pub skip_rows: usize,
    pub date_column: String,
    pub date_format: String,
    pub amount_column: String,
    pub description_columns: Option<Vec<String>>,
    pub counterparty_column: Option<String>,
    pub counterparty_iban_column: Option<String>,
    pub currency_column: Option<String>,
    pub variable_symbol_column: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvImportResult {
    pub imported_count: usize,
    pub duplicate_count: usize,
    pub error_count: usize,
    pub errors: Vec<String>,
}

#[tauri::command]
pub async fn import_csv_transactions(
    db: State<'_, Database>,
    account_id: String,
    file_path: String,
    config: CsvImportConfig,
) -> Result<CsvImportResult> {
    use std::fs;
    use std::io::Cursor;

    // Read file as bytes and decode encoding
    let bytes =
        fs::read(&file_path).map_err(|e| AppError::Internal(format!("Cannot open file: {}", e)))?;
    let content = decode_csv_content(&bytes)?;

    // Convert String delimiter to char (first character, default to comma)
    let delimiter_char = config.delimiter.chars().next().unwrap_or(',');

    let mut csv_reader = csv::ReaderBuilder::new()
        .delimiter(delimiter_char as u8)
        .has_headers(true)
        .flexible(true)
        .from_reader(Cursor::new(content.as_bytes()));

    // Skip rows if needed
    for _ in 0..config.skip_rows {
        let _ = csv_reader.records().next();
    }

    let headers: Vec<String> = csv_reader
        .headers()
        .map_err(|e| AppError::Internal(format!("Cannot read headers: {}", e)))?
        .iter()
        .map(|s| s.to_string())
        .collect();

    // Find column indices
    let date_idx = headers.iter().position(|h| h == &config.date_column);
    let amount_idx = headers.iter().position(|h| h == &config.amount_column);
    // Find multiple description column indices
    let desc_indices: Vec<usize> = config
        .description_columns
        .as_ref()
        .map(|cols| {
            cols.iter()
                .filter_map(|c| headers.iter().position(|h| h == c))
                .collect()
        })
        .unwrap_or_default();
    let counterparty_idx = config
        .counterparty_column
        .as_ref()
        .and_then(|c| headers.iter().position(|h| h == c));
    let counterparty_iban_idx = config
        .counterparty_iban_column
        .as_ref()
        .and_then(|c| headers.iter().position(|h| h == c));
    let currency_idx = config
        .currency_column
        .as_ref()
        .and_then(|c| headers.iter().position(|h| h == c));
    let vs_idx = config
        .variable_symbol_column
        .as_ref()
        .and_then(|c| headers.iter().position(|h| h == c));

    if date_idx.is_none() || amount_idx.is_none() {
        return Err(AppError::Validation(
            format!(
                "Required columns not found. Looking for date='{}', amount='{}'. Available headers: {:?}",
                config.date_column, config.amount_column, headers
            ),
        ));
    }

    let date_idx =
        date_idx.ok_or_else(|| AppError::Validation("Date column mapping is required".into()))?;
    let amount_idx = amount_idx
        .ok_or_else(|| AppError::Validation("Amount column mapping is required".into()))?;

    let mut imported_count = 0;
    let mut duplicate_count = 0;
    let mut error_count = 0;
    let mut errors: Vec<String> = Vec::new();

    // Extract filename from file_path
    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown.csv")
        .to_string();

    // Create import batch record
    let batch_id = Uuid::new_v4().to_string();
    let batch_account_id = account_id.clone();
    let batch_file_name = file_name.clone();
    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO csv_import_batches (id, bank_account_id, file_name, imported_count, duplicate_count, error_count) VALUES (?1, ?2, ?3, 0, 0, 0)",
            params![batch_id.clone(), batch_account_id, batch_file_name],
        )?;
        Ok(())
    })?;

    // Get existing transaction IDs for duplicate detection
    let mut existing_tx_ids: Vec<String> = db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT transaction_id FROM bank_transactions WHERE bank_account_id = ?1 AND transaction_id IS NOT NULL"
        )?;
        let ids: Vec<String> = stmt.query_map([&account_id], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(ids)
    })?;

    for (row_num, result) in csv_reader.records().enumerate() {
        match result {
            Ok(record) => {
                // Parse date
                let date_str = record.get(date_idx).unwrap_or("");
                let booking_date =
                    match chrono::NaiveDate::parse_from_str(date_str, &config.date_format) {
                        Ok(d) => d
                            .and_hms_opt(0, 0, 0)
                            .expect("Valid date should have valid midnight time")
                            .and_utc()
                            .timestamp(),
                        Err(_) => {
                            // Try alternative formats
                            chrono::NaiveDate::parse_from_str(date_str, "%d.%m.%Y")
                                .or_else(|_| {
                                    chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
                                })
                                .map(|d| {
                                    d.and_hms_opt(0, 0, 0)
                                        .expect("Valid date should have valid midnight time")
                                        .and_utc()
                                        .timestamp()
                                })
                                .unwrap_or_else(|_| {
                                    errors.push(format!(
                                        "Row {}: Cannot parse date '{}'",
                                        row_num + 2,
                                        date_str
                                    ));
                                    error_count += 1;
                                    0
                                })
                        }
                    };

                if booking_date == 0 {
                    continue;
                }

                // Parse amount (handle multiple formats + NBSP)
                let amount_str = record.get(amount_idx).unwrap_or("0");
                let amount = crate::services::csv_import::clean_and_parse_amount(amount_str);

                // Determine transaction type
                let tx_type = if amount >= 0.0 { "credit" } else { "debit" };
                let abs_amount = amount.abs().to_string();

                // Get optional fields - combine multiple description columns
                let description: Option<String> = if desc_indices.is_empty() {
                    None
                } else {
                    let parts: Vec<String> = desc_indices
                        .iter()
                        .filter_map(|&i| record.get(i))
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect();
                    if parts.is_empty() {
                        None
                    } else {
                        Some(parts.join(" | "))
                    }
                };
                let counterparty = counterparty_idx
                    .and_then(|i| record.get(i))
                    .map(|s| s.to_string());
                let counterparty_iban = counterparty_iban_idx
                    .and_then(|i| record.get(i))
                    .map(|s| s.to_string())
                    .filter(|s| !s.trim().is_empty());
                let currency = currency_idx
                    .and_then(|i| record.get(i))
                    .map(|s| s.to_string())
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or_else(|| "CZK".to_string());
                let variable_symbol = vs_idx.and_then(|i| record.get(i)).map(|s| s.to_string());

                // Create transaction ID for duplicate detection (date + amount + vs + counterparty + iban)
                let tx_id = format!(
                    "{}_{}_{}_{}_{}",
                    booking_date,
                    abs_amount,
                    variable_symbol.as_deref().unwrap_or(""),
                    counterparty.as_deref().unwrap_or(""),
                    counterparty_iban.as_deref().unwrap_or("")
                );

                // Check for duplicate
                if existing_tx_ids.contains(&tx_id) {
                    duplicate_count += 1;
                    continue;
                }

                // Insert transaction
                let id = Uuid::new_v4().to_string();
                let now = chrono::Utc::now().timestamp();

                let insert_result = db.with_conn(|conn| {
                    conn.execute(
                        "INSERT INTO bank_transactions (
                            id, bank_account_id, transaction_id, tx_type, amount, currency,
                            description, counterparty_name, counterparty_iban, variable_symbol, booking_date,
                            status, data_source, import_batch_id, created_at
                        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                        params![
                            id,
                            account_id,
                            tx_id,
                            tx_type,
                            abs_amount,
                            currency,
                            description,
                            counterparty,
                            counterparty_iban,
                            variable_symbol,
                            booking_date,
                            "booked",
                            "csv_import",
                            batch_id,
                            now
                        ],
                    )?;
                    Ok(())
                });

                match insert_result {
                    Ok(_) => {
                        imported_count += 1;
                        // Track this tx_id to detect duplicates within the same batch
                        existing_tx_ids.push(tx_id);
                    }
                    Err(e) => {
                        errors.push(format!("Row {}: {}", row_num + 2, e));
                        error_count += 1;
                    }
                }
            }
            Err(e) => {
                errors.push(format!("Row {}: Cannot parse: {}", row_num + 2, e));
                error_count += 1;
            }
        }
    }

    // Update batch record with final counts
    let final_imported = imported_count as i64;
    let final_duplicate = duplicate_count as i64;
    let final_error = error_count as i64;
    db.with_conn(|conn| {
        conn.execute(
            "UPDATE csv_import_batches SET imported_count = ?1, duplicate_count = ?2, error_count = ?3 WHERE id = ?4",
            params![final_imported, final_duplicate, final_error, batch_id],
        )?;
        Ok(())
    })?;

    Ok(CsvImportResult {
        imported_count,
        duplicate_count,
        error_count,
        errors,
    })
}

/// Represents a CSV import batch for the frontend
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvImportBatch {
    pub id: String,
    pub bank_account_id: String,
    pub file_name: String,
    pub imported_count: i64,
    pub duplicate_count: i64,
    pub error_count: i64,
    pub imported_at: i64,
}

/// Get all import batches for a bank account
#[tauri::command]
pub async fn get_import_batches(
    db: State<'_, Database>,
    account_id: String,
) -> Result<Vec<CsvImportBatch>> {
    let batches = db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, bank_account_id, file_name, imported_count, duplicate_count, error_count, imported_at 
             FROM csv_import_batches 
             WHERE bank_account_id = ?1 
             ORDER BY imported_at DESC"
        )?;
        let batch_iter = stmt.query_map([&account_id], |row| {
            Ok(CsvImportBatch {
                id: row.get(0)?,
                bank_account_id: row.get(1)?,
                file_name: row.get(2)?,
                imported_count: row.get(3)?,
                duplicate_count: row.get(4)?,
                error_count: row.get(5)?,
                imported_at: row.get(6)?,
            })
        })?;
        let batches: Vec<CsvImportBatch> = batch_iter.filter_map(|r| r.ok()).collect();
        Ok(batches)
    })?;

    Ok(batches)
}

/// Delete an import batch and all its transactions
#[tauri::command]
pub async fn delete_import_batch(db: State<'_, Database>, batch_id: String) -> Result<()> {
    // Transactions are deleted via CASCADE, but let's be explicit
    db.with_conn(|conn| {
        // Delete transactions first
        conn.execute(
            "DELETE FROM bank_transactions WHERE import_batch_id = ?1",
            params![batch_id],
        )?;
        // Delete the batch record
        conn.execute(
            "DELETE FROM csv_import_batches WHERE id = ?1",
            params![batch_id],
        )?;
        Ok(())
    })?;

    Ok(())
}
