//! Bank account business logic service
//!
//! All business logic for bank accounts lives here.
//! Commands should only validate input, call these functions, and handle events.
//! This is the SINGLE SOURCE OF TRUTH for bank account operations.

use crate::error::{AppError, Result};
use crate::models::{BankAccount, InsertBankAccount};
use rusqlite::params;
use uuid::Uuid;

/// Get a bank account by ID
/// Helper function to fetch a bank account from the database
pub fn get_account_by_id(conn: &rusqlite::Connection, id: &str) -> Result<BankAccount> {
    let account = conn.query_row(
        "SELECT id, name, account_type, iban, bban, currency, balance, institution_id,
         external_account_id, data_source, last_synced_at, interest_rate, has_zone_designation,
         termination_date, exclude_from_balance, created_at, updated_at FROM bank_accounts WHERE id = ?1",
        [id],
        |row| {
            Ok(BankAccount {
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
                exclude_from_balance: row.get::<_, i32>(14)? != 0,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
            })
        },
    )?;
    Ok(account)
}

/// Create a new bank account
/// This is the SINGLE SOURCE OF TRUTH for bank account creation
pub fn create_account(
    conn: &rusqlite::Connection,
    data: &InsertBankAccount,
) -> Result<BankAccount> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let account_type = data
        .account_type
        .clone()
        .unwrap_or_else(|| "checking".to_string());
    let currency = data.currency.clone().unwrap_or_else(|| "CZK".to_string());
    let balance = data.balance.clone().unwrap_or_else(|| "0".to_string());
    let has_zone = data.has_zone_designation.unwrap_or(false);
    let exclude_from_balance = data.exclude_from_balance.unwrap_or(false);

    conn.execute(
        "INSERT INTO bank_accounts (
            id, name, account_type, iban, bban, currency, balance,
            institution_id, data_source, interest_rate, has_zone_designation,
            termination_date, exclude_from_balance, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![
            id,
            data.name,
            account_type,
            data.iban,
            data.bban,
            currency,
            balance,
            data.institution_id,
            "manual",
            data.interest_rate,
            has_zone as i32,
            data.termination_date,
            exclude_from_balance as i32,
            now,
            now,
        ],
    )?;

    Ok(BankAccount {
        id,
        name: data.name.clone(),
        account_type,
        iban: data.iban.clone(),
        bban: data.bban.clone(),
        currency,
        balance,
        institution_id: data.institution_id.clone(),
        external_account_id: None,
        data_source: "manual".to_string(),
        last_synced_at: None,
        interest_rate: data.interest_rate.clone(),
        has_zone_designation: has_zone,
        termination_date: data.termination_date,
        exclude_from_balance,
        created_at: now,
        updated_at: now,
    })
}

/// Update an existing bank account
/// This is the SINGLE SOURCE OF TRUTH for bank account updates
pub fn update_account(
    conn: &rusqlite::Connection,
    id: &str,
    data: &InsertBankAccount,
) -> Result<BankAccount> {
    let now = chrono::Utc::now().timestamp();

    // Get existing account first
    let existing = get_account_by_id(conn, id)?;

    let account_type = data.account_type.clone().unwrap_or(existing.account_type);
    let currency = data.currency.clone().unwrap_or(existing.currency);
    let balance = data.balance.clone().unwrap_or(existing.balance);
    let has_zone = data
        .has_zone_designation
        .unwrap_or(existing.has_zone_designation);
    let exclude_from_balance = data
        .exclude_from_balance
        .unwrap_or(existing.exclude_from_balance);

    conn.execute(
        "UPDATE bank_accounts SET 
            name = ?1, account_type = ?2, iban = ?3, bban = ?4, currency = ?5,
            balance = ?6, institution_id = ?7, interest_rate = ?8, has_zone_designation = ?9,
            termination_date = ?10, exclude_from_balance = ?11, updated_at = ?12
        WHERE id = ?13",
        params![
            data.name,
            account_type,
            data.iban,
            data.bban,
            currency,
            balance,
            data.institution_id,
            data.interest_rate,
            has_zone as i32,
            data.termination_date,
            exclude_from_balance as i32,
            now,
            id,
        ],
    )?;

    Ok(BankAccount {
        id: id.to_string(),
        name: data.name.clone(),
        account_type,
        iban: data.iban.clone(),
        bban: data.bban.clone(),
        currency,
        balance,
        institution_id: data.institution_id.clone(),
        external_account_id: existing.external_account_id,
        data_source: existing.data_source,
        last_synced_at: existing.last_synced_at,
        interest_rate: data.interest_rate.clone(),
        has_zone_designation: has_zone,
        termination_date: data.termination_date,
        exclude_from_balance,
        created_at: existing.created_at,
        updated_at: now,
    })
}

/// Delete a bank account
/// Note: This does NOT delete related transactions - that's handled by the DB cascade
/// or should be done explicitly before calling this function
pub fn delete_account(conn: &rusqlite::Connection, id: &str) -> Result<()> {
    let changes = conn.execute("DELETE FROM bank_accounts WHERE id = ?1", [id])?;
    if changes == 0 {
        return Err(AppError::NotFound("Bank account not found".into()));
    }
    Ok(())
}
