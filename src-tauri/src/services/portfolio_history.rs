//! Single writer for `portfolio_metrics_history`
//! (spec: docs/specs/2026-08-09-currency-native-history-design.md).
//!
//! Invariants enforced here and nowhere else:
//! - I1: native per-currency breakdowns are the canonical daily record.
//! - I3: CZK totals are a derived cache — computed from the breakdowns at the
//!   row's rates by this module only. No other code writes history columns.
//! - I4: provenance — `source = 'live'` rows are authentic records; a
//!   `'backfill'` write never overwrites a live row, while a live write
//!   overwrites anything for its day.
//!
//! Rate semantics: live rows convert at the current in-memory rates (identical
//! to what `save_rates_to_history_db` stores for today, so the timeseries and
//! the cache agree); backfill rows convert at their day's rates from the
//! timeseries (`get_rates_for_date`, ≤10-day walk-back, current-rates fallback
//! when the timeseries predates the day).

use std::collections::HashMap;

use rusqlite::Connection;
use uuid::Uuid;

use crate::error::Result;
use crate::services::currency::{convert_to_czk_with_rates, get_all_rates, get_rates_for_date};

pub const SECONDS_PER_DAY: i64 = 86_400;

/// Provenance of a snapshot row (see migration 002).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SnapshotSource {
    /// Recorded by the running app from live data — an authentic record.
    Live,
    /// Reconstructed after the fact (gap backfill, recalculation).
    Backfill,
}

impl SnapshotSource {
    fn as_str(self) -> &'static str {
        match self {
            SnapshotSource::Live => "live",
            SnapshotSource::Backfill => "backfill",
        }
    }
}

/// Native per-currency amounts for every asset class of one snapshot day.
/// Real estate is split so both stored totals can be derived; the stored
/// `real_estate_by_currency` column is the merge of the two maps.
#[derive(Debug, Clone, Default)]
pub struct ClassBreakdowns {
    pub savings: HashMap<String, f64>,
    pub investments: HashMap<String, f64>,
    pub crypto: HashMap<String, f64>,
    pub bonds: HashMap<String, f64>,
    pub real_estate_personal: HashMap<String, f64>,
    pub real_estate_investment: HashMap<String, f64>,
    pub loans: HashMap<String, f64>,
    pub other_assets: HashMap<String, f64>,
}

/// Transaction-driven classes that a targeted recalculation may rewrite on an
/// existing row (loans/bonds/real estate have no transaction history).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AssetClassKind {
    Savings,
    Investments,
    Crypto,
    OtherAssets,
}

/// Serialize a per-currency breakdown map for a `*_by_currency` column.
pub fn breakdown_json(map: &HashMap<String, f64>) -> String {
    serde_json::to_string(map).unwrap_or_else(|_| "{}".to_string())
}

fn czk_total(breakdown: &HashMap<String, f64>, rates: &HashMap<String, f64>) -> f64 {
    breakdown
        .iter()
        .map(|(currency, amount)| convert_to_czk_with_rates(*amount, currency, rates))
        .sum()
}

fn merged(a: &HashMap<String, f64>, b: &HashMap<String, f64>) -> HashMap<String, f64> {
    let mut out = a.clone();
    for (currency, amount) in b {
        *out.entry(currency.clone()).or_insert(0.0) += amount;
    }
    out
}

/// Insert or update the snapshot row for `recorded_at`'s day.
///
/// - `Live`: overwrites whatever exists for the day; the row keeps the given
///   (non-midnight) timestamp and becomes `source = 'live'`.
/// - `Backfill`: creates the row at the day's midnight, updates an existing
///   backfill row, and leaves an existing live row untouched.
pub fn upsert_snapshot(
    conn: &Connection,
    recorded_at: i64,
    source: SnapshotSource,
    breakdowns: &ClassBreakdowns,
) -> Result<()> {
    let day_start = (recorded_at / SECONDS_PER_DAY) * SECONDS_PER_DAY;

    let rates = match source {
        SnapshotSource::Live => get_all_rates(),
        SnapshotSource::Backfill => get_rates_for_date(conn, day_start),
    };

    let real_estate_merged = merged(
        &breakdowns.real_estate_personal,
        &breakdowns.real_estate_investment,
    );

    let existing: Option<(String, String)> = conn
        .query_row(
            "SELECT id, source FROM portfolio_metrics_history
             WHERE recorded_at >= ?1 AND recorded_at < ?2 LIMIT 1",
            [day_start, day_start + SECONDS_PER_DAY],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok();

    let row_ts = match source {
        SnapshotSource::Live => recorded_at,
        SnapshotSource::Backfill => day_start,
    };

    match existing {
        Some((_, existing_source))
            if source == SnapshotSource::Backfill && existing_source == "live" =>
        {
            // I4: reconstructions never replace authentic records.
            Ok(())
        }
        Some((id, _)) => {
            conn.execute(
                "UPDATE portfolio_metrics_history
                 SET total_savings = ?2, total_loans_principal = ?3, total_investments = ?4,
                     total_crypto = ?5, total_bonds = ?6, total_real_estate_personal = ?7,
                     total_real_estate_investment = ?8, total_other_assets = ?9, recorded_at = ?10,
                     investments_by_currency = ?11, crypto_by_currency = ?12,
                     savings_by_currency = ?13, bonds_by_currency = ?14,
                     real_estate_by_currency = ?15, loans_by_currency = ?16,
                     other_assets_by_currency = ?17, source = ?18
                 WHERE id = ?1",
                rusqlite::params![
                    id,
                    czk_total(&breakdowns.savings, &rates).to_string(),
                    czk_total(&breakdowns.loans, &rates).to_string(),
                    czk_total(&breakdowns.investments, &rates).to_string(),
                    czk_total(&breakdowns.crypto, &rates).to_string(),
                    czk_total(&breakdowns.bonds, &rates).to_string(),
                    czk_total(&breakdowns.real_estate_personal, &rates).to_string(),
                    czk_total(&breakdowns.real_estate_investment, &rates).to_string(),
                    czk_total(&breakdowns.other_assets, &rates).to_string(),
                    row_ts,
                    breakdown_json(&breakdowns.investments),
                    breakdown_json(&breakdowns.crypto),
                    breakdown_json(&breakdowns.savings),
                    breakdown_json(&breakdowns.bonds),
                    breakdown_json(&real_estate_merged),
                    breakdown_json(&breakdowns.loans),
                    breakdown_json(&breakdowns.other_assets),
                    source.as_str(),
                ],
            )?;
            Ok(())
        }
        None => {
            conn.execute(
                "INSERT INTO portfolio_metrics_history
                 (id, total_savings, total_loans_principal, total_investments, total_crypto,
                  total_bonds, total_real_estate_personal, total_real_estate_investment,
                  total_other_assets, recorded_at,
                  investments_by_currency, crypto_by_currency, savings_by_currency,
                  bonds_by_currency, real_estate_by_currency, loans_by_currency,
                  other_assets_by_currency, source)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
                         ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
                rusqlite::params![
                    Uuid::new_v4().to_string(),
                    czk_total(&breakdowns.savings, &rates).to_string(),
                    czk_total(&breakdowns.loans, &rates).to_string(),
                    czk_total(&breakdowns.investments, &rates).to_string(),
                    czk_total(&breakdowns.crypto, &rates).to_string(),
                    czk_total(&breakdowns.bonds, &rates).to_string(),
                    czk_total(&breakdowns.real_estate_personal, &rates).to_string(),
                    czk_total(&breakdowns.real_estate_investment, &rates).to_string(),
                    czk_total(&breakdowns.other_assets, &rates).to_string(),
                    row_ts,
                    breakdown_json(&breakdowns.investments),
                    breakdown_json(&breakdowns.crypto),
                    breakdown_json(&breakdowns.savings),
                    breakdown_json(&breakdowns.bonds),
                    breakdown_json(&real_estate_merged),
                    breakdown_json(&breakdowns.loans),
                    breakdown_json(&breakdowns.other_assets),
                    source.as_str(),
                ],
            )?;
            Ok(())
        }
    }
}

/// Static-class breakdowns used when reconstructing a day (savings, bonds,
/// loans, other assets, real estate split). Investments/crypto are rebuilt
/// from per-ticker history instead and are not part of this.
#[derive(Debug, Clone, Default)]
pub struct StaticBreakdowns {
    pub savings: HashMap<String, f64>,
    pub bonds: HashMap<String, f64>,
    pub loans: HashMap<String, f64>,
    pub other_assets: HashMap<String, f64>,
    pub real_estate_personal: HashMap<String, f64>,
    pub real_estate_investment: HashMap<String, f64>,
}

/// Static classes for a reconstructed day, carried from the nearest live
/// snapshot (spec decision: a live record beats today's balances). The
/// nearest **earlier** live row wins; days that precede every live row carry
/// **backward** from the earliest one instead — the first authentic record is
/// still a better statics estimate than nothing (zeroed savings/loans would
/// cliff the net-worth chart at the live boundary). Real estate is carried
/// from the live row's split CZK totals — the stored breakdown is combined,
/// so the split survives only in CZK terms. Returns None only when no live
/// row exists at all (caller falls back to current table values).
pub fn carried_statics_from_nearest_live(
    conn: &Connection,
    before_ts: i64,
) -> Result<Option<StaticBreakdowns>> {
    use crate::services::currency::breakdown_from_json;

    const COLUMNS: &str = "savings_by_currency, bonds_by_currency, loans_by_currency,
                    other_assets_by_currency,
                    CAST(total_real_estate_personal AS REAL),
                    CAST(total_real_estate_investment AS REAL)";

    type StaticsRow = (String, String, String, String, f64, f64);
    let fetch = |sql: String| -> Option<StaticsRow> {
        conn.query_row(&sql, [before_ts], |r| {
            Ok((
                r.get(0)?,
                r.get(1)?,
                r.get(2)?,
                r.get(3)?,
                r.get(4)?,
                r.get(5)?,
            ))
        })
        .ok()
    };

    let row = fetch(format!(
        "SELECT {COLUMNS} FROM portfolio_metrics_history
         WHERE recorded_at < ?1 AND source = 'live'
         ORDER BY recorded_at DESC LIMIT 1"
    ))
    .or_else(|| {
        fetch(format!(
            "SELECT {COLUMNS} FROM portfolio_metrics_history
             WHERE recorded_at >= ?1 AND source = 'live'
             ORDER BY recorded_at ASC LIMIT 1"
        ))
    });

    Ok(row.map(
        |(savings, bonds, loans, other, re_personal, re_investment)| {
            let czk_map = |v: f64| -> HashMap<String, f64> {
                if v != 0.0 {
                    HashMap::from([("CZK".to_string(), v)])
                } else {
                    HashMap::new()
                }
            };
            StaticBreakdowns {
                savings: breakdown_from_json(&savings),
                bonds: breakdown_from_json(&bonds),
                loans: breakdown_from_json(&loans),
                other_assets: breakdown_from_json(&other),
                real_estate_personal: czk_map(re_personal),
                real_estate_investment: czk_map(re_investment),
            }
        },
    ))
}

/// Rewrite selected transaction-driven classes of an existing snapshot row:
/// the class total and its breakdown change together, both derived at the
/// day's rates. Rows the day does not have are left for the full backfill to
/// create; every other column (including `source`) is untouched.
pub fn update_classes(
    conn: &Connection,
    day_timestamp: i64,
    classes: &[(AssetClassKind, HashMap<String, f64>)],
) -> Result<()> {
    let day_start = (day_timestamp / SECONDS_PER_DAY) * SECONDS_PER_DAY;
    let day_end = day_start + SECONDS_PER_DAY;

    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM portfolio_metrics_history
             WHERE recorded_at >= ?1 AND recorded_at < ?2 LIMIT 1",
            [day_start, day_end],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if !exists {
        return Ok(());
    }

    let rates = get_rates_for_date(conn, day_start);

    for (kind, breakdown) in classes {
        let (total_column, breakdown_column) = match kind {
            AssetClassKind::Savings => ("total_savings", "savings_by_currency"),
            AssetClassKind::Investments => ("total_investments", "investments_by_currency"),
            AssetClassKind::Crypto => ("total_crypto", "crypto_by_currency"),
            AssetClassKind::OtherAssets => ("total_other_assets", "other_assets_by_currency"),
        };
        let sql = format!(
            "UPDATE portfolio_metrics_history SET {total_column} = ?1, {breakdown_column} = ?2
             WHERE recorded_at >= ?3 AND recorded_at < ?4"
        );
        conn.execute(
            &sql,
            rusqlite::params![
                czk_total(breakdown, &rates).to_string(),
                breakdown_json(breakdown),
                day_start,
                day_end
            ],
        )?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(
            r#"
            CREATE TABLE portfolio_metrics_history (
                id TEXT PRIMARY KEY,
                total_savings TEXT NOT NULL,
                total_loans_principal TEXT NOT NULL,
                total_investments TEXT NOT NULL,
                total_crypto TEXT NOT NULL,
                total_bonds TEXT NOT NULL,
                total_real_estate_personal TEXT NOT NULL,
                total_real_estate_investment TEXT NOT NULL,
                total_other_assets TEXT NOT NULL DEFAULT '0',
                recorded_at INTEGER NOT NULL,
                investments_by_currency TEXT NOT NULL DEFAULT '{}',
                crypto_by_currency TEXT NOT NULL DEFAULT '{}',
                savings_by_currency TEXT NOT NULL DEFAULT '{}',
                bonds_by_currency TEXT NOT NULL DEFAULT '{}',
                real_estate_by_currency TEXT NOT NULL DEFAULT '{}',
                loans_by_currency TEXT NOT NULL DEFAULT '{}',
                other_assets_by_currency TEXT NOT NULL DEFAULT '{}',
                source TEXT NOT NULL DEFAULT 'live'
            );
            CREATE TABLE exchange_rate_history (
                date INTEGER NOT NULL,
                currency TEXT NOT NULL,
                rate REAL NOT NULL,
                PRIMARY KEY (date, currency)
            );
        "#,
        )
        .expect("schema");
        conn
    }

    const DAY: i64 = SECONDS_PER_DAY;
    const TEST_DAY: i64 = DAY * 20_000;

    fn insert_day_rate(conn: &Connection, day: i64, currency: &str, rate: f64) {
        conn.execute(
            "INSERT INTO exchange_rate_history (date, currency, rate) VALUES (?1, ?2, ?3)",
            rusqlite::params![day, currency, rate],
        )
        .expect("insert rate");
    }

    fn map(entries: &[(&str, f64)]) -> HashMap<String, f64> {
        entries.iter().map(|(c, v)| (c.to_string(), *v)).collect()
    }

    fn row(conn: &Connection) -> (String, String, String, String, i64, String) {
        conn.query_row(
            "SELECT total_investments, total_savings, investments_by_currency,
                    real_estate_by_currency, recorded_at, source
             FROM portfolio_metrics_history LIMIT 1",
            [],
            |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                ))
            },
        )
        .expect("row")
    }

    #[test]
    fn backfill_insert_derives_totals_at_day_rates() {
        let conn = setup_test_db();
        insert_day_rate(&conn, TEST_DAY, "USD", 20.0);

        let breakdowns = ClassBreakdowns {
            investments: map(&[("USD", 100.0)]),
            savings: map(&[("CZK", 500.0)]),
            ..Default::default()
        };
        upsert_snapshot(
            &conn,
            TEST_DAY + 3600,
            SnapshotSource::Backfill,
            &breakdowns,
        )
        .expect("upsert");

        let (inv, savings, inv_json, _, recorded_at, source) = row(&conn);
        assert_eq!(inv, "2000");
        assert_eq!(savings, "500");
        assert!(inv_json.contains("\"USD\":100"));
        assert_eq!(recorded_at, TEST_DAY, "backfill rows sit at midnight");
        assert_eq!(source, "backfill");
    }

    #[test]
    fn backfill_never_overwrites_live_row() {
        let conn = setup_test_db();
        insert_day_rate(&conn, TEST_DAY, "USD", 20.0);

        let live = ClassBreakdowns {
            investments: map(&[("CZK", 1111.0)]),
            ..Default::default()
        };
        upsert_snapshot(&conn, TEST_DAY + 4000, SnapshotSource::Live, &live).expect("live");

        let backfill = ClassBreakdowns {
            investments: map(&[("USD", 100.0)]),
            ..Default::default()
        };
        upsert_snapshot(&conn, TEST_DAY + 100, SnapshotSource::Backfill, &backfill)
            .expect("backfill");

        let (inv, _, _, _, recorded_at, source) = row(&conn);
        assert_eq!(inv, "1111", "live totals must survive a backfill write");
        assert_eq!(recorded_at, TEST_DAY + 4000);
        assert_eq!(source, "live");
    }

    #[test]
    fn live_overwrites_backfill_row_and_claims_provenance() {
        let conn = setup_test_db();
        insert_day_rate(&conn, TEST_DAY, "USD", 20.0);

        let backfill = ClassBreakdowns {
            investments: map(&[("USD", 100.0)]),
            ..Default::default()
        };
        upsert_snapshot(&conn, TEST_DAY, SnapshotSource::Backfill, &backfill).expect("backfill");

        let live = ClassBreakdowns {
            investments: map(&[("CZK", 3333.0)]),
            ..Default::default()
        };
        upsert_snapshot(&conn, TEST_DAY + 5555, SnapshotSource::Live, &live).expect("live");

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM portfolio_metrics_history", [], |r| {
                r.get(0)
            })
            .expect("count");
        assert_eq!(count, 1, "same day must stay one row");

        let (inv, _, _, _, recorded_at, source) = row(&conn);
        assert_eq!(inv, "3333");
        assert_eq!(recorded_at, TEST_DAY + 5555);
        assert_eq!(source, "live");
    }

    #[test]
    fn backfill_updates_existing_backfill_row() {
        let conn = setup_test_db();
        insert_day_rate(&conn, TEST_DAY, "USD", 20.0);

        let first = ClassBreakdowns {
            investments: map(&[("USD", 100.0)]),
            ..Default::default()
        };
        upsert_snapshot(&conn, TEST_DAY, SnapshotSource::Backfill, &first).expect("first");

        let second = ClassBreakdowns {
            investments: map(&[("USD", 150.0)]),
            ..Default::default()
        };
        upsert_snapshot(&conn, TEST_DAY, SnapshotSource::Backfill, &second).expect("second");

        let (inv, _, inv_json, _, _, source) = row(&conn);
        assert_eq!(inv, "3000");
        assert!(inv_json.contains("\"USD\":150"));
        assert_eq!(source, "backfill");
    }

    #[test]
    fn real_estate_split_totals_with_merged_breakdown() {
        let conn = setup_test_db();
        let breakdowns = ClassBreakdowns {
            real_estate_personal: map(&[("CZK", 100.0)]),
            real_estate_investment: map(&[("CZK", 50.0)]),
            ..Default::default()
        };
        upsert_snapshot(&conn, TEST_DAY, SnapshotSource::Backfill, &breakdowns).expect("upsert");

        let (personal, investment, re_json): (String, String, String) = conn
            .query_row(
                "SELECT total_real_estate_personal, total_real_estate_investment,
                        real_estate_by_currency
                 FROM portfolio_metrics_history",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .expect("row");
        assert_eq!(personal, "100");
        assert_eq!(investment, "50");
        assert!(re_json.contains("\"CZK\":150"));
    }

    #[test]
    fn update_classes_rewrites_total_and_breakdown_together() {
        let conn = setup_test_db();
        insert_day_rate(&conn, TEST_DAY, "USD", 20.0);

        let breakdowns = ClassBreakdowns {
            investments: map(&[("USD", 100.0)]),
            savings: map(&[("CZK", 500.0)]),
            ..Default::default()
        };
        upsert_snapshot(&conn, TEST_DAY, SnapshotSource::Backfill, &breakdowns).expect("upsert");

        update_classes(
            &conn,
            TEST_DAY,
            &[(AssetClassKind::Investments, map(&[("USD", 200.0)]))],
        )
        .expect("update classes");

        let (inv, savings, inv_json, _, _, _) = row(&conn);
        assert_eq!(inv, "4000", "total derived from the new breakdown");
        assert!(inv_json.contains("\"USD\":200"));
        assert_eq!(savings, "500", "other classes untouched");
    }

    #[test]
    fn carried_statics_come_from_nearest_earlier_live_row() {
        let conn = setup_test_db();
        insert_day_rate(&conn, TEST_DAY, "EUR", 25.0);

        // An older live row, a newer backfill row, and a live row after the
        // target date — only the older live row may be carried.
        let older_live = ClassBreakdowns {
            savings: map(&[("EUR", 40.0)]),
            bonds: map(&[("CZK", 100.0)]),
            real_estate_personal: map(&[("CZK", 900.0)]),
            ..Default::default()
        };
        upsert_snapshot(&conn, TEST_DAY + 500, SnapshotSource::Live, &older_live).expect("live");

        let newer_backfill = ClassBreakdowns {
            savings: map(&[("CZK", 7777.0)]),
            ..Default::default()
        };
        upsert_snapshot(
            &conn,
            TEST_DAY + DAY,
            SnapshotSource::Backfill,
            &newer_backfill,
        )
        .expect("backfill");

        let later_live = ClassBreakdowns {
            savings: map(&[("CZK", 9999.0)]),
            ..Default::default()
        };
        upsert_snapshot(&conn, TEST_DAY + 3 * DAY, SnapshotSource::Live, &later_live)
            .expect("later live");

        let statics = carried_statics_from_nearest_live(&conn, TEST_DAY + 2 * DAY)
            .expect("query")
            .expect("live row exists");
        assert!((statics.savings["EUR"] - 40.0).abs() < 1e-9);
        assert!((statics.bonds["CZK"] - 100.0).abs() < 1e-9);
        assert!((statics.real_estate_personal["CZK"] - 900.0).abs() < 1e-9);
        assert!(statics.loans.is_empty());
    }

    #[test]
    fn carried_statics_fall_back_to_the_earliest_later_live_row() {
        let conn = setup_test_db();
        // History starts with reconstructed days; the first live row comes
        // later. Days before it must carry from that first authentic record —
        // not from nothing (which would zero savings/loans and cliff the
        // net-worth chart at the live boundary).
        let first_live = ClassBreakdowns {
            savings: map(&[("CZK", 2500.0)]),
            loans: map(&[("CZK", 12000.0)]),
            ..Default::default()
        };
        upsert_snapshot(
            &conn,
            TEST_DAY + 5 * DAY + 700,
            SnapshotSource::Live,
            &first_live,
        )
        .expect("live");

        let statics = carried_statics_from_nearest_live(&conn, TEST_DAY)
            .expect("query")
            .expect("later live row exists");
        assert!((statics.savings["CZK"] - 2500.0).abs() < 1e-9);
        assert!((statics.loans["CZK"] - 12000.0).abs() < 1e-9);
    }

    #[test]
    fn carried_statics_none_without_any_live_row() {
        let conn = setup_test_db();
        let backfill = ClassBreakdowns {
            savings: map(&[("CZK", 1.0)]),
            ..Default::default()
        };
        upsert_snapshot(&conn, TEST_DAY, SnapshotSource::Backfill, &backfill).expect("backfill");
        assert!(carried_statics_from_nearest_live(&conn, TEST_DAY + DAY)
            .expect("query")
            .is_none());
    }

    #[test]
    fn update_classes_without_row_is_a_noop() {
        let conn = setup_test_db();
        update_classes(
            &conn,
            TEST_DAY,
            &[(AssetClassKind::Crypto, map(&[("USD", 1.0)]))],
        )
        .expect("no-op");
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM portfolio_metrics_history", [], |r| {
                r.get(0)
            })
            .expect("count");
        assert_eq!(count, 0);
    }
}
