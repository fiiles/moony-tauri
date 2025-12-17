//! Insurance commands

use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{InsurancePolicy, InsertInsurancePolicy};
use tauri::State;
use uuid::Uuid;

/// Get all insurance policies
#[tauri::command]
pub async fn get_all_insurance(db: State<'_, Database>) -> Result<Vec<InsurancePolicy>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, type, provider, policy_name, policy_number, start_date, end_date,
                    payment_frequency, one_time_payment, one_time_payment_currency,
                    regular_payment, regular_payment_currency, limits, notes, status,
                    created_at, updated_at 
             FROM insurance_policies ORDER BY policy_name"
        )?;
        
        let policies = stmt.query_map([], |row| {
            let limits_json: String = row.get(12)?;
            
            Ok(InsurancePolicy {
                id: row.get(0)?,
                policy_type: row.get(1)?,
                provider: row.get(2)?,
                policy_name: row.get(3)?,
                policy_number: row.get(4)?,
                start_date: row.get(5)?,
                end_date: row.get(6)?,
                payment_frequency: row.get(7)?,
                one_time_payment: row.get(8)?,
                one_time_payment_currency: row.get(9)?,
                regular_payment: row.get(10)?,
                regular_payment_currency: row.get(11)?,
                limits: serde_json::from_str(&limits_json).unwrap_or_default(),
                notes: row.get(13)?,
                status: row.get(14)?,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        
        Ok(policies)
    })
}

/// Create insurance policy
#[tauri::command]
pub async fn create_insurance(db: State<'_, Database>, data: InsertInsurancePolicy) -> Result<InsurancePolicy> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let limits_json = serde_json::to_string(&data.limits.unwrap_or_default())?;
    
    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO insurance_policies 
             (id, type, provider, policy_name, policy_number, start_date, end_date,
              payment_frequency, one_time_payment, one_time_payment_currency,
              regular_payment, regular_payment_currency, limits, notes, status, created_at, updated_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?16)",
            rusqlite::params![
                id, data.policy_type, data.provider, data.policy_name, data.policy_number,
                data.start_date, data.end_date, data.payment_frequency,
                data.one_time_payment, data.one_time_payment_currency,
                data.regular_payment.unwrap_or_else(|| "0".to_string()),
                data.regular_payment_currency.unwrap_or_else(|| "CZK".to_string()),
                limits_json, data.notes, data.status.unwrap_or_else(|| "active".to_string()), now
            ],
        )?;
        
        conn.query_row(
            "SELECT id, type, provider, policy_name, policy_number, start_date, end_date,
                    payment_frequency, one_time_payment, one_time_payment_currency,
                    regular_payment, regular_payment_currency, limits, notes, status,
                    created_at, updated_at 
             FROM insurance_policies WHERE id = ?1",
            [&id],
            |row| {
                let limits_json: String = row.get(12)?;
                Ok(InsurancePolicy {
                    id: row.get(0)?,
                    policy_type: row.get(1)?,
                    provider: row.get(2)?,
                    policy_name: row.get(3)?,
                    policy_number: row.get(4)?,
                    start_date: row.get(5)?,
                    end_date: row.get(6)?,
                    payment_frequency: row.get(7)?,
                    one_time_payment: row.get(8)?,
                    one_time_payment_currency: row.get(9)?,
                    regular_payment: row.get(10)?,
                    regular_payment_currency: row.get(11)?,
                    limits: serde_json::from_str(&limits_json).unwrap_or_default(),
                    notes: row.get(13)?,
                    status: row.get(14)?,
                    created_at: row.get(15)?,
                    updated_at: row.get(16)?,
                })
            },
        ).map_err(|e| e.into())
    })
}

/// Update insurance policy
#[tauri::command]
pub async fn update_insurance(
    db: State<'_, Database>,
    id: String,
    data: InsertInsurancePolicy,
) -> Result<InsurancePolicy> {
    let now = chrono::Utc::now().timestamp();
    let limits_json = data.limits.map(|l| serde_json::to_string(&l).ok()).flatten();
    
    db.with_conn(|conn| {
        conn.execute(
            "UPDATE insurance_policies SET 
             type = ?1, provider = ?2, policy_name = ?3, policy_number = ?4,
             start_date = ?5, end_date = ?6, payment_frequency = ?7,
             one_time_payment = ?8, one_time_payment_currency = ?9,
             regular_payment = COALESCE(?10, regular_payment),
             regular_payment_currency = COALESCE(?11, regular_payment_currency),
             limits = COALESCE(?12, limits), notes = ?13, status = COALESCE(?14, status),
             updated_at = ?15 WHERE id = ?16",
            rusqlite::params![
                data.policy_type, data.provider, data.policy_name, data.policy_number,
                data.start_date, data.end_date, data.payment_frequency,
                data.one_time_payment, data.one_time_payment_currency,
                data.regular_payment, data.regular_payment_currency,
                limits_json, data.notes, data.status, now, id
            ],
        )?;
        
        conn.query_row(
            "SELECT id, type, provider, policy_name, policy_number, start_date, end_date,
                    payment_frequency, one_time_payment, one_time_payment_currency,
                    regular_payment, regular_payment_currency, limits, notes, status,
                    created_at, updated_at 
             FROM insurance_policies WHERE id = ?1",
            [&id],
            |row| {
                let limits_json: String = row.get(12)?;
                Ok(InsurancePolicy {
                    id: row.get(0)?,
                    policy_type: row.get(1)?,
                    provider: row.get(2)?,
                    policy_name: row.get(3)?,
                    policy_number: row.get(4)?,
                    start_date: row.get(5)?,
                    end_date: row.get(6)?,
                    payment_frequency: row.get(7)?,
                    one_time_payment: row.get(8)?,
                    one_time_payment_currency: row.get(9)?,
                    regular_payment: row.get(10)?,
                    regular_payment_currency: row.get(11)?,
                    limits: serde_json::from_str(&limits_json).unwrap_or_default(),
                    notes: row.get(13)?,
                    status: row.get(14)?,
                    created_at: row.get(15)?,
                    updated_at: row.get(16)?,
                })
            },
        ).map_err(|_| AppError::NotFound("Insurance policy not found".into()))
    })
}

/// Delete insurance policy
#[tauri::command]
pub async fn delete_insurance(db: State<'_, Database>, id: String) -> Result<()> {
    db.with_conn(|conn| {
        conn.execute("DELETE FROM real_estate_insurances WHERE insurance_id = ?1", [&id])?;
        let changes = conn.execute("DELETE FROM insurance_policies WHERE id = ?1", [&id])?;
        if changes == 0 {
            return Err(AppError::NotFound("Insurance policy not found".into()));
        }
        Ok(())
    })
}
