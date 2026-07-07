# Stock Time-Weighted Return Chart

**Date:** 2026-04-03  
**Status:** Approved  
**Location:** StocksAnalysis page

## Overview

Add a time-weighted return (TWR) chart to the StocksAnalysis page. The chart shows how a stock portfolio grows relatively over time, removing distortion caused by buy/sell transactions. The user can view the whole portfolio as a single line, or select labels (tags) to show one line per label for comparison.

## Feature Summary

- New Card section at the bottom of `StocksAnalysis.tsx`
- Date range: custom from/to date pickers (default: 1 year ago → today)
- Label filter: multi-select using existing tag combobox; each selected label gets its own line
- "Whole portfolio" toggle: on by default when no labels selected, optional alongside label lines
- Chart always starts at 0% at the selected from-date
- Stocks tagged with multiple labels appear independently in each label's line (no deduplication)

## Data Layer (Rust)

### New command: `get_stock_twr`

```rust
#[tauri::command]
pub async fn get_stock_twr(
    db: State<'_, Database>,
    tag_ids: Vec<String>,
    include_portfolio: bool,
    from_date: String,
    to_date: String,
) -> Result<Vec<TwrSeries>>
```

### Return types

```rust
pub struct TwrDataPoint {
    pub date: String,   // "YYYY-MM-DD"
    pub twr: f64,       // cumulative TWR in percent (0.0 at from_date)
}

pub struct TwrSeries {
    pub tag: Option<StockTag>,  // None = whole portfolio
    pub data: Vec<TwrDataPoint>,
}
```

When `tag_ids` is empty, only the portfolio series is returned (regardless of `include_portfolio`). When tags are selected, one series per tag is returned plus the portfolio series if `include_portfolio` is true.

### TWR Algorithm (daily chain-linking)

For each series (tag or whole portfolio), for each calendar day in `[from_date, to_date]`:

1. **Portfolio value:** Sum `value_czk` across all tickers in the group, using the most recent `stock_value_history` entry with `recorded_at ≤ date` per ticker.
2. **Cash flows:** Sum net cash flows for that day — cost basis of buy transactions minus proceeds of sell transactions for tickers in the group.
3. **Daily return:** `r = (V_today - V_yesterday - CF) / (V_yesterday + CF)`
   - Skip days where `V_yesterday + CF = 0` (no holdings yet).
4. **Cumulative TWR:** `TWR_d = ∏(1 + r_i) - 1` for all days from `from_date` to `d`.
   - First data point is always `{ date: from_date, twr: 0.0 }`.

Data source for cash flows: the existing stock transactions table (buy/sell records already used elsewhere in `investments.rs`).

### Tests

New `#[cfg(test)]` module in the command or a service function extracted from it:
- Happy path: two tickers, one buy transaction mid-period, verify TWR ignores the cash bump
- Edge case: no transactions (pure price appreciation = same as simple return)
- Edge case: tag with no tickers returns empty data

## Frontend

### New state (added to StocksAnalysis)

```ts
const [twrFrom, setTwrFrom] = useState<string>(oneYearAgo)
const [twrTo, setTwrTo] = useState<string>(today)
const [twrTagIds, setTwrTagIds] = useState<string[]>([])
const [showPortfolio, setShowPortfolio] = useState(true)
```

`showPortfolio` is forced `true` and hidden when `twrTagIds` is empty.

### Query

```ts
const { data: twrSeries = [] } = useQuery({
  queryKey: ["stock-twr", twrTagIds, showPortfolio, twrFrom, twrTo],
  queryFn: () => investmentsApi.getStockTwr(twrTagIds, showPortfolio, twrFrom, twrTo),
})
```

### New tauri-api method

```ts
getStockTwr: (tagIds: string[], includePortfolio: boolean, fromDate: string, toDate: string) =>
  tauriInvoke<TwrSeries[]>('get_stock_twr', { tagIds, includePortfolio, fromDate, toDate }),
```

### New shared types

```ts
export interface TwrDataPoint { date: string; twr: number }
export interface TwrSeries { tag: StockTag | null; data: TwrDataPoint[] }
```

### Chart (Recharts LineChart)

- One `<Line>` per `TwrSeries`
- Portfolio line color: `hsl(var(--foreground))`
- Label lines: `TAG_COLORS[index % TAG_COLORS.length]`
- X-axis: date string, formatted as `DD MMM` when range ≤ 90 days, `MMM YY` otherwise
- Y-axis: formatted as `+5.2%` / `-3.1%`
- Tooltip: date + each series name + TWR value
- Legend below chart: tag name or "Whole portfolio"

### Controls layout

```
[ From date picker ] [ To date picker ]  [ Label multi-select ]  [ □ Whole portfolio ]
```

## Files to Change

| File | Change |
|---|---|
| `src-tauri/src/commands/investments.rs` (or new `stock_twr.rs`) | Add `get_stock_twr` command + `TwrSeries`/`TwrDataPoint` structs |
| `src-tauri/src/lib.rs` | Register `get_stock_twr` in the invoke handler |
| `shared/schema.ts` | Add `TwrDataPoint`, `TwrSeries` interfaces |
| `src/lib/tauri-api.ts` | Add `getStockTwr` to `investmentsApi` |
| `src/pages/StocksAnalysis.tsx` | Add TWR card with controls + chart |

## Out of Scope

- Crypto TWR (separate future feature)
- Benchmark comparison (e.g. vs S&P 500)
- Export of TWR data
