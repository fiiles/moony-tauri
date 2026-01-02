//! User profile and app configuration models

use serde::{Deserialize, Serialize};
use specta::Type;

fn default_true() -> bool {
    true
}

/// Menu preferences for sidebar visibility
#[derive(Debug, Clone, Serialize, Deserialize, Default, Type)]
pub struct MenuPreferences {
    pub savings: bool,
    pub loans: bool,
    pub insurance: bool,
    pub investments: bool,
    pub bonds: bool,
    #[serde(rename = "realEstate")]
    pub real_estate: bool,
    #[serde(default = "default_true")]
    pub crypto: bool,
    #[serde(rename = "otherAssets", default = "default_true")]
    pub other_assets: bool,
}

impl MenuPreferences {
    pub fn all_enabled() -> Self {
        Self {
            savings: true,
            loans: true,
            insurance: true,
            investments: true,
            bonds: true,
            real_estate: true,
            crypto: true,
            other_assets: true,
        }
    }
}

/// User profile stored in database
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UserProfile {
    pub id: i64,
    pub name: String,
    pub surname: String,
    pub email: String,
    #[serde(rename = "menuPreferences")]
    pub menu_preferences: MenuPreferences,
    pub currency: String,
    pub language: String,
    #[serde(rename = "excludePersonalRealEstate")]
    pub exclude_personal_real_estate: bool,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

/// Data for creating/updating user profile
#[derive(Debug, Clone, Deserialize, Type)]
pub struct InsertUserProfile {
    pub name: String,
    pub surname: String,
    pub email: String,
    #[serde(rename = "menuPreferences")]
    pub menu_preferences: Option<MenuPreferences>,
    pub currency: Option<String>,
    pub language: Option<String>,
    #[serde(rename = "excludePersonalRealEstate")]
    pub exclude_personal_real_estate: Option<bool>,
}

/// Data for updating user profile (partial updates)
#[derive(Debug, Clone, Deserialize, Type)]
pub struct UpdateUserProfile {
    pub name: Option<String>,
    pub surname: Option<String>,
    pub email: Option<String>,
    #[serde(rename = "menuPreferences")]
    pub menu_preferences: Option<MenuPreferences>,
    pub currency: Option<String>,
    pub language: Option<String>,
    #[serde(rename = "excludePersonalRealEstate")]
    pub exclude_personal_real_estate: Option<bool>,
}

/// Setup data from frontend
#[derive(Debug, Clone, Deserialize)]
pub struct SetupData {
    pub name: String,
    pub surname: String,
    pub email: String,
    pub password: String,
}

/// Unlock data from frontend
#[derive(Debug, Clone, Deserialize)]
pub struct UnlockData {
    pub password: String,
}

/// Recovery data from frontend
#[derive(Debug, Clone, Deserialize)]
pub struct RecoverData {
    #[serde(rename = "recoveryKey")]
    pub recovery_key: String,
    #[serde(rename = "newPassword")]
    pub new_password: String,
}

/// Portfolio metrics history entry
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct PortfolioMetricsHistory {
    pub id: String,
    #[serde(rename = "totalSavings")]
    pub total_savings: String,
    #[serde(rename = "totalLoansPrincipal")]
    pub total_loans_principal: String,
    #[serde(rename = "totalInvestments")]
    pub total_investments: String,
    #[serde(rename = "totalCrypto")]
    pub total_crypto: String,
    #[serde(rename = "totalBonds")]
    pub total_bonds: String,
    #[serde(rename = "totalRealEstatePersonal")]
    pub total_real_estate_personal: String,
    #[serde(rename = "totalRealEstateInvestment")]
    pub total_real_estate_investment: String,
    #[serde(rename = "totalOtherAssets")]
    pub total_other_assets: String,
    #[serde(rename = "recordedAt")]
    pub recorded_at: i64,
}
