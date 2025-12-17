//! Savings account commands

use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{SavingsAccount, InsertSavingsAccount, SavingsAccountZone, InsertSavingsAccountZone};
use tauri::State;
use uuid::Uuid;

/// Get all savings accounts
/// Get all savings accounts
#[tauri::command]
pub async fn get_all_savings_accounts(db: State<'_, Database>) -> Result<Vec<SavingsAccount>> {
    let accounts: Vec<SavingsAccount> = db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, balance, currency, interest_rate, has_zone_designation, 
                    created_at, updated_at 
             FROM savings_accounts ORDER BY name"
        )?;
        
        let accounts = stmt.query_map([], |row| {
            Ok(SavingsAccount {
                id: row.get(0)?,
                name: row.get(1)?,
                balance: row.get(2)?,
                currency: row.get(3)?,
                interest_rate: row.get(4)?,
                has_zone_designation: row.get::<_, i32>(5)? != 0,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                effective_interest_rate: None,
                projected_earnings: None,
            })
        })?.filter_map(|r| r.ok()).collect();
        
        Ok(accounts)
    })?;

    // Calculate effective rates for zoned accounts
    let mut enriched_accounts = Vec::new();
    for mut account in accounts {
        if account.has_zone_designation {
            let zones = get_account_zones(db.clone(), account.id.clone()).await?;
            let balance = account.balance.parse::<f64>().unwrap_or(0.0);
            
            let mut total_earnings = 0.0;
            
            for zone in zones {
                let from_amount = zone.from_amount.parse::<f64>().unwrap_or(0.0);
                let to_amount = zone.to_amount
                    .and_then(|t| t.parse::<f64>().ok())
                    .unwrap_or(f64::MAX); // Unlimited if None
                let rate = zone.interest_rate.parse::<f64>().unwrap_or(0.0);

                if balance > from_amount {
                    let taxable_amount = f64::min(balance, to_amount) - from_amount;
                    if taxable_amount > 0.0 {
                        total_earnings += taxable_amount * (rate / 100.0);
                    }
                }
            }

            account.projected_earnings = Some(total_earnings);
            if balance > 0.0 {
                account.effective_interest_rate = Some((total_earnings / balance) * 100.0);
            } else {
                account.effective_interest_rate = Some(0.0);
            }
        }
        enriched_accounts.push(account);
    }
    
    Ok(enriched_accounts)
}

/// Get single savings account
#[tauri::command]
pub async fn get_savings_account(db: State<'_, Database>, id: String) -> Result<Option<SavingsAccount>> {
    let account = db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, balance, currency, interest_rate, has_zone_designation, 
                    created_at, updated_at 
             FROM savings_accounts WHERE id = ?1"
        )?;
        
        let result = stmt.query_row([&id], |row| {
            Ok(SavingsAccount {
                id: row.get(0)?,
                name: row.get(1)?,
                balance: row.get(2)?,
                currency: row.get(3)?,
                interest_rate: row.get(4)?,
                has_zone_designation: row.get::<_, i32>(5)? != 0,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                effective_interest_rate: None,
                projected_earnings: None,
            })
        });
        
        match result {
            Ok(account) => Ok(Some(account)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    })?;

    if let Some(mut acc) = account {
        if acc.has_zone_designation {
            let zones = get_account_zones(db.clone(), acc.id.clone()).await?;
            let balance = acc.balance.parse::<f64>().unwrap_or(0.0);
            
            let mut total_earnings = 0.0;
            
            for zone in zones {
                let from_amount = zone.from_amount.parse::<f64>().unwrap_or(0.0);
                let to_amount = zone.to_amount
                    .and_then(|t| t.parse::<f64>().ok())
                    .unwrap_or(f64::MAX);
                let rate = zone.interest_rate.parse::<f64>().unwrap_or(0.0);

                if balance > from_amount {
                    let taxable_amount = f64::min(balance, to_amount) - from_amount;
                    if taxable_amount > 0.0 {
                        total_earnings += taxable_amount * (rate / 100.0);
                    }
                }
            }

            acc.projected_earnings = Some(total_earnings);
            if balance > 0.0 {
                acc.effective_interest_rate = Some((total_earnings / balance) * 100.0);
            } else {
                acc.effective_interest_rate = Some(0.0);
            }
        }
        Ok(Some(acc))
    } else {
        Ok(None)
    }
}

/// Create savings account
#[tauri::command]
pub async fn create_savings_account(
    db: State<'_, Database>,
    data: InsertSavingsAccount,
) -> Result<SavingsAccount> {
    let id = Uuid::new_v4().to_string();
    let currency = data.currency.unwrap_or_else(|| "CZK".to_string());
    let interest_rate = data.interest_rate.unwrap_or_else(|| "0".to_string());
    let has_zone = data.has_zone_designation.unwrap_or(false);
    
    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO savings_accounts (id, name, balance, currency, interest_rate, has_zone_designation) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![id, data.name, data.balance, currency, interest_rate, has_zone as i32],
        )?;
        Ok(())
    })?;
    
    get_savings_account(db, id).await?
        .ok_or_else(|| AppError::Internal("Failed to retrieve created account".into()))
}

/// Update savings account
#[tauri::command]
pub async fn update_savings_account(
    db: State<'_, Database>,
    id: String,
    data: InsertSavingsAccount,
) -> Result<SavingsAccount> {
    let now = chrono::Utc::now().timestamp();
    
    db.with_conn(|conn| {
        let mut updates = vec!["name = ?1", "balance = ?2", "updated_at = ?3"];
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![
            Box::new(data.name.clone()),
            Box::new(data.balance.clone()),
            Box::new(now),
        ];
        
        if let Some(ref currency) = data.currency {
            updates.push("currency = ?4");
            params.push(Box::new(currency.clone()));
        }
        if let Some(ref rate) = data.interest_rate {
            updates.push("interest_rate = ?5");
            params.push(Box::new(rate.clone()));
        }
        if let Some(has_zone) = data.has_zone_designation {
            updates.push("has_zone_designation = ?6");
            params.push(Box::new(has_zone as i32));
        }
        
        // Simplified: just update all fields
        conn.execute(
            &format!(
                "UPDATE savings_accounts SET name = ?1, balance = ?2, updated_at = ?3, 
                 currency = COALESCE(?4, currency), 
                 interest_rate = COALESCE(?5, interest_rate),
                 has_zone_designation = COALESCE(?6, has_zone_designation)
                 WHERE id = ?7"
            ),
            rusqlite::params![
                data.name,
                data.balance,
                now,
                data.currency,
                data.interest_rate,
                data.has_zone_designation.map(|v| v as i32),
                id,
            ],
        )?;
        Ok(())
    })?;
    
    get_savings_account(db, id).await?
        .ok_or_else(|| AppError::NotFound("Savings account not found".into()))
}

/// Delete savings account
#[tauri::command]
pub async fn delete_savings_account(db: State<'_, Database>, id: String) -> Result<()> {
    db.with_conn(|conn| {
        let changes = conn.execute("DELETE FROM savings_accounts WHERE id = ?1", [&id])?;
        if changes == 0 {
            return Err(AppError::NotFound("Savings account not found".into()));
        }
        Ok(())
    })
}

/// Get zones for a savings account
#[tauri::command]
pub async fn get_account_zones(db: State<'_, Database>, account_id: String) -> Result<Vec<SavingsAccountZone>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, savings_account_id, from_amount, to_amount, interest_rate, created_at 
             FROM savings_account_zones WHERE savings_account_id = ?1 ORDER BY from_amount"
        )?;
        
        let zones = stmt.query_map([&account_id], |row| {
            Ok(SavingsAccountZone {
                id: row.get(0)?,
                savings_account_id: row.get(1)?,
                from_amount: row.get(2)?,
                to_amount: row.get(3)?,
                interest_rate: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        
        Ok(zones)
    })
}

/// Create zone for savings account
#[tauri::command]
pub async fn create_account_zone(
    db: State<'_, Database>,
    data: InsertSavingsAccountZone,
) -> Result<SavingsAccountZone> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    
    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO savings_account_zones (id, savings_account_id, from_amount, to_amount, interest_rate, created_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                id,
                data.savings_account_id,
                data.from_amount,
                data.to_amount,
                data.interest_rate,
                now,
            ],
        )?;
        
        Ok(SavingsAccountZone {
            id,
            savings_account_id: data.savings_account_id,
            from_amount: data.from_amount,
            to_amount: data.to_amount,
            interest_rate: data.interest_rate,
            created_at: now,
        })
    })
}

/// Delete zone
#[tauri::command]
pub async fn delete_account_zone(db: State<'_, Database>, zone_id: String) -> Result<()> {
    db.with_conn(|conn| {
        conn.execute("DELETE FROM savings_account_zones WHERE id = ?1", [&zone_id])?;
        Ok(())
    })
}
