//! Type bindings generation for TypeScript
//!
//! Run with: cargo test generate_bindings -- --ignored
//!
//! This module collects all types that need to be exported to TypeScript
//! for frontend use. The generated types ensure type safety across the
//! Rust backend and TypeScript frontend.

use specta::TypeCollection;

/// Collect all types that should be exported to TypeScript.
/// Each type registered here will be included in the generated TypeScript file.
pub fn collect_types() -> TypeCollection {
    let mut types = specta::TypeCollection::default();

    // User models
    types.register::<crate::models::UserProfile>();
    types.register::<crate::models::MenuPreferences>();
    types.register::<crate::models::UpdateUserProfile>();
    types.register::<crate::models::InsertUserProfile>();
    types.register::<crate::models::PortfolioMetricsHistory>();

    // Investment models
    types.register::<crate::models::StockInvestment>();
    types.register::<crate::models::EnrichedStockInvestment>();
    types.register::<crate::models::InsertStockInvestment>();
    types.register::<crate::models::InvestmentTransaction>();
    types.register::<crate::models::InsertInvestmentTransaction>();
    types.register::<crate::models::StockPriceOverride>();
    types.register::<crate::models::DividendOverride>();
    types.register::<crate::models::TickerValueHistory>();

    // Crypto models
    types.register::<crate::models::CryptoInvestment>();
    types.register::<crate::models::EnrichedCryptoInvestment>();
    types.register::<crate::models::InsertCryptoInvestment>();
    types.register::<crate::models::CryptoTransaction>();
    types.register::<crate::models::InsertCryptoTransaction>();

    // Savings models
    types.register::<crate::models::SavingsAccount>();
    types.register::<crate::models::InsertSavingsAccount>();
    types.register::<crate::models::SavingsAccountZone>();

    // Bond models
    types.register::<crate::models::Bond>();
    types.register::<crate::models::InsertBond>();

    // Loan models
    types.register::<crate::models::Loan>();
    types.register::<crate::models::InsertLoan>();

    // Real estate models
    types.register::<crate::models::RealEstate>();
    types.register::<crate::models::InsertRealEstate>();
    types.register::<crate::models::RecurringCost>();
    types.register::<crate::models::RealEstateOneTimeCost>();
    types.register::<crate::models::RealEstatePhotoBatch>();
    types.register::<crate::models::RealEstatePhoto>();
    types.register::<crate::models::RealEstateDocument>();

    // Insurance models
    types.register::<crate::models::InsurancePolicy>();
    types.register::<crate::models::InsertInsurancePolicy>();
    types.register::<crate::models::InsuranceLimit>();
    types.register::<crate::models::InsuranceDocument>();

    // Other assets models
    types.register::<crate::models::OtherAsset>();
    types.register::<crate::models::InsertOtherAsset>();
    types.register::<crate::models::OtherAssetTransaction>();
    types.register::<crate::models::InsertOtherAssetTransaction>();

    // Bank account models
    types.register::<crate::models::AccountType>();
    types.register::<crate::models::DataSource>();
    types.register::<crate::models::BankAccount>();
    types.register::<crate::models::InsertBankAccount>();
    types.register::<crate::models::Institution>();
    types.register::<crate::models::BankAccountWithInstitution>();

    // Bank transaction models
    types.register::<crate::models::TransactionType>();
    types.register::<crate::models::TransactionStatus>();
    types.register::<crate::models::BankTransaction>();
    types.register::<crate::models::InsertBankTransaction>();
    types.register::<crate::models::TransactionCategory>();
    types.register::<crate::models::TransactionRule>();
    types.register::<crate::models::TransactionFilters>();
    types.register::<crate::models::TransactionQueryResult>();

    // Stock tags models
    types.register::<crate::models::StockTag>();
    types.register::<crate::models::InsertStockTag>();
    types.register::<crate::models::StockTagGroup>();
    types.register::<crate::models::InsertStockTagGroup>();

    // Cashflow models
    types.register::<crate::models::CashflowItem>();
    types.register::<crate::models::InsertCashflowItem>();

    // Portfolio models
    types.register::<crate::commands::portfolio::PortfolioMetrics>();

    // Projection models
    types.register::<crate::models::ProjectionSettings>();

    types
}

#[cfg(test)]
mod tests {
    use super::*;
    use specta_typescript::{BigIntExportBehavior, Typescript};
    use std::path::Path;

    #[test]
    #[ignore] // Run manually: cargo test generate_bindings -- --ignored
    fn generate_bindings() {
        let types = collect_types();
        let output_path = Path::new("../shared/generated-types.ts");

        let typescript = Typescript::new()
            .header("// AUTO-GENERATED FILE - DO NOT EDIT\n// Generated by: cargo test generate_bindings -- --ignored\n")
            .bigint(BigIntExportBehavior::Number); // Use number for i64 timestamps

        typescript
            .export_to(output_path, &types)
            .expect("Failed to generate TypeScript bindings");

        println!("Generated TypeScript bindings at {:?}", output_path);
    }
}
