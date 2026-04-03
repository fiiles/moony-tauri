# Stock TWR Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a time-weighted return (TWR) chart to the StocksAnalysis page that shows relative portfolio performance over a custom date range, with optional filtering by stock tags.

**Architecture:** A new `compute_twr_for_tickers` service function in Rust computes daily chain-linked TWR using `stock_value_history` data. A new `get_stock_twr` Tauri command orchestrates per-tag and whole-portfolio series. The StocksAnalysis page renders the result as a multi-line Recharts chart with date pickers and tag filter badges.

**Tech Stack:** Rust + rusqlite, chrono, Tauri commands, React 18, TanStack Query, Recharts

---

## File Map

| File | Change |
|---|---|
| `src-tauri/src/models/investments.rs` | Add `TwrDataPoint`, `TwrSeries` structs |
| `src-tauri/src/bindings.rs` | Register `TwrDataPoint`, `TwrSeries` for TS generation |
| `src-tauri/src/services/investments.rs` | Add `compute_twr_for_tickers` + `ts_to_date_str` + tests |
| `src-tauri/src/commands/investments.rs` | Add `get_stock_twr` command |
| `src-tauri/src/lib.rs` | Register `get_stock_twr` in invoke handler |
| `shared/schema.ts` | Add `TwrDataPoint`, `TwrSeries` interfaces |
| `src/lib/tauri-api.ts` | Add `getStockTwr` to `investmentsApi` |
| `src/pages/StocksAnalysis.tsx` | Add TWR card with controls + chart |

---

## Task 1: Add Rust model types

**Files:**
- Modify: `src-tauri/src/models/investments.rs`
- Modify: `src-tauri/src/bindings.rs`

- [ ] **Step 1: Add TwrDataPoint and TwrSeries to investments model**

Open `src-tauri/src/models/investments.rs`. At the very top, after the existing `use` lines, add the `StockTag` import. Then append the two structs at the end of the file (after all existing code):

```rust
// At top of file, add after existing use statements:
use super::stock_tags::StockTag;
```

```rust
// Append at end of file:

/// A single data point in a TWR time series.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TwrDataPoint {
    /// Calendar date as "YYYY-MM-DD"
    pub date: String,
    /// Cumulative time-weighted return in percent (0.0 at start of range)
    pub twr: f64,
}

/// A complete TWR series for one tag or the whole portfolio.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TwrSeries {
    /// The tag this series belongs to. None = whole portfolio.
    pub tag: Option<StockTag>,
    pub data: Vec<TwrDataPoint>,
}
```

- [ ] **Step 2: Register the new types in bindings.rs**

Open `src-tauri/src/bindings.rs`. Find the block where `TickerValueHistory` is registered (line ~31). Add two lines immediately after it:

```rust
    types.register::<crate::models::TwrDataPoint>();
    types.register::<crate::models::TwrSeries>();
```

- [ ] **Step 3: Verify compilation**

```bash
cd src-tauri && cargo check 2>&1 | grep -E "^error"
```

Expected: no errors (warnings OK).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/models/investments.rs src-tauri/src/bindings.rs
git commit -m "feat: add TwrDataPoint and TwrSeries Rust model types"
```

---

## Task 2: TWR service function (TDD)

**Files:**
- Modify: `src-tauri/src/services/investments.rs`

The TWR algorithm uses daily chain-linking. For each day in the range:
- Sum `value_czk` across all tickers (using the most recent `stock_value_history` entry ≤ that day).
- Estimate cash flow from quantity changes: `CF = delta_qty × (value_czk / qty)`.
- Compute `daily_r = (V_curr - V_prev - CF) / (V_prev + CF)`.
- Chain: `twr_factor *= (1 + daily_r)`.

- [ ] **Step 1: Write failing tests**

Open `src-tauri/src/services/investments.rs`. Find the existing `#[cfg(test)] mod tests` block (line ~449). Add these three tests inside the existing `mod tests { ... }` block, after the last test:

```rust
    fn setup_twr_db() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE stock_value_history (
                id TEXT PRIMARY KEY,
                ticker TEXT NOT NULL,
                recorded_at INTEGER NOT NULL,
                value_czk TEXT NOT NULL,
                quantity TEXT NOT NULL,
                price TEXT NOT NULL,
                currency TEXT NOT NULL,
                UNIQUE(ticker, recorded_at)
            );",
        )
        .unwrap();
        conn
    }

    #[test]
    fn test_twr_buy_does_not_inflate_return() {
        // Day 0: 10 AAPL @ 100 CZK = 1000 CZK
        // Day 1: buy 10 more @ 100 CZK → 20 @ 100 = 2000 (CF = 1000, pure cash-in, no price gain)
        // Day 2: price rises to 110 → 20 @ 110 = 2200 (no transaction, pure gain = 10%)
        // Expected TWR: day0=0%, day1=0%, day2=10%
        let conn = setup_twr_db();
        let day0: i64 = 1_700_000_000 / 86400 * 86400;
        let day1 = day0 + 86400;
        let day2 = day0 + 2 * 86400;
        conn.execute_batch(&format!(
            "INSERT INTO stock_value_history (id, ticker, recorded_at, value_czk, quantity, price, currency) VALUES
             ('a', 'AAPL', {day0}, '1000.0', '10.0', '100.0', 'USD'),
             ('b', 'AAPL', {day1}, '2000.0', '20.0', '100.0', 'USD'),
             ('c', 'AAPL', {day2}, '2200.0', '20.0', '110.0', 'USD');"
        ))
        .unwrap();

        let result =
            compute_twr_for_tickers(&conn, &["AAPL".to_string()], day0, day2).unwrap();
        assert_eq!(result.len(), 3);
        assert!((result[0].twr - 0.0).abs() < 0.01, "day0 should be 0%");
        assert!((result[1].twr - 0.0).abs() < 0.01, "buy should not inflate TWR");
        assert!((result[2].twr - 10.0).abs() < 0.1, "price gain should be ~10%");
    }

    #[test]
    fn test_twr_pure_price_appreciation() {
        // No transactions: daily chain TWR equals simple cumulative return
        let conn = setup_twr_db();
        let day0: i64 = 1_700_200_000 / 86400 * 86400;
        let day1 = day0 + 86400;
        let day2 = day0 + 2 * 86400;
        conn.execute_batch(&format!(
            "INSERT INTO stock_value_history (id, ticker, recorded_at, value_czk, quantity, price, currency) VALUES
             ('a', 'AAPL', {day0}, '1000.0', '10.0', '100.0', 'USD'),
             ('b', 'AAPL', {day1}, '1050.0', '10.0', '105.0', 'USD'),
             ('c', 'AAPL', {day2}, '1100.0', '10.0', '110.0', 'USD');"
        ))
        .unwrap();

        let result =
            compute_twr_for_tickers(&conn, &["AAPL".to_string()], day0, day2).unwrap();
        assert_eq!(result.len(), 3);
        assert!((result[0].twr - 0.0).abs() < 0.01);
        // day1: (1050-1000)/1000 = 5%
        assert!((result[1].twr - 5.0).abs() < 0.1);
        // day2: 1.05 * (1100/1050) - 1 ≈ 10%
        assert!((result[2].twr - 10.0).abs() < 0.5);
    }

    #[test]
    fn test_twr_empty_tickers_returns_single_zero_point() {
        let conn = setup_twr_db();
        let day0: i64 = 1_700_400_000 / 86400 * 86400;
        let day1 = day0 + 86400;
        let result = compute_twr_for_tickers(&conn, &[], day0, day1).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].twr, 0.0);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd src-tauri && cargo test compute_twr 2>&1 | tail -20
```

Expected: compile error (`compute_twr_for_tickers` not found).

- [ ] **Step 3: Implement compute_twr_for_tickers**

Open `src-tauri/src/services/investments.rs`. Add these imports after the existing `use` lines at the top:

```rust
use chrono::DateTime;
use rusqlite::types::Value;
use rusqlite::params_from_iter;
use std::collections::HashMap;
```

Then add the following two functions before the `#[cfg(test)]` block (i.e., just before line ~449):

```rust
/// Convert a Unix timestamp to a "YYYY-MM-DD" date string (UTC).
fn ts_to_date_str(ts: i64) -> String {
    DateTime::from_timestamp(ts, 0)
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_default()
}

/// Find the most recent (value_czk, quantity) for a ticker at or before target_ts.
fn lookup_ticker_at(
    history: &HashMap<String, Vec<(i64, f64, f64)>>,
    ticker: &str,
    target_ts: i64,
) -> (f64, f64) {
    history
        .get(ticker)
        .and_then(|entries| {
            entries
                .iter()
                .rev()
                .find(|(ts, _, _)| *ts <= target_ts)
                .map(|(_, val, qty)| (*val, *qty))
        })
        .unwrap_or((0.0, 0.0))
}

/// Compute daily chain-linked time-weighted return for a group of tickers.
///
/// Returns one `TwrDataPoint` per calendar day from `from_ts` to `to_ts` inclusive.
/// The first point is always `{ date: from_ts, twr: 0.0 }`.
/// Cash flows are estimated from quantity changes in `stock_value_history`.
///
/// `from_ts` and `to_ts` must be Unix timestamps (seconds, midnight UTC).
pub fn compute_twr_for_tickers(
    conn: &rusqlite::Connection,
    tickers: &[String],
    from_ts: i64,
    to_ts: i64,
) -> Result<Vec<crate::models::TwrDataPoint>> {
    if tickers.is_empty() {
        return Ok(vec![crate::models::TwrDataPoint {
            date: ts_to_date_str(from_ts),
            twr: 0.0,
        }]);
    }

    // Build SQL: ?1 = to_ts, ?2..?N = tickers
    let placeholders: Vec<String> = (2..=tickers.len() + 1)
        .map(|i| format!("?{i}"))
        .collect();
    let sql = format!(
        "SELECT ticker, recorded_at, CAST(value_czk AS REAL), CAST(quantity AS REAL) \
         FROM stock_value_history \
         WHERE ticker IN ({}) AND recorded_at <= ?1 \
         ORDER BY ticker, recorded_at ASC",
        placeholders.join(", ")
    );

    let params: Vec<Value> = std::iter::once(Value::Integer(to_ts))
        .chain(tickers.iter().map(|t| Value::Text(t.clone())))
        .collect();

    let mut history: HashMap<String, Vec<(i64, f64, f64)>> = HashMap::new();
    {
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(params_from_iter(params), |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, f64>(3)?,
            ))
        })?;
        for row in rows {
            let (ticker, ts, val, qty) = row?;
            history.entry(ticker).or_default().push((ts, val, qty));
        }
    }

    let mut result = vec![crate::models::TwrDataPoint {
        date: ts_to_date_str(from_ts),
        twr: 0.0,
    }];
    let mut twr_factor = 1.0f64;
    let mut day = from_ts + 86400;

    while day <= to_ts {
        let prev_day = day - 86400;
        let mut v_curr = 0.0f64;
        let mut v_prev = 0.0f64;
        let mut cf = 0.0f64;

        for ticker in tickers {
            let (val_curr, qty_curr) = lookup_ticker_at(&history, ticker, day);
            let (val_prev, qty_prev) = lookup_ticker_at(&history, ticker, prev_day);
            v_curr += val_curr;
            v_prev += val_prev;

            let delta_qty = qty_curr - qty_prev;
            if delta_qty.abs() > 1e-9 {
                let price_czk = if qty_curr > 1e-9 {
                    val_curr / qty_curr
                } else if qty_prev > 1e-9 {
                    val_prev / qty_prev
                } else {
                    0.0
                };
                cf += delta_qty * price_czk;
            }
        }

        let denominator = v_prev + cf;
        if denominator > 1e-9 {
            let daily_r = (v_curr - v_prev - cf) / denominator;
            twr_factor *= 1.0 + daily_r;
        }

        result.push(crate::models::TwrDataPoint {
            date: ts_to_date_str(day),
            twr: (twr_factor - 1.0) * 100.0,
        });

        day += 86400;
    }

    Ok(result)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd src-tauri && cargo test compute_twr 2>&1 | tail -20
```

Expected output:
```
test services::investments::tests::test_twr_buy_does_not_inflate_return ... ok
test services::investments::tests::test_twr_empty_tickers_returns_single_zero_point ... ok
test services::investments::tests::test_twr_pure_price_appreciation ... ok
test result: ok. 3 passed; 0 failed
```

- [ ] **Step 5: Run full test suite**

```bash
cd src-tauri && cargo test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/services/investments.rs
git commit -m "feat: add compute_twr_for_tickers service function with tests"
```

---

## Task 3: Add get_stock_twr command

**Files:**
- Modify: `src-tauri/src/commands/investments.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add the command to investments.rs**

Open `src-tauri/src/commands/investments.rs`. Add `OptionalExtension` to the imports at the top:

```rust
use rusqlite::OptionalExtension;
```

Also add `TwrDataPoint` and `TwrSeries` to the existing `use crate::models::{ ... }` import:

```rust
use crate::models::{
    DividendOverride, EnrichedStockInvestment, InsertInvestmentTransaction, InsertStockInvestment,
    InvestmentTransaction, StockInvestment, StockPriceOverride, StockTag, TwrDataPoint, TwrSeries,
};
```

Then append this command at the very end of the file:

```rust
/// Get time-weighted return series for a set of stock tags and/or the whole portfolio.
///
/// `tag_ids`: IDs of tags to compute separate series for.
/// `include_portfolio`: if true, also include a whole-portfolio series.
/// `from_ts` / `to_ts`: Unix timestamps (seconds, midnight UTC) for the date range.
///
/// When `tag_ids` is empty, only the portfolio series is returned regardless of `include_portfolio`.
#[tauri::command]
pub async fn get_stock_twr(
    db: State<'_, Database>,
    tag_ids: Vec<String>,
    include_portfolio: bool,
    from_ts: i64,
    to_ts: i64,
) -> Result<Vec<TwrSeries>> {
    db.with_conn(move |conn| {
        let mut series: Vec<TwrSeries> = Vec::new();

        // Fetch all stock tickers
        let all_tickers: Vec<String> = conn
            .prepare("SELECT ticker FROM stock_investments ORDER BY ticker")?
            .query_map([], |row| row.get(0))?
            .collect::<rusqlite::Result<_>>()?;

        // Whole portfolio series (always when no tag filter, optional when tags selected)
        if tag_ids.is_empty() || include_portfolio {
            let data =
                investment_service::compute_twr_for_tickers(conn, &all_tickers, from_ts, to_ts)?;
            series.push(TwrSeries { tag: None, data });
        }

        // Per-tag series
        for tag_id in &tag_ids {
            let tag: Option<StockTag> = conn
                .query_row(
                    "SELECT id, name, color, group_id, created_at \
                     FROM stock_tags WHERE id = ?1",
                    [tag_id],
                    |row| {
                        Ok(StockTag {
                            id: row.get(0)?,
                            name: row.get(1)?,
                            color: row.get(2)?,
                            group_id: row.get(3)?,
                            created_at: row.get(4)?,
                        })
                    },
                )
                .optional()?;

            if let Some(tag) = tag {
                let tickers: Vec<String> = conn
                    .prepare(
                        "SELECT si.ticker FROM stock_investments si \
                         JOIN stock_investment_tags sit ON sit.investment_id = si.id \
                         WHERE sit.tag_id = ?1 ORDER BY si.ticker",
                    )?
                    .query_map([tag_id], |row| row.get(0))?
                    .collect::<rusqlite::Result<_>>()?;

                let data =
                    investment_service::compute_twr_for_tickers(conn, &tickers, from_ts, to_ts)?;
                series.push(TwrSeries {
                    tag: Some(tag),
                    data,
                });
            }
        }

        Ok(series)
    })
}
```

- [ ] **Step 2: Register the command in lib.rs**

Open `src-tauri/src/lib.rs`. Find the line:

```rust
            commands::investments::get_stock_value_history,
```

Add the new command immediately after it:

```rust
            commands::investments::get_stock_value_history,
            commands::investments::get_stock_twr,
```

- [ ] **Step 3: Verify compilation**

```bash
cd src-tauri && cargo check 2>&1 | grep -E "^error"
```

Expected: no errors.

- [ ] **Step 4: Run full Rust tests**

```bash
cd src-tauri && cargo test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/investments.rs src-tauri/src/lib.rs
git commit -m "feat: add get_stock_twr Tauri command"
```

---

## Task 4: TypeScript types and API method

**Files:**
- Modify: `shared/schema.ts`
- Modify: `src/lib/tauri-api.ts`

- [ ] **Step 1: Add types to shared/schema.ts**

Open `shared/schema.ts`. Find the `StockTag` interface. Add the two new interfaces immediately after it:

```typescript
export interface TwrDataPoint {
  /** Calendar date as "YYYY-MM-DD" */
  date: string;
  /** Cumulative TWR in percent (0.0 at start of range) */
  twr: number;
}

export interface TwrSeries {
  /** Tag this series belongs to. null = whole portfolio. */
  tag: StockTag | null;
  data: TwrDataPoint[];
}
```

- [ ] **Step 2: Add getStockTwr to tauri-api.ts**

Open `src/lib/tauri-api.ts`. Find the `investmentsApi` object. Add the import for `TwrSeries` at the top of the file where other shared types are imported.

Then add `getStockTwr` as the last method in `investmentsApi`, before the closing `}`:

```typescript
  getStockTwr: (
    tagIds: string[],
    includePortfolio: boolean,
    fromTs: number,
    toTs: number,
  ) =>
    tauriInvoke<TwrSeries[]>('get_stock_twr', { tagIds, includePortfolio, fromTs, toTs }),
```

- [ ] **Step 3: Verify TypeScript**

```bash
npm run typecheck 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add shared/schema.ts src/lib/tauri-api.ts
git commit -m "feat: add TwrDataPoint/TwrSeries TS types and getStockTwr API method"
```

---

## Task 5: Frontend TWR chart in StocksAnalysis

**Files:**
- Modify: `src/pages/StocksAnalysis.tsx`

- [ ] **Step 1: Add missing imports**

Open `src/pages/StocksAnalysis.tsx`. Update the first line to include `useMemo`:

```typescript
import { useState, useMemo } from "react";
```

Add `LineChart` and `Line` to the recharts import (line 47):

```typescript
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
```

Add `investmentsApi` to the tauri-api import (line 3):

```typescript
import { stockTagsApi, investmentsApi } from "@/lib/tauri-api";
```

Add `TwrSeries` to the schema import (line 52):

```typescript
import type { StockTag, StockTagGroup, StockInvestmentWithTags, TagMetrics, TwrSeries } from "@shared/schema";
```

- [ ] **Step 2: Add TWR state variables**

Inside the `StocksAnalysis` component, after the existing state declarations (after `setIsManagementOpen`, around line 84), add:

```typescript
    // TWR chart state
    const oneYearAgo = useMemo(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        return d.toISOString().slice(0, 10);
    }, []);
    const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

    const [twrFrom, setTwrFrom] = useState(oneYearAgo);
    const [twrTo, setTwrTo] = useState(today);
    const [twrTagIds, setTwrTagIds] = useState<string[]>([]);
    const [twrShowPortfolio, setTwrShowPortfolio] = useState(true);
```

- [ ] **Step 3: Add TWR query and chart data transform**

After the existing `useQuery` calls (after the `metrics` query, around line 113), add:

```typescript
    const dateToTs = (dateStr: string) =>
        Math.floor(new Date(dateStr + 'T00:00:00Z').getTime() / 1000);

    const { data: twrSeries = [] } = useQuery<TwrSeries[]>({
        queryKey: ['stock-twr', twrTagIds, twrShowPortfolio, twrFrom, twrTo],
        queryFn: () =>
            investmentsApi.getStockTwr(
                twrTagIds,
                twrShowPortfolio,
                dateToTs(twrFrom),
                dateToTs(twrTo),
            ),
        enabled: !!twrFrom && !!twrTo && twrFrom <= twrTo,
    });

    // Merge TwrSeries[] into a flat array keyed by seriesKey for Recharts
    const twrChartData = useMemo(() => {
        if (!twrSeries.length) return [];
        const dateSet = new Set<string>();
        twrSeries.forEach(s => s.data.forEach(d => dateSet.add(d.date)));
        const dates = Array.from(dateSet).sort();
        return dates.map(date => {
            const point: Record<string, string | number | null> = { date };
            twrSeries.forEach(s => {
                const key = s.tag?.id ?? 'portfolio';
                const dp = s.data.find(d => d.date === date);
                point[key] = dp?.twr ?? null;
            });
            return point;
        });
    }, [twrSeries]);

    const formatTwr = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
```

- [ ] **Step 4: Add TWR card to JSX**

Scroll to the end of the JSX return in `StocksAnalysis.tsx`. Add the TWR card as the last card inside the main `<div>` wrapper, just before the closing `</div>` of the page:

```tsx
                {/* TWR Performance Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('stocksAnalysis.twrTitle', 'Portfolio Performance (TWR)')}</CardTitle>
                        <CardDescription>
                            {t('stocksAnalysis.twrDescription', 'Time-weighted return removes distortion caused by buy/sell transactions')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* Controls row */}
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground whitespace-nowrap">
                                    {t('stocksAnalysis.twrFrom', 'From')}
                                </span>
                                <Input
                                    type="date"
                                    className="w-36"
                                    value={twrFrom}
                                    max={twrTo}
                                    onChange={e => setTwrFrom(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground whitespace-nowrap">
                                    {t('stocksAnalysis.twrTo', 'To')}
                                </span>
                                <Input
                                    type="date"
                                    className="w-36"
                                    value={twrTo}
                                    min={twrFrom}
                                    onChange={e => setTwrTo(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-2 flex-1">
                                <span className="text-sm text-muted-foreground">
                                    {t('stocksAnalysis.twrLabels', 'Labels')}:
                                </span>
                                {tags.map(tag => (
                                    <Badge
                                        key={tag.id}
                                        variant={twrTagIds.includes(tag.id) ? 'default' : 'secondary'}
                                        className="cursor-pointer transition-all h-7 px-3"
                                        style={{
                                            backgroundColor: twrTagIds.includes(tag.id) ? tag.color || undefined : undefined,
                                            borderColor: tag.color || undefined,
                                        }}
                                        onClick={() =>
                                            setTwrTagIds(prev =>
                                                prev.includes(tag.id)
                                                    ? prev.filter(id => id !== tag.id)
                                                    : [...prev, tag.id],
                                            )
                                        }
                                    >
                                        <span
                                            className="w-2 h-2 rounded-full mr-1.5"
                                            style={{
                                                backgroundColor: twrTagIds.includes(tag.id)
                                                    ? '#fff'
                                                    : tag.color || 'hsl(var(--chart-8))',
                                            }}
                                        />
                                        {tag.name}
                                    </Badge>
                                ))}
                                {twrTagIds.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs h-7"
                                        onClick={() => setTwrTagIds([])}
                                    >
                                        {tc('buttons.clearAll')}
                                    </Button>
                                )}
                            </div>
                            {twrTagIds.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="twr-portfolio"
                                        checked={twrShowPortfolio}
                                        onCheckedChange={checked => setTwrShowPortfolio(!!checked)}
                                    />
                                    <label htmlFor="twr-portfolio" className="text-sm cursor-pointer">
                                        {t('stocksAnalysis.twrWholePortfolio', 'Whole portfolio')}
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Chart */}
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={twrChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis
                                    dataKey="date"
                                    stroke="hsl(var(--muted-foreground))"
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                    tickFormatter={date => {
                                        const d = new Date(date + 'T00:00:00Z');
                                        const rangeDays = (dateToTs(twrTo) - dateToTs(twrFrom)) / 86400;
                                        return rangeDays <= 90
                                            ? d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
                                            : d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
                                    }}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    stroke="hsl(var(--muted-foreground))"
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                    tickFormatter={v => formatTwr(v as number)}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--popover))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '6px',
                                    }}
                                    formatter={(value, name) => {
                                        const series = twrSeries.find(
                                            s => (s.tag?.id ?? 'portfolio') === name,
                                        );
                                        const label = series?.tag?.name ?? t('stocksAnalysis.twrWholePortfolio', 'Whole portfolio');
                                        return [formatTwr(value as number), label];
                                    }}
                                    labelFormatter={date => String(date)}
                                />
                                <Legend
                                    formatter={name => {
                                        const series = twrSeries.find(
                                            s => (s.tag?.id ?? 'portfolio') === name,
                                        );
                                        return series?.tag?.name ?? t('stocksAnalysis.twrWholePortfolio', 'Whole portfolio');
                                    }}
                                />
                                {twrSeries.map((series, idx) => (
                                    <Line
                                        key={series.tag?.id ?? 'portfolio'}
                                        type="monotone"
                                        dataKey={series.tag?.id ?? 'portfolio'}
                                        stroke={
                                            series.tag
                                                ? TAG_COLORS[idx % TAG_COLORS.length]
                                                : 'hsl(var(--foreground))'
                                        }
                                        strokeWidth={2}
                                        dot={false}
                                        connectNulls
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
```

- [ ] **Step 5: Verify TypeScript and tests**

```bash
npm run typecheck 2>&1 | tail -10
npm test 2>&1 | tail -10
```

Expected: no errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/StocksAnalysis.tsx
git commit -m "feat: add TWR performance chart to StocksAnalysis page"
```

---

## Self-Review Checklist

- **Spec coverage:** TWR algorithm ✓, date range ✓, tag filter ✓, portfolio toggle ✓, multi-line chart ✓, 0% baseline ✓, stocks in multiple labels appear in each ✓
- **No placeholders:** All code blocks are complete with no TODOs
- **Type consistency:** `TwrDataPoint.twr` is `f64` in Rust / `number` in TS throughout; `TwrSeries.tag` is `Option<StockTag>` / `StockTag | null` throughout; `getStockTwr` param names match `get_stock_twr` field names (`tagIds`, `includePortfolio`, `fromTs`, `toTs`)
- **Edge cases covered:** empty tickers (Task 2 test), disabled query when dates invalid (Task 5 Step 3)
