# Spec: calculation fixes + multicurrency history display (2026-08-06)

Executes the findings of `docs/audits/2026-08-06-calculations-audit.md`. Written as
a self-contained handoff for a fresh session. Follow CLAUDE.md rules (thin
commands, services take `&Connection`, TDD per `docs/standards/testing.md`,
i18n for any new user-facing string, mutations invalidate the standard query keys).

## 1. Stock cost basis → moving average (audit H1)

Port the crypto implementation (`services/crypto_investments.rs::recalculate_crypto_metrics`)
to `services/investments.rs::recalculate_investment_metrics`:

- Order transactions `ORDER BY transaction_date ASC, created_at ASC`.
- Buys: `total_cost += qty * price; total_qty += qty`.
- Sells: `total_cost -= qty * (total_cost / total_qty); total_qty -= qty` (guard
  `total_qty > 0`).
- `average_price = total_cost / total_qty` when `total_qty > 0`, else `0`.
- Clamp negatives to zero like crypto does.

TDD: extend the existing test module in `investments.rs` with the sell+re-buy
scenario (buy 10@100, sell 10, buy 10@200 → average 200, quantity 10) and a
partial-sell case (buy 10@100, sell 5, buy 5@200 → average 150). Existing stored
`average_price` values self-heal on the next transaction of each investment;
optionally add a one-time recalculation on startup for all investments (cheap:
iterate `stock_investments` ids).

## 2. Honor `exclude_from_balance` in live metrics (audit H2)

In `commands/portfolio.rs::calculate_portfolio_metrics` change the bank query to
`SELECT balance, currency FROM bank_accounts WHERE exclude_from_balance = 0`
(matching `portfolio.rs:1708`, `:2125`, `local_api.rs:221`). Decide (and document
in the audit doc) whether `savings_by_currency` should also exclude them — yes,
for consistency: the breakdown must sum to the total it accompanies.

## 3. Faithful history in any display currency (audit H3 + M1)

Goal: history charts must show what the portfolio was worth in the display
currency **on each day**, using that day's rates.

Already available: every `portfolio_metrics_history` row stores per-currency
native breakdowns (`*_by_currency` JSON); `exchange_rate_history` stores daily
CZK rates per currency (`services/currency.rs:336` writes it on each ECB refresh,
and `get_exchange_rates_for_date_range` command already exposes it).

Design (keep CZK pivot, fix display):

- Frontend: for history charts (`AssetClassTrendChart`, portfolio history, any
  chart fed by `portfolio-history`), fetch rates for the chart's date range via
  the existing `get_exchange_rates_for_date_range` command, then per data point
  convert native breakdowns → display currency using that day's rate (fallback:
  closest earlier day; final fallback today's rate). Encapsulate in one hook,
  e.g. `useHistoricalDisplayValues`, so every chart shares the logic.
- Rows older than the first `exchange_rate_history` entry (or missing a currency)
  fall back to the stored CZK total × today's display rate — i.e. current
  behavior — so charts degrade gracefully rather than gap.
- Backfill (`calculate_metrics_for_day_historical`, `portfolio.rs:1697`): replace
  `convert_to_czk(...)` with a day-aware helper
  `convert_to_czk_at(conn, amount, currency, day_ts)` (new fn in
  `services/currency.rs`) that reads `exchange_rate_history` (closest ≤ day) and
  falls back to current rates. This fixes M1 for newly backfilled rows.

Non-goals: rewriting stored history rows (existing CZK totals stay), changing
ADR 0001, or moving aggregation off the CZK pivot.

## 4. Loud unknown-currency handling (audit M2)

`services/currency.rs::convert_to_czk/convert_from_czk`: when the currency is not
in the table, `log::warn!` once per currency per session and keep 1.0 only as the
documented last resort. Add `get_missing_currencies()` surfaced through the
existing price-status command (`get_price_status`) so the UI can show a warning
badge. i18n both locales for any new string.

## 5. Small consistency fixes (audit L2, optional L3/L4)

- `real_estate_by_currency`: respect `exclude_personal_real_estate` the same way
  the totals do (`portfolio.rs:119` vs `:189`).
- Optional hardening: replace metric-path `unwrap_or(0.0)` parses with a helper
  that logs corrupt values; count unresolved-price positions into the
  `get_price_status` response.

## Verification

`cd src-tauri && cargo test && cargo clippy --all-targets -- -D warnings`, then
`npm run typecheck && npm test && npm run build`. Manual: dashboard total equals
history's last point with an excluded account present; switch display currency to
EUR and confirm the history chart changes shape (not just scale) across a period
with known EUR/CZK movement.

---

# Appendix: demo database seeder (separate task, may run in the same session)

Studied APIs for `src-tauri/src/bin/seed_demo.rs` (pattern: existing
`src/bin/train_model.rs`):

- Full account setup incl. encrypted DB + key files:
  `services::auth::setup_account(&Database::new(), db_path, InsertUserProfile{..}, "demo password")`
  — generates master key/salt/recovery, writes `salt`, `key.enc`, `recovery.enc`,
  creates SQLCipher DB via `Database::create_with_key` (runs migrations), inserts
  profile, returns recovery key. Data dir = parent of `db_path`.
- Bank: `services::bank_accounts::create_account(&conn, &InsertBankAccount{..})`;
  transactions via direct INSERT matching `commands/bank_accounts.rs` columns
  (id, bank_account_id, tx_type 'credit'/'debit', amount TEXT, currency,
  description, counterparty_name, booking_date epoch, category_id from
  `cat_*` system ids, status 'booked', data_source 'manual', created_at).
- Stocks: `services::investments::create_investment_with_transaction(&conn,
  ticker, company, None, None, Some(&InsertInvestmentTransaction{..}))` +
  `add_transaction_to_investment`; prices into `stock_data (ticker,
  original_price, currency, price_date, fetched_at)`.
- Crypto: `services::crypto_investments::create_crypto_with_transaction` (same
  shape; `coingecko_id`).
- Real estate / loans / bonds: direct INSERTs mirroring the SQL in
  `commands/real_estate.rs`, `commands/loans.rs`, `commands/bonds.rs`.
- Budgets: `budget_goals (category_id, timeframe 'monthly', amount, currency)`.
- History: INSERT into `portfolio_metrics_history` with backdated `recorded_at`
  and plausible growing totals + `*_by_currency` JSON (columns per
  `commands/portfolio.rs:472`); also seed `exchange_rate_history` so historical
  display works.
- Launch app against the demo dir without touching real data:
  `HOME=<tmp-home> npm run tauri dev` redirects `app_data_dir()`
  (`~/Library/Application Support/com.filipkral.moony-tauri`) on macOS.
  Unlock with the demo password, screenshot pages → `docs/screenshots/`, wire
  into README (replaces "Screenshots coming soon").
