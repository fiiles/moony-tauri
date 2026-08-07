//! Demo database generator
//!
//! Creates a fully working, encrypted Moony data directory seeded with
//! realistic synthetic finances — for screenshots, demos, and safe UI
//! development without touching real data.
//!
//! # Usage
//! ```bash
//! cd src-tauri
//! cargo run --bin seed_demo            # writes ../demo-home/
//! # from repo root — HOME redirects app data; RUSTUP/CARGO stay at the real home:
//! HOME=$(pwd)/demo-home RUSTUP_HOME=~/.rustup CARGO_HOME=~/.cargo npm run tauri dev
//! ```
//!
//! Unlock password: `demo1234`

use moony_tauri_lib::db::Database;
use moony_tauri_lib::models::{
    InsertBankAccount, InsertCryptoTransaction, InsertInvestmentTransaction, InsertUserProfile,
};
use moony_tauri_lib::services::{auth, bank_accounts, crypto_investments, investments};
use rusqlite::params;
use uuid::Uuid;

const DEMO_PASSWORD: &str = "demo1234";

/// (qty, price, days_ago)
type Buys = &'static [(f64, f64, i64)];
const DAY: i64 = 86_400;

/// Deterministic pseudo-random generator (LCG) so every run produces the same data
struct Rng(u64);
impl Rng {
    fn next(&mut self) -> f64 {
        self.0 = self
            .0
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        ((self.0 >> 33) as f64) / (u32::MAX as f64)
    }
    /// uniform in [lo, hi)
    fn range(&mut self, lo: f64, hi: f64) -> f64 {
        lo + (hi - lo) * self.next()
    }
}

fn main() {
    let repo_root = std::env::current_dir()
        .expect("cwd")
        .parent()
        .expect("repo root")
        .to_path_buf();
    let demo_home = repo_root.join("demo-home");
    let data_dir = demo_home.join("Library/Application Support/com.filipkral.moony-tauri");

    if data_dir.exists() {
        std::fs::remove_dir_all(&data_dir).expect("clear previous demo data dir");
    }
    std::fs::create_dir_all(&data_dir).expect("create demo data dir");

    let db_path = data_dir.join("moony.db");
    let db = Database::new();

    let profile = InsertUserProfile {
        name: "Alex".into(),
        surname: "Novák".into(),
        email: "demo@moony.app".into(),
        menu_preferences: None,
        currency: Some("CZK".into()),
        language: Some("en".into()),
        exclude_personal_real_estate: Some(false),
    };
    let recovery_key = auth::setup_account(&db, db_path.clone(), profile, DEMO_PASSWORD)
        .expect("setup demo account");

    let now = chrono::Utc::now().timestamp();
    let mut rng = Rng(20260806);

    seed_bank(&db, now, &mut rng);
    seed_stocks(&db, now);
    seed_crypto(&db, now);
    seed_static_assets(&db, now);
    seed_rate_history(&db, now, &mut rng);
    seed_portfolio_history(&db, now, &mut rng);

    verify(&db);

    println!("\nDemo data directory: {}", data_dir.display());
    println!("Unlock password:     {DEMO_PASSWORD}");
    println!("Recovery key:        {recovery_key}");
    println!("\nLaunch the app on demo data (from repo root):");
    println!(
        "  HOME=\"{}\" RUSTUP_HOME=\"$HOME/.rustup\" CARGO_HOME=\"$HOME/.cargo\" npm run tauri dev",
        demo_home.display()
    );
}

fn seed_bank(db: &Database, now: i64, rng: &mut Rng) {
    db.with_conn(|conn| {
        let fio = bank_accounts::create_account(
            conn,
            &InsertBankAccount {
                name: "Běžný účet".into(),
                account_type: Some("checking".into()),
                iban: None,
                bban: None,
                currency: Some("CZK".into()),
                balance: Some("84230.50".into()),
                institution_id: Some("inst_fio".into()),
                interest_rate: None,
                has_zone_designation: None,
                termination_date: None,
            },
        )
        .expect("create fio account");

        let revolut = bank_accounts::create_account(
            conn,
            &InsertBankAccount {
                name: "Revolut".into(),
                account_type: Some("checking".into()),
                iban: None,
                bban: None,
                currency: Some("EUR".into()),
                balance: Some("2150.75".into()),
                institution_id: Some("inst_revolut".into()),
                interest_rate: None,
                has_zone_designation: None,
                termination_date: None,
            },
        )
        .expect("create revolut account");

        let _savings = bank_accounts::create_account(
            conn,
            &InsertBankAccount {
                name: "Spořicí účet".into(),
                account_type: Some("savings".into()),
                iban: None,
                bban: None,
                currency: Some("CZK".into()),
                balance: Some("350000".into()),
                institution_id: Some("inst_air_bank".into()),
                interest_rate: Some("4.5".into()),
                has_zone_designation: None,
                termination_date: None,
            },
        )
        .expect("create savings account");

        let tx = |account: &str,
                  tx_type: &str,
                  amount: f64,
                  currency: &str,
                  desc: &str,
                  counterparty: &str,
                  category: &str,
                  date: i64| {
            conn.execute(
                "INSERT INTO bank_transactions (
                    id, bank_account_id, tx_type, amount, currency, description,
                    counterparty_name, booking_date, category_id, status, data_source, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'booked', 'manual', ?8)",
                params![
                    Uuid::new_v4().to_string(),
                    account,
                    tx_type,
                    format!("{amount:.2}"),
                    currency,
                    desc,
                    counterparty,
                    date,
                    category,
                ],
            )
            .expect("insert bank transaction");
        };

        // 4 months of activity on the CZK account
        for month in 0..4 {
            let month_start = now - (month * 30 + 28) * DAY;
            tx(
                &fio.id,
                "credit",
                68000.0,
                "CZK",
                "Mzda",
                "TechCorp s.r.o.",
                "cat_income",
                month_start,
            );
            tx(
                &fio.id,
                "debit",
                18500.0,
                "CZK",
                "Nájem",
                "Reality Plus",
                "cat_housing",
                month_start + DAY,
            );
            tx(
                &fio.id,
                "debit",
                3420.0,
                "CZK",
                "Elektřina a plyn",
                "ČEZ Prodej",
                "cat_utilities",
                month_start + 2 * DAY,
            );
            tx(
                &fio.id,
                "debit",
                24800.0,
                "CZK",
                "Splátka hypotéky",
                "Hypoteční banka",
                "cat_loan_payments",
                month_start + 3 * DAY,
            );
            for week in 0..4 {
                let d = month_start + (4 + week * 7) * DAY;
                tx(
                    &fio.id,
                    "debit",
                    rng.range(950.0, 1650.0),
                    "CZK",
                    "Nákup potravin",
                    "Albert",
                    "cat_groceries",
                    d,
                );
                if rng.next() > 0.4 {
                    tx(
                        &fio.id,
                        "debit",
                        rng.range(320.0, 890.0),
                        "CZK",
                        "Restaurace",
                        "Restaurace U Lípy",
                        "cat_dining",
                        d + 2 * DAY,
                    );
                }
                if rng.next() > 0.6 {
                    tx(
                        &fio.id,
                        "debit",
                        rng.range(500.0, 2400.0),
                        "CZK",
                        "Nákup",
                        "Alza.cz",
                        "cat_shopping",
                        d + 3 * DAY,
                    );
                }
            }
            tx(
                &fio.id,
                "debit",
                550.0,
                "CZK",
                "Lítačka",
                "DPP",
                "cat_transport",
                month_start + 5 * DAY,
            );
            tx(
                &fio.id,
                "debit",
                rng.range(400.0, 900.0),
                "CZK",
                "Kino a koncerty",
                "GoOut",
                "cat_entertainment",
                month_start + 12 * DAY,
            );

            // EUR account activity
            let d = month_start + 9 * DAY;
            tx(
                &revolut.id,
                "debit",
                rng.range(25.0, 80.0),
                "EUR",
                "Dinner abroad",
                "Bolt Food",
                "cat_dining",
                d,
            );
            if month % 2 == 0 {
                tx(
                    &revolut.id,
                    "debit",
                    rng.range(120.0, 420.0),
                    "EUR",
                    "Flight tickets",
                    "Ryanair",
                    "cat_travel",
                    d + 3 * DAY,
                );
            }
        }
        Ok(())
    })
    .expect("seed bank data");
}

fn seed_stocks(db: &Database, now: i64) {
    db.with_conn(|conn| {
        // (ticker, name, buys[(qty, price, days_ago)], current_price)
        let stocks: &[(&str, &str, Buys, f64)] = &[
            ("AAPL", "Apple Inc.", &[(15.0, 165.30, 310), (10.0, 195.80, 120)], 232.50),
            ("MSFT", "Microsoft Corporation", &[(8.0, 310.20, 280), (4.0, 390.50, 90)], 425.10),
            ("VOO", "Vanguard S&P 500 ETF", &[(10.0, 385.00, 400), (8.0, 445.60, 150)], 512.30),
            ("NVDA", "NVIDIA Corporation", &[(30.0, 95.40, 200)], 178.90),
        ];

        for (ticker, name, buys, current) in stocks {
            let (first, rest) = buys.split_first().expect("at least one buy");
            let inv = investments::create_investment_with_transaction(
                conn,
                ticker,
                name,
                None,
                None,
                Some(&InsertInvestmentTransaction {
                    investment_id: None,
                    tx_type: "buy".into(),
                    ticker: ticker.to_string(),
                    company_name: name.to_string(),
                    quantity: first.0.to_string(),
                    price_per_unit: first.1.to_string(),
                    currency: "USD".into(),
                    transaction_date: now - first.2 * DAY,
                }),
            )
            .expect("create investment");

            for (qty, price, days_ago) in rest {
                investments::add_transaction_to_investment(
                    conn,
                    &inv.id,
                    &InsertInvestmentTransaction {
                        investment_id: Some(inv.id.clone()),
                        tx_type: "buy".into(),
                        ticker: ticker.to_string(),
                        company_name: name.to_string(),
                        quantity: qty.to_string(),
                        price_per_unit: price.to_string(),
                        currency: "USD".into(),
                        transaction_date: now - days_ago * DAY,
                    },
                )
                .expect("add investment transaction");
            }

            conn.execute(
                "INSERT INTO stock_data (id, ticker, original_price, currency, price_date, fetched_at)
                 VALUES (?1, ?2, ?3, 'USD', ?4, ?4)",
                params![Uuid::new_v4().to_string(), ticker, format!("{current:.2}"), now],
            )
            .expect("insert stock price");
        }
        Ok(())
    })
    .expect("seed stocks");
}

fn seed_crypto(db: &Database, now: i64) {
    db.with_conn(|conn| {
        let cryptos: &[(&str, &str, &str, Buys, f64)] = &[
            (
                "BTC",
                "bitcoin",
                "Bitcoin",
                &[(0.25, 38500.0, 420), (0.17, 62000.0, 160)],
                97400.0,
            ),
            (
                "ETH",
                "ethereum",
                "Ethereum",
                &[(2.5, 2250.0, 380), (1.3, 3100.0, 130)],
                3650.0,
            ),
        ];

        for (ticker, gecko, name, buys, current) in cryptos {
            let (first, rest) = buys.split_first().expect("at least one buy");
            let inv = crypto_investments::create_crypto_with_transaction(
                conn,
                ticker,
                Some(gecko),
                name,
                None,
                None,
                Some(&InsertCryptoTransaction {
                    investment_id: None,
                    tx_type: "buy".into(),
                    ticker: ticker.to_string(),
                    name: name.to_string(),
                    quantity: first.0.to_string(),
                    price_per_unit: first.1.to_string(),
                    currency: "USD".into(),
                    transaction_date: now - first.2 * DAY,
                }),
            )
            .expect("create crypto");

            for (qty, price, days_ago) in rest {
                crypto_investments::add_transaction_to_crypto(
                    conn,
                    &inv.id,
                    &InsertCryptoTransaction {
                        investment_id: Some(inv.id.clone()),
                        tx_type: "buy".into(),
                        ticker: ticker.to_string(),
                        name: name.to_string(),
                        quantity: qty.to_string(),
                        price_per_unit: price.to_string(),
                        currency: "USD".into(),
                        transaction_date: now - days_ago * DAY,
                    },
                )
                .expect("add crypto transaction");
            }

            conn.execute(
                "INSERT INTO crypto_prices (id, symbol, coingecko_id, price, currency, fetched_at)
                 VALUES (?1, ?2, ?3, ?4, 'USD', ?5)",
                params![
                    Uuid::new_v4().to_string(),
                    ticker,
                    gecko,
                    format!("{current:.2}"),
                    now
                ],
            )
            .expect("insert crypto price");
        }
        Ok(())
    })
    .expect("seed crypto");
}

fn seed_static_assets(db: &Database, now: i64) {
    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO real_estate (id, name, address, type, purchase_price, purchase_price_currency,
                market_price, market_price_currency, monthly_rent, monthly_rent_currency,
                recurring_costs, photos, notes, created_at, updated_at)
             VALUES (?1, 'Byt 3+kk Vinohrady', 'Korunní 89, Praha 3', 'personal', '6900000', 'CZK',
                '8400000', 'CZK', NULL, 'CZK', '[]', '[]', NULL, ?2, ?2)",
            params![Uuid::new_v4().to_string(), now - 900 * DAY],
        )
        .expect("insert personal real estate");
        conn.execute(
            "INSERT INTO real_estate (id, name, address, type, purchase_price, purchase_price_currency,
                market_price, market_price_currency, monthly_rent, monthly_rent_currency,
                recurring_costs, photos, notes, created_at, updated_at)
             VALUES (?1, 'Investiční byt 2+kk', 'Veveří 14, Brno', 'investment', '4150000', 'CZK',
                '4850000', 'CZK', '16500', 'CZK', '[]', '[]', NULL, ?2, ?2)",
            params![Uuid::new_v4().to_string(), now - 620 * DAY],
        )
        .expect("insert investment real estate");

        conn.execute(
            "INSERT INTO loans (id, name, principal, currency, interest_rate, monthly_payment, start_date, end_date, created_at, updated_at)
             VALUES (?1, 'Hypotéka — Vinohrady', '4320000', 'CZK', '4.79', '24800', ?2, ?3, ?2, ?2)",
            params![Uuid::new_v4().to_string(), now - 900 * DAY, now + 22 * 365 * DAY],
        )
        .expect("insert loan");

        conn.execute(
            "INSERT INTO bonds (id, name, isin, coupon_value, interest_rate, maturity_date, currency, quantity, created_at, updated_at)
             VALUES (?1, 'Dluhopis Republiky 2029', 'CZ0001005888', '10000', '5.20', ?2, 'CZK', '15', ?3, ?3)",
            params![Uuid::new_v4().to_string(), now + 3 * 365 * DAY, now - 400 * DAY],
        )
        .expect("insert bond");

        for (cat, amount) in [
            ("cat_groceries", "6000"),
            ("cat_dining", "4000"),
            ("cat_entertainment", "2500"),
            ("cat_shopping", "5000"),
            ("cat_transport", "2000"),
        ] {
            conn.execute(
                "INSERT INTO budget_goals (id, category_id, timeframe, amount, currency)
                 VALUES (?1, ?2, 'monthly', ?3, 'CZK')",
                params![Uuid::new_v4().to_string(), cat, amount],
            )
            .expect("insert budget goal");
        }
        Ok(())
    })
    .expect("seed static assets");
}

fn seed_rate_history(db: &Database, now: i64, rng: &mut Rng) {
    db.with_conn(|conn| {
        for day in 0..180 {
            let ts = now - day * DAY;
            let date = ts - ts % DAY;
            let drift = (day as f64) / 180.0;
            let eur = 24.85 + 0.45 * (day as f64 / 29.0).sin() + rng.range(-0.05, 0.05) - 0.3 * drift;
            let usd = 23.10 + 0.55 * (day as f64 / 23.0).sin() + rng.range(-0.06, 0.06) + 0.4 * drift;
            for (cur, rate) in [("EUR", eur), ("USD", usd)] {
                conn.execute(
                    "INSERT OR IGNORE INTO exchange_rate_history (date, currency, rate) VALUES (?1, ?2, ?3)",
                    params![date, cur, rate],
                )
                .expect("insert rate history");
            }
        }
        // current in-DB rates used at unlock
        for (cur, rate) in [("EUR", 24.55f64), ("USD", 23.45f64)] {
            conn.execute(
                "INSERT OR REPLACE INTO exchange_rates (currency, rate, fetched_at) VALUES (?1, ?2, ?3)",
                params![cur, rate, now],
            )
            .expect("insert current rate");
        }
        Ok(())
    })
    .expect("seed rate history");
}

fn seed_portfolio_history(db: &Database, now: i64, rng: &mut Rng) {
    db.with_conn(|conn| {
        for day in (0..180).rev() {
            let ts = now - day * DAY;
            let progress = 1.0 - (day as f64) / 180.0; // 0 → oldest, 1 → today
            let growth = |from: f64, to: f64| from + (to - from) * progress;

            let savings = growth(392_000.0, 486_000.0) + rng.range(-4_000.0, 4_000.0);
            let investments = growth(298_000.0, 405_000.0) * (1.0 + 0.03 * (day as f64 / 17.0).sin());
            let crypto = growth(212_000.0, 268_000.0) * (1.0 + 0.09 * (day as f64 / 11.0).sin());
            let bonds = 150_000.0;
            let re_personal = growth(8_150_000.0, 8_400_000.0);
            let re_investment = growth(4_700_000.0, 4_850_000.0);
            let other = 0.0;
            let loans = growth(4_410_000.0, 4_320_000.0);

            let usd_rate = 23.45;
            let inv_by_cur = format!("{{\"USD\":{:.2}}}", investments / usd_rate);
            let crypto_by_cur = format!("{{\"USD\":{:.2}}}", crypto / usd_rate);
            let savings_by_cur = format!(
                "{{\"CZK\":{:.2},\"EUR\":{:.2}}}",
                savings - 52_000.0,
                52_000.0 / 24.55
            );

            conn.execute(
                "INSERT INTO portfolio_metrics_history
                 (id, total_savings, total_loans_principal, total_investments, total_crypto,
                  total_bonds, total_real_estate_personal, total_real_estate_investment,
                  total_other_assets, recorded_at,
                  investments_by_currency, crypto_by_currency, savings_by_currency,
                  bonds_by_currency, real_estate_by_currency, loans_by_currency,
                  other_assets_by_currency)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
                params![
                    Uuid::new_v4().to_string(),
                    format!("{savings:.2}"),
                    format!("{loans:.2}"),
                    format!("{investments:.2}"),
                    format!("{crypto:.2}"),
                    format!("{bonds:.2}"),
                    format!("{re_personal:.2}"),
                    format!("{re_investment:.2}"),
                    format!("{other:.2}"),
                    ts,
                    inv_by_cur,
                    crypto_by_cur,
                    savings_by_cur,
                    "{\"CZK\":150000.00}",
                    format!("{{\"CZK\":{:.2}}}", re_personal + re_investment),
                    format!("{{\"CZK\":{loans:.2}}}"),
                    "{}",
                ],
            )
            .expect("insert history row");
        }
        Ok(())
    })
    .expect("seed portfolio history");
}

fn verify(db: &Database) {
    db.with_conn(|conn| {
        println!("\nSeeded demo database contents:");
        for table in [
            "bank_accounts",
            "bank_transactions",
            "stock_investments",
            "investment_transactions",
            "crypto_investments",
            "crypto_transactions",
            "real_estate",
            "loans",
            "bonds",
            "budget_goals",
            "portfolio_metrics_history",
            "exchange_rate_history",
        ] {
            let count: i64 = conn
                .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))
                .expect("count");
            println!("  {table:<28} {count:>5} rows");
        }
        let avg: String = conn
            .query_row(
                "SELECT average_price FROM stock_investments WHERE ticker = 'AAPL'",
                [],
                |r| r.get(0),
            )
            .expect("aapl avg");
        println!("  AAPL average price (computed by service): {avg}");
        Ok(())
    })
    .expect("verify seeded db");
}
