//! Moony - Personal Finance Manager
//!
//! Tauri v2 application with Rust backend

pub mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod services;

use db::Database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(Database::new())
        .invoke_handler(tauri::generate_handler![
            // Auth commands
            commands::auth::check_setup,
            commands::auth::setup,
            commands::auth::prepare_setup,
            commands::auth::confirm_setup,
            commands::auth::unlock,
            commands::auth::recover,
            commands::auth::prepare_recover,
            commands::auth::confirm_recover,
            commands::auth::logout,
            commands::auth::is_authenticated,
            commands::auth::get_user_profile,
            commands::auth::update_user_profile,
            commands::auth::prepare_change_password,
            commands::auth::confirm_change_password,
            commands::auth::delete_account,
            // Savings commands
            commands::savings::get_all_savings_accounts,
            commands::savings::get_savings_account,
            commands::savings::create_savings_account,
            commands::savings::update_savings_account,
            commands::savings::delete_savings_account,
            commands::savings::get_account_zones,
            commands::savings::create_account_zone,
            commands::savings::delete_account_zone,
            // Investment commands
            commands::investments::get_all_investments,
            commands::investments::create_investment,
            commands::investments::delete_investment,
            commands::investments::get_investment_transactions,
            commands::investments::create_investment_transaction,
            commands::investments::delete_investment_transaction,
            commands::investments::update_investment_transaction,
            commands::investments::import_investment_transactions,
            commands::investments::set_manual_price,
            commands::investments::delete_manual_price,
            commands::investments::set_manual_dividend,
            commands::investments::delete_manual_dividend,
            // Crypto commands
            commands::crypto::get_all_crypto,
            commands::crypto::create_crypto,
            commands::crypto::delete_crypto,
            commands::crypto::get_crypto_transactions,
            commands::crypto::create_crypto_transaction,
            commands::crypto::delete_crypto_transaction,
            commands::crypto::update_crypto_price,
            // Bond commands
            commands::bonds::get_all_bonds,
            commands::bonds::create_bond,
            commands::bonds::update_bond,
            commands::bonds::delete_bond,
            // Loan commands
            commands::loans::get_all_loans,
            commands::loans::create_loan,
            commands::loans::update_loan,
            commands::loans::delete_loan,
            // Real estate commands
            commands::real_estate::get_all_real_estate,
            commands::real_estate::get_real_estate,
            commands::real_estate::create_real_estate,
            commands::real_estate::update_real_estate,
            commands::real_estate::delete_real_estate,
            commands::real_estate::get_real_estate_costs,
            commands::real_estate::create_real_estate_cost,
            commands::real_estate::delete_real_estate_cost,
            commands::real_estate::update_real_estate_cost,
            commands::real_estate::link_loan_to_real_estate,
            commands::real_estate::unlink_loan_from_real_estate,
            commands::real_estate::get_real_estate_loans,
            // Real estate photo commands
            commands::real_estate::get_real_estate_photo_batches,
            commands::real_estate::create_photo_batch,
            commands::real_estate::add_photos_to_batch,
            commands::real_estate::update_photo_batch,
            commands::real_estate::delete_photo_batch,
            commands::real_estate::delete_real_estate_photo,
            // Insurance commands
            commands::insurance::get_all_insurance,
            commands::insurance::get_insurance,
            commands::insurance::create_insurance,
            commands::insurance::update_insurance,
            commands::insurance::delete_insurance,
            commands::insurance::get_insurance_documents,
            commands::insurance::add_insurance_document,
            commands::insurance::delete_insurance_document,
            commands::insurance::open_insurance_document,
            // Other assets commands
            commands::other_assets::get_all_other_assets,
            commands::other_assets::create_other_asset,
            commands::other_assets::update_other_asset,
            commands::other_assets::delete_other_asset,
            commands::other_assets::get_other_asset_transactions,
            commands::other_assets::create_other_asset_transaction,
            commands::other_assets::delete_other_asset_transaction,
            // Portfolio commands
            commands::portfolio::get_portfolio_metrics,
            commands::portfolio::get_portfolio_history,
            commands::portfolio::record_portfolio_snapshot,
            commands::portfolio::refresh_exchange_rates,
            commands::portfolio::get_exchange_rates,
            // Price API commands
            commands::price_api::get_api_keys,
            commands::price_api::set_api_keys,
            commands::price_api::refresh_stock_prices,
            commands::price_api::refresh_crypto_prices,
            commands::price_api::search_crypto,
            commands::price_api::refresh_dividends,
            commands::price_api::search_stock_tickers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
