//! Tauri commands for the Smart Categorization Engine
//!
//! These commands provide the IPC interface for:
//! - Categorizing individual and batch transactions
//! - Learning from user corrections
//! - Retraining the ML model
//! - Managing categorization rules

use std::sync::Arc;

use rusqlite::OptionalExtension;
use tauri::State;
use uuid::Uuid;

use crate::db::Database;
use crate::services::categorization::tokenizer::simple_normalize;
use crate::services::categorization::{
    CategorizationEngine, CategorizationResult, CategorizationRule, TransactionInput,
};

/// State wrapper for thread-safe engine access
pub struct CategorizationState(pub Arc<CategorizationEngine>);

/// Categorize a single transaction using the waterfall approach
#[tauri::command]
pub async fn categorize_transaction(
    state: State<'_, CategorizationState>,
    transaction: TransactionInput,
) -> Result<CategorizationResult, String> {
    // Run categorization on background thread to avoid blocking
    let engine = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || engine.categorize(&transaction))
        .await
        .map_err(|e| format!("Categorization task panicked: {}", e))
}

/// Categorize multiple transactions in batch
#[tauri::command]
pub async fn categorize_batch(
    state: State<'_, CategorizationState>,
    transactions: Vec<TransactionInput>,
) -> Result<Vec<CategorizationResult>, String> {
    let engine = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || engine.categorize_batch(&transactions))
        .await
        .map_err(|e| format!("Batch categorization panicked: {}", e))
}

/// Learn from user's manual categorization with hierarchical matching
///
/// This stores the payee/iban → category mapping for instant future lookups
/// AND persists it to the database for future app sessions.
///
/// Hierarchical priority:
/// - iban = IBAN default (catches any payee for this iban)
/// - payee = payee default (catches any iban for this payee)
#[tauri::command]
pub async fn learn_categorization(
    state: State<'_, CategorizationState>,
    db: State<'_, Database>,
    payee: Option<String>,
    counterparty_iban: Option<String>,
    category_id: String,
) -> Result<(), String> {
    // Update in-memory engine
    state.0.learn_from_user(
        payee.as_deref(),
        counterparty_iban.as_deref(),
        &category_id,
    );

    // Persist to database using DELETE + INSERT pattern
    // (SQLite treats NULLs as distinct in unique indexes, so INSERT OR REPLACE doesn't work)
    let normalized = payee.as_ref().map(|p| simple_normalize(p));
    let original_payee = payee.clone();
    let iban_clone = counterparty_iban.clone();
    let category_clone = category_id.clone();
    let id = Uuid::new_v4().to_string();

    db.with_conn(|conn| {
        // First delete any existing entry with matching composite key
        conn.execute(
            "DELETE FROM learned_payees WHERE 
             (normalized_payee IS ?1 OR (?1 IS NULL AND normalized_payee IS NULL))
             AND (counterparty_iban IS ?2 OR (?2 IS NULL AND counterparty_iban IS NULL))",
            rusqlite::params![&normalized, &iban_clone],
        )?;
        // Then insert the new entry
        conn.execute(
            "INSERT INTO learned_payees (id, normalized_payee, original_payee, counterparty_iban, category_id, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, unixepoch())",
            rusqlite::params![id, &normalized, &original_payee, &iban_clone, &category_clone],
        )?;
        Ok(())
    }).map_err(|e| format!("Failed to persist learned payee: {}", e))?;

    log::info!(
        "Learned and persisted: payee={:?}, iban={:?} → {}",
        payee,
        counterparty_iban,
        category_id
    );
    Ok(())
}

/// Forget a learned payee mapping
///
/// Removes from both in-memory engine AND database.
/// Supports hierarchical forget: specify all attributes that were used during learn.
#[tauri::command]
pub async fn forget_payee(
    state: State<'_, CategorizationState>,
    db: State<'_, Database>,
    payee: Option<String>,
    counterparty_iban: Option<String>,
) -> Result<bool, String> {
    // Remove from in-memory engine
    let forgotten = state.0.forget_payee(
        payee.as_deref(),
        counterparty_iban.as_deref(),
    );

    if forgotten {
        // Also remove from database
        let normalized = payee.as_ref().map(|p| simple_normalize(p));
        db.with_conn(|conn| {
            // Delete matching the exact combination
            conn.execute(
                "DELETE FROM learned_payees WHERE 
                 (normalized_payee IS ?1 OR (?1 IS NULL AND normalized_payee IS NULL))
                 AND (counterparty_iban IS ?2 OR (?2 IS NULL AND counterparty_iban IS NULL))",
                rusqlite::params![normalized, counterparty_iban],
            )?;
            Ok(())
        })
        .map_err(|e| format!("Failed to delete from database: {}", e))?;

        log::info!(
            "Forgot and removed from DB: payee={:?}, iban={:?}",
            payee,
            counterparty_iban
        );
    }
    Ok(forgotten)
}

/// Update categorization rules (after user edits)
#[tauri::command]
pub async fn update_categorization_rules(
    state: State<'_, CategorizationState>,
    rules: Vec<CategorizationRule>,
) -> Result<(), String> {
    state.0.update_rules(rules);
    log::info!("Updated categorization rules");
    Ok(())
}

/// Get engine statistics
#[tauri::command]
pub async fn get_categorization_stats(
    state: State<'_, CategorizationState>,
) -> Result<CategorizationStats, String> {
    let stats = state.0.stats();
    Ok(CategorizationStats {
        active_rules: stats.active_rules,
        learned_payees: stats.learned_payees,
        ml_classes: stats.ml_classes,
        ml_vocabulary_size: stats.ml_vocabulary_size,
    })
}

/// Retrain ML model with provided samples
#[tauri::command]
pub async fn retrain_ml_model(
    state: State<'_, CategorizationState>,
    samples: Vec<TrainingSample>,
) -> Result<(), String> {
    let training_data: Vec<(String, String)> = samples
        .into_iter()
        .map(|s| (s.text, s.category_id))
        .collect();

    let engine = state.0.clone();
    let data = training_data;
    tauri::async_runtime::spawn_blocking(move || engine.retrain_ml(data))
        .await
        .map_err(|e| format!("Retrain task panicked: {}", e))?
        .map_err(|e| format!("Training failed: {}", e))?;

    log::info!("ML model retrained successfully");
    Ok(())
}

/// Export learned payees for persistence
#[tauri::command]
pub async fn export_learned_payees(
    state: State<'_, CategorizationState>,
) -> Result<std::collections::HashMap<String, String>, String> {
    Ok(state.0.export_learned_payees())
}

/// Import learned payees
#[tauri::command]
pub async fn import_learned_payees(
    state: State<'_, CategorizationState>,
    payees: std::collections::HashMap<String, String>,
) -> Result<usize, String> {
    let count = payees.len();
    state.0.import_learned_payees(payees);
    log::info!("Imported {} learned payees", count);
    Ok(count)
}

/// Load learned payees from the database
///
/// This should be called after app unlock to populate the in-memory engine
/// with previously learned payee → category mappings.
#[tauri::command]
pub async fn load_learned_payees_from_db(
    state: State<'_, CategorizationState>,
    db: State<'_, Database>,
) -> Result<usize, String> {
    // Load all learned payees
    let entries = db
        .with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT normalized_payee, counterparty_iban, category_id FROM learned_payees"
            )?;
            let rows = stmt.query_map([], |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })?;
            let entries: Vec<(Option<String>, Option<String>, String)> =
                rows.filter_map(|r| r.ok()).collect();
            Ok(entries)
        })
        .map_err(|e| format!("Failed to load learned payees: {}", e))?;

    let count = entries.len();
    if count > 0 {
        for (payee, iban, category) in entries {
            state
                .0
                .learn_from_user(payee.as_deref(), iban.as_deref(), &category);
        }
        log::info!("Loaded {} learned payees from database", count);
    }
    Ok(count)
}

/// Load user's own IBANs from bank accounts for internal transfer detection
///
/// This should be called after app unlock to enable automatic detection of
/// transactions between user's own accounts as "Internal Transfers".
#[tauri::command]
pub async fn load_own_ibans_from_db(
    state: State<'_, CategorizationState>,
    db: State<'_, Database>,
) -> Result<usize, String> {
    let ibans = db
        .with_conn(|conn| {
            let mut stmt = conn
                .prepare("SELECT iban FROM bank_accounts WHERE iban IS NOT NULL AND iban != ''")?;
            let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
            let ibans: Vec<String> = rows.filter_map(|r| r.ok()).collect();
            Ok(ibans)
        })
        .map_err(|e| format!("Failed to load IBANs: {}", e))?;

    let count = ibans.len();
    state.0.set_own_ibans(ibans);
    log::info!("Loaded {} own IBANs for internal transfer detection", count);
    Ok(count)
}

/// Initialize engine with training data from the database
/// This should be called after app startup to train on existing categorized transactions
#[tauri::command]
pub async fn initialize_ml_from_transactions(
    state: State<'_, CategorizationState>,
    samples: Vec<TrainingSample>,
) -> Result<(), String> {
    if samples.is_empty() {
        log::info!("No training samples provided, using base model only");
        return Ok(());
    }

    let training_data: Vec<(String, String)> = samples
        .into_iter()
        .map(|s| (s.text, s.category_id))
        .collect();

    let engine = state.0.clone();
    let data = training_data;
    match tauri::async_runtime::spawn_blocking(move || engine.retrain_ml(data))
        .await
        .map_err(|e| format!("Task panicked: {}", e))?
    {
        Ok(_) => {
            log::info!("ML model initialized from user transactions");
            Ok(())
        }
        Err(e) => {
            log::warn!("Could not initialize ML model: {}", e);
            Ok(()) // Non-fatal
        }
    }
}

// ==================== DTOs ====================

/// Statistics about the categorization engine
#[derive(serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CategorizationStats {
    pub active_rules: usize,
    pub learned_payees: usize,
    pub ml_classes: usize,
    pub ml_vocabulary_size: usize,
}

/// Training sample from frontend
#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSample {
    pub text: String,
    pub category_id: String,
}

// ==================== Learned Payees Management ====================

/// Learned payee entry for display in the management UI
#[derive(Debug, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct LearnedPayeeEntry {
    pub id: String,
    /// Rule type: "payee_default", "iban_only_default"
    pub rule_type: String,
    pub normalized_payee: Option<String>,
    pub original_payee: Option<String>,
    pub counterparty_iban: Option<String>,
    pub category_id: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Get all learned payees for management UI
#[tauri::command]
pub async fn get_learned_payees_list(
    db: State<'_, Database>,
) -> Result<Vec<LearnedPayeeEntry>, String> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, normalized_payee, original_payee, counterparty_iban, category_id, created_at, updated_at 
             FROM learned_payees 
             ORDER BY updated_at DESC"
        )?;
        
        let entries = stmt.query_map([], |row| {
            let normalized_payee: Option<String> = row.get(1)?;
            let counterparty_iban: Option<String> = row.get(3)?;
            
            // Determine rule type based on which fields are present
            let rule_type = match (&normalized_payee, &counterparty_iban) {
                (Some(_), Some(_)) => "iban_default",
                (Some(_), None) => "payee_default",
                (None, Some(_)) => "iban_only_default",
                (None, None) => "unknown",
            };
            
            Ok(LearnedPayeeEntry {
                id: row.get(0)?,
                rule_type: rule_type.to_string(),
                normalized_payee,
                original_payee: row.get(2)?,
                counterparty_iban,
                category_id: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();
        
        Ok(entries)
    }).map_err(|e| format!("Failed to load learned payees: {}", e))
}

/// Delete a learned payee by ID
#[tauri::command]
pub async fn delete_learned_payee(
    state: State<'_, CategorizationState>,
    db: State<'_, Database>,
    id: String,
) -> Result<(), String> {
    // First get the payee details to remove from in-memory engine
    let payee_data = db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT normalized_payee, counterparty_iban FROM learned_payees WHERE id = ?1"
        )?;
        let result: Option<(Option<String>, Option<String>)> = stmt.query_row([&id], |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(1)?,
            ))
        }).optional()?;
        Ok(result)
    }).map_err(|e| format!("Failed to find payee: {}", e))?;
    
    if let Some((payee, iban)) = payee_data {
        // Remove from in-memory engine
        state.0.forget_payee(payee.as_deref(), iban.as_deref());
        
        // Remove from database
        db.with_conn(|conn| {
            conn.execute("DELETE FROM learned_payees WHERE id = ?1", [&id])?;
            Ok(())
        }).map_err(|e| format!("Failed to delete payee: {}", e))?;
        
        log::info!("Deleted learned payee: {}", id);
    }
    
    Ok(())
}

/// Bulk delete learned payees by IDs
#[tauri::command]
pub async fn delete_learned_payees_bulk(
    state: State<'_, CategorizationState>,
    db: State<'_, Database>,
    ids: Vec<String>,
) -> Result<usize, String> {
    if ids.is_empty() {
        return Ok(0);
    }
    
    // Get all payee details first
    let payees_data = db.with_conn(|conn| {
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT id, normalized_payee, counterparty_iban FROM learned_payees WHERE id IN ({})",
            placeholders
        );
        let mut stmt = conn.prepare(&sql)?;
        let params: Vec<&dyn rusqlite::ToSql> = ids.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
        let entries = stmt.query_map(params.as_slice(), |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        })?
        .filter_map(|r| r.ok())
        .collect::<Vec<_>>();
        Ok(entries)
    }).map_err(|e| format!("Failed to find payees: {}", e))?;
    
    let count = payees_data.len();
    
    // Remove from in-memory engine
    for (_id, payee, iban) in &payees_data {
        state.0.forget_payee(payee.as_deref(), iban.as_deref());
    }
    
    // Remove from database
    db.with_conn(|conn| {
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!("DELETE FROM learned_payees WHERE id IN ({})", placeholders);
        let params: Vec<&dyn rusqlite::ToSql> = ids.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
        conn.execute(&sql, params.as_slice())?;
        Ok(())
    }).map_err(|e| format!("Failed to delete payees: {}", e))?;
    
    log::info!("Bulk deleted {} learned payees", count);
    Ok(count)
}

/// Update the category of an existing learned payee
#[tauri::command]
pub async fn update_learned_payee_category(
    state: State<'_, CategorizationState>,
    db: State<'_, Database>,
    id: String,
    category_id: String,
) -> Result<(), String> {
    // Get the payee details first
    let payee_data = db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT normalized_payee, counterparty_iban FROM learned_payees WHERE id = ?1"
        )?;
        let result: Option<(Option<String>, Option<String>)> = stmt.query_row([&id], |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(1)?,
            ))
        }).optional()?;
        Ok(result)
    }).map_err(|e| format!("Failed to find payee: {}", e))?;
    
    if let Some((payee, iban)) = payee_data {
        // Update in-memory engine
        state.0.learn_from_user(payee.as_deref(), iban.as_deref(), &category_id);
        
        // Update in database
        db.with_conn(|conn| {
            conn.execute(
                "UPDATE learned_payees SET category_id = ?1, updated_at = unixepoch() WHERE id = ?2",
                rusqlite::params![&category_id, &id],
            )?;
            Ok(())
        }).map_err(|e| format!("Failed to update payee category: {}", e))?;
        
        log::info!("Updated learned payee {} to category {}", id, category_id);
    }
    
    Ok(())
}

// ==================== Custom Rules Management ====================

/// Custom rule entry from database
#[derive(Debug, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CustomRule {
    pub id: String,
    pub name: String,
    pub rule_type: String,
    pub pattern: String,
    pub category_id: String,
    pub priority: i32,
    pub is_active: bool,
    pub stop_processing: bool,
    pub is_system: bool,
    pub created_at: i64,
}

/// Input for creating/updating custom rules
#[derive(Debug, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CustomRuleInput {
    pub name: String,
    pub rule_type: String,
    pub pattern: String,
    pub category_id: String,
    pub priority: i32,
    pub is_active: bool,
    pub stop_processing: bool,
}

/// Get all custom categorization rules
#[tauri::command]
pub async fn get_custom_rules(
    db: State<'_, Database>,
) -> Result<Vec<CustomRule>, String> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, rule_type, pattern, category_id, priority, is_active, stop_processing, is_system, created_at 
             FROM categorization_rules 
             ORDER BY priority DESC, created_at ASC"
        )?;
        
        let entries = stmt.query_map([], |row| {
            Ok(CustomRule {
                id: row.get(0)?,
                name: row.get(1)?,
                rule_type: row.get(2)?,
                pattern: row.get(3)?,
                category_id: row.get(4)?,
                priority: row.get(5)?,
                is_active: row.get::<_, i32>(6)? != 0,
                stop_processing: row.get::<_, i32>(7)? != 0,
                is_system: row.get::<_, i32>(8)? != 0,
                created_at: row.get(9)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();
        
        Ok(entries)
    }).map_err(|e| format!("Failed to load custom rules: {}", e))
}

/// Create a new custom categorization rule
#[tauri::command]
pub async fn create_custom_rule(
    db: State<'_, Database>,
    data: CustomRuleInput,
) -> Result<CustomRule, String> {
    let id = Uuid::new_v4().to_string();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    
    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO categorization_rules (id, name, rule_type, pattern, category_id, priority, is_active, stop_processing, is_system, created_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9)",
            rusqlite::params![
                &id,
                &data.name,
                &data.rule_type,
                &data.pattern,
                &data.category_id,
                data.priority,
                data.is_active as i32,
                data.stop_processing as i32,
                now,
            ],
        )?;
        Ok(())
    }).map_err(|e| format!("Failed to create rule: {}", e))?;
    
    log::info!("Created custom rule: {} ({})", data.name, id);
    
    Ok(CustomRule {
        id,
        name: data.name,
        rule_type: data.rule_type,
        pattern: data.pattern,
        category_id: data.category_id,
        priority: data.priority,
        is_active: data.is_active,
        stop_processing: data.stop_processing,
        is_system: false,
        created_at: now,
    })
}

/// Update an existing custom categorization rule
#[tauri::command]
pub async fn update_custom_rule(
    db: State<'_, Database>,
    id: String,
    data: CustomRuleInput,
) -> Result<CustomRule, String> {
    // Check if rule is system rule (cannot be edited)
    let is_system = db.with_conn(|conn| {
        let val = conn.query_row(
            "SELECT is_system FROM categorization_rules WHERE id = ?1",
            [&id],
            |row| row.get::<_, i32>(0),
        )?;
        Ok(val)
    }).map_err(|e| format!("Failed to find rule: {}", e))?;
    
    if is_system != 0 {
        return Err("Cannot modify system rules".to_string());
    }
    
    db.with_conn(|conn| {
        conn.execute(
            "UPDATE categorization_rules 
             SET name = ?1, rule_type = ?2, pattern = ?3, category_id = ?4, priority = ?5, is_active = ?6, stop_processing = ?7 
             WHERE id = ?8 AND is_system = 0",
            rusqlite::params![
                &data.name,
                &data.rule_type,
                &data.pattern,
                &data.category_id,
                data.priority,
                data.is_active as i32,
                data.stop_processing as i32,
                &id,
            ],
        )?;
        Ok(())
    }).map_err(|e| format!("Failed to update rule: {}", e))?;
    
    let created_at = db.with_conn(|conn| {
        let val = conn.query_row(
            "SELECT created_at FROM categorization_rules WHERE id = ?1",
            [&id],
            |row| row.get::<_, i64>(0),
        )?;
        Ok(val)
    }).unwrap_or(0);
    
    log::info!("Updated custom rule: {} ({})", data.name, id);
    
    Ok(CustomRule {
        id,
        name: data.name,
        rule_type: data.rule_type,
        pattern: data.pattern,
        category_id: data.category_id,
        priority: data.priority,
        is_active: data.is_active,
        stop_processing: data.stop_processing,
        is_system: false,
        created_at,
    })
}

/// Delete a custom categorization rule
#[tauri::command]
pub async fn delete_custom_rule(
    db: State<'_, Database>,
    id: String,
) -> Result<(), String> {
    // Check if rule is system rule (cannot be deleted)
    let is_system = db.with_conn(|conn| {
        let val = conn.query_row(
            "SELECT is_system FROM categorization_rules WHERE id = ?1",
            [&id],
            |row| row.get::<_, i32>(0),
        )?;
        Ok(val)
    }).map_err(|e| format!("Failed to find rule: {}", e))?;
    
    if is_system != 0 {
        return Err("Cannot delete system rules".to_string());
    }
    
    db.with_conn(|conn| {
        conn.execute("DELETE FROM categorization_rules WHERE id = ?1 AND is_system = 0", [&id])?;
        Ok(())
    }).map_err(|e| format!("Failed to delete rule: {}", e))?;
    
    log::info!("Deleted custom rule: {}", id);
    Ok(())
}
