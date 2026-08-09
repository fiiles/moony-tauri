# Spec: currency-native history redesign + one-time data migration (2026-08-09)

Follow-up to `docs/specs/2026-08-06-calculation-fixes.md` and the 2026-08-09
session fixes (renderer consistency guard, startup repair sweep, day-rate
writers). Those were symptom patches; this spec removes the root flaw. Written
as a self-contained handoff. Follow CLAUDE.md rules (thin commands, services
take `&Connection`, TDD per `docs/standards/testing.md`, append-only
migrations).

Context: single-user installation. Destructive-ish data migration of the one
production DB is acceptable, gated behind a dry-run report.

## Root flaw

`portfolio_metrics_history` carries two representations of the same fact — CZK
totals and native `*_by_currency` breakdowns — written by six different code
paths with three different rate semantics (today's rates, day rates, snapshot
time rates). Reconstructed rows (gap backfill, recalcs) are indistinguishable
from live-recorded rows, so later logic must *trust* whichever value is there.
Every chart bug so far (H3, the Jul 24 dip, the Apr–May YTD dips) is this flaw
wearing a different hat. The Apr–May dips specifically: backfilled rows whose
*stored CZK totals* are fragments (partial Yahoo fetches), which the
consistency machinery then faithfully treats as ground truth. (Verify when the
app is next running: the same dips should appear in CZK display too.)

## Target invariants

- **I1 — native is canonical.** The daily record of a portfolio is the native
  per-currency breakdown per asset class. CZK totals are a derived cache,
  never independently authored.
- **I2 — FX is a complete timeseries.** `exchange_rate_history` covers every
  day of portfolio history (ECB publishes it all; see migration phase 1).
  `get_rates_for_date` semantics stay (≤10-day walk-back for weekends).
- **I3 — one writer.** A single service function writes history rows. It takes
  breakdowns + day, computes totals at that day's rates, writes atomically.
  No other code touches `portfolio_metrics_history` columns.
- **I4 — provenance is recorded.** Rows know whether they were live-recorded
  or reconstructed. Repairs may freely rewrite reconstructed rows; live rows
  are authentic records and are only normalized, never re-derived.
- **I5 — per-ticker history is native.** `stock_value_history` /
  `crypto_value_history` canonical fields are (day, quantity, price,
  currency); `value_czk` is a cache written by the same single-writer rule.

## Schema (migration 002, append-only)

```sql
ALTER TABLE portfolio_metrics_history ADD COLUMN source TEXT NOT NULL DEFAULT 'live';
-- existing reconstructed rows are exactly the midnight-stamped ones:
UPDATE portfolio_metrics_history SET source = 'backfill' WHERE recorded_at % 86400 = 0;
```

No columns dropped — totals stay as the derived cache (cheap CZK reads, and
the wire contract `PortfolioMetricsHistory` keeps working). Register `source`
per the type-contract procedure (schema.ts step list, bindings.rs, regenerate
generated-types).

## Code changes

1. **`services/portfolio_history.rs` (new).** `upsert_snapshot(conn, day,
   source, &ClassBreakdowns) -> Result<()>`: resolves rates for `day` from the
   timeseries, computes all totals from the breakdowns, writes every column in
   one statement. `ClassBreakdowns` = the seven `HashMap<String, f64>`. Unit
   tests per the in-memory-Connection pattern (this is a service — testing
   policy applies).
2. **Route all writers through it**: `update_todays_snapshot` (source live),
   `insert_snapshot_for_day` + `update_or_insert_snapshot` (source backfill),
   `update_asset_column_for_day` (reads the row's other breakdowns, replaces
   one class, rewrites through the writer — a targeted recalc can no longer
   desync totals from breakdowns).
3. **Live snapshot keeps its own rates.** For `source = 'live'` today-rows the
   writer uses current in-memory rates (identical to what
   `save_rates_to_history_db` stores for today, so I3 still holds).
4. **Repair sweep simplifies.** With provenance: `backfill` rows failing the
   consistency check are rebuilt (per-ticker native sums, static classes
   carried forward from the nearest earlier `live` row); `live` rows are left
   alone. The renderer guard stays as defense-in-depth.
5. **Ticker currency from quote metadata.** `get_currency_from_ticker`'s
   suffix map is replaced by Yahoo's `meta.currency`, normalizing pence
   (`GBp`/`GBX` → GBP, price ÷ 100), falling back to the suffix map offline.
   ⚠ Needs owner confirmation: EWG.L shows `109.00 GBP`; if the true quote is
   109 GBp (~£1.09), the position is stored 100× too high and phase 2 of the
   migration must divide its price history by 100.

## One-time migration (CLI: `src-tauri/src/bin/migrate_history.rs`)

Pattern of `seed_demo.rs`; prompts for the DB password (SQLCipher), takes
`--dry-run` (default: report only) and `--apply`. Idempotent. Phases:

1. **FX backfill.** Fetch ECB daily rates (frankfurter.dev,
   `/v1/{start}..{end}?base=CZK` inverted, or per-currency) for
   [oldest snapshot − 10d, today] for every currency present anywhere in the
   data. `INSERT OR IGNORE` into `exchange_rate_history`. After this phase the
   "pre-timeseries era" exception disappears for ECB currencies.
2. **Per-ticker rebuild.** For each ticker and each day it was held (quantity
   from transactions): keep an existing native price row if present, fetch the
   missing days from Yahoo/CoinGecko otherwise; recompute every `value_czk`
   as native × rate(day). Apply the pence correction here if confirmed.
3. **Snapshot rebuild.** For every day oldest→today:
   - `backfill` rows (and missing days): stocks/crypto breakdowns from the
     per-ticker sums — a day with **no** per-ticker coverage for a class
     carries that class forward from the nearest earlier `live` row instead
     of zeroing it (an empty class would zero the day's total and draw teeth
     into the charts, e.g. crypto days without a CoinGecko key); static
     classes carried forward from the nearest earlier `live` row (replaces
     today's "current balances for all history" — fixes audit M3 for
     savings); totals derived at day rates via the single writer.
   - `live` rows: breakdowns kept; totals recomputed only when they diverge
     from breakdown × day-rate beyond `BREAKDOWN_CONSISTENCY_TOLERANCE`
     (logged).
4. **Validation report.** Every row must satisfy |Σ breakdown×rate(day) −
   total| ≤ tolerance; print per-day diffs, unresolvable days (no price data),
   and counts. Dry-run prints the same report without writing.

## Open decisions (owner)

1. EWG.L pence confirmation (drives the ÷100 correction in phase 2).
2. Migration vehicle: CLI binary with password prompt (recommended; it is
   "the script") vs. hidden in-app maintenance command.
3. Static classes on reconstructed days: carry-forward from nearest earlier
   live row (recommended) vs. current behavior (today's balances).

## Testing

- `services/portfolio_history.rs`: full unit coverage (writer, rate
  resolution, provenance rules) — in-memory Connection pattern.
- Migration phases 2–3 factored as service functions taking `&Connection`,
  unit-tested with synthetic fixtures; the bin is a thin driver.
- Frontend unchanged (guards + `useHistoricalDisplayValues` already
  single-path); existing tests keep passing.
