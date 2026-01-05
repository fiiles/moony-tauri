//! Tauri commands for the Smart Categorization Engine
//!
//! These commands provide the IPC interface for:
//! - Categorizing individual and batch transactions
//! - Learning from user corrections
//! - Retraining the ML model
//! - Managing categorization rules

use std::sync::Arc;

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
/// This stores the payee/iban/vs → category mapping for instant future lookups
/// AND persists it to the database for future app sessions.
///
/// Hierarchical priority:
/// - payee + iban + vs = exact match for specific combination
/// - payee + iban + null = IBAN default (catches any vs for this payee+iban)
/// - payee + null + null = payee default (catches any iban/vs for this payee)
#[tauri::command]
pub async fn learn_categorization(
    state: State<'_, CategorizationState>,
    db: State<'_, Database>,
    payee: Option<String>,
    counterparty_iban: Option<String>,
    variable_symbol: Option<String>,
    category_id: String,
) -> Result<(), String> {
    // Update in-memory engine
    state.0.learn_from_user(
        payee.as_deref(),
        counterparty_iban.as_deref(),
        variable_symbol.as_deref(),
        &category_id,
    );

    // Persist to database
    let normalized = payee.as_ref().map(|p| simple_normalize(p));
    let original_payee = payee.clone();
    let iban_clone = counterparty_iban.clone();
    let vs_clone = variable_symbol.clone();
    let category_clone = category_id.clone();
    let id = Uuid::new_v4().to_string();

    db.with_conn(|conn| {
        conn.execute(
            "INSERT OR REPLACE INTO learned_payees (id, normalized_payee, original_payee, counterparty_iban, variable_symbol, category_id, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, unixepoch())",
            rusqlite::params![id, normalized, original_payee, iban_clone, vs_clone, category_clone],
        )?;
        Ok(())
    }).map_err(|e| format!("Failed to persist learned payee: {}", e))?;

    log::info!(
        "Learned and persisted: payee={:?}, iban={:?}, vs={:?} → {}",
        payee,
        counterparty_iban,
        variable_symbol,
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
    variable_symbol: Option<String>,
) -> Result<bool, String> {
    // Remove from in-memory engine
    let forgotten = state.0.forget_payee(
        payee.as_deref(),
        counterparty_iban.as_deref(),
        variable_symbol.as_deref(),
    );

    if forgotten {
        // Also remove from database
        let normalized = payee.as_ref().map(|p| simple_normalize(p));
        db.with_conn(|conn| {
            // Delete matching the exact combination
            conn.execute(
                "DELETE FROM learned_payees WHERE 
                 (normalized_payee IS ?1 OR (?1 IS NULL AND normalized_payee IS NULL))
                 AND (counterparty_iban IS ?2 OR (?2 IS NULL AND counterparty_iban IS NULL))
                 AND (variable_symbol IS ?3 OR (?3 IS NULL AND variable_symbol IS NULL))",
                rusqlite::params![normalized, counterparty_iban, variable_symbol],
            )?;
            Ok(())
        })
        .map_err(|e| format!("Failed to delete from database: {}", e))?;

        log::info!(
            "Forgot and removed from DB: payee={:?}, iban={:?}, vs={:?}",
            payee,
            counterparty_iban,
            variable_symbol
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
/// with previously learned payee → category mappings (including hierarchical attributes).
#[tauri::command]
pub async fn load_learned_payees_from_db(
    state: State<'_, CategorizationState>,
    db: State<'_, Database>,
) -> Result<usize, String> {
    // Load all learned payees with hierarchical attributes
    let entries = db
        .with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT normalized_payee, counterparty_iban, variable_symbol, category_id FROM learned_payees"
            )?;
            let rows = stmt.query_map([], |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, String>(3)?,
                ))
            })?;
            #[allow(clippy::type_complexity)]
            let entries: Vec<(Option<String>, Option<String>, Option<String>, String)> =
                rows.filter_map(|r| r.ok()).collect();
            Ok(entries)
        })
        .map_err(|e| format!("Failed to load learned payees: {}", e))?;

    let count = entries.len();
    if count > 0 {
        for (payee, iban, vs, category) in entries {
            state
                .0
                .learn_from_user(payee.as_deref(), iban.as_deref(), vs.as_deref(), &category);
        }
        log::info!("Loaded {} learned payees from database", count);
    }
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
