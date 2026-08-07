# Calculations audit: portfolio metrics, history, currency (2026-08-06)

Requested by the maintainer before open-sourcing: "verify there is no bug or design
flaw in calculations of metrics, history etc." Scope reviewed: live portfolio
metrics, snapshot/history recording and backfill, currency conversion (Rust and
frontend), stock/crypto cost-basis recalculation, budgeting report math.

Fixes are specified in `docs/specs/2026-08-06-calculation-fixes.md`. Findings are
ordered by severity. `file:line` references are as of commit state on 2026-08-06.

## HIGH

### H1 — Stock cost basis ignores sells (P/L wrong after sell + re-buy)

`recalculate_investment_metrics` (`src-tauri/src/services/investments.rs:18`)
computes `average_price` as the lifetime weighted average of **all buys**, and
sells only reduce quantity. After selling a position and re-buying at a different
price, the average still contains the old buys.

*Failure scenario:* buy 10 @ 100, sell 10, buy 10 @ 200 → stored average = 150,
actual cost basis of the open position = 200. Every P/L figure in the UI
(`src/utils/stocks.ts:54` builds `gainLoss` from `investment.averagePrice`) is
shifted.

*Note:* the crypto equivalent (`crypto_investments.rs::recalculate_crypto_metrics`)
already implements the correct moving-average (sells reduce cost proportionally at
the running average, transactions ordered by date). Stocks never got the same fix.
The stock query also lacks `ORDER BY transaction_date` — harmless for the current
(order-insensitive) formula, but required once the moving average lands.

**Resolution (2026-08-07):** `recalculate_investment_metrics` now ports the crypto
moving average — transactions ordered `transaction_date ASC, created_at ASC`, sells
reduce cost at the running average, negatives clamped, and an empty-transaction guard
preserves manually-created positions (quantity/average set without transactions).
Stored values self-heal via `recalculate_all_investment_metrics`, an idempotent sweep
run at every DB open (`db/mod.rs`), failure-isolated so it can never block unlock.

### H2 — Live dashboard metrics disagree with history for the same day

`calculate_portfolio_metrics` (`src-tauri/src/commands/portfolio.rs:53`) sums **all**
bank accounts; the snapshot paths (`portfolio.rs:1708`, `portfolio.rs:2125`) and the
MCP local API (`services/local_api.rs:221`) filter `WHERE exclude_from_balance = 0`.
An account marked "exclude from balance" is counted in today's dashboard number but
missing from the history chart of the very same day.

**Resolution (2026-08-06):** the bank account query in both `calculate_portfolio_metrics`
(live dashboard) and `calculate_metrics_for_day` (snapshot backfill, called from the
backfill loop at `portfolio.rs:1183`) now filters `WHERE exclude_from_balance = 0`,
matching the already-filtered snapshot paths (`calculate_metrics_for_day_historical`,
`portfolio.rs:1708`/`:2125`) and the MCP local API (`services/local_api.rs:221`). Every
portfolio-metrics/snapshot bank-balance aggregation (live metrics, snapshot, backfill,
MCP local API) now filters `exclude_from_balance = 0`. In `calculate_portfolio_metrics`,
`total_savings` and `savings_by_currency` are derived from the same filtered query, so
the by-currency breakdown now also excludes those accounts — consistent with the total
it accompanies (the breakdown must sum to the total).

**Follow-up (2026-08-06):** the two gaps originally left out of scope are now closed.
`commands/projection.rs::get_current_portfolio_values` filters
`WHERE exclude_from_balance = 0`, so an excluded account no longer seeds the projection's
starting `total_savings` or its weighted average interest rate — consistent with the
portfolio metrics the projection extrapolates from. The savings-interest-income query in
`commands/cashflow.rs` (Interest Income category of the cashflow report) now filters too,
matching the already-filtered MCP listing (`services/local_api.rs:1416`) — previously the
app UI and the MCP API disagreed on the same report. Rationale for filtering interest
income rather than keeping it: the flag's documented meaning is "exclude from portfolio
balance (for operational/checking accounts)", the category is auto-derived portfolio
income, and interest from an excluded account can still be recorded as a manual
user-defined `interestIncome` item if genuinely wanted.

### H3 — History rendered in a non-CZK display currency uses the wrong rates

Snapshot rows store CZK totals computed with the exchange rate of the snapshot day.
The frontend `formatCurrency` (`src/lib/currency.tsx:102`) converts every value —
including historical ones — with **today's** rate. A history chart displayed in EUR
is therefore "CZK history × constant rate", not the portfolio's actual EUR value per
day. The data needed for faithful rendering already exists: per-currency breakdowns
are stored on every history row (`*_by_currency` JSON) and daily rates are stored in
`exchange_rate_history`.

**Resolution (2026-08-07):** history charts now convert per data point with that day's
rates via the shared `useHistoricalDisplayValues` hook (pure logic in
`src/utils/historical-rates.ts`, tested): day rate → closest earlier day → today's
rate; rows without breakdowns or rates degrade to the stored CZK total × today's rate
(previous behavior). Wired into all `portfolio-history` consumers (the three dashboard
charts + `PortfolioValueTrendChart`, which lost its weaker private version and its
silent 1:1 fallback). *Caveat:* a full history recalculation resets `*_by_currency` to
`'{}'` on existing rows (`update_or_insert_snapshot` UPDATE branch); the automatic
`backfill_currency_breakdowns` repair reconstructs stocks/crypto natively but flattens
savings/bonds/real-estate/loans to `{"CZK": total}`, so those rows lose their original
native mix and convert day-aware only from the CZK bucket. Never worse than the
pre-fix behavior, noted for completeness.

## MEDIUM

### M1 — Historical backfill applies today's FX rates to past days

`calculate_metrics_for_day_historical` (`portfolio.rs:1697`) converts every value
with `convert_to_czk` (current in-memory rates) even for day timestamps months in
the past, although `exchange_rate_history` exists. The FX component of backfilled
history is erased.

**Resolution (2026-08-07):** both snapshot backfill calculators
(`calculate_metrics_for_day`, `calculate_metrics_for_day_historical`) now fetch the
day's rates once per day (`get_rates_for_date`: exact day, ≤10-day walkback for
weekends/holidays, fallback current rates) and convert via
`convert_to_czk_with_rates`; the spec's `convert_to_czk_at` entry point exists as the
composition of the two. *Residual, out of this spec's scope:* the per-ticker history
paths (`recalculate_stock_ticker_history`, `recalculate_crypto_ticker_history`, the
per-ticker backfill loops, `calculate_asset_value_for_day`) still convert past days at
today's rates, and `update_portfolio_stocks/crypto_from_ticker_table` rewrite
`total_investments`/`total_crypto` on history rows from those sums after a
retrospective ticker recalculation — tracked as a follow-up.

### M2 — Unknown currencies convert 1:1 silently

`convert_to_czk` / `convert_from_czk` (`services/currency.rs:47,60`) fall back to
rate `1.0` for any currency missing from the table. A PLN account would be counted
into CZK totals at 1:1 (~5× off) with no warning. Should log loudly and/or surface
a UI flag; silent plausible-but-wrong totals are the worst failure mode in a
finance app.

**Resolution (2026-08-07):** every unknown-currency 1.0 fallback (`convert_to_czk`,
`convert_from_czk`, `get_exchange_rate` — which also covers the day-rate fallback)
now records the currency in a session-global set and prints one loud
`[CURRENCY] WARNING` per currency per session (`println!` rather than `log::warn!` —
no logger backend is initialized in the main app, so `log::warn!` would be silently
dropped). The set is cleared per-currency when rates arrive (`update_exchange_rates`),
and is surfaced as `PriceStatus.missingCurrencies` with an amber line in the
stale-prices indicator (i18n in both locales).

### M3 — Backfilled history flat-lines banks/bonds/loans/real estate

The historical calculator uses **today's** balances/valuations for those asset
classes on every past day (acknowledged as "static" in comments — per-day balance
history simply isn't tracked). Stocks, crypto and other-assets do use historical
quantities and prices. Not fixable without per-day balance tracking, but the chart
currently presents the flat-line as real history; at minimum this deserves user
facing documentation or visual distinction.

## LOW / design notes

- **L1** Two independent fallback rate tables exist (Rust `services/currency.rs:14`
  and frontend `shared/currencies.ts`); they sync via IPC at unlock, but any drift
  makes frontend-computed CZK values (e.g. `use-savings-accounts.ts`) disagree with
  backend metrics. Single source of truth would be safer.
- **L2** `real_estate_by_currency` includes personal real estate even when
  `exclude_personal_real_estate = true` (`portfolio.rs:119` vs `:189`) — currency
  breakdown inconsistent with the totals it accompanies.
  **Resolution (2026-08-06):** the real-estate loop in `calculate_portfolio_metrics`
  now skips adding a property's native price into `real_estate_by_currency` when
  `exclude_personal_real_estate` is true and the property is personal, while
  `total_real_estate_personal` still always accumulates it (that field is always
  reported). The breakdown now sums (in CZK terms) to `total_real_estate`, matching
  the totals it accompanies.
- **L3** Money parsing uses `parse().unwrap_or(0.0)` throughout metrics — corrupt
  amounts silently become zero instead of failing loudly.
  **Resolution (2026-08-06):** added `services::parsing::parse_money`, a thin
  wrapper around the same `parse().unwrap_or(default)` fallback that additionally
  logs a loud warning when a non-empty value fails to parse (empty/whitespace-only
  values stay silent — legacy rows may legitimately have them). Applied to every
  money/quantity parse site in the three metric-path functions
  (`calculate_portfolio_metrics`, `calculate_metrics_for_day`,
  `calculate_metrics_for_day_historical`); parses elsewhere in the file and in
  other files are unchanged.
- **L4** Positions whose price cannot be resolved are silently omitted from live
  totals (`portfolio.rs:138`); the `is_stale` mechanism exists for history but the
  live metric gives no signal.
  **Resolution (2026-08-06):** decision — no new plumbing for now. `get_price_status`
  already exposes `stocks_missing_price`/`crypto_missing_price` (positions with no
  price row at all) and, from the M2 fix, `missing_currencies` (a UI-visible badge
  for unknown-currency 1:1 fallbacks). The residual gap this item describes —
  a position with a `stock_data`/`crypto_prices` row present but whose price still
  fails to resolve — is rare in practice (would require a corrupt/unparseable stored
  price, which L3's new warning now surfaces in logs) and isn't worth new counting
  plumbing in `get_price_status` at this time.
- **L5** All money arithmetic is `f64`. At CZK portfolio magnitudes (≤1e9) the
  15–16 significant digits are ample and rounding happens only at display; this is
  an accepted trade-off of ADR 0001 (money-as-TEXT storage, float compute), noted
  here for completeness.

## What was checked and found sound

- Budgeting report (`services/budgeting.rs::get_report`): SQL-side sums, internal
  transfers excluded, per-currency grouping, monthly→quarterly/yearly budget
  scaling. Covered by unit tests.
- Crypto cost basis: correct moving average, date-ordered, currency-normalized.
- Savings weighted-average interest rate (`use-savings-accounts.ts`): correct
  weighting by CZK balance.
- Snapshot upsert logic (one row per day, update-else-insert) is consistent.
