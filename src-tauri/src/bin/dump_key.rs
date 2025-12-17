use moony_tauri_lib::services::crypto;
use std::io::{self, Write};
use std::path::PathBuf;

fn main() {
    println!("Moony Database Key Dumper");
    println!("-------------------------");

    let data_dir = find_data_dir();
    println!("Using data directory: {}", data_dir.display());

    let salt_path = data_dir.join("salt");
    let key_path = data_dir.join("key.enc");

    if !salt_path.exists() || !key_path.exists() {
        eprintln!("Error: Could not find 'salt' or 'key.enc' in the data directory.");
        eprintln!("Please run this tool from the directory containing moony.db, or ensure the standard path is correct.");
        std::process::exit(1);
    }

    print!("Enter your application password: ");
    io::stdout().flush().unwrap();

    let mut password = String::new();
    io::stdin().read_line(&mut password).unwrap();
    let password = password.trim();

    println!("\nAttempting to decrypt master key...");

    // Read salt
    let salt = match crypto::read_salt(&salt_path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to read salt: {}", e);
            std::process::exit(1);
        }
    };

    // Decrypt key
    match crypto::decrypt_master_key_with_password(password, &salt, &key_path) {
        Ok(master_key) => {
            let hex_key = hex::encode(master_key);
            println!("\nSUCCESS! Master Key Decrypted.");
            println!("---------------------------------------------------------------");
            println!("Copy one of the following formats based on your tool:");
            println!();
            println!("1. Raw Hex (Most common):");
            println!("   {}", hex_key);
            println!();
            println!("2. 0x-Prefixed (For DB Browser 'Raw key'):");
            println!("   0x{}", hex_key);
            println!();
            println!("3. SQL Literal (For PRAGMA commands):");
            println!("   x'{}'", hex_key);
            println!("---------------------------------------------------------------");
            println!("Instructions for DB Browser for SQLite:");
            println!("1. Open 'moony.db'");
            println!("2. Select 'SQLCipher' as the encryption setting.");
            println!(
                "3. For 'Password', enter the '0x-Prefixed' key from above: 0x{}",
                hex_key
            );
            println!("4. Ensure 'Encryption Settings' are set to 'SQLCipher 4 defaults' (Page size: 4096).");
        }
        Err(_) => {
            eprintln!("\nError: Failed to decrypt master key. Incorrect password?");
            std::process::exit(1);
        }
    }
}

fn find_data_dir() -> PathBuf {
    // 1. Check current directory
    let current = std::env::current_dir().unwrap();
    if current.join("salt").exists() {
        return current;
    }

    // 2. Check standard Mac path: ~/Library/Application Support/com.moony.app
    // Note: The bundle ID might be different, checking tauri.conf.json is best but hard here.
    // Based on previous logs, user path is /Users/filipkral/Documents/...
    // But the app data should be in standard location.

    if let Some(home) = dirs_next::home_dir() {
        // Try common variants
        let paths = [
            "Library/Application Support/com.filipkral.moony-tauri",
            "Library/Application Support/com.moony.app",
            "Library/Application Support/moony-tauri",
            ".moony",
        ];

        for p in paths {
            let path = home.join(p);
            if path.join("salt").exists() {
                return path;
            }
        }
    }

    // Default to current directory if not found, execution will fail later with clear message
    current
}

// We need a simple home_dir function since we don't have dirs crate in dependencies?
// modifying to use std::env for HOME if dirs is not available.
// Actually, `dirs` is not in Cargo.toml. I should stick to std::env::var("HOME").

mod dirs_next {
    use std::path::PathBuf;
    pub fn home_dir() -> Option<PathBuf> {
        std::env::var("HOME").ok().map(PathBuf::from)
    }
}
