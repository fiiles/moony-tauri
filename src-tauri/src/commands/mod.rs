//! Tauri commands - IPC layer between frontend and Rust backend
//!
//! All commands are registered in lib.rs and called via invoke() from frontend

pub mod auth;
pub mod bonds;
pub mod crypto;
pub mod insurance;
pub mod investments;
pub mod loans;
pub mod other_assets;
pub mod portfolio;
pub mod price_api;
pub mod real_estate;
pub mod savings;
