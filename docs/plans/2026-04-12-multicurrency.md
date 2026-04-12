# Multicurrency Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Moony from 4 display currencies to 15, store daily ECB rate history for accurate historical charts, and record native-currency breakdowns in portfolio snapshots to eliminate double-conversion.

**Architecture:** Three coordinated layers — (1) TypeScript/Rust currency registry expanded to 15 unified currencies, (2) new `exchange_rate_history` DB table populated on every ECB fetch and queried for historical chart rendering, (3) seven JSON breakdown columns added to `portfolio_metrics_history` populated by `calculate_portfolio_metrics` going forward and backfilled from `stock_value_history`/`crypto_value_history` for past snapshots.

**Tech Stack:** Rust (rusqlite, serde_json, chrono, lazy_static), TypeScript (Vitest), Tauri `invoke`, React Query.

**Spec:** `docs/specs/2026-04-12-multicurrency-design.md`

---

## File Map

| File | Change |
|------|--------|
| `shared/currencies.ts` | Expand to 15 unified currencies, drop `DisplayCurrencyCode` |
| `shared/currencies.test.ts` | Update + extend tests for all 15 currencies |
| `shared/schema.ts` | Add breakdown fields to `PortfolioMetrics` and `PortfolioMetricsHistory` |
| `src-tauri/src/db/migrations.rs` | Add migration 037 |
| `src-tauri/src/services/currency.rs` | Add `save_rates_to_history_db`, `get_rates_for_date`, `get_rates_for_date_range`; update fallbacks |
| `src-tauri/src/models/user.rs` | Add breakdown fields to `PortfolioMetricsHistory` Rust struct |
| `src-tauri/src/commands/portfolio.rs` | Update `PortfolioMetrics` struct, `calculate_portfolio_metrics`, `update_todays_snapshot`; add `get_exchange_rates_for_date`, `get_exchange_rates_for_date_range`, `backfill_currency_breakdowns` commands |
| `src-tauri/src/lib.rs` | Register three new commands |
| `src/lib/tauri-api.ts` | Add `getExchangeRatesForDate`, `getExchangeRatesForDateRange`, `backfillCurrencyBreakdowns` |
| `src/hooks/SyncProvider.tsx` | Call `backfillCurrencyBreakdowns` after existing backfill |
| `src/components/common/PortfolioValueTrendChart.tsx` | Use native breakdowns + historical rates for chart rendering |

---

## Task 1: Expand currency registry in `shared/currencies.ts`

**Files:**
- Modify: `shared/currencies.ts`

- [ ] **Step 1: Replace the file content**

```typescript
// All supported currencies — every currency is both a position currency and a display currency
export type CurrencyCode =
  | "CZK" | "EUR" | "USD" | "GBP"
  | "JPY" | "AUD" | "CAD" | "CHF"
  | "HKD" | "CNY" | "SEK" | "NOK"
  | "DKK" | "SGD" | "NZD";

export interface CurrencyDef {
    code: CurrencyCode;
    symbol: string;
    locale: string;
    position: "before" | "after";
    label: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyDef> = {
    CZK: { code: "CZK", symbol: "Kč",  locale: "cs-CZ",  position: "after",  label: "Czech Crown (CZK)" },
    EUR: { code: "EUR", symbol: "€",   locale: "de-DE",  position: "before", label: "Euro (EUR)" },
    USD: { code: "USD", symbol: "$",   locale: "en-US",  position: "before", label: "US Dollar (USD)" },
    GBP: { code: "GBP", symbol: "£",   locale: "en-GB",  position: "before", label: "British Pound (GBP)" },
    JPY: { code: "JPY", symbol: "¥",   locale: "ja-JP",  position: "before", label: "Japanese Yen (JPY)" },
    AUD: { code: "AUD", symbol: "A$",  locale: "en-AU",  position: "before", label: "Australian Dollar (AUD)" },
    CAD: { code: "CAD", symbol: "C$",  locale: "en-CA",  position: "before", label: "Canadian Dollar (CAD)" },
    CHF: { code: "CHF", symbol: "Fr.", locale: "de-CH",  position: "before", label: "Swiss Franc (CHF)" },
    HKD: { code: "HKD", symbol: "HK$", locale: "zh-HK",  position: "before", label: "Hong Kong Dollar (HKD)" },
    CNY: { code: "CNY", symbol: "¥",   locale: "zh-CN",  position: "before", label: "Chinese Yuan (CNY)" },
    SEK: { code: "SEK", symbol: "kr",  locale: "sv-SE",  position: "after",  label: "Swedish Krona (SEK)" },
    NOK: { code: "NOK", symbol: "kr",  locale: "nb-NO",  position: "after",  label: "Norwegian Krone (NOK)" },
    DKK: { code: "DKK", symbol: "kr",  locale: "da-DK",  position: "after",  label: "Danish Krone (DKK)" },
    SGD: { code: "SGD", symbol: "S$",  locale: "en-SG",  position: "before", label: "Singapore Dollar (SGD)" },
    NZD: { code: "NZD", symbol: "NZ$", locale: "en-NZ",  position: "before", label: "New Zealand Dollar (NZD)" },
};

// Base currency is CZK
export const BASE_CURRENCY: CurrencyCode = "CZK";

// Fallback exchange rates (1 unit of currency = X CZK). Updated from ECB on unlock.
export let EXCHANGE_RATES: Record<CurrencyCode, number> = {
    CZK: 1,
    EUR: 25.0,
    USD: 23.0,
    GBP: 29.0,
    JPY: 0.15,
    AUD: 14.5,
    CAD: 17.0,
    CHF: 26.0,
    HKD: 3.0,
    CNY: 3.2,
    SEK: 2.2,
    NOK: 2.1,
    DKK: 3.4,
    SGD: 17.5,
    NZD: 13.5,
};

export function updateExchangeRates(rates: Partial<Record<CurrencyCode, number>>): void {
    Object.entries(rates).forEach(([currency, rate]) => {
        if (rate !== undefined) {
            EXCHANGE_RATES[currency as CurrencyCode] = rate;
        }
    });
    EXCHANGE_RATES.CZK = 1;
}

export function convertToCzK(amount: number, fromCurrency: CurrencyCode): number {
    const rate = EXCHANGE_RATES[fromCurrency];
    return amount * rate;
}

export function convertFromCzK(amountInCzk: number, toCurrency: CurrencyCode): number {
    const rate = EXCHANGE_RATES[toCurrency];
    return amountInCzk / rate;
}
```

- [ ] **Step 2: Run typecheck to verify no compile errors**

```bash
npm run typecheck
```

Expected: no errors (some files that imported `DisplayCurrencyCode` may now error — fix them in next step).

- [ ] **Step 3: Fix any `DisplayCurrencyCode` import sites**

Search for remaining usages:
```bash
grep -rn "DisplayCurrencyCode" src/ shared/
```

For each hit, replace `DisplayCurrencyCode` with `CurrencyCode`. The type is now unified — no behaviour change, just the type name.

- [ ] **Step 4: Commit**

```bash
git add shared/currencies.ts src/
git commit -m "feat: expand currency registry to 15 unified currencies"
```

---

## Task 2: Update tests for `shared/currencies.ts`

**Files:**
- Modify: `shared/currencies.test.ts`

- [ ] **Step 1: Replace the CURRENCIES describe block to cover all 15**

In `shared/currencies.test.ts`, update the `"CURRENCIES constant"` describe block:

```typescript
describe("CURRENCIES constant", () => {
  const ALL_CODES: CurrencyCode[] = [
    "CZK","EUR","USD","GBP","JPY","AUD","CAD","CHF",
    "HKD","CNY","SEK","NOK","DKK","SGD","NZD",
  ];

  it("contains all 15 supported currencies", () => {
    for (const code of ALL_CODES) {
      expect(CURRENCIES).toHaveProperty(code);
    }
  });

  it("each currency has symbol, locale, position, and label", () => {
    for (const [, def] of Object.entries(CURRENCIES)) {
      expect(def.symbol).toBeTruthy();
      expect(def.locale).toBeTruthy();
      expect(["before", "after"]).toContain(def.position);
      expect(def.label).toBeTruthy();
    }
  });

  it("has exactly 15 currencies", () => {
    expect(Object.keys(CURRENCIES)).toHaveLength(15);
  });
});
```

- [ ] **Step 2: Update EXCHANGE_RATES describe block**

```typescript
describe("EXCHANGE_RATES", () => {
  it("includes all 15 currencies with fallback rates", () => {
    const codes: CurrencyCode[] = [
      "CZK","EUR","USD","GBP","JPY","AUD","CAD","CHF",
      "HKD","CNY","SEK","NOK","DKK","SGD","NZD",
    ];
    for (const code of codes) {
      expect(EXCHANGE_RATES).toHaveProperty(code);
    }
  });

  it("CZK rate is always 1", () => {
    expect(EXCHANGE_RATES.CZK).toBe(1);
  });

  it("all rates are positive numbers", () => {
    for (const rate of Object.values(EXCHANGE_RATES)) {
      expect(typeof rate).toBe("number");
      expect(rate).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 3: Add cross-rate math test**

Append a new describe block at the end of the test file:

```typescript
describe("Cross-rate derivation via CZK", () => {
  beforeEach(() => {
    updateExchangeRates({ EUR: 25.0, USD: 20.0, JPY: 0.16, AUD: 14.0 });
  });

  it("EUR→USD cross-rate equals (EUR/CZK) / (USD/CZK)", () => {
    const eurInCzk = convertToCzK(100, "EUR");  // 2500 CZK
    const result = convertFromCzK(eurInCzk, "USD"); // 2500/20 = 125
    expect(result).toBeCloseTo(125, 2);
  });

  it("JPY→AUD cross-rate is accurate", () => {
    const jpyInCzk = convertToCzK(10000, "JPY"); // 1600 CZK
    const result = convertFromCzK(jpyInCzk, "AUD"); // 1600/14 ≈ 114.29
    expect(result).toBeCloseTo(1600 / 14, 2);
  });

  it("round-trip for all new currencies is lossless", () => {
    updateExchangeRates({ AUD: 14.5, CAD: 17.0, SEK: 2.2, NOK: 2.1, DKK: 3.4, SGD: 17.5, NZD: 13.5 });
    const codes: CurrencyCode[] = ["AUD","CAD","SEK","NOK","DKK","SGD","NZD"];
    for (const code of codes) {
      const original = 100;
      const inCzk = convertToCzK(original, code);
      const back = convertFromCzK(inCzk, code);
      expect(back).toBeCloseTo(original, 6);
    }
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm test -- shared/currencies.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add shared/currencies.test.ts
git commit -m "test: update currency tests for 15-currency registry"
```

---

## Task 3: Update Rust currency fallback rates

**Files:**
- Modify: `src-tauri/src/services/currency.rs`

- [ ] **Step 1: Update the `EXCHANGE_RATES` lazy_static map**

In `src-tauri/src/services/currency.rs`, find the `lazy_static!` block and replace the `EXCHANGE_RATES` initializer:

```rust
static ref EXCHANGE_RATES: RwLock<HashMap<String, f64>> = {
    let mut m = HashMap::new();
    m.insert("CZK".to_string(), 1.0);
    m.insert("EUR".to_string(), 25.0);
    m.insert("USD".to_string(), 23.0);
    m.insert("GBP".to_string(), 29.0);
    m.insert("JPY".to_string(), 0.15);
    m.insert("AUD".to_string(), 14.5);
    m.insert("CAD".to_string(), 17.0);
    m.insert("CHF".to_string(), 26.0);
    m.insert("HKD".to_string(), 3.0);
    m.insert("CNY".to_string(), 3.2);
    m.insert("SEK".to_string(), 2.2);
    m.insert("NOK".to_string(), 2.1);
    m.insert("DKK".to_string(), 3.4);
    m.insert("SGD".to_string(), 17.5);
    m.insert("NZD".to_string(), 13.5);
    RwLock::new(m)
};
```

- [ ] **Step 2: Run Rust check**

```bash
cd src-tauri && cargo check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/services/currency.rs
git commit -m "feat: add fallback rates for 11 new currencies in Rust"
```

---

## Task 4: DB migration 037

**Files:**
- Modify: `src-tauri/src/db/migrations.rs`

- [ ] **Step 1: Add the migration constant**

After the existing `MIGRATION_036` constant definition (near the end of the file), add:

```rust
/// Migration 037: Exchange rate history + currency breakdowns in portfolio snapshots
const MIGRATION_037: &str = r#"
CREATE TABLE IF NOT EXISTS exchange_rate_history (
    date     INTEGER NOT NULL,
    currency TEXT NOT NULL,
    rate     REAL NOT NULL,
    PRIMARY KEY (date, currency)
);
CREATE INDEX IF NOT EXISTS idx_erh_currency_date ON exchange_rate_history(currency, date);

ALTER TABLE portfolio_metrics_history ADD COLUMN investments_by_currency  TEXT NOT NULL DEFAULT '{}';
ALTER TABLE portfolio_metrics_history ADD COLUMN crypto_by_currency       TEXT NOT NULL DEFAULT '{}';
ALTER TABLE portfolio_metrics_history ADD COLUMN savings_by_currency      TEXT NOT NULL DEFAULT '{}';
ALTER TABLE portfolio_metrics_history ADD COLUMN bonds_by_currency        TEXT NOT NULL DEFAULT '{}';
ALTER TABLE portfolio_metrics_history ADD COLUMN real_estate_by_currency  TEXT NOT NULL DEFAULT '{}';
ALTER TABLE portfolio_metrics_history ADD COLUMN loans_by_currency        TEXT NOT NULL DEFAULT '{}';
ALTER TABLE portfolio_metrics_history ADD COLUMN other_assets_by_currency TEXT NOT NULL DEFAULT '{}';
"#;
```

- [ ] **Step 2: Register the migration**

In the `get_migrations()` function (the array of tuples), append after the 036 entry:

```rust
("037_multicurrency", MIGRATION_037),
```

- [ ] **Step 3: Run Rust check**

```bash
cd src-tauri && cargo check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/db/migrations.rs
git commit -m "feat: add migration 037 — exchange_rate_history table and portfolio breakdown columns"
```

---

## Task 5: Exchange rate history — Rust service functions

**Files:**
- Modify: `src-tauri/src/services/currency.rs`

- [ ] **Step 1: Add `save_rates_to_history_db`**

After the existing `save_rates_to_db` function, add:

```rust
/// Save today's rates into the exchange_rate_history table (one row per currency per day).
/// Called every time ECB rates are fetched. Overwrites existing row for today if present.
pub fn save_rates_to_history_db(
    conn: &rusqlite::Connection,
    rates: &HashMap<String, f64>,
) -> crate::error::Result<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("Time went backwards")
        .as_secs() as i64;
    // Normalise to midnight UTC
    let today_midnight = (now / 86400) * 86400;

    for (currency, rate) in rates {
        if currency == "CZK" {
            continue; // CZK is always 1.0 — no need to store
        }
        conn.execute(
            "INSERT INTO exchange_rate_history (date, currency, rate)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(date, currency) DO UPDATE SET rate = ?3",
            rusqlite::params![today_midnight, currency, rate],
        )?;
    }

    Ok(())
}

/// Return rates for a specific date (Unix timestamp, normalised to midnight UTC).
/// Falls back to the nearest earlier date that has a snapshot.
/// Falls back to today's in-memory rates if no history exists at all.
pub fn get_rates_for_date(
    conn: &rusqlite::Connection,
    date: i64,
) -> HashMap<String, f64> {
    let day = (date / 86400) * 86400;

    // Try exact date first, then walk backwards up to 10 days (covers weekends + holidays)
    let result: rusqlite::Result<Vec<(String, f64)>> = (0..=10).find_map(|offset| {
        let target = day - offset * 86400;
        let mut stmt = conn
            .prepare(
                "SELECT currency, rate FROM exchange_rate_history WHERE date = ?1",
            )
            .ok()?;
        let rows: Vec<(String, f64)> = stmt
            .query_map([target], |row| Ok((row.get(0)?, row.get(1)?)))
            .ok()?
            .filter_map(|r| r.ok())
            .collect();
        if rows.is_empty() { None } else { Some(Ok(rows)) }
    }).unwrap_or(Ok(vec![]));

    let rows = result.unwrap_or_default();
    if rows.is_empty() {
        // No history at all — fall back to current in-memory rates
        return get_all_rates();
    }

    let mut map = HashMap::new();
    map.insert("CZK".to_string(), 1.0);
    for (currency, rate) in rows {
        map.insert(currency, rate);
    }
    map
}

/// Return rates for all dates in a range that have history snapshots.
/// Keys are midnight-normalised Unix timestamps.
pub fn get_rates_for_date_range(
    conn: &rusqlite::Connection,
    start_date: i64,
    end_date: i64,
) -> HashMap<i64, HashMap<String, f64>> {
    let start = (start_date / 86400) * 86400;
    let end = (end_date / 86400) * 86400;

    let mut stmt = match conn.prepare(
        "SELECT date, currency, rate FROM exchange_rate_history
         WHERE date >= ?1 AND date <= ?2
         ORDER BY date",
    ) {
        Ok(s) => s,
        Err(_) => return HashMap::new(),
    };

    let mut result: HashMap<i64, HashMap<String, f64>> = HashMap::new();

    let rows = stmt
        .query_map(rusqlite::params![start, end], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, f64>(2)?))
        })
        .unwrap_or_else(|_| {
            // Return empty iterator on error - rusqlite MappedRows doesn't implement Default
            // so we use a workaround by returning early above
            panic!("unreachable")
        });

    for row in rows.flatten() {
        let (date, currency, rate) = row;
        let entry = result.entry(date).or_insert_with(|| {
            let mut m = HashMap::new();
            m.insert("CZK".to_string(), 1.0);
            m
        });
        entry.insert(currency, rate);
    }

    result
}
```

Note: the `get_rates_for_date_range` function has an awkward workaround for the rusqlite iterator. Replace it with a cleaner version:

```rust
pub fn get_rates_for_date_range(
    conn: &rusqlite::Connection,
    start_date: i64,
    end_date: i64,
) -> HashMap<i64, HashMap<String, f64>> {
    let start = (start_date / 86400) * 86400;
    let end = (end_date / 86400) * 86400;

    let mut result: HashMap<i64, HashMap<String, f64>> = HashMap::new();

    let query_result: rusqlite::Result<Vec<(i64, String, f64)>> = conn
        .prepare(
            "SELECT date, currency, rate FROM exchange_rate_history
             WHERE date >= ?1 AND date <= ?2
             ORDER BY date",
        )
        .and_then(|mut stmt| {
            stmt.query_map(rusqlite::params![start, end], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, f64>(2)?))
            })
            .map(|rows| rows.filter_map(|r| r.ok()).collect())
        });

    for (date, currency, rate) in query_result.unwrap_or_default() {
        let entry = result.entry(date).or_insert_with(|| {
            let mut m = HashMap::new();
            m.insert("CZK".to_string(), 1.0);
            m
        });
        entry.insert(currency, rate);
    }

    result
}
```

- [ ] **Step 2: Add tests**

In the `#[cfg(test)]` module at the bottom of `currency.rs`, add after existing tests:

```rust
fn setup_history_db() -> rusqlite::Connection {
    let conn = rusqlite::Connection::open_in_memory().expect("in-memory db");
    conn.execute_batch(
        "CREATE TABLE exchange_rate_history (
            date INTEGER NOT NULL,
            currency TEXT NOT NULL,
            rate REAL NOT NULL,
            PRIMARY KEY (date, currency)
        );",
    )
    .expect("schema");
    conn
}

#[test]
fn test_save_and_get_rates_for_date_exact() {
    let conn = setup_history_db();
    let mut rates = HashMap::new();
    rates.insert("EUR".to_string(), 25.0);
    rates.insert("USD".to_string(), 23.0);
    save_rates_to_history_db(&conn, &rates).expect("save");

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let today = (now / 86400) * 86400;

    let loaded = get_rates_for_date(&conn, today);
    assert!((loaded["EUR"] - 25.0).abs() < 0.001);
    assert!((loaded["USD"] - 23.0).abs() < 0.001);
    assert_eq!(loaded["CZK"], 1.0);
}

#[test]
fn test_get_rates_for_date_falls_back_to_nearest_earlier() {
    let conn = setup_history_db();
    // Insert rates for 5 days ago
    let five_days_ago = (std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
        / 86400
        - 5)
        * 86400;
    conn.execute(
        "INSERT INTO exchange_rate_history (date, currency, rate) VALUES (?1, 'EUR', 24.5)",
        [five_days_ago],
    )
    .expect("insert");

    // Query for 2 days ago (no exact match) — should fall back to 5-days-ago row
    let two_days_ago = five_days_ago + 3 * 86400;
    let loaded = get_rates_for_date(&conn, two_days_ago);
    assert!((loaded["EUR"] - 24.5).abs() < 0.001);
}

#[test]
fn test_get_rates_for_date_falls_back_to_memory_when_no_history() {
    let conn = setup_history_db(); // empty table
    update_exchange_rates([("EUR".to_string(), 27.0)].into_iter().collect());
    // Any date — table is empty, should return in-memory rates
    let loaded = get_rates_for_date(&conn, 1_700_000_000);
    assert!((loaded["EUR"] - 27.0).abs() < 0.001);
}

#[test]
fn test_get_rates_for_date_range() {
    let conn = setup_history_db();
    let base: i64 = 1_700_000_000 / 86400 * 86400;
    conn.execute_batch(&format!(
        "INSERT INTO exchange_rate_history VALUES ({}, 'EUR', 25.0);
         INSERT INTO exchange_rate_history VALUES ({}, 'EUR', 25.5);",
        base,
        base + 86400,
    ))
    .expect("insert");

    let result = get_rates_for_date_range(&conn, base, base + 86400);
    assert_eq!(result.len(), 2);
    assert!((result[&base]["EUR"] - 25.0).abs() < 0.001);
    assert!((result[&(base + 86400)]["EUR"] - 25.5).abs() < 0.001);
}
```

- [ ] **Step 3: Run Rust tests**

```bash
cd src-tauri && cargo test services::currency
```

Expected: all tests pass (including pre-existing ones).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/services/currency.rs
git commit -m "feat: add exchange rate history service functions (save, get by date, get by range)"
```

---

## Task 6: Exchange rate history — commands + API

**Files:**
- Modify: `src-tauri/src/commands/portfolio.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/tauri-api.ts`

- [ ] **Step 1: Update `refresh_exchange_rates` to also save to history**

In `src-tauri/src/commands/portfolio.rs`, find `pub async fn refresh_exchange_rates` and update its body:

```rust
pub async fn refresh_exchange_rates(
    db: State<'_, Database>,
) -> Result<std::collections::HashMap<String, f64>> {
    let rates = crate::services::currency::fetch_ecb_rates().await?;

    // Persist latest rates for offline use
    db.with_conn(|conn| crate::services::currency::save_rates_to_db(conn, &rates))?;

    // Also persist to daily history for accurate historical chart rendering
    db.with_conn(|conn| crate::services::currency::save_rates_to_history_db(conn, &rates))?;

    Ok(rates)
}
```

- [ ] **Step 2: Add `get_exchange_rates_for_date` command**

After the existing `get_exchange_rates` function, add:

```rust
/// Get exchange rates (relative to CZK) for a specific date.
/// Falls back to the nearest earlier date with a snapshot, then to today's rates.
#[tauri::command]
pub async fn get_exchange_rates_for_date(
    db: State<'_, Database>,
    date: i64,
) -> Result<std::collections::HashMap<String, f64>> {
    db.with_conn(|conn| {
        Ok(crate::services::currency::get_rates_for_date(conn, date))
    })
}

/// Get exchange rates for all dates in a range that have history snapshots.
/// Returns a map of date (midnight UTC unix timestamp) → rates.
#[tauri::command]
pub async fn get_exchange_rates_for_date_range(
    db: State<'_, Database>,
    start_date: i64,
    end_date: i64,
) -> Result<std::collections::HashMap<i64, std::collections::HashMap<String, f64>>> {
    db.with_conn(|conn| {
        Ok(crate::services::currency::get_rates_for_date_range(conn, start_date, end_date))
    })
}
```

- [ ] **Step 3: Register commands in `lib.rs`**

In `src-tauri/src/lib.rs`, find the `.invoke_handler(tauri::generate_handler![` block and add the two new commands alongside the existing ones:

```rust
commands::portfolio::get_exchange_rates_for_date,
commands::portfolio::get_exchange_rates_for_date_range,
```

- [ ] **Step 4: Expose in `tauri-api.ts`**

In `src/lib/tauri-api.ts`, find the `portfolioApi` object and add after `getExchangeRates`:

```typescript
getExchangeRatesForDate: (date: number) =>
  tauriInvoke<Record<string, number>>('get_exchange_rates_for_date', { date }),
getExchangeRatesForDateRange: (startDate: number, endDate: number) =>
  tauriInvoke<Record<number, Record<string, number>>>('get_exchange_rates_for_date_range', { startDate, endDate }),
```

- [ ] **Step 5: Run Rust check and typecheck**

```bash
cd src-tauri && cargo check
cd .. && npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/portfolio.rs src-tauri/src/lib.rs src/lib/tauri-api.ts
git commit -m "feat: add get_exchange_rates_for_date and _for_date_range commands + API"
```

---

## Task 7: Update `PortfolioMetrics` struct and shared types

**Files:**
- Modify: `src-tauri/src/commands/portfolio.rs`
- Modify: `shared/schema.ts`

- [ ] **Step 1: Update the Rust `PortfolioMetrics` struct**

In `src-tauri/src/commands/portfolio.rs`, find `pub struct PortfolioMetrics` and replace it:

```rust
#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PortfolioMetrics {
    pub total_savings: f64,
    pub total_investments: f64,
    pub total_crypto: f64,
    pub total_bonds: f64,
    pub total_real_estate_personal: f64,
    pub total_real_estate_investment: f64,
    pub total_real_estate: f64,
    pub total_other_assets: f64,
    pub total_liabilities: f64,
    pub total_assets: f64,
    pub net_worth: f64,
    // Native currency breakdowns
    pub savings_by_currency: std::collections::HashMap<String, f64>,
    pub investments_by_currency: std::collections::HashMap<String, f64>,
    pub crypto_by_currency: std::collections::HashMap<String, f64>,
    pub bonds_by_currency: std::collections::HashMap<String, f64>,
    pub real_estate_by_currency: std::collections::HashMap<String, f64>,
    pub loans_by_currency: std::collections::HashMap<String, f64>,
    pub other_assets_by_currency: std::collections::HashMap<String, f64>,
}
```

- [ ] **Step 2: Update `shared/schema.ts` — `PortfolioMetrics` interface**

Find the `PortfolioMetrics` interface and replace:

```typescript
export interface PortfolioMetrics {
    totalSavings: number;
    totalInvestments: number;
    totalCrypto: number;
    totalBonds: number;
    totalRealEstatePersonal: number;
    totalRealEstateInvestment: number;
    totalRealEstate: number;
    totalOtherAssets: number;
    totalLiabilities: number;
    totalAssets: number;
    netWorth: number;
    // Native currency breakdowns
    savingsByCurrency: Record<string, number>;
    investmentsByCurrency: Record<string, number>;
    cryptoByCurrency: Record<string, number>;
    bondsByCurrency: Record<string, number>;
    realEstateByCurrency: Record<string, number>;
    loansByCurrency: Record<string, number>;
    otherAssetsByCurrency: Record<string, number>;
}
```

- [ ] **Step 3: Update `PortfolioMetricsHistory` interface**

Find the `PortfolioMetricsHistory` interface and replace:

```typescript
export interface PortfolioMetricsHistory {
    id: string;
    totalSavings: string;
    totalLoansPrincipal: string;
    totalInvestments: string;
    totalCrypto: string;
    totalBonds: string;
    totalRealEstatePersonal: string;
    totalRealEstateInvestment: string;
    totalOtherAssets: string;
    recordedAt: number;
    // Native currency breakdowns (JSON strings, '{}' when not yet populated)
    investmentsByCurrency: string;
    cryptoByCurrency: string;
    savingsByCurrency: string;
    bondsByCurrency: string;
    realEstateByCurrency: string;
    loansByCurrency: string;
    otherAssetsByCurrency: string;
}
```

- [ ] **Step 4: Run Rust check + typecheck**

```bash
cd src-tauri && cargo check
cd .. && npm run typecheck
```

The Rust check will fail if `PortfolioMetrics` is constructed anywhere without the new fields — that's expected. Those will be fixed in Task 8.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/portfolio.rs shared/schema.ts
git commit -m "feat: add currency breakdown fields to PortfolioMetrics struct and TS types"
```

---

## Task 8: Update `calculate_portfolio_metrics` to populate breakdowns

**Files:**
- Modify: `src-tauri/src/commands/portfolio.rs`

- [ ] **Step 1: Update the function body**

Find `fn calculate_portfolio_metrics` and replace the entire function body. The function signature stays the same. Add `use std::collections::HashMap;` at the top of the file if not already present.

The key additions are accumulator maps alongside each CZK total, plus populating them in the return struct. Here is the complete updated function body (inside `db.with_conn(|conn| { ... })`):

```rust
    db.with_conn(|conn| {
        // --- Savings ---
        let mut savings_by_currency: HashMap<String, f64> = HashMap::new();
        let mut bank_stmt = conn.prepare("SELECT balance, currency FROM bank_accounts")?;
        let total_savings: f64 = bank_stmt
            .query_map([], |row| {
                let balance: f64 = row.get::<_, String>(0)?.parse().unwrap_or(0.0);
                let currency: String = row.get(1)?;
                Ok((balance, currency))
            })?
            .filter_map(|r| r.ok())
            .map(|(balance, currency)| {
                *savings_by_currency.entry(currency.clone()).or_insert(0.0) += balance;
                convert_to_czk(balance, &currency)
            })
            .sum();

        // --- Bonds ---
        let mut bonds_by_currency: HashMap<String, f64> = HashMap::new();
        let mut bonds_stmt = conn.prepare("SELECT coupon_value, quantity, currency FROM bonds")?;
        let total_bonds: f64 = bonds_stmt
            .query_map([], |row| {
                let value: f64 = row.get::<_, String>(0)?.parse().unwrap_or(0.0);
                let quantity: f64 = row.get::<_, String>(1)?.parse().unwrap_or(1.0);
                let currency: String = row.get(2)?;
                Ok((value, quantity, currency))
            })?
            .filter_map(|r| r.ok())
            .map(|(value, quantity, currency)| {
                *bonds_by_currency.entry(currency.clone()).or_insert(0.0) += value * quantity;
                convert_to_czk(value * quantity, &currency)
            })
            .sum();

        // --- Liabilities (loans) ---
        let mut loans_by_currency: HashMap<String, f64> = HashMap::new();
        let mut loans_stmt = conn.prepare("SELECT principal, currency FROM loans")?;
        let total_liabilities: f64 = loans_stmt
            .query_map([], |row| {
                let principal: f64 = row.get::<_, String>(0)?.parse().unwrap_or(0.0);
                let currency: String = row.get(1)?;
                Ok((principal, currency))
            })?
            .filter_map(|r| r.ok())
            .map(|(principal, currency)| {
                *loans_by_currency.entry(currency.clone()).or_insert(0.0) += principal;
                convert_to_czk(principal, &currency)
            })
            .sum();

        // --- Real estate ---
        let mut real_estate_by_currency: HashMap<String, f64> = HashMap::new();
        let mut stmt =
            conn.prepare("SELECT type, market_price, market_price_currency FROM real_estate")?;
        let mut total_re_personal = 0.0;
        let mut total_re_investment = 0.0;

        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?;

        for row in rows.filter_map(|r| r.ok()) {
            let price: f64 = row.1.parse().unwrap_or(0.0);
            let currency = row.2.clone();
            let price_czk = convert_to_czk(price, &currency);
            *real_estate_by_currency.entry(currency).or_insert(0.0) += price;
            if row.0 == "personal" {
                total_re_personal += price_czk;
            } else {
                total_re_investment += price_czk;
            }
        }

        // --- Investments (stocks) ---
        let mut investments_by_currency: HashMap<String, f64> = HashMap::new();
        let mut total_investments = 0.0;
        let mut inv_stmt = conn.prepare("SELECT ticker, quantity FROM stock_investments")?;
        let investments: Vec<(String, String)> = inv_stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .filter_map(|r| r.ok())
            .collect();

        for inv in investments {
            let qty: f64 = inv.1.parse().unwrap_or(0.0);
            if let Some(resolved) = crate::services::pricing::resolve_stock_price(conn, &inv.0) {
                total_investments += resolved.price_czk * qty;
                let native_price: f64 = resolved.original_price.parse().unwrap_or(0.0);
                *investments_by_currency
                    .entry(resolved.currency.clone())
                    .or_insert(0.0) += native_price * qty;
            }
        }

        // --- Crypto ---
        let mut crypto_by_currency: HashMap<String, f64> = HashMap::new();
        let mut total_crypto = 0.0;
        let mut crypto_stmt = conn.prepare("SELECT ticker, quantity FROM crypto_investments")?;
        let cryptos: Vec<(String, String)> = crypto_stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .filter_map(|r| r.ok())
            .collect();

        for crypto in cryptos {
            let qty: f64 = crypto.1.parse().unwrap_or(0.0);
            if let Some(resolved) =
                crate::services::pricing::resolve_crypto_price(conn, &crypto.0)
            {
                total_crypto += resolved.price_czk * qty;
                let native_price: f64 = resolved.original_price.parse().unwrap_or(0.0);
                *crypto_by_currency
                    .entry(resolved.currency.clone())
                    .or_insert(0.0) += native_price * qty;
            }
        }

        // --- Other assets ---
        let mut other_assets_by_currency: HashMap<String, f64> = HashMap::new();
        let mut total_other_assets = 0.0;
        let mut other_stmt =
            conn.prepare("SELECT quantity, market_price, currency FROM other_assets")?;
        let other_assets: Vec<(String, String, String)> = other_stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?
            .filter_map(|r| r.ok())
            .collect();

        for asset in other_assets {
            let qty: f64 = asset.0.parse().unwrap_or(0.0);
            let price: f64 = asset.1.parse().unwrap_or(0.0);
            let currency = asset.2;
            *other_assets_by_currency.entry(currency.clone()).or_insert(0.0) += qty * price;
            total_other_assets += convert_to_czk(qty * price, &currency);
        }

        // --- Totals ---
        let total_real_estate = if exclude_personal_real_estate {
            total_re_investment
        } else {
            total_re_personal + total_re_investment
        };

        let total_assets = total_savings
            + total_investments
            + total_crypto
            + total_bonds
            + total_real_estate
            + total_other_assets;
        let net_worth = total_assets - total_liabilities;

        Ok(PortfolioMetrics {
            total_savings,
            total_investments,
            total_crypto,
            total_bonds,
            total_real_estate_personal: total_re_personal,
            total_real_estate_investment: total_re_investment,
            total_real_estate,
            total_other_assets,
            total_liabilities,
            total_assets,
            net_worth,
            savings_by_currency,
            investments_by_currency,
            crypto_by_currency,
            bonds_by_currency,
            real_estate_by_currency,
            loans_by_currency,
            other_assets_by_currency,
        })
    })
```

- [ ] **Step 2: Add test**

In the `#[cfg(test)]` module at the bottom of `portfolio.rs`, add:

```rust
#[test]
fn test_calculate_portfolio_metrics_investments_by_currency() {
    let conn = rusqlite::Connection::open_in_memory().expect("db");
    conn.execute_batch(r#"
        CREATE TABLE stock_investments (id TEXT PRIMARY KEY, ticker TEXT, quantity TEXT, currency TEXT DEFAULT 'USD');
        CREATE TABLE stock_data (ticker TEXT PRIMARY KEY, price TEXT, currency TEXT, fetched_at INTEGER);
        CREATE TABLE stock_price_overrides (ticker TEXT PRIMARY KEY, price TEXT, currency TEXT, updated_at INTEGER);
        CREATE TABLE crypto_investments (id TEXT PRIMARY KEY, ticker TEXT, quantity TEXT, currency TEXT DEFAULT 'USD');
        CREATE TABLE crypto_data (ticker TEXT PRIMARY KEY, price TEXT, currency TEXT, fetched_at INTEGER);
        CREATE TABLE crypto_price_overrides (ticker TEXT PRIMARY KEY, price TEXT, currency TEXT, updated_at INTEGER);
        CREATE TABLE bank_accounts (id TEXT PRIMARY KEY, name TEXT, balance TEXT, currency TEXT DEFAULT 'CZK');
        CREATE TABLE bonds (id TEXT PRIMARY KEY, coupon_value TEXT, quantity TEXT, currency TEXT DEFAULT 'CZK');
        CREATE TABLE loans (id TEXT PRIMARY KEY, principal TEXT, currency TEXT DEFAULT 'CZK');
        CREATE TABLE real_estate (id TEXT PRIMARY KEY, type TEXT, market_price TEXT, market_price_currency TEXT DEFAULT 'CZK');
        CREATE TABLE other_assets (id TEXT PRIMARY KEY, quantity TEXT, market_price TEXT, currency TEXT DEFAULT 'CZK');
        CREATE TABLE savings_accounts (id TEXT PRIMARY KEY, balance TEXT, currency TEXT DEFAULT 'CZK');

        INSERT INTO stock_investments VALUES ('1', 'AAPL', '10', 'USD');
        INSERT INTO stock_investments VALUES ('2', 'T7203', '5', 'JPY');
        INSERT INTO stock_data VALUES ('AAPL', '150.0', 'USD', 0);
        INSERT INTO stock_data VALUES ('T7203', '2000.0', 'JPY', 0);
    "#).expect("schema");

    crate::services::currency::update_exchange_rates(
        [("USD".to_string(), 23.0), ("JPY".to_string(), 0.15)]
            .into_iter()
            .collect(),
    );

    // We can't call calculate_portfolio_metrics directly (needs Database struct),
    // but we can verify the resolve_stock_price logic contributes correctly
    let resolved_aapl = crate::services::pricing::resolve_stock_price(&conn, "AAPL")
        .expect("AAPL price");
    assert_eq!(resolved_aapl.currency, "USD");
    assert!((resolved_aapl.original_price.parse::<f64>().unwrap() - 150.0).abs() < 0.01);

    let resolved_t7203 = crate::services::pricing::resolve_stock_price(&conn, "T7203")
        .expect("T7203 price");
    assert_eq!(resolved_t7203.currency, "JPY");
    assert!((resolved_t7203.original_price.parse::<f64>().unwrap() - 2000.0).abs() < 0.01);
}
```

- [ ] **Step 3: Run Rust check and tests**

```bash
cd src-tauri && cargo check
cd src-tauri && cargo test
```

Expected: no errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/portfolio.rs
git commit -m "feat: calculate_portfolio_metrics now populates native currency breakdowns"
```

---

## Task 9: Update `update_todays_snapshot` to write breakdown columns

**Files:**
- Modify: `src-tauri/src/commands/portfolio.rs`

- [ ] **Step 1: Add JSON serialization helper at top of the db.with_conn closure**

Inside `update_todays_snapshot`, after `let metrics = calculate_portfolio_metrics(db, false)?;`, add serialization of breakdowns. Require `serde_json` — check that `Cargo.toml` already has it (it does, used elsewhere). Then update both the UPDATE and INSERT statements.

Find the `UPDATE portfolio_metrics_history` statement and replace it:

```rust
// Serialize breakdown maps to JSON
let inv_by_cur = serde_json::to_string(&metrics.investments_by_currency).unwrap_or("{}".to_string());
let crypto_by_cur = serde_json::to_string(&metrics.crypto_by_currency).unwrap_or("{}".to_string());
let savings_by_cur = serde_json::to_string(&metrics.savings_by_currency).unwrap_or("{}".to_string());
let bonds_by_cur = serde_json::to_string(&metrics.bonds_by_currency).unwrap_or("{}".to_string());
let re_by_cur = serde_json::to_string(&metrics.real_estate_by_currency).unwrap_or("{}".to_string());
let loans_by_cur = serde_json::to_string(&metrics.loans_by_currency).unwrap_or("{}".to_string());
let other_by_cur = serde_json::to_string(&metrics.other_assets_by_currency).unwrap_or("{}".to_string());
```

Then update the UPDATE statement (the one inside `if let Some(id) = existing_id`):

```rust
conn.execute(
    "UPDATE portfolio_metrics_history
     SET total_savings = ?2, total_loans_principal = ?3, total_investments = ?4,
         total_crypto = ?5, total_bonds = ?6, total_real_estate_personal = ?7,
         total_real_estate_investment = ?8, total_other_assets = ?9, recorded_at = ?10,
         investments_by_currency = ?11, crypto_by_currency = ?12,
         savings_by_currency = ?13, bonds_by_currency = ?14,
         real_estate_by_currency = ?15, loans_by_currency = ?16,
         other_assets_by_currency = ?17
     WHERE id = ?1",
    rusqlite::params![
        id,
        metrics.total_savings.to_string(),
        metrics.total_liabilities.to_string(),
        metrics.total_investments.to_string(),
        metrics.total_crypto.to_string(),
        metrics.total_bonds.to_string(),
        metrics.total_real_estate_personal.to_string(),
        metrics.total_real_estate_investment.to_string(),
        metrics.total_other_assets.to_string(),
        now_ts,
        inv_by_cur,
        crypto_by_cur,
        savings_by_cur,
        bonds_by_cur,
        re_by_cur,
        loans_by_cur,
        other_by_cur,
    ],
)?;
```

And update the INSERT statement:

```rust
let id = Uuid::new_v4().to_string();
conn.execute(
    "INSERT INTO portfolio_metrics_history
     (id, total_savings, total_loans_principal, total_investments, total_crypto,
      total_bonds, total_real_estate_personal, total_real_estate_investment,
      total_other_assets, recorded_at,
      investments_by_currency, crypto_by_currency, savings_by_currency,
      bonds_by_currency, real_estate_by_currency, loans_by_currency,
      other_assets_by_currency)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
    rusqlite::params![
        id,
        metrics.total_savings.to_string(),
        metrics.total_liabilities.to_string(),
        metrics.total_investments.to_string(),
        metrics.total_crypto.to_string(),
        metrics.total_bonds.to_string(),
        metrics.total_real_estate_personal.to_string(),
        metrics.total_real_estate_investment.to_string(),
        metrics.total_other_assets.to_string(),
        now_ts,
        inv_by_cur,
        crypto_by_cur,
        savings_by_cur,
        bonds_by_cur,
        re_by_cur,
        loans_by_cur,
        other_by_cur,
    ],
)?;
```

- [ ] **Step 2: Update backfill snapshot INSERT/UPDATE statements in `portfolio.rs`**

Search for all `INSERT INTO portfolio_metrics_history` and `UPDATE portfolio_metrics_history` statements in `portfolio.rs` other than the one already updated in Step 1 (there are several in the `backfill_missing_snapshots` path). For each INSERT, extend the column list and add `'{}'` literals for the seven breakdown columns:

```rust
"INSERT INTO portfolio_metrics_history
 (id, total_savings, total_loans_principal, total_investments, total_crypto,
  total_bonds, total_real_estate_personal, total_real_estate_investment,
  total_other_assets, recorded_at,
  investments_by_currency, crypto_by_currency, savings_by_currency,
  bonds_by_currency, real_estate_by_currency, loans_by_currency,
  other_assets_by_currency)
 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
         '{}', '{}', '{}', '{}', '{}', '{}', '{}')",
```

For each UPDATE, add these columns set to `'{}'`:
```rust
investments_by_currency = '{}',
crypto_by_currency = '{}',
savings_by_currency = '{}',
bonds_by_currency = '{}',
real_estate_by_currency = '{}',
loans_by_currency = '{}',
other_assets_by_currency = '{}'
```

These backfill snapshots start with `'{}'` and are populated by `backfill_currency_breakdowns` in Task 10.

- [ ] **Step 3: Update `PortfolioMetricsHistory` Rust struct in `src-tauri/src/models/user.rs`**

Find `pub struct PortfolioMetricsHistory` and replace it:

```rust
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
    #[serde(rename = "investmentsByCurrency")]
    pub investments_by_currency: String,
    #[serde(rename = "cryptoByCurrency")]
    pub crypto_by_currency: String,
    #[serde(rename = "savingsByCurrency")]
    pub savings_by_currency: String,
    #[serde(rename = "bondsByCurrency")]
    pub bonds_by_currency: String,
    #[serde(rename = "realEstateByCurrency")]
    pub real_estate_by_currency: String,
    #[serde(rename = "loansByCurrency")]
    pub loans_by_currency: String,
    #[serde(rename = "otherAssetsByCurrency")]
    pub other_assets_by_currency: String,
}
```

- [ ] **Step 4: Update the `get_portfolio_history` SELECT query and row mapping**

Find the `get_portfolio_history` function and its SELECT query. Update it to also select the seven new columns:

```rust
"SELECT id, total_savings, total_loans_principal, total_investments, total_crypto,
        total_bonds, total_real_estate_personal, total_real_estate_investment,
        total_other_assets, recorded_at,
        investments_by_currency, crypto_by_currency, savings_by_currency,
        bonds_by_currency, real_estate_by_currency, loans_by_currency,
        other_assets_by_currency
 FROM portfolio_metrics_history",
```

Update the row mapping to populate the new fields:

```rust
Ok(PortfolioMetricsHistory {
    id: row.get(0)?,
    total_savings: row.get(1)?,
    total_loans_principal: row.get(2)?,
    total_investments: row.get(3)?,
    total_crypto: row.get(4)?,
    total_bonds: row.get(5)?,
    total_real_estate_personal: row.get(6)?,
    total_real_estate_investment: row.get(7)?,
    total_other_assets: row.get(8)?,
    recorded_at: row.get(9)?,
    investments_by_currency: row.get::<_, String>(10).unwrap_or("{}".to_string()),
    crypto_by_currency: row.get::<_, String>(11).unwrap_or("{}".to_string()),
    savings_by_currency: row.get::<_, String>(12).unwrap_or("{}".to_string()),
    bonds_by_currency: row.get::<_, String>(13).unwrap_or("{}".to_string()),
    real_estate_by_currency: row.get::<_, String>(14).unwrap_or("{}".to_string()),
    loans_by_currency: row.get::<_, String>(15).unwrap_or("{}".to_string()),
    other_assets_by_currency: row.get::<_, String>(16).unwrap_or("{}".to_string()),
})
```

- [ ] **Step 5: Run Rust check**

```bash
cd src-tauri && cargo check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/portfolio.rs src-tauri/src/models/user.rs
git commit -m "feat: snapshot writes and reads native currency breakdown columns"
```

---

## Task 10: Add `backfill_currency_breakdowns` Rust command

**Files:**
- Modify: `src-tauri/src/commands/portfolio.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/tauri-api.ts`

- [ ] **Step 1: Add the backfill function and command**

After `backfill_crypto_ticker_history`, add:

```rust
/// Backfill native currency breakdowns for existing portfolio_metrics_history rows.
///
/// - Stocks/crypto: derived from stock_value_history / crypto_value_history per day.
/// - Other asset classes: populated with {"CZK": <czk_total>} (no per-day history available).
///
/// Only processes rows where investments_by_currency = '{}' — safe to interrupt and resume.
#[tauri::command]
pub async fn backfill_currency_breakdowns(
    db: State<'_, Database>,
) -> Result<i32> {
    db.with_conn(|conn| {
        // Fetch all rows that need investment breakdown
        let rows: Vec<(String, i64, f64, f64, f64, f64, f64)> = conn
            .prepare(
                "SELECT id, recorded_at,
                        CAST(total_savings AS REAL),
                        CAST(total_bonds AS REAL),
                        CAST(total_real_estate_personal AS REAL) + CAST(total_real_estate_investment AS REAL),
                        CAST(total_loans_principal AS REAL),
                        CAST(total_other_assets AS REAL)
                 FROM portfolio_metrics_history
                 WHERE investments_by_currency = '{}'",
            )?
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, f64>(3)?,
                    row.get::<_, f64>(4)?,
                    row.get::<_, f64>(5)?,
                    row.get::<_, f64>(6)?,
                ))
            })?
            .filter_map(|r| r.ok())
            .collect();

        let mut processed = 0i32;

        for (id, recorded_at, total_savings, total_bonds, total_re, total_loans, total_other) in rows {
            let day_start = (recorded_at / 86400) * 86400;
            let day_end = day_start + 86400;

            // Stock breakdown from stock_value_history
            let inv_breakdown: std::collections::HashMap<String, f64> = conn
                .prepare(
                    "SELECT currency, SUM(CAST(quantity AS REAL) * CAST(price AS REAL))
                     FROM stock_value_history
                     WHERE recorded_at >= ?1 AND recorded_at < ?2
                     GROUP BY currency",
                )?
                .query_map(rusqlite::params![day_start, day_end], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
                })?
                .filter_map(|r| r.ok())
                .collect();

            // Crypto breakdown from crypto_value_history
            let crypto_breakdown: std::collections::HashMap<String, f64> = conn
                .prepare(
                    "SELECT currency, SUM(CAST(quantity AS REAL) * CAST(price AS REAL))
                     FROM crypto_value_history
                     WHERE recorded_at >= ?1 AND recorded_at < ?2
                     GROUP BY currency",
                )?
                .query_map(rusqlite::params![day_start, day_end], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
                })?
                .filter_map(|r| r.ok())
                .collect();

            // Other asset classes: snapshot CZK total as {"CZK": value}
            let savings_json = format!("{{\"CZK\":{}}}", total_savings);
            let bonds_json = format!("{{\"CZK\":{}}}", total_bonds);
            let re_json = format!("{{\"CZK\":{}}}", total_re);
            let loans_json = format!("{{\"CZK\":{}}}", total_loans);
            let other_json = format!("{{\"CZK\":{}}}", total_other);

            let inv_json = serde_json::to_string(&inv_breakdown).unwrap_or("{}".to_string());
            let crypto_json = serde_json::to_string(&crypto_breakdown).unwrap_or("{}".to_string());

            conn.execute(
                "UPDATE portfolio_metrics_history
                 SET investments_by_currency = ?2,
                     crypto_by_currency = ?3,
                     savings_by_currency = ?4,
                     bonds_by_currency = ?5,
                     real_estate_by_currency = ?6,
                     loans_by_currency = ?7,
                     other_assets_by_currency = ?8
                 WHERE id = ?1",
                rusqlite::params![
                    id, inv_json, crypto_json,
                    savings_json, bonds_json, re_json, loans_json, other_json,
                ],
            )?;

            processed += 1;
        }

        println!("[BACKFILL] Currency breakdowns: processed {} rows", processed);
        Ok(processed)
    })
}
```

- [ ] **Step 2: Register in `lib.rs`**

Add to the `generate_handler![]` block:

```rust
commands::portfolio::backfill_currency_breakdowns,
```

- [ ] **Step 3: Expose in `tauri-api.ts`**

In the `portfolioApi` object, add:

```typescript
backfillCurrencyBreakdowns: () =>
  tauriInvoke<number>('backfill_currency_breakdowns'),
```

- [ ] **Step 4: Run Rust check + typecheck**

```bash
cd src-tauri && cargo check
cd .. && npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/portfolio.rs src-tauri/src/lib.rs src/lib/tauri-api.ts
git commit -m "feat: add backfill_currency_breakdowns command to populate existing snapshot rows"
```

---

## Task 11: Wire backfill into SyncProvider

**Files:**
- Modify: `src/hooks/SyncProvider.tsx`

- [ ] **Step 1: Add currency breakdown backfill call after existing portfolio backfill**

In `src/hooks/SyncProvider.tsx`, find the `startBackfill` callback. After the `portfolioApi.startBackfill()` call succeeds, add the currency breakdown backfill:

```typescript
const startBackfill = useCallback(async () => {
  if (isSyncingRef.current) return;
  isSyncingRef.current = true;

  try {
    setIsSyncing(true);
    setProgress({ current: 0, total: 0 });

    const result = await portfolioApi.startBackfill();

    setProgress({
      current: result.days_processed,
      total: result.total_days,
    });
    setLastResult(result);

    if (result.days_processed > 0) {
      queryClient.invalidateQueries({ queryKey: ['portfolio-history'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-metrics'] });
    }

    // Backfill native currency breakdowns for existing snapshots (safe to re-run)
    try {
      await portfolioApi.backfillCurrencyBreakdowns();
      queryClient.invalidateQueries({ queryKey: ['portfolio-history'] });
    } catch (err) {
      console.warn('[Sync] Currency breakdown backfill failed (non-critical):', err);
    }
  } catch (error) {
    console.error('[Sync] Backfill failed:', error);
  } finally {
    isSyncingRef.current = false;
    setIsSyncing(false);
  }
}, [queryClient]);
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/SyncProvider.tsx
git commit -m "feat: run currency breakdown backfill on startup after portfolio backfill"
```

---

## Task 12: Update `PortfolioValueTrendChart` for historical accuracy

**Files:**
- Modify: `src/components/common/PortfolioValueTrendChart.tsx`

- [ ] **Step 1: Add a historical rates query**

At the top of the `PortfolioValueTrendChart` component (after the existing `portfolioHistory` query), add a query that fetches historical rates for the current date range:

```typescript
// Fetch historical rates for the displayed date range
const startTs = dateRange.start
  ? Math.floor(dateRange.start.getTime() / 1000)
  : 0;
const endTs = Math.floor(dateRange.end.getTime() / 1000);

const { data: historicalRates } = useQuery<Record<number, Record<string, number>>>({
  queryKey: ['exchange-rates-range', startTs, endTs],
  queryFn: () => portfolioApi.getExchangeRatesForDateRange(startTs, endTs),
  enabled: !!portfolioHistory && currencyCode !== 'CZK',
  staleTime: 60 * 60 * 1000, // rates don't change more than once per hour
});
```

- [ ] **Step 2: Update the `historyData` useMemo to use native breakdowns**

Find the block inside the `useMemo` that builds `historyData`. It currently does:
```typescript
let valueInCzk: number;
if (type === 'investments') {
  valueInCzk = Number(h.totalInvestments);
} else {
  valueInCzk = Number(h.totalCrypto || 0);
}
const value = convert(valueInCzk, "CZK", currencyCode);
```

Replace with:

```typescript
// Helper: convert native breakdown using historical rates for this date,
// falling back to current-day CZK total if breakdown is empty or rates unavailable.
function valueFromBreakdown(
  breakdownJson: string,
  czKFallback: number,
  rates: Record<string, number> | undefined,
): number {
  let breakdown: Record<string, number> = {};
  try { breakdown = JSON.parse(breakdownJson); } catch { /* ignore */ }

  const hasBreakdown = Object.keys(breakdown).length > 0;
  if (!hasBreakdown || !rates || currencyCode === 'CZK') {
    return convert(czKFallback, 'CZK', currencyCode);
  }

  // Sum each native bucket converted to display currency via CZK pivot
  return Object.entries(breakdown).reduce((sum, [cur, amount]) => {
    const toCzk = (rates[cur] ?? 1) * amount;           // native → CZK
    const displayRate = rates[currencyCode] ?? 1;
    return sum + toCzk / displayRate;                    // CZK → display
  }, 0);
}

// Find the closest historical rate snapshot for this chart point
// (rates map keys are midnight timestamps; chart timestamps may be offset slightly)
const dayKey = Math.floor(h.recordedAt / 86400) * 86400;
const ratesForDay = historicalRates?.[dayKey];

let value: number;
if (type === 'investments') {
  value = valueFromBreakdown(h.investmentsByCurrency, Number(h.totalInvestments), ratesForDay);
} else {
  value = valueFromBreakdown(h.cryptoByCurrency, Number(h.totalCrypto || 0), ratesForDay);
}
```

Add `portfolioApi` to the import if not already present (it is — check the existing imports).

Also add `historicalRates` to the `useMemo` dependencies array.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
npm test
cd src-tauri && cargo test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/common/PortfolioValueTrendChart.tsx
git commit -m "feat: use native currency breakdowns + historical rates in portfolio trend chart"
```

---

## Final verification

- [ ] Run `npm run lint` — fix any warnings that are errors
- [ ] Run `npm run typecheck` — no errors
- [ ] Run `npm test` — all pass
- [ ] Run `cd src-tauri && cargo clippy` — no warnings
- [ ] Run `cd src-tauri && cargo test` — all pass
- [ ] Start the app with `npm run tauri dev`, unlock, verify:
  - Settings currency dropdown shows all 15 currencies
  - Stock form currency dropdown shows all 15 currencies
  - Portfolio chart renders without errors after switching display currency to USD/JPY
  - Console shows `[BACKFILL] Currency breakdowns: processed N rows` on startup
