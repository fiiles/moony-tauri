//! Authentication commands

use crate::db::Database;
use crate::error::Result;
use crate::models::{
    ChangePasswordData, InsertUserProfile, SetupData, UpdateUserProfile, UserProfile,
};
use crate::services::auth;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

/// Response for setup command
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

/// Setup new account
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

/// Recover account using recovery key
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

/// Change password
#[tauri::command]
pub async fn change_password(
    app: AppHandle,
    db: State<'_, Database>,
    data: ChangePasswordData,
) -> Result<()> {
    let db_path = get_db_path(&app);
    auth::change_password(&db, &db_path, &data.new_password)
}

/// Delete account
#[tauri::command]
pub async fn delete_account(app: AppHandle, db: State<'_, Database>) -> Result<()> {
    let db_path = get_db_path(&app);
    auth::delete_account(&db, &db_path)
}
