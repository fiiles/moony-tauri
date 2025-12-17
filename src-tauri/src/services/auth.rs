//! Authentication service
//!
//! Handles user setup, unlock, recovery, and session management.
//! Uses file-based key storage compatible with Moony-local.

use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{InsertUserProfile, MenuPreferences, UpdateUserProfile, UserProfile};
use crate::services::crypto;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

/// Global session state
static IS_AUTHENTICATED: AtomicBool = AtomicBool::new(false);

/// Check if user is currently authenticated
pub fn is_authenticated() -> bool {
    IS_AUTHENTICATED.load(Ordering::SeqCst)
}

/// Set authentication state
fn set_authenticated(value: bool) {
    IS_AUTHENTICATED.store(value, Ordering::SeqCst);
}

/// File names for key storage
const SALT_FILE: &str = "salt";
const PASSWORD_KEY_FILE: &str = "key.enc";
const RECOVERY_KEY_FILE: &str = "recovery.enc";

/// Get paths for all key files
fn get_key_paths(data_dir: &Path) -> (PathBuf, PathBuf, PathBuf) {
    (
        data_dir.join(SALT_FILE),
        data_dir.join(PASSWORD_KEY_FILE),
        data_dir.join(RECOVERY_KEY_FILE),
    )
}

/// Check if database and key files exist (user has set up account)
pub fn database_exists(db_path: &Path) -> bool {
    if !db_path.exists() {
        return false;
    }

    // Also check for key files
    if let Some(data_dir) = db_path.parent() {
        let (salt_path, key_path, recovery_path) = get_key_paths(data_dir);
        return salt_path.exists() && key_path.exists() && recovery_path.exists();
    }

    false
}

/// Setup a new user account
///
/// Creates encrypted database, stores user profile, returns recovery key.
/// Key architecture:
/// 1. Generate random master key (32 bytes)
/// 2. Generate random salt (32 bytes)
/// 3. Encrypt master key with password-derived key -> key.enc
/// 4. Encrypt master key with recovery-derived key -> recovery.enc
/// 5. Use master key to encrypt SQLCipher database
pub fn setup_account(
    db: &Database,
    db_path: PathBuf,
    data: InsertUserProfile,
    password: &str,
) -> Result<String> {
    let data_dir = db_path
        .parent()
        .ok_or_else(|| AppError::Internal("Invalid database path".into()))?;

    // Ensure data directory exists
    fs::create_dir_all(data_dir)
        .map_err(|e| AppError::Database(format!("Failed to create data directory: {}", e)))?;

    let (salt_path, key_path, recovery_path) = get_key_paths(data_dir);

    // Generate cryptographic keys
    let master_key = crypto::generate_master_key();
    let salt = crypto::generate_salt();
    let recovery_key = crypto::generate_recovery_key();

    // Store salt
    crypto::write_salt(&salt_path, &salt)?;

    // Store master key encrypted with password
    crypto::store_password_encrypted_key(&master_key, password, &salt, &key_path)?;

    // Store master key encrypted with recovery key
    crypto::store_recovery_encrypted_key(&master_key, &recovery_key, &salt, &recovery_path)?;

    // Create encrypted database using master key
    let master_key_hex = crypto::master_key_to_hex(&master_key);
    db.create_with_key(db_path.clone(), &master_key_hex)?;

    // Create user profile
    let menu_prefs = data
        .menu_preferences
        .unwrap_or_else(MenuPreferences::all_enabled);
    let menu_prefs_json = serde_json::to_string(&menu_prefs)?;
    let currency = data.currency.unwrap_or_else(|| "CZK".to_string());
    let exclude_re = data.exclude_personal_real_estate.unwrap_or(false);

    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO user_profile (name, surname, email, menu_preferences, currency, exclude_personal_real_estate) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                data.name,
                data.surname,
                data.email,
                menu_prefs_json,
                currency,
                exclude_re as i32,
            ],
        )?;
        Ok(())
    })?;

    set_authenticated(true);

    Ok(recovery_key)
}

/// Unlock existing database with password
pub fn unlock(db: &Database, db_path: PathBuf, password: &str) -> Result<UserProfile> {
    let data_dir = db_path
        .parent()
        .ok_or_else(|| AppError::Internal("Invalid database path".into()))?;

    let (salt_path, key_path, _) = get_key_paths(data_dir);

    // Read salt
    let salt = crypto::read_salt(&salt_path)?;

    // Decrypt master key using password
    let master_key = crypto::decrypt_master_key_with_password(password, &salt, &key_path)?;

    // Open database with master key
    let master_key_hex = crypto::master_key_to_hex(&master_key);
    db.open_with_key(db_path, &master_key_hex)?;

    // Get user profile
    let profile =
        get_user_profile(db)?.ok_or_else(|| AppError::Auth("No user profile found".into()))?;

    set_authenticated(true);

    Ok(profile)
}

/// Recover account with recovery key
///
/// Uses recovery key to decrypt master key, then re-encrypts with new password.
/// Also generates a new recovery key for security.
pub fn recover_account(
    db: &Database,
    db_path: PathBuf,
    recovery_key: &str,
    new_password: &str,
) -> Result<(UserProfile, String)> {
    let data_dir = db_path
        .parent()
        .ok_or_else(|| AppError::Internal("Invalid database path".into()))?;

    let (salt_path, key_path, recovery_path) = get_key_paths(data_dir);

    // Read salt
    let salt = crypto::read_salt(&salt_path)?;

    // Decrypt master key using recovery key
    let master_key = crypto::decrypt_master_key_with_recovery(recovery_key, &salt, &recovery_path)?;

    // Generate new recovery key
    let new_recovery_key = crypto::generate_recovery_key();

    // Re-encrypt master key with new password
    crypto::store_password_encrypted_key(&master_key, new_password, &salt, &key_path)?;

    // Re-encrypt master key with new recovery key
    crypto::store_recovery_encrypted_key(&master_key, &new_recovery_key, &salt, &recovery_path)?;

    // Open database with master key
    let master_key_hex = crypto::master_key_to_hex(&master_key);
    db.open_with_key(db_path, &master_key_hex)?;

    // Get user profile
    let profile =
        get_user_profile(db)?.ok_or_else(|| AppError::Auth("No user profile found".into()))?;

    set_authenticated(true);

    Ok((profile, new_recovery_key))
}

/// Change password
///
/// Re-encrypts master key with new password. Recovery key remains unchanged.
pub fn change_password(_db: &Database, db_path: &Path, _new_password: &str) -> Result<()> {
    let data_dir = db_path
        .parent()
        .ok_or_else(|| AppError::Internal("Invalid database path".into()))?;

    let (_salt_path, _key_path, _) = get_key_paths(data_dir);

    // We need to get the master key from the currently open database connection
    // For simplicity, we'll require the user to be authenticated and re-derive from current session
    // In practice, we'd need to store the master key in memory during the session

    // TODO: Implement password change - this requires storing the master key in session
    Err(AppError::Auth(
        "Password change requires re-authentication".into(),
    ))
}

/// Lock the app (close database)
pub fn logout(db: &Database) {
    db.close();
    set_authenticated(false);
}

/// Get user profile from database
pub fn get_user_profile(db: &Database) -> Result<Option<UserProfile>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, surname, email, menu_preferences, currency, 
                    exclude_personal_real_estate, created_at 
             FROM user_profile LIMIT 1",
        )?;

        let result = stmt.query_row([], |row| {
            let menu_prefs_json: String = row.get(4)?;
            let menu_prefs: MenuPreferences =
                serde_json::from_str(&menu_prefs_json).unwrap_or_default();

            Ok(UserProfile {
                id: row.get(0)?,
                name: row.get(1)?,
                surname: row.get(2)?,
                email: row.get(3)?,
                menu_preferences: menu_prefs,
                currency: row.get(5)?,
                exclude_personal_real_estate: row.get::<_, i32>(6)? != 0,
                created_at: row.get(7)?,
            })
        });

        match result {
            Ok(profile) => Ok(Some(profile)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    })
}

/// Update user profile
pub fn update_user_profile(db: &Database, updates: UpdateUserProfile) -> Result<UserProfile> {
    db.with_conn(|conn| {
        let mut set_clauses = Vec::new();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ref name) = updates.name {
            set_clauses.push("name = ?".to_string());
            params.push(Box::new(name.clone()));
        }

        if let Some(ref surname) = updates.surname {
            set_clauses.push("surname = ?".to_string());
            params.push(Box::new(surname.clone()));
        }

        if let Some(ref email) = updates.email {
            set_clauses.push("email = ?".to_string());
            params.push(Box::new(email.clone()));
        }

        if let Some(ref prefs) = updates.menu_preferences {
            set_clauses.push("menu_preferences = ?".to_string());
            params.push(Box::new(serde_json::to_string(prefs)?));
        }

        if let Some(ref currency) = updates.currency {
            set_clauses.push("currency = ?".to_string());
            params.push(Box::new(currency.clone()));
        }

        if let Some(exclude) = updates.exclude_personal_real_estate {
            set_clauses.push("exclude_personal_real_estate = ?".to_string());
            params.push(Box::new(exclude as i32));
        }

        if set_clauses.is_empty() {
            return Ok(());
        }

        let sql = format!(
            "UPDATE user_profile SET {} WHERE id = 1",
            set_clauses.join(", ")
        );

        let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        conn.execute(&sql, params_refs.as_slice())?;

        Ok(())
    })?;

    get_user_profile(db)?.ok_or_else(|| AppError::NotFound("User profile not found".into()))
}

/// Delete entire account (database and key files)
pub fn delete_account(db: &Database, db_path: &Path) -> Result<()> {
    set_authenticated(false);
    db.close();

    // Delete database file
    if db_path.exists() {
        fs::remove_file(db_path)
            .map_err(|e| AppError::Database(format!("Failed to delete database: {}", e)))?;
    }

    // Delete key files
    if let Some(data_dir) = db_path.parent() {
        let (salt_path, key_path, recovery_path) = get_key_paths(data_dir);

        for path in [salt_path, key_path, recovery_path] {
            if path.exists() {
                let _ = fs::remove_file(path);
            }
        }
    }

    Ok(())
}
