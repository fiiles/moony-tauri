//! Cryptographic utilities for SQLCipher encryption
//!
//! Architecture (matching Moony-local):
//! - Master key: Random 32-byte key used for SQLCipher encryption
//! - Master key is encrypted by BOTH password AND recovery key
//! - When password/recovery key is used, it decrypts the master key
//! - Master key then opens the encrypted database
//!
//! File format for key.enc and recovery.enc:
//! IV (12 bytes) + AuthTag (16 bytes) + Ciphertext (32 bytes) = 60 bytes total

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::RngCore;
use scrypt::{scrypt, Params};
use std::fs;
use std::path::Path;

use crate::error::{AppError, Result};

const KEY_LENGTH: usize = 32; // 256 bits
const SALT_LENGTH: usize = 32;
const IV_LENGTH: usize = 12; // GCM recommended nonce length
const AUTH_TAG_LENGTH: usize = 16;

/// Derive encryption key from password/recovery key using scrypt
/// Matches Node.js: scrypt(password, salt, 32)
pub fn derive_key(secret: &str, salt: &[u8]) -> Result<[u8; KEY_LENGTH]> {
    // scrypt parameters: N=16384 (2^14), r=8, p=1
    // These match Node.js crypto.scrypt defaults
    let params = Params::new(14, 8, 1, KEY_LENGTH)
        .map_err(|e| AppError::Encryption(format!("Invalid scrypt params: {}", e)))?;

    let mut key = [0u8; KEY_LENGTH];
    scrypt(secret.as_bytes(), salt, &params, &mut key)
        .map_err(|e| AppError::Encryption(format!("scrypt failed: {}", e)))?;

    Ok(key)
}

/// Generate random master key for SQLCipher (32 bytes)
pub fn generate_master_key() -> [u8; KEY_LENGTH] {
    let mut key = [0u8; KEY_LENGTH];
    rand::rng().fill_bytes(&mut key);
    key
}

/// Generate random salt (32 bytes)
pub fn generate_salt() -> [u8; SALT_LENGTH] {
    let mut salt = [0u8; SALT_LENGTH];
    rand::rng().fill_bytes(&mut salt);
    salt
}

/// Encrypt data with key using AES-256-GCM
/// Returns: IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
/// This matches Node.js format: createCipheriv with getAuthTag()
pub fn encrypt_with_key(data: &[u8], key: &[u8; KEY_LENGTH]) -> Result<Vec<u8>> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| AppError::Encryption(format!("Failed to create cipher: {}", e)))?;

    // Generate random IV
    let mut iv = [0u8; IV_LENGTH];
    rand::rng().fill_bytes(&mut iv);
    let nonce = Nonce::from_slice(&iv);

    // Encrypt (ciphertext includes auth tag appended by aes-gcm)
    let ciphertext_with_tag = cipher
        .encrypt(nonce, data)
        .map_err(|e| AppError::Encryption(format!("Encryption failed: {}", e)))?;

    // aes-gcm appends auth tag at the end, we need to reformat to match Node.js:
    // Node.js format: IV + AuthTag + Ciphertext
    // aes-gcm format: Ciphertext + AuthTag
    let ciphertext_len = ciphertext_with_tag.len() - AUTH_TAG_LENGTH;
    let ciphertext = &ciphertext_with_tag[..ciphertext_len];
    let auth_tag = &ciphertext_with_tag[ciphertext_len..];

    // Combine: IV + AuthTag + Ciphertext
    let mut result = Vec::with_capacity(IV_LENGTH + AUTH_TAG_LENGTH + ciphertext_len);
    result.extend_from_slice(&iv);
    result.extend_from_slice(auth_tag);
    result.extend_from_slice(ciphertext);

    Ok(result)
}

/// Decrypt data with key using AES-256-GCM
/// Input format: IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
pub fn decrypt_with_key(encrypted_data: &[u8], key: &[u8; KEY_LENGTH]) -> Result<Vec<u8>> {
    if encrypted_data.len() < IV_LENGTH + AUTH_TAG_LENGTH {
        return Err(AppError::Encryption("Encrypted data too short".into()));
    }

    let iv = &encrypted_data[..IV_LENGTH];
    let auth_tag = &encrypted_data[IV_LENGTH..IV_LENGTH + AUTH_TAG_LENGTH];
    let ciphertext = &encrypted_data[IV_LENGTH + AUTH_TAG_LENGTH..];

    // Reconstruct aes-gcm format: Ciphertext + AuthTag
    let mut ciphertext_with_tag = Vec::with_capacity(ciphertext.len() + AUTH_TAG_LENGTH);
    ciphertext_with_tag.extend_from_slice(ciphertext);
    ciphertext_with_tag.extend_from_slice(auth_tag);

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| AppError::Encryption(format!("Failed to create cipher: {}", e)))?;

    let nonce = Nonce::from_slice(iv);

    cipher
        .decrypt(nonce, ciphertext_with_tag.as_ref())
        .map_err(|_| AppError::Auth("Invalid password or corrupted key file".into()))
}

/// Generate a recovery key in readable format (XXXX-XXXX-XXXX-XXXX-XXXX-XXXX)
/// Uses unambiguous characters to avoid confusion
pub fn generate_recovery_key() -> String {
    const CHARS: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No 0, O, 1, I
    let mut key = String::with_capacity(29); // 24 chars + 5 dashes
    let mut rng = rand::rng();
    let mut bytes = [0u8; 24];
    rng.fill_bytes(&mut bytes);

    for (i, &byte) in bytes.iter().enumerate() {
        if i > 0 && i % 4 == 0 {
            key.push('-');
        }
        key.push(CHARS[(byte as usize) % CHARS.len()] as char);
    }

    key
}

/// Convert master key to hex string for SQLCipher PRAGMA key
pub fn master_key_to_hex(master_key: &[u8]) -> String {
    format!("'{}'", hex::encode(master_key))
}

/// Convert hex string back to master key bytes
/// Handles the format from master_key_to_hex (with surrounding quotes)
pub fn hex_to_master_key(hex_str: &str) -> Result<[u8; KEY_LENGTH]> {
    // Remove surrounding quotes if present
    let clean_hex = hex_str.trim_matches('\'');

    let bytes = hex::decode(clean_hex)
        .map_err(|e| AppError::Encryption(format!("Invalid hex key: {}", e)))?;

    if bytes.len() != KEY_LENGTH {
        return Err(AppError::Encryption(format!(
            "Invalid key length: expected {}, got {}",
            KEY_LENGTH,
            bytes.len()
        )));
    }

    let mut key = [0u8; KEY_LENGTH];
    key.copy_from_slice(&bytes);
    Ok(key)
}

/// Read salt from file
pub fn read_salt(path: &Path) -> Result<[u8; SALT_LENGTH]> {
    let data =
        fs::read(path).map_err(|e| AppError::Encryption(format!("Failed to read salt: {}", e)))?;

    if data.len() != SALT_LENGTH {
        return Err(AppError::Encryption("Invalid salt file size".into()));
    }

    let mut salt = [0u8; SALT_LENGTH];
    salt.copy_from_slice(&data);
    Ok(salt)
}

/// Write salt to file
pub fn write_salt(path: &Path, salt: &[u8; SALT_LENGTH]) -> Result<()> {
    fs::write(path, salt).map_err(|e| AppError::Encryption(format!("Failed to write salt: {}", e)))
}

/// Read encrypted key from file
pub fn read_encrypted_key(path: &Path) -> Result<Vec<u8>> {
    fs::read(path).map_err(|e| AppError::Encryption(format!("Failed to read encrypted key: {}", e)))
}

/// Write encrypted key to file
pub fn write_encrypted_key(path: &Path, encrypted_key: &[u8]) -> Result<()> {
    fs::write(path, encrypted_key)
        .map_err(|e| AppError::Encryption(format!("Failed to write encrypted key: {}", e)))
}

/// Store master key encrypted with password
pub fn store_password_encrypted_key(
    master_key: &[u8; KEY_LENGTH],
    password: &str,
    salt: &[u8],
    key_file_path: &Path,
) -> Result<()> {
    let derived_key = derive_key(password, salt)?;
    let encrypted = encrypt_with_key(master_key, &derived_key)?;
    write_encrypted_key(key_file_path, &encrypted)
}

/// Store master key encrypted with recovery key
pub fn store_recovery_encrypted_key(
    master_key: &[u8; KEY_LENGTH],
    recovery_key: &str,
    salt: &[u8],
    recovery_file_path: &Path,
) -> Result<()> {
    // Normalize recovery key (remove dashes)
    let normalized = recovery_key.replace('-', "");
    let derived_key = derive_key(&normalized, salt)?;
    let encrypted = encrypt_with_key(master_key, &derived_key)?;
    write_encrypted_key(recovery_file_path, &encrypted)
}

/// Decrypt master key using password
pub fn decrypt_master_key_with_password(
    password: &str,
    salt: &[u8],
    key_file_path: &Path,
) -> Result<[u8; KEY_LENGTH]> {
    let encrypted = read_encrypted_key(key_file_path)?;
    let derived_key = derive_key(password, salt)?;
    let decrypted = decrypt_with_key(&encrypted, &derived_key).map_err(|_| {
        AppError::Auth(format!(
            "Decryption failed for {}. Ensure 'salt' and 'key.enc' are from the same backup.",
            key_file_path.display()
        ))
    })?;

    if decrypted.len() != KEY_LENGTH {
        return Err(AppError::Encryption("Invalid master key size".into()));
    }

    let mut master_key = [0u8; KEY_LENGTH];
    master_key.copy_from_slice(&decrypted);
    Ok(master_key)
}

/// Decrypt master key using recovery key
pub fn decrypt_master_key_with_recovery(
    recovery_key: &str,
    salt: &[u8],
    recovery_file_path: &Path,
) -> Result<[u8; KEY_LENGTH]> {
    let encrypted = read_encrypted_key(recovery_file_path)?;
    let normalized = recovery_key.replace('-', "");
    let derived_key = derive_key(&normalized, salt)?;
    let decrypted = decrypt_with_key(&encrypted, &derived_key).map_err(|_| {
        AppError::Auth(format!(
            "Recovery failed for {}. Ensure 'salt' and 'recovery.enc' are from the same backup.",
            recovery_file_path.display()
        ))
    })?;

    if decrypted.len() != KEY_LENGTH {
        return Err(AppError::Encryption("Invalid master key size".into()));
    }

    let mut master_key = [0u8; KEY_LENGTH];
    master_key.copy_from_slice(&decrypted);
    Ok(master_key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_derivation() {
        let salt = generate_salt();
        let key1 = derive_key("password123", &salt).unwrap();
        let key2 = derive_key("password123", &salt).unwrap();
        assert_eq!(key1, key2);

        let key3 = derive_key("different", &salt).unwrap();
        assert_ne!(key1, key3);
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = generate_master_key();
        let data = b"Hello, World!";

        let encrypted = encrypt_with_key(data, &key).unwrap();
        assert_ne!(encrypted.as_slice(), data);

        let decrypted = decrypt_with_key(&encrypted, &key).unwrap();
        assert_eq!(decrypted, data);
    }

    #[test]
    fn test_recovery_key_format() {
        let key = generate_recovery_key();
        assert_eq!(key.len(), 29); // 24 chars + 5 dashes
        assert_eq!(key.matches('-').count(), 5);
    }
}
