//! Models for Moony - Rust structs matching database schema
//!
//! All monetary values are stored as strings to preserve decimal precision

#![allow(dead_code)]

pub mod bank_accounts;
pub mod bank_transactions;
pub mod bonds;
pub mod cashflow;
pub mod crypto;
pub mod insurance;
pub mod investments;
pub mod loans;
pub mod other_assets;
pub mod projection;
pub mod real_estate;
pub mod savings;
pub mod stock_tags;
pub mod user;

// Re-export commonly used types
pub use bank_accounts::*;
pub use bank_transactions::*;
pub use bonds::*;
pub use cashflow::*;
pub use crypto::*;
pub use insurance::*;
pub use investments::*;
pub use loans::*;
pub use other_assets::*;
pub use projection::*;
pub use real_estate::*;
pub use savings::*;
pub use stock_tags::*;
pub use user::*;
