//! Database module for Moony
//!
//! Handles SQLCipher encrypted database connections and migrations

#![allow(dead_code)]

mod migrations;

use crate::error::{AppError, Result};
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

/// Database state managed by Tauri
pub struct Database {
    /// Mutex-protected connection (None when locked/closed)
    conn: Mutex<Option<Connection>>,
    /// Path to the database file
    db_path: Mutex<Option<PathBuf>>,
}

impl Database {
    /// Create a new database instance (not yet connected)
    pub fn new() -> Self {
        Self {
            conn: Mutex::new(None),
            db_path: Mutex::new(None),
        }
    }

    /// Check if the database is currently open/unlocked
    pub fn is_open(&self) -> bool {
        self.conn.lock().unwrap().is_some()
    }

    /// Open and unlock the database with a password (legacy method)
    ///
    /// The password is used as the SQLCipher encryption key
    pub fn open(&self, path: PathBuf, password: &str) -> Result<()> {
        let conn = Connection::open(&path)?;

        // Set SQLCipher encryption key
        conn.pragma_update(None, "key", password)?;

        // Enable foreign key constraints
        conn.execute("PRAGMA foreign_keys = ON", [])?;

        // Verify the key works by querying sqlite_master
        conn.query_row("SELECT count(*) FROM sqlite_master", [], |_| Ok(()))
            .map_err(|_| AppError::Auth("Invalid password or corrupted database".into()))?;

        // Run migrations
        migrations::run_migrations(&conn)?;

        // Store connection and path
        *self.conn.lock().unwrap() = Some(conn);
        *self.db_path.lock().unwrap() = Some(path);

        Ok(())
    }

    /// Open and unlock the database with a hex master key
    ///
    /// The key should be in format: 'hexstring' (with quotes, as expected by SQLCipher)
    pub fn open_with_key(&self, path: PathBuf, hex_key: &str) -> Result<()> {
        let conn = Connection::open(&path)?;

        // Set SQLCipher encryption key using hex format
        // SQLCipher expects: PRAGMA key = "x'hexstring'"
        let pragma_key = format!("x{}", hex_key);
        conn.pragma_update(None, "key", &pragma_key)?;

        // Enable foreign key constraints
        conn.execute("PRAGMA foreign_keys = ON", [])?;

        // Verify the key works by querying sqlite_master
        conn.query_row("SELECT count(*) FROM sqlite_master", [], |_| Ok(()))
            .map_err(|_| AppError::Auth("Invalid password or corrupted database".into()))?;

        // Run migrations
        migrations::run_migrations(&conn)?;

        // Store connection and path
        *self.conn.lock().unwrap() = Some(conn);
        *self.db_path.lock().unwrap() = Some(path);

        Ok(())
    }

    /// Create a new encrypted database (legacy method)
    pub fn create(&self, path: PathBuf, password: &str) -> Result<()> {
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| AppError::Database(format!("Failed to create directory: {}", e)))?;
        }

        let conn = Connection::open(&path)?;

        // Set SQLCipher encryption key
        conn.pragma_update(None, "key", password)?;

        // Enable foreign key constraints
        conn.execute("PRAGMA foreign_keys = ON", [])?;

        // Run migrations to create schema
        migrations::run_migrations(&conn)?;

        // Store connection and path
        *self.conn.lock().unwrap() = Some(conn);
        *self.db_path.lock().unwrap() = Some(path);

        Ok(())
    }

    /// Create a new encrypted database with a hex master key
    ///
    /// The key should be in format: 'hexstring' (with quotes, as expected by SQLCipher)
    pub fn create_with_key(&self, path: PathBuf, hex_key: &str) -> Result<()> {
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| AppError::Database(format!("Failed to create directory: {}", e)))?;
        }

        let conn = Connection::open(&path)?;

        // Set SQLCipher encryption key using hex format
        let pragma_key = format!("x{}", hex_key);
        conn.pragma_update(None, "key", &pragma_key)?;

        // Enable foreign key constraints
        conn.execute("PRAGMA foreign_keys = ON", [])?;

        // Run migrations to create schema
        migrations::run_migrations(&conn)?;

        // Store connection and path
        *self.conn.lock().unwrap() = Some(conn);
        *self.db_path.lock().unwrap() = Some(path);

        Ok(())
    }

    /// Close the database connection (lock the app)
    pub fn close(&self) {
        *self.conn.lock().unwrap() = None;
    }

    /// Execute a function with the database connection
    /// Returns an error if the database is not open
    pub fn with_conn<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&Connection) -> Result<T>,
    {
        let guard = self.conn.lock().unwrap();
        let conn = guard
            .as_ref()
            .ok_or_else(|| AppError::Auth("Database is locked".into()))?;
        f(conn)
    }

    /// Execute a mutable function with the database connection
    pub fn with_conn_mut<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&mut Connection) -> Result<T>,
    {
        let mut guard = self.conn.lock().unwrap();
        let conn = guard
            .as_mut()
            .ok_or_else(|| AppError::Auth("Database is locked".into()))?;
        f(conn)
    }

    /// Change the database encryption password
    pub fn change_password(&self, new_password: &str) -> Result<()> {
        self.with_conn(|conn| {
            conn.pragma_update(None, "rekey", new_password)?;
            Ok(())
        })
    }

    /// Delete the database file (for account deletion)
    pub fn delete_database(&self) -> Result<()> {
        // Close connection first
        self.close();

        // Get and clear the path
        let path = self.db_path.lock().unwrap().take();

        if let Some(path) = path {
            std::fs::remove_file(&path)
                .map_err(|e| AppError::Database(format!("Failed to delete database: {}", e)))?;
        }

        Ok(())
    }

    /// Get the database file path
    pub fn get_path(&self) -> Option<PathBuf> {
        self.db_path.lock().unwrap().clone()
    }
}

impl Default for Database {
    fn default() -> Self {
        Self::new()
    }
}
