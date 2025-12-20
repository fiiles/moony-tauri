//! Authentication commands

use crate::db::Database;
use crate::error::Result;
use crate::models::{InsertUserProfile, SetupData, UpdateUserProfile, UserProfile};
use crate::services::auth;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

/// Response for setup command (legacy - kept for compatibility)
#[derive(Serialize)]
pub struct SetupResponse {
    #[serde(rename = "recoveryKey")]
    pub recovery_key: String,
    pub profile: UserProfile,
}

/// Response for recover command
#[derive(Serialize)]
pub struct RecoverResponse {
    #[serde(rename = "recoveryKey")]
    pub recovery_key: String,
    pub profile: UserProfile,
}

/// Data for recover command
#[derive(Deserialize)]
pub struct RecoverData {
    #[serde(rename = "recoveryKey")]
    pub recovery_key: String,
    #[serde(rename = "newPassword")]
    pub new_password: String,
}

// ============================================================================
// 2-Phase Setup Commands
// ============================================================================

/// Response for prepare_setup - contains generated keys to show user
#[derive(Serialize)]
pub struct PrepareSetupResponse {
    #[serde(rename = "recoveryKey")]
    pub recovery_key: String,
    #[serde(rename = "masterKeyHex")]
    pub master_key_hex: String,
    pub salt: Vec<u8>,
}

/// Data for confirm_setup
#[derive(Deserialize)]
pub struct ConfirmSetupData {
    pub name: String,
    pub surname: String,
    pub email: String,
    pub password: String,
    #[serde(rename = "masterKeyHex")]
    pub master_key_hex: String,
    #[serde(rename = "recoveryKey")]
    pub recovery_key: String,
    pub salt: Vec<u8>,
    pub language: Option<String>,
}

// ============================================================================
// 2-Phase Change Password Commands
// ============================================================================

/// Data for prepare_change_password
#[derive(Deserialize)]
pub struct PrepareChangePasswordData {
    #[serde(rename = "currentPassword")]
    pub current_password: String,
}

/// Response for prepare_change_password
#[derive(Serialize)]
pub struct PrepareChangePasswordResponse {
    #[serde(rename = "recoveryKey")]
    pub recovery_key: String,
}

/// Data for confirm_change_password
#[derive(Deserialize)]
pub struct ConfirmChangePasswordData {
    #[serde(rename = "currentPassword")]
    pub current_password: String,
    #[serde(rename = "newPassword")]
    pub new_password: String,
    #[serde(rename = "recoveryKey")]
    pub recovery_key: String,
}

// ============================================================================
// 2-Phase Recovery Commands
// ============================================================================

/// Data for prepare_recover
#[derive(Deserialize)]
pub struct PrepareRecoverData {
    #[serde(rename = "recoveryKey")]
    pub recovery_key: String,
    #[serde(rename = "newPassword")]
    pub new_password: String,
}

/// Response for prepare_recover
#[derive(Serialize)]
pub struct PrepareRecoverResponse {
    #[serde(rename = "recoveryKey")]
    pub new_recovery_key: String,
}

/// Data for confirm_recover
#[derive(Deserialize)]
pub struct ConfirmRecoverData {
    #[serde(rename = "oldRecoveryKey")]
    pub old_recovery_key: String,
    #[serde(rename = "newPassword")]
    pub new_password: String,
    #[serde(rename = "newRecoveryKey")]
    pub new_recovery_key: String,
}

/// Get the database path for the app
fn get_db_path(app: &AppHandle) -> PathBuf {
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir");
    app_dir.join("moony.db")
}

/// Check if database exists (user has set up account)
#[tauri::command]
pub async fn check_setup(app: AppHandle) -> Result<bool> {
    let db_path = get_db_path(&app);
    Ok(auth::database_exists(&db_path))
}

/// Setup new account (legacy - single step, kept for compatibility)
#[tauri::command]
pub async fn setup(
    app: AppHandle,
    db: State<'_, Database>,
    data: SetupData,
) -> Result<SetupResponse> {
    let db_path = get_db_path(&app);

    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| {
            crate::error::AppError::Database(format!("Failed to create app directory: {}", e))
        })?;
    }

    let profile_data = InsertUserProfile {
        name: data.name,
        surname: data.surname,
        email: data.email,
        menu_preferences: None,
        currency: None,
        language: None,
        exclude_personal_real_estate: None,
    };

    let recovery_key = auth::setup_account(&db, db_path, profile_data, &data.password)?;
    let profile = auth::get_user_profile(&db)?.ok_or_else(|| {
        crate::error::AppError::Internal("Failed to get profile after setup".into())
    })?;

    Ok(SetupResponse {
        recovery_key,
        profile,
    })
}

/// Phase 1: Prepare setup - generates keys but doesn't persist
/// Returns recovery key so user can save it before we create the account
#[tauri::command]
pub async fn prepare_setup() -> Result<PrepareSetupResponse> {
    let prepared = auth::prepare_setup()?;
    Ok(PrepareSetupResponse {
        recovery_key: prepared.recovery_key,
        master_key_hex: prepared.master_key_hex,
        salt: prepared.salt,
    })
}

/// Phase 2: Confirm setup - persists all keys and creates account
/// Only called after user confirms they saved the recovery key
#[tauri::command]
pub async fn confirm_setup(
    app: AppHandle,
    db: State<'_, Database>,
    data: ConfirmSetupData,
) -> Result<UserProfile> {
    let db_path = get_db_path(&app);

    let profile_data = InsertUserProfile {
        name: data.name,
        surname: data.surname,
        email: data.email,
        menu_preferences: None,
        currency: None,
        language: data.language,
        exclude_personal_real_estate: None,
    };

    let prepared = auth::PreparedSetup {
        master_key_hex: data.master_key_hex,
        recovery_key: data.recovery_key,
        salt: data.salt,
    };

    auth::confirm_setup(&db, db_path, profile_data, &data.password, &prepared)
}

/// Unlock existing account
#[tauri::command]
pub async fn unlock(
    app: AppHandle,
    db: State<'_, Database>,
    password: String,
) -> Result<UserProfile> {
    let db_path = get_db_path(&app);
    auth::unlock(&db, db_path, &password)
}

/// Recover account using recovery key (legacy - single step, kept for compatibility)
#[tauri::command]
pub async fn recover(
    app: AppHandle,
    db: State<'_, Database>,
    data: RecoverData,
) -> Result<RecoverResponse> {
    let db_path = get_db_path(&app);
    let (profile, new_recovery_key) =
        auth::recover_account(&db, db_path, &data.recovery_key, &data.new_password)?;

    Ok(RecoverResponse {
        recovery_key: new_recovery_key,
        profile,
    })
}

/// Phase 1: Prepare recovery - verifies recovery key, generates new one
/// Returns new recovery key so user can save it before we make changes
#[tauri::command]
pub async fn prepare_recover(
    app: AppHandle,
    data: PrepareRecoverData,
) -> Result<PrepareRecoverResponse> {
    let db_path = get_db_path(&app);
    let new_recovery_key = auth::prepare_recover(&db_path, &data.recovery_key)?;
    Ok(PrepareRecoverResponse { new_recovery_key })
}

/// Phase 2: Confirm recovery - persists new password and recovery key
/// Only called after user confirms they saved the new recovery key
#[tauri::command]
pub async fn confirm_recover(
    app: AppHandle,
    db: State<'_, Database>,
    data: ConfirmRecoverData,
) -> Result<UserProfile> {
    let db_path = get_db_path(&app);
    auth::confirm_recover(
        &db,
        db_path,
        &data.old_recovery_key,
        &data.new_password,
        &data.new_recovery_key,
    )
}

/// Lock account (logout)
#[tauri::command]
pub async fn logout(db: State<'_, Database>) -> Result<()> {
    auth::logout(&db);
    Ok(())
}

/// Check if currently authenticated
#[tauri::command]
pub async fn is_authenticated() -> Result<bool> {
    Ok(auth::is_authenticated())
}

/// Get current user profile
#[tauri::command]
pub async fn get_user_profile(db: State<'_, Database>) -> Result<Option<UserProfile>> {
    auth::get_user_profile(&db)
}

/// Update user profile
#[tauri::command]
pub async fn update_user_profile(
    db: State<'_, Database>,
    updates: UpdateUserProfile,
) -> Result<UserProfile> {
    auth::update_user_profile(&db, updates)
}

/// Phase 1: Prepare password change - verifies current password, generates new recovery key
/// Returns new recovery key so user can save it before we make changes
#[tauri::command]
pub async fn prepare_change_password(
    app: AppHandle,
    data: PrepareChangePasswordData,
) -> Result<PrepareChangePasswordResponse> {
    let db_path = get_db_path(&app);
    let new_recovery_key = auth::prepare_change_password(&db_path, &data.current_password)?;
    Ok(PrepareChangePasswordResponse {
        recovery_key: new_recovery_key,
    })
}

/// Phase 2: Confirm password change - persists new password and recovery key
/// Only called after user confirms they saved the new recovery key
#[tauri::command]
pub async fn confirm_change_password(
    app: AppHandle,
    data: ConfirmChangePasswordData,
) -> Result<()> {
    let db_path = get_db_path(&app);
    auth::confirm_change_password(
        &db_path,
        &data.current_password,
        &data.new_password,
        &data.recovery_key,
    )
}

/// Delete account
#[tauri::command]
pub async fn delete_account(app: AppHandle, db: State<'_, Database>) -> Result<()> {
    let db_path = get_db_path(&app);
    auth::delete_account(&db, &db_path)
}
