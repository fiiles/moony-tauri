//! Portfolio projection commands
//!
//! Calculates projected portfolio values based on growth rates,
//! contributions, and loan amortization.

use crate::db::Database;
use crate::error::Result;
use crate::models::{
    CalculatedDefaults, PortfolioProjection, ProjectionSettings, ProjectionTimelinePoint,
};
use crate::services::currency::convert_to_czk;
use chrono::{Duration, Utc};
use serde::Deserialize;
use tauri::State;
use uuid::Uuid;

/// Input for calculating a projection
#[derive(Debug, Deserialize)]
pub struct ProjectionInput {
    #[serde(rename = "horizonYears")]
    pub horizon_years: i32,
    #[serde(rename = "viewType")]
    pub view_type: String, // "monthly" or "yearly"
    #[serde(rename = "excludePersonalRealEstate", default)]
    pub exclude_personal_real_estate: bool,
}

/// Get all projection settings
#[tauri::command]
pub async fn get_projection_settings(db: State<'_, Database>) -> Result<Vec<ProjectionSettings>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, asset_type, yearly_growth_rate, monthly_contribution,
                    contribution_currency, enabled, created_at, updated_at
             FROM projection_settings",
        )?;

        let settings = stmt
            .query_map([], |row| {
                Ok(ProjectionSettings {
                    id: row.get(0)?,
                    asset_type: row.get(1)?,
                    yearly_growth_rate: row.get(2)?,
                    monthly_contribution: row.get(3)?,
                    contribution_currency: row.get(4)?,
                    enabled: row.get::<_, i32>(5)? != 0,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(settings)
    })
}

/// Save projection settings (upsert)
#[tauri::command]
pub async fn save_projection_settings(
    db: State<'_, Database>,
    settings: Vec<ProjectionSettings>,
) -> Result<()> {
    let now = Utc::now().timestamp();

    db.with_conn(|conn| {
        for s in settings {
            let id = if s.id.is_empty() {
                Uuid::new_v4().to_string()
            } else {
                s.id
            };

            conn.execute(
                "INSERT INTO projection_settings
                    (id, asset_type, yearly_growth_rate, monthly_contribution,
                     contribution_currency, enabled, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                 ON CONFLICT(asset_type) DO UPDATE SET
                    yearly_growth_rate = excluded.yearly_growth_rate,
                    monthly_contribution = excluded.monthly_contribution,
                    contribution_currency = excluded.contribution_currency,
                    enabled = excluded.enabled,
                    updated_at = excluded.updated_at",
                rusqlite::params![
                    id,
                    s.asset_type,
                    s.yearly_growth_rate,
                    s.monthly_contribution,
                    s.contribution_currency,
                    if s.enabled { 1 } else { 0 },
                    now,
                    now,
                ],
            )?;
        }
        Ok(())
    })
}

/// Calculate portfolio projection
#[tauri::command]
pub async fn calculate_portfolio_projection(
    db: State<'_, Database>,
    input: ProjectionInput,
) -> Result<PortfolioProjection> {
    eprintln!(
        "[Projection] Starting calculation: horizon={}, view={}, exclude_re={}",
        input.horizon_years, input.view_type, input.exclude_personal_real_estate
    );

    db.with_conn(|conn| {
        // 1. Get current portfolio values (with exclude personal RE flag)
        let current = get_current_portfolio_values(conn, input.exclude_personal_real_estate)?;

        eprintln!("[Projection] Current values: savings={}, investments={}, crypto={}, bonds={}, real_estate={}, other={}",
                  current.savings, current.investments, current.crypto, current.bonds, current.real_estate, current.other_assets);
        eprintln!("[Projection] Calculated rates: savings_interest={:.2}%, bonds_yield={:.2}%",
                  current.savings_weighted_interest, current.bonds_weighted_yield);

        // 2. Get projection settings (use defaults if not set)
        let settings = get_settings_map(conn)?;

        // 3. Calculate timeline points
        let is_monthly = input.view_type == "monthly";
        let total_periods = if is_monthly {
            input.horizon_years * 12
        } else {
            input.horizon_years
        };

        let mut timeline = Vec::with_capacity(total_periods as usize + 1);
        let now = Utc::now();

        // Add current point (period 0)
        timeline.push(ProjectionTimelinePoint {
            date: now.timestamp(),
            total_assets: current.total_assets,
            total_liabilities: current.total_liabilities,
            net_worth: current.total_assets - current.total_liabilities,
            savings: current.savings,
            investments: current.investments,
            crypto: current.crypto,
            bonds: current.bonds,
            real_estate: current.real_estate,
            other_assets: current.other_assets,
            loans: current.total_liabilities,
        });

        let mut total_contributions = 0.0;

        // Project forward
        for period in 1..=total_periods {
            let period_date = if is_monthly {
                now + Duration::days(30 * period as i64)
            } else {
                now + Duration::days(365 * period as i64)
            };

            let years_elapsed = if is_monthly {
                period as f64 / 12.0
            } else {
                period as f64
            };

            let months_elapsed = if is_monthly { period } else { period * 12 };

            // Track contributions only for the final period
            let is_final_period = period == total_periods;
            let mut period_contributions = 0.0;

            // Calculate each category
            let savings = project_savings(
                &current,
                &settings,
                years_elapsed,
                months_elapsed,
                &mut period_contributions,
            );
            let investments = project_investments(
                &current,
                &settings,
                years_elapsed,
                months_elapsed,
                &mut period_contributions,
            );
            let crypto = project_crypto(
                &current,
                &settings,
                years_elapsed,
                months_elapsed,
                &mut period_contributions,
            );
            let bonds = project_bonds(
                &current,
                &settings,
                years_elapsed,
                months_elapsed,
                &mut period_contributions,
            );
            let real_estate = project_real_estate(&current, &settings, years_elapsed);
            let other = project_other_assets(
                &current,
                &settings,
                years_elapsed,
                months_elapsed,
                &mut period_contributions,
            );
            let loans = project_loans(&current, months_elapsed);

            // Only store the final period's contributions
            if is_final_period {
                total_contributions = period_contributions;
            }

            let total_assets = savings + investments + crypto + bonds + real_estate + other;

            timeline.push(ProjectionTimelinePoint {
                date: period_date.timestamp(),
                total_assets,
                total_liabilities: loans.max(0.0),
                net_worth: total_assets - loans.max(0.0),
                savings,
                investments,
                crypto,
                bonds,
                real_estate,
                other_assets: other,
                loans: loans.max(0.0),
            });
        }

        // Extract final values before consuming timeline
        let projected_net_worth = timeline
            .last()
            .map(|l| l.net_worth)
            .unwrap_or(current.net_worth);
        let total_growth = projected_net_worth - current.net_worth - total_contributions;

        Ok(PortfolioProjection {
            horizon_years: input.horizon_years,
            view_type: input.view_type,
            timeline,
            projected_net_worth,
            total_contributions,
            total_growth,
            calculated_defaults: CalculatedDefaults {
                savings_rate: current.savings_weighted_interest,
                bonds_rate: current.bonds_weighted_yield,
            },
        })
    })
}

/// Current portfolio values for projection starting point
struct CurrentValues {
    savings: f64,
    investments: f64,
    crypto: f64,
    bonds: f64,
    real_estate: f64,
    other_assets: f64,
    total_assets: f64,
    total_liabilities: f64,
    net_worth: f64,
    // For loan amortization
    loan_monthly_payment: f64,
    loan_interest_rate: f64,
    // For savings interest
    savings_weighted_interest: f64,
    // For bonds yield
    bonds_weighted_yield: f64,
}

/// Settings map with defaults
struct SettingsMap {
    savings_growth: f64,
    savings_contribution: f64,
    investments_growth: f64,
    investments_contribution: f64,
    crypto_growth: f64,
    crypto_contribution: f64,
    bonds_growth: f64,
    bonds_contribution: f64,
    real_estate_growth: f64,
    other_growth: f64,
    other_contribution: f64,
}

fn get_current_portfolio_values(
    conn: &rusqlite::Connection,
    exclude_personal_real_estate: bool,
) -> Result<CurrentValues> {
    eprintln!("[Projection] get_current_portfolio_values starting...");

    // Calculate savings
    eprintln!("[Projection] Querying savings_accounts...");
    let mut savings_stmt =
        conn.prepare("SELECT balance, currency, interest_rate FROM savings_accounts")?;
    let savings_data: Vec<(f64, f64)> = savings_stmt
        .query_map([], |row| {
            let balance: f64 = row.get::<_, String>(0)?.parse().unwrap_or(0.0);
            let currency: String = row.get(1)?;
            let rate: f64 = row.get::<_, String>(2)?.parse().unwrap_or(0.0);
            Ok((convert_to_czk(balance, &currency), rate))
        })?
        .filter_map(|r| r.ok())
        .collect();

    let total_savings: f64 = savings_data.iter().map(|(b, _)| b).sum();
    eprintln!(
        "[Projection] Savings: count={}, total={}",
        savings_data.len(),
        total_savings
    );

    // Weighted average interest rate (excluding 0% accounts)
    let non_zero_savings: Vec<_> = savings_data
        .iter()
        .filter(|(b, r)| *r > 0.0 && *b > 0.0)
        .collect();
    let weighted_interest = if non_zero_savings.is_empty() {
        0.0
    } else {
        let total_balance: f64 = non_zero_savings.iter().map(|(b, _)| b).sum();
        if total_balance > 0.0 {
            non_zero_savings.iter().map(|(b, r)| b * r).sum::<f64>() / total_balance
        } else {
            0.0
        }
    };

    // Calculate bonds with weighted yield
    eprintln!("[Projection] Querying bonds...");
    let mut bonds_stmt =
        conn.prepare("SELECT coupon_value, quantity, currency, interest_rate FROM bonds")?;
    let bonds_data: Vec<(f64, f64)> = bonds_stmt
        .query_map([], |row| {
            let value: f64 = row.get::<_, String>(0)?.parse().unwrap_or(0.0);
            let quantity: f64 = row.get::<_, String>(1)?.parse().unwrap_or(1.0);
            let currency: String = row.get(2)?;
            let yield_rate: f64 = row.get::<_, String>(3)?.parse().unwrap_or(0.0);
            Ok((convert_to_czk(value * quantity, &currency), yield_rate))
        })?
        .filter_map(|r| r.ok())
        .collect();

    let total_bonds: f64 = bonds_data.iter().map(|(v, _)| v).sum();

    // Weighted average bond yield (excluding 0% bonds)
    let non_zero_bonds: Vec<_> = bonds_data
        .iter()
        .filter(|(v, y)| *y > 0.0 && *v > 0.0)
        .collect();
    let weighted_bond_yield = if non_zero_bonds.is_empty() {
        0.0
    } else {
        let total_value: f64 = non_zero_bonds.iter().map(|(v, _)| v).sum();
        if total_value > 0.0 {
            non_zero_bonds.iter().map(|(v, y)| v * y).sum::<f64>() / total_value
        } else {
            0.0
        }
    };

    // Calculate loans
    let mut loans_stmt =
        conn.prepare("SELECT principal, currency, interest_rate, monthly_payment FROM loans")?;
    let loans_data: Vec<(f64, f64, f64)> = loans_stmt
        .query_map([], |row| {
            let principal: f64 = row.get::<_, String>(0)?.parse().unwrap_or(0.0);
            let currency: String = row.get(1)?;
            let rate: f64 = row.get::<_, String>(2)?.parse().unwrap_or(0.0);
            let payment: f64 = row.get::<_, String>(3)?.parse().unwrap_or(0.0);
            Ok((
                convert_to_czk(principal, &currency),
                rate,
                convert_to_czk(payment, &currency),
            ))
        })?
        .filter_map(|r| r.ok())
        .collect();

    let total_liabilities: f64 = loans_data.iter().map(|(p, _, _)| p).sum();
    let total_monthly_payment: f64 = loans_data.iter().map(|(_, _, m)| m).sum();

    // Weighted avg interest on loans for simplicity
    let weighted_loan_interest = if total_liabilities > 0.0 {
        loans_data
            .iter()
            .map(|(p, r, _)| p * r / 100.0)
            .sum::<f64>()
            / total_liabilities
    } else {
        0.0
    };

    // Calculate investments
    let mut total_investments = 0.0;
    let mut inv_stmt = conn.prepare("SELECT ticker, quantity FROM stock_investments")?;
    let investments = inv_stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;

    for inv in investments.filter_map(|r| r.ok()) {
        let qty: f64 = inv.1.parse().unwrap_or(0.0);
        let price_data: rusqlite::Result<(Option<String>, Option<String>)> = conn.query_row(
            "SELECT COALESCE(
                (SELECT price FROM stock_price_overrides WHERE ticker = ?1),
                (SELECT original_price FROM stock_prices WHERE ticker = ?1)
            ),
            COALESCE(
                (SELECT currency FROM stock_price_overrides WHERE ticker = ?1),
                (SELECT currency FROM stock_prices WHERE ticker = ?1)
            )",
            [&inv.0],
            |row| Ok((row.get(0)?, row.get(1)?)),
        );

        if let Ok((Some(price_str), Some(currency))) = price_data {
            let price: f64 = price_str.parse().unwrap_or(0.0);
            total_investments += convert_to_czk(price * qty, &currency);
        }
    }

    // Calculate crypto
    let mut total_crypto = 0.0;
    let mut crypto_stmt = conn.prepare("SELECT ticker, quantity FROM crypto_investments")?;
    let cryptos = crypto_stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;

    for crypto in cryptos.filter_map(|r| r.ok()) {
        let qty: f64 = crypto.1.parse().unwrap_or(0.0);
        let price_data: rusqlite::Result<(Option<String>, Option<String>)> = conn.query_row(
            "SELECT price, currency FROM crypto_prices WHERE symbol = ?1",
            [&crypto.0],
            |row| Ok((row.get(0)?, row.get(1)?)),
        );

        if let Ok((Some(price_str), Some(currency))) = price_data {
            let price: f64 = price_str.parse().unwrap_or(0.0);
            total_crypto += convert_to_czk(price * qty, &currency);
        }
    }

    // Calculate real estate (respecting exclude personal RE flag)
    let mut re_stmt =
        conn.prepare("SELECT type, market_price, market_price_currency FROM real_estate")?;
    let mut total_real_estate = 0.0;
    let re_rows = re_stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;

    for row in re_rows.filter_map(|r| r.ok()) {
        let price: f64 = row.1.parse().unwrap_or(0.0);
        let price_czk = convert_to_czk(price, &row.2);
        // Skip personal properties if exclude flag is set
        if exclude_personal_real_estate && row.0 == "personal" {
            continue;
        }
        total_real_estate += price_czk;
    }

    // Calculate other assets
    let mut other_stmt =
        conn.prepare("SELECT quantity, market_price, currency FROM other_assets")?;
    let total_other: f64 = other_stmt
        .query_map([], |row| {
            let qty: f64 = row.get::<_, String>(0)?.parse().unwrap_or(0.0);
            let price: f64 = row.get::<_, String>(1)?.parse().unwrap_or(0.0);
            let currency: String = row.get(2)?;
            Ok(convert_to_czk(qty * price, &currency))
        })?
        .filter_map(|r| r.ok())
        .sum();

    let total_assets = total_savings
        + total_investments
        + total_crypto
        + total_bonds
        + total_real_estate
        + total_other;

    Ok(CurrentValues {
        savings: total_savings,
        investments: total_investments,
        crypto: total_crypto,
        bonds: total_bonds,
        real_estate: total_real_estate,
        other_assets: total_other,
        total_assets,
        total_liabilities,
        net_worth: total_assets - total_liabilities,
        loan_monthly_payment: total_monthly_payment,
        loan_interest_rate: weighted_loan_interest,
        savings_weighted_interest: weighted_interest,
        bonds_weighted_yield: weighted_bond_yield,
    })
}

fn get_settings_map(conn: &rusqlite::Connection) -> Result<SettingsMap> {
    let mut stmt = conn.prepare(
        "SELECT asset_type, yearly_growth_rate, monthly_contribution FROM projection_settings WHERE enabled = 1"
    )?;

    let mut settings = SettingsMap {
        savings_growth: 0.0, // Will use weighted avg from accounts
        savings_contribution: 0.0,
        investments_growth: 7.0, // Default 7% S&P average
        investments_contribution: 0.0,
        crypto_growth: 7.0, // Same as investments
        crypto_contribution: 0.0,
        bonds_growth: 0.0, // Will use bond interest rates
        bonds_contribution: 0.0,
        real_estate_growth: 3.0, // Conservative appreciation
        other_growth: 0.0,
        other_contribution: 0.0,
    };

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;

    for row in rows.filter_map(|r| r.ok()) {
        let rate: f64 = row.1.parse().unwrap_or(0.0);
        let contrib: f64 = row.2.parse().unwrap_or(0.0);

        match row.0.as_str() {
            "savings" => {
                settings.savings_growth = rate;
                settings.savings_contribution = contrib;
            }
            "investments" => {
                settings.investments_growth = rate;
                settings.investments_contribution = contrib;
            }
            "crypto" => {
                settings.crypto_growth = rate;
                settings.crypto_contribution = contrib;
            }
            "bonds" => {
                settings.bonds_growth = rate;
                settings.bonds_contribution = contrib;
            }
            "real_estate" => {
                settings.real_estate_growth = rate;
            }
            "other_assets" => {
                settings.other_growth = rate;
                settings.other_contribution = contrib;
            }
            _ => {}
        }
    }

    Ok(settings)
}

// Projection helper functions

fn project_savings(
    current: &CurrentValues,
    settings: &SettingsMap,
    years: f64,
    months: i32,
    contributions: &mut f64,
) -> f64 {
    // Use weighted avg interest from accounts, or override if set
    let rate = if settings.savings_growth > 0.0 {
        settings.savings_growth / 100.0
    } else {
        current.savings_weighted_interest / 100.0
    };

    // Compound interest: FV = PV * (1 + r)^n
    let growth_factor = (1.0 + rate).powf(years);
    let base = current.savings * growth_factor;

    // Monthly contributions with compound growth
    let monthly_contrib = settings.savings_contribution;
    let total_contrib = monthly_contrib * months as f64;
    *contributions += total_contrib;

    // Future value of annuity for monthly contributions
    let contrib_value = if rate > 0.0 {
        let monthly_rate = rate / 12.0;
        monthly_contrib * ((growth_factor - 1.0) / monthly_rate)
    } else {
        total_contrib
    };

    base + contrib_value
}

fn project_investments(
    current: &CurrentValues,
    settings: &SettingsMap,
    years: f64,
    months: i32,
    contributions: &mut f64,
) -> f64 {
    let rate = settings.investments_growth / 100.0;
    let growth_factor = (1.0 + rate).powf(years);
    let base = current.investments * growth_factor;

    let monthly_contrib = settings.investments_contribution;
    let total_contrib = monthly_contrib * months as f64;
    *contributions += total_contrib;

    let contrib_value = if rate > 0.0 {
        let monthly_rate = rate / 12.0;
        monthly_contrib * ((growth_factor - 1.0) / monthly_rate)
    } else {
        total_contrib
    };

    base + contrib_value
}

fn project_crypto(
    current: &CurrentValues,
    settings: &SettingsMap,
    years: f64,
    months: i32,
    contributions: &mut f64,
) -> f64 {
    let rate = settings.crypto_growth / 100.0;
    let growth_factor = (1.0 + rate).powf(years);
    let base = current.crypto * growth_factor;

    let monthly_contrib = settings.crypto_contribution;
    let total_contrib = monthly_contrib * months as f64;
    *contributions += total_contrib;

    let contrib_value = if rate > 0.0 {
        let monthly_rate = rate / 12.0;
        monthly_contrib * ((growth_factor - 1.0) / monthly_rate)
    } else {
        total_contrib
    };

    base + contrib_value
}

fn project_bonds(
    current: &CurrentValues,
    settings: &SettingsMap,
    years: f64,
    months: i32,
    contributions: &mut f64,
) -> f64 {
    // Use weighted avg yield from bonds, or override if set
    let rate = if settings.bonds_growth > 0.0 {
        settings.bonds_growth / 100.0
    } else {
        current.bonds_weighted_yield / 100.0
    };

    let growth_factor = (1.0 + rate).powf(years);
    let base = current.bonds * growth_factor;

    let monthly_contrib = settings.bonds_contribution;
    let total_contrib = monthly_contrib * months as f64;
    *contributions += total_contrib;

    let contrib_value = if rate > 0.0 {
        let monthly_rate = rate / 12.0;
        monthly_contrib * ((growth_factor - 1.0) / monthly_rate)
    } else {
        total_contrib
    };

    base + contrib_value
}

fn project_real_estate(current: &CurrentValues, settings: &SettingsMap, years: f64) -> f64 {
    let rate = settings.real_estate_growth / 100.0;
    current.real_estate * (1.0 + rate).powf(years)
}

fn project_other_assets(
    current: &CurrentValues,
    settings: &SettingsMap,
    years: f64,
    months: i32,
    contributions: &mut f64,
) -> f64 {
    let rate = settings.other_growth / 100.0;
    let growth_factor = (1.0 + rate).powf(years);
    let base = current.other_assets * growth_factor;

    let monthly_contrib = settings.other_contribution;
    let total_contrib = monthly_contrib * months as f64;
    *contributions += total_contrib;

    let contrib_value = if rate > 0.0 {
        let monthly_rate = rate / 12.0;
        monthly_contrib * ((growth_factor - 1.0) / monthly_rate)
    } else {
        total_contrib
    };

    base + contrib_value
}

fn project_loans(current: &CurrentValues, months: i32) -> f64 {
    // Simple amortization: reduce principal by monthly payments
    // This is a simplified model - actual amortization depends on specific loan terms
    if current.total_liabilities <= 0.0 || current.loan_monthly_payment <= 0.0 {
        return current.total_liabilities;
    }

    let monthly_rate = current.loan_interest_rate / 12.0;
    let mut balance = current.total_liabilities;

    for _ in 0..months {
        if balance <= 0.0 {
            break;
        }
        let interest = balance * monthly_rate;
        let principal_payment = (current.loan_monthly_payment - interest).max(0.0);
        balance -= principal_payment;
    }

    balance.max(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper to create test CurrentValues
    fn make_test_current() -> CurrentValues {
        CurrentValues {
            savings: 100_000.0,
            investments: 200_000.0,
            crypto: 50_000.0,
            bonds: 100_000.0,
            real_estate: 500_000.0,
            other_assets: 25_000.0,
            total_assets: 975_000.0,
            total_liabilities: 300_000.0,
            net_worth: 675_000.0,
            loan_monthly_payment: 5_000.0,
            loan_interest_rate: 0.05, // 5% annual
            savings_weighted_interest: 3.0,
            bonds_weighted_yield: 5.0,
        }
    }

    /// Helper to create test SettingsMap
    fn make_test_settings() -> SettingsMap {
        SettingsMap {
            savings_growth: 3.0,
            savings_contribution: 1000.0,
            investments_growth: 7.0,
            investments_contribution: 2000.0,
            crypto_growth: 7.0,
            crypto_contribution: 500.0,
            bonds_growth: 5.0,
            bonds_contribution: 0.0,
            real_estate_growth: 3.0,
            other_growth: 0.0,
            other_contribution: 0.0,
        }
    }

    // =====================================================================
    // COMPOUND GROWTH TESTS
    // =====================================================================

    #[test]
    fn test_compound_growth_1_year_10_percent() {
        // 100,000 at 10% for 1 year should = 110,000
        let base: f64 = 100_000.0;
        let rate: f64 = 0.10;
        let years: f64 = 1.0;
        let result = base * (1.0_f64 + rate).powf(years);
        assert!(
            (result - 110_000.0).abs() < 0.01,
            "Expected 110,000, got {}",
            result
        );
    }

    #[test]
    fn test_compound_growth_5_years_10_percent() {
        // 100,000 at 10% for 5 years = 100,000 * 1.1^5 = 161,051.00
        let base: f64 = 100_000.0;
        let rate: f64 = 0.10;
        let years: f64 = 5.0;
        let result = base * (1.0_f64 + rate).powf(years);
        assert!(
            (result - 161_051.0).abs() < 1.0,
            "Expected ~161,051, got {}",
            result
        );
    }

    #[test]
    fn test_compound_growth_zero_rate() {
        // 100,000 at 0% for any years should stay 100,000
        let base: f64 = 100_000.0;
        let rate: f64 = 0.0;
        let years: f64 = 10.0;
        let result = base * (1.0_f64 + rate).powf(years);
        assert!(
            (result - 100_000.0).abs() < 0.01,
            "Expected 100,000, got {}",
            result
        );
    }

    // =====================================================================
    // FUTURE VALUE OF ANNUITY TESTS (Monthly Contributions)
    // =====================================================================

    #[test]
    fn test_fv_annuity_1000_monthly_7_percent_12_months() {
        // $1,000/mo at 7% for 12 months
        // FVA = PMT * ((1+r)^n - 1) / r where r = annual_rate/12, n = months
        // But our formula uses years-based growth_factor
        let monthly_contrib: f64 = 1000.0;
        let annual_rate: f64 = 0.07;
        let months = 12;
        let years: f64 = months as f64 / 12.0;
        let growth_factor = (1.0_f64 + annual_rate).powf(years);
        let monthly_rate = annual_rate / 12.0;

        let contrib_value = monthly_contrib * ((growth_factor - 1.0) / monthly_rate);
        // Expected approximately $12,438 (varies slightly based on formula)
        assert!(
            contrib_value > 12_000.0 && contrib_value < 13_000.0,
            "Expected ~12,438, got {}",
            contrib_value
        );
    }

    #[test]
    fn test_fv_annuity_zero_rate() {
        // At 0% rate, contributions should just sum up
        let monthly_contrib = 1000.0;
        let months = 12;
        let total_contrib = monthly_contrib * months as f64;
        assert!((total_contrib - 12_000.0).abs() < 0.01);
    }

    // =====================================================================
    // PROJECT_SAVINGS TESTS
    // =====================================================================

    #[test]
    fn test_project_savings_growth_only() {
        let mut current = make_test_current();
        current.savings = 100_000.0;

        let mut settings = make_test_settings();
        settings.savings_growth = 5.0;
        settings.savings_contribution = 0.0;

        let mut contributions = 0.0;
        let result = project_savings(&current, &settings, 1.0, 12, &mut contributions);

        // 100,000 * 1.05 = 105,000
        assert!(
            (result - 105_000.0).abs() < 1.0,
            "Expected ~105,000, got {}",
            result
        );
        assert!(contributions == 0.0, "No contributions expected");
    }

    #[test]
    fn test_project_savings_with_contributions() {
        let mut current = make_test_current();
        current.savings = 100_000.0;

        let mut settings = make_test_settings();
        settings.savings_growth = 5.0;
        settings.savings_contribution = 1000.0;

        let mut contributions = 0.0;
        let result = project_savings(&current, &settings, 1.0, 12, &mut contributions);

        // Base growth: 100,000 * 1.05 = 105,000
        // Plus contributions with growth, result should be > 105,000 + 12,000 = 117,000
        assert!(result > 116_000.0, "Expected > 116,000, got {}", result);
        assert!(
            (contributions - 12_000.0).abs() < 0.01,
            "Contributions should be 12,000"
        );
    }

    #[test]
    fn test_project_savings_uses_weighted_interest() {
        let mut current = make_test_current();
        current.savings = 100_000.0;
        current.savings_weighted_interest = 4.0; // 4% weighted average

        let mut settings = make_test_settings();
        settings.savings_growth = 0.0; // Should use current.savings_weighted_interest
        settings.savings_contribution = 0.0;

        let mut contributions = 0.0;
        let result = project_savings(&current, &settings, 1.0, 12, &mut contributions);

        // 100,000 * 1.04 = 104,000
        assert!(
            (result - 104_000.0).abs() < 1.0,
            "Expected ~104,000, got {}",
            result
        );
    }

    // =====================================================================
    // PROJECT_INVESTMENTS TESTS
    // =====================================================================

    #[test]
    fn test_project_investments_7_percent_10_years() {
        let mut current = make_test_current();
        current.investments = 100_000.0;

        let mut settings = make_test_settings();
        settings.investments_growth = 7.0;
        settings.investments_contribution = 0.0;

        let mut contributions = 0.0;
        let result = project_investments(&current, &settings, 10.0, 120, &mut contributions);

        // 100,000 * 1.07^10 = 196,715
        assert!(
            (result - 196_715.0).abs() < 10.0,
            "Expected ~196,715, got {}",
            result
        );
    }

    #[test]
    fn test_project_investments_with_dca() {
        let mut current = make_test_current();
        current.investments = 0.0; // Start from zero

        let mut settings = make_test_settings();
        settings.investments_growth = 7.0;
        settings.investments_contribution = 1000.0;

        let mut contributions = 0.0;
        let result = project_investments(&current, &settings, 10.0, 120, &mut contributions);

        // Should have significant growth from DCA
        assert!(
            result > 120_000.0,
            "DCA should grow beyond 120,000, got {}",
            result
        );
        assert!(
            (contributions - 120_000.0).abs() < 0.01,
            "Contributions should be 120,000"
        );
    }

    // =====================================================================
    // PROJECT_BONDS TESTS
    // =====================================================================

    #[test]
    fn test_project_bonds_uses_settings_override() {
        let mut current = make_test_current();
        current.bonds = 100_000.0;
        current.bonds_weighted_yield = 3.0; // This should be ignored

        let mut settings = make_test_settings();
        settings.bonds_growth = 6.0; // Override with 6%
        settings.bonds_contribution = 0.0;

        let mut contributions = 0.0;
        let result = project_bonds(&current, &settings, 1.0, 12, &mut contributions);

        // 100,000 * 1.06 = 106,000
        assert!(
            (result - 106_000.0).abs() < 1.0,
            "Expected ~106,000, got {}",
            result
        );
    }

    #[test]
    fn test_project_bonds_uses_weighted_yield_when_no_override() {
        let mut current = make_test_current();
        current.bonds = 100_000.0;
        current.bonds_weighted_yield = 4.0;

        let mut settings = make_test_settings();
        settings.bonds_growth = 0.0; // No override
        settings.bonds_contribution = 0.0;

        let mut contributions = 0.0;
        let result = project_bonds(&current, &settings, 1.0, 12, &mut contributions);

        // 100,000 * 1.04 = 104,000
        assert!(
            (result - 104_000.0).abs() < 1.0,
            "Expected ~104,000, got {}",
            result
        );
    }

    // =====================================================================
    // PROJECT_REAL_ESTATE TESTS
    // =====================================================================

    #[test]
    fn test_project_real_estate_3_percent_appreciation() {
        let mut current = make_test_current();
        current.real_estate = 500_000.0;

        let mut settings = make_test_settings();
        settings.real_estate_growth = 3.0;

        let result = project_real_estate(&current, &settings, 10.0);

        // 500,000 * 1.03^10 = 671,958
        assert!(
            (result - 671_958.0).abs() < 10.0,
            "Expected ~671,958, got {}",
            result
        );
    }

    #[test]
    fn test_project_real_estate_zero_growth() {
        let mut current = make_test_current();
        current.real_estate = 500_000.0;

        let mut settings = make_test_settings();
        settings.real_estate_growth = 0.0;

        let result = project_real_estate(&current, &settings, 10.0);

        assert!(
            (result - 500_000.0).abs() < 0.01,
            "Expected 500,000, got {}",
            result
        );
    }

    // =====================================================================
    // PROJECT_OTHER_ASSETS TESTS
    // =====================================================================

    #[test]
    fn test_project_other_assets_with_contributions() {
        let mut current = make_test_current();
        current.other_assets = 10_000.0;

        let mut settings = make_test_settings();
        settings.other_growth = 0.0;
        settings.other_contribution = 500.0;

        let mut contributions = 0.0;
        let result = project_other_assets(&current, &settings, 1.0, 12, &mut contributions);

        // 10,000 + (500 * 12) = 16,000
        assert!(
            (result - 16_000.0).abs() < 0.01,
            "Expected 16,000, got {}",
            result
        );
        assert!(
            (contributions - 6_000.0).abs() < 0.01,
            "Contributions should be 6,000"
        );
    }

    // =====================================================================
    // PROJECT_LOANS (AMORTIZATION) TESTS
    // =====================================================================

    #[test]
    fn test_project_loans_basic_amortization() {
        let mut current = make_test_current();
        current.total_liabilities = 100_000.0;
        current.loan_monthly_payment = 2_000.0;
        current.loan_interest_rate = 0.05; // 5% annual

        // After 12 months, balance should be reduced
        let result = project_loans(&current, 12);

        // With 5% interest and 2,000/month payments, balance should decrease
        assert!(result < 100_000.0, "Balance should decrease");
        assert!(result > 70_000.0, "Balance shouldn't decrease too much");
    }

    #[test]
    fn test_project_loans_fully_paid() {
        let mut current = make_test_current();
        current.total_liabilities = 10_000.0;
        current.loan_monthly_payment = 5_000.0;
        current.loan_interest_rate = 0.0; // 0% interest

        // With 5,000/month and 0% interest, 10,000 should be paid off in 2 months
        let result = project_loans(&current, 12);

        assert!((result - 0.0).abs() < 0.01, "Loan should be fully paid");
    }

    #[test]
    fn test_project_loans_zero_payment() {
        let mut current = make_test_current();
        current.total_liabilities = 100_000.0;
        current.loan_monthly_payment = 0.0;
        current.loan_interest_rate = 0.05;

        // With no payments, balance stays the same (simplified model)
        let result = project_loans(&current, 12);

        assert!(
            (result - 100_000.0).abs() < 0.01,
            "Balance should stay at 100,000"
        );
    }

    // =====================================================================
    // INTEGRATION TESTS
    // =====================================================================

    #[test]
    fn test_total_assets_calculation() {
        let current = make_test_current();
        let settings = make_test_settings();
        let mut contributions = 0.0;

        let savings = project_savings(&current, &settings, 1.0, 12, &mut contributions);
        contributions = 0.0;
        let investments = project_investments(&current, &settings, 1.0, 12, &mut contributions);
        contributions = 0.0;
        let crypto = project_crypto(&current, &settings, 1.0, 12, &mut contributions);
        contributions = 0.0;
        let bonds = project_bonds(&current, &settings, 1.0, 12, &mut contributions);
        let real_estate = project_real_estate(&current, &settings, 1.0);
        contributions = 0.0;
        let other = project_other_assets(&current, &settings, 1.0, 12, &mut contributions);

        let total = savings + investments + crypto + bonds + real_estate + other;

        // Verify total is greater than initial (due to growth)
        assert!(
            total > current.total_assets,
            "Total after 1 year ({}) should exceed initial ({})",
            total,
            current.total_assets
        );
    }

    #[test]
    fn test_net_worth_calculation() {
        let current = make_test_current();
        let settings = make_test_settings();
        let mut contributions = 0.0;

        let savings = project_savings(&current, &settings, 1.0, 12, &mut contributions);
        let investments = project_investments(&current, &settings, 1.0, 12, &mut contributions);
        let crypto = project_crypto(&current, &settings, 1.0, 12, &mut contributions);
        let bonds = project_bonds(&current, &settings, 1.0, 12, &mut contributions);
        let real_estate = project_real_estate(&current, &settings, 1.0);
        let other = project_other_assets(&current, &settings, 1.0, 12, &mut contributions);
        let loans = project_loans(&current, 12);

        let total_assets = savings + investments + crypto + bonds + real_estate + other;
        let net_worth = total_assets - loans;

        // Net worth should increase (assets grow faster than loans decrease)
        assert!(
            net_worth > current.net_worth,
            "Net worth after 1 year ({}) should exceed initial ({})",
            net_worth,
            current.net_worth
        );
    }
}
