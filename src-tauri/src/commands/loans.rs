//! Loan commands

use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{InsertLoan, Loan};
use tauri::State;
use uuid::Uuid;

/// Get all loans
#[tauri::command]
pub async fn get_all_loans(db: State<'_, Database>) -> Result<Vec<Loan>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, principal, currency, interest_rate, interest_rate_validity_date,
                    monthly_payment, start_date, end_date, created_at, updated_at
             FROM loans ORDER BY name",
        )?;

        let loans = stmt
            .query_map([], |row| {
                Ok(Loan {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    principal: row.get(2)?,
                    currency: row.get(3)?,
                    interest_rate: row.get(4)?,
                    interest_rate_validity_date: row.get(5)?,
                    monthly_payment: row.get(6)?,
                    start_date: row.get(7)?,
                    end_date: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(loans)
    })
}

/// Create loan
#[tauri::command]
pub async fn create_loan(db: State<'_, Database>, data: InsertLoan) -> Result<Loan> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let currency = data.currency.unwrap_or_else(|| "CZK".to_string());
    let interest_rate = data.interest_rate.unwrap_or_else(|| "0".to_string());
    let monthly_payment = data.monthly_payment.unwrap_or_else(|| "0".to_string());
    let start_date = data.start_date.unwrap_or(now);

    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO loans (id, name, principal, currency, interest_rate, interest_rate_validity_date,
             monthly_payment, start_date, end_date, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)",
            rusqlite::params![
                id, data.name, data.principal, currency, interest_rate,
                data.interest_rate_validity_date, monthly_payment, start_date, data.end_date, now
            ],
        )?;

        Ok(Loan {
            id,
            name: data.name,
            principal: data.principal,
            currency,
            interest_rate,
            interest_rate_validity_date: data.interest_rate_validity_date,
            monthly_payment,
            start_date,
            end_date: data.end_date,
            created_at: now,
            updated_at: now,
        })
    })
}

/// Update loan
#[tauri::command]
pub async fn update_loan(db: State<'_, Database>, id: String, data: InsertLoan) -> Result<Loan> {
    let now = chrono::Utc::now().timestamp();

    db.with_conn(|conn| {
        conn.execute(
            "UPDATE loans SET name = ?1, principal = ?2,
             currency = COALESCE(?3, currency), interest_rate = COALESCE(?4, interest_rate),
             interest_rate_validity_date = ?5, monthly_payment = COALESCE(?6, monthly_payment),
             start_date = COALESCE(?7, start_date), end_date = ?8, updated_at = ?9
             WHERE id = ?10",
            rusqlite::params![
                data.name,
                data.principal,
                data.currency,
                data.interest_rate,
                data.interest_rate_validity_date,
                data.monthly_payment,
                data.start_date,
                data.end_date,
                now,
                id
            ],
        )?;

        conn.query_row(
            "SELECT id, name, principal, currency, interest_rate, interest_rate_validity_date,
                    monthly_payment, start_date, end_date, created_at, updated_at
             FROM loans WHERE id = ?1",
            [&id],
            |row| {
                Ok(Loan {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    principal: row.get(2)?,
                    currency: row.get(3)?,
                    interest_rate: row.get(4)?,
                    interest_rate_validity_date: row.get(5)?,
                    monthly_payment: row.get(6)?,
                    start_date: row.get(7)?,
                    end_date: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            },
        )
        .map_err(|_| AppError::NotFound("Loan not found".into()))
    })
}

/// Delete loan
#[tauri::command]
pub async fn delete_loan(db: State<'_, Database>, id: String) -> Result<()> {
    db.with_conn(|conn| {
        // Remove links first
        conn.execute("DELETE FROM real_estate_loans WHERE loan_id = ?1", [&id])?;
        let changes = conn.execute("DELETE FROM loans WHERE id = ?1", [&id])?;
        if changes == 0 {
            return Err(AppError::NotFound("Loan not found".into()));
        }
        Ok(())
    })
}
