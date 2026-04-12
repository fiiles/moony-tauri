# Multicurrency Refactor — Design Spec

**Date:** 2026-04-12
**Status:** Approved

## Overview

Three coordinated changes to make Moony's currency handling accurate end-to-end:

1. **Currency registry expansion** — promote 15 currencies to full display + position support
2. **Daily exchange rate history** — store per-day ECB rates for accurate historical conversion
3. **Native currency breakdown in portfolio snapshots** — eliminate double-conversion by storing native amounts alongside CZK totals

---

## Area 1: Currency Registry

### Problem

The current system has a split: 4 display currencies (USD, EUR, CZK, GBP) and 8 internal currencies. AUD, CAD, NZD, SGD, SEK, NOK, DKK and others are missing entirely, making it impossible to correctly handle positions on Japanese, Australian, Canadian, Nordic, or Singapore exchanges.

### Solution

Collapse the display/internal split. One unified `CurrencyCode` type covering 15 currencies — every currency is both a valid position currency and a valid display/preference currency.

### Supported currencies

| Code | Name | Primary Exchange(s) |
|------|------|---------------------|
| CZK  | Czech Crown | Prague (PSE) — internal base |
| EUR  | Euro | Frankfurt, Euronext |
| USD  | US Dollar | NYSE, NASDAQ |
| GBP  | British Pound | London (LSE) |
| JPY  | Japanese Yen | Tokyo (TSE) |
| AUD  | Australian Dollar | Sydney (ASX) |
| CAD  | Canadian Dollar | Toronto (TSX) |
| CHF  | Swiss Franc | Zurich (SIX) |
| HKD  | Hong Kong Dollar | Hong Kong (HKEX) |
| CNY  | Chinese Yuan | Shanghai, Shenzhen |
| SEK  | Swedish Krona | Stockholm (Nasdaq Nordic) |
| NOK  | Norwegian Krone | Oslo (Oslo Børs) |
| DKK  | Danish Krone | Copenhagen (Nasdaq Nordic) |
| SGD  | Singapore Dollar | Singapore (SGX) |
| NZD  | New Zealand Dollar | Auckland (NZX) |

All 15 are published daily by ECB. The backend already fetches all ECB currencies via `extract_all_currencies` — no Rust fetch logic changes needed.

### Code changes

**`shared/currencies.ts`**
- Remove `DisplayCurrencyCode` type — replaced by unified `CurrencyCode`
- Expand `CurrencyCode` union to all 15 codes
- Expand `CURRENCIES` record with locale, symbol, position for each new currency
- Seed `EXCHANGE_RATES` with sensible fallbacks for all 15
- `BASE_CURRENCY` stays `"CZK"`

**`src-tauri/src/services/currency.rs`**
- Update fallback rates in `EXCHANGE_RATES` lazy_static to include all 15 currencies

**UI — currency dropdowns**
- Settings display currency preference: shows all 15 (currently 4)
- Entity form dropdowns (bank accounts, stocks, crypto, bonds, real estate, loans, other assets): all derive options from the central `CURRENCIES` map — expanding the registry covers them automatically
- Sweep all forms to confirm none hardcode a filtered subset

---

## Area 2: Daily Exchange Rate History

### Problem

`exchange_rates` table stores only the latest rate per currency. Historical portfolio snapshots are re-displayed using today's rate, not the rate that was in effect on the snapshot date. A US user with EUR positions sees inaccurate historical chart values.

### Solution

Store one rate snapshot per (date, currency) each time ECB rates are fetched. Any historical date can then be looked up and any currency pair derived via CZK as cross-rate pivot.

### Cross-rate derivation

No pair storage needed — any pair is derivable from CZK-relative rates:

```
EUR→USD on date T = (EUR/CZK rate on T) ÷ (USD/CZK rate on T)
```

This is consistent with the existing `convert()` logic in `currency.tsx` which already routes through CZK.

### New DB table (migration 037)

```sql
CREATE TABLE exchange_rate_history (
    date     INTEGER NOT NULL,  -- Unix timestamp normalised to midnight UTC
    currency TEXT NOT NULL,     -- ISO 4217 code, e.g. "USD"
    rate     REAL NOT NULL,     -- 1 unit of currency = X CZK
    PRIMARY KEY (date, currency)
);
CREATE INDEX idx_erh_currency_date ON exchange_rate_history(currency, date);
```

CZK is not stored (always 1.0 by definition).

**Size estimate:** 15 currencies × 365 days × 10 years ≈ 55K rows at ~50 bytes = **~2.7 MB**. Negligible.

### Population

Every call to `fetch_ecb_rates()` (once per session after unlock) upserts today's rates into `exchange_rate_history` after updating `exchange_rates`. If called multiple times in a day, the latest intraday value overwrites.

### New Rust service function

```rust
/// Returns rates for a specific date.
/// Falls back to the nearest earlier date if the exact date has no snapshot
/// (weekends, holidays, or dates before first install).
/// Falls back to today's rates if no historical snapshot exists at all.
pub fn get_rates_for_date(conn: &Connection, date: i64) -> HashMap<String, f64>
```

### New Tauri command

```rust
#[tauri::command]
pub async fn get_exchange_rates_for_date(
    db: State<'_, Database>,
    date: i64,
) -> Result<HashMap<String, f64>>
```

Exposed as `portfolioApi.getExchangeRatesForDate(date: number)` in `tauri-api.ts`.

### Display layer usage

When rendering a historical chart point in a non-CZK display currency, the chart component fetches rates for that date and applies the cross-rate conversion instead of using today's live rates. Falls back gracefully to today's rates if no historical snapshot exists (no regression for pre-migration data).

---

## Area 3: Native Currency Breakdown in Portfolio Snapshots

### Problem

`portfolio_metrics_history` stores all asset class totals as CZK scalars. Displaying a historical point in USD requires: `CZK total ÷ today's USD rate` — wrong in two ways: the CZK value was computed with the rate at recording time, and the display applies a different (today's) rate.

### Solution

Store native currency amounts per asset class as JSON alongside the existing CZK totals. The CZK totals are kept for backwards compatibility and net worth calculation. The breakdown fields are used for accurate per-currency display.

### Schema change (migration 037, continued)

```sql
ALTER TABLE portfolio_metrics_history ADD COLUMN investments_by_currency  TEXT NOT NULL DEFAULT '{}';
ALTER TABLE portfolio_metrics_history ADD COLUMN crypto_by_currency       TEXT NOT NULL DEFAULT '{}';
ALTER TABLE portfolio_metrics_history ADD COLUMN savings_by_currency      TEXT NOT NULL DEFAULT '{}';
ALTER TABLE portfolio_metrics_history ADD COLUMN bonds_by_currency        TEXT NOT NULL DEFAULT '{}';
ALTER TABLE portfolio_metrics_history ADD COLUMN real_estate_by_currency  TEXT NOT NULL DEFAULT '{}';
ALTER TABLE portfolio_metrics_history ADD COLUMN loans_by_currency        TEXT NOT NULL DEFAULT '{}';
ALTER TABLE portfolio_metrics_history ADD COLUMN other_assets_by_currency TEXT NOT NULL DEFAULT '{}';
```

Example value: `{"USD": 3200.0, "JPY": 180000.0, "EUR": 1500.0}`

### Migration of existing rows

| Asset class | Existing rows | Rationale |
|-------------|---------------|-----------|
| Stocks | Backfilled from `stock_value_history` where coverage exists | History table has `price`, `currency`, `quantity` per ticker per day |
| Crypto | Backfilled from `crypto_value_history` where coverage exists | Same structure |
| Savings | `{"CZK": <total_savings>}` | No per-day history; current total copied as CZK |
| Bonds | `{"CZK": <total_bonds>}` | No per-day history |
| Real estate | `{"CZK": <total_real_estate>}` | No per-day history |
| Loans | `{"CZK": <total_loans>}` | No per-day history |
| Other assets | `{"CZK": <total_other_assets>}` | No per-day history |

For non-stock/crypto existing rows, `{"CZK": X}` is no worse than today and gives consistent structure. From migration day forward, all asset classes record true native breakdowns.

### Backfill query (stocks example)

```sql
SELECT currency, SUM(CAST(quantity AS REAL) * CAST(price AS REAL))
FROM stock_value_history
WHERE recorded_at >= :day_start AND recorded_at < :day_end
GROUP BY currency
```

Backfill runs at startup after unlock (same pattern as existing portfolio backfill in `SyncProvider`). Only rows where `investments_by_currency = '{}'` are processed — safe to interrupt and resume.

### Updated `PortfolioMetrics` Rust struct

```rust
pub struct PortfolioMetrics {
    // CZK totals — unchanged, kept for net worth calculation and backwards compat
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

    // Native currency breakdowns — new
    pub savings_by_currency: HashMap<String, f64>,
    pub investments_by_currency: HashMap<String, f64>,
    pub crypto_by_currency: HashMap<String, f64>,
    pub bonds_by_currency: HashMap<String, f64>,
    pub real_estate_by_currency: HashMap<String, f64>,
    pub loans_by_currency: HashMap<String, f64>,
    pub other_assets_by_currency: HashMap<String, f64>,
}
```

`calculate_portfolio_metrics` accumulates `quantity × price` in native currency alongside the existing CZK total — no extra DB queries needed.

### Display layer logic for historical chart points

```
if investments_by_currency is non-empty:
    fetch rates for that date via getExchangeRatesForDate()
    for each (currency, native_amount) in breakdown:
        convert native_amount → display_currency using historical rates
    sum → accurate chart value
else:
    fall back to total_investments (CZK) ÷ display_currency rate for that date
    (same as today — no regression)
```

Accuracy improves automatically as backfill completes and new snapshots accumulate, with no visible change to the user.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| ECB fetch fails | Falls back to `exchange_rates` table, then nearest row in `exchange_rate_history` |
| No historical rate for requested date | Walk backwards to nearest available date; if none, use today's rates |
| Malformed JSON in breakdown column | Parse failure returns empty `HashMap`; display falls back to CZK total |
| Backfill interrupted mid-run | Safe to resume — checks `= '{}'` before processing each row |

---

## Testing

### Rust (`#[cfg(test)]` modules, in-memory DB)

- `currency.rs`
  - Cross-rate derivation: EUR→USD via CZK pivot produces correct result
  - `get_rates_for_date` falls back to nearest earlier date when exact date missing
  - `get_rates_for_date` falls back to today's rates when no history exists
- `portfolio.rs`
  - `calculate_portfolio_metrics` produces correct `investments_by_currency` for mixed-currency positions
  - Backfill sets correct native breakdown from `stock_value_history`
  - Migration sets `{"CZK": X}` for asset classes without history

### TypeScript (Vitest, co-located `.test.ts`)

- `shared/currencies.ts`
  - All 15 currencies present in `CURRENCIES` and `EXCHANGE_RATES`
  - `convertToCzk` / `convertFromCzk` round-trip for all new currencies
  - Cross-rate math: `convert(100, "EUR", "USD")` equals `(EUR/CZK) / (USD/CZK) × 100`
  - No test for `tauri-api.ts` or React components (per project policy)

---

## Out of Scope

- Rate history charts as a standalone UI feature (Area 2 is infrastructure only)
- Per-day history tracking for savings, bonds, real estate, loans, other assets (deferred — no source data exists)
- Cryptocurrency exchange rates (crypto prices are fetched directly in native USD; conversion already works via existing `convert_to_czk`)
