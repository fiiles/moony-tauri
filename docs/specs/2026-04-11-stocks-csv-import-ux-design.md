# Stocks CSV Import UX Redesign

**Date:** 2026-04-11  
**Status:** Approved  
**Scope:** `src/components/stocks/ImportInvestmentsModal.tsx` (full rewrite) + i18n keys in `src/i18n/locales/*/stocks.json`

---

## Overview

Replace the existing `ImportInvestmentsModal.tsx` with a clean 5-step wizard that adds:
1. Expanded CSV format description + Yahoo Finance ticker format hints (Step 1)
2. Explicit column mapping with CSV preview (Step 2)
3. Auto-verified ticker review with editable names and rate-limit handling (Step 3)
4. Import (Step 4, unchanged)
5. Done (Step 5, unchanged)

No Rust backend changes required. The existing `investmentsApi.importTransactions` and `priceApi.searchStockTickers` APIs are used as-is.

---

## Step Flow

```
select → mapping → ticker-review → importing → done
```

Back navigation: `mapping → select`, `ticker-review → mapping`. No back from `importing` or `done`.

---

## State Shape

```ts
type Step = "select" | "mapping" | "ticker-review" | "importing" | "done";

type ColumnMap = {
  date: string;
  type: string;
  ticker: string;
  quantity: string;
  price: string;
  currency: string; // optional — empty string means "use default currency"
};

type TickerStatus = "pending" | "searching" | "found" | "not_found" | "failed";

type TickerEntry = {
  originalTicker: string;   // raw value from CSV
  resolvedTicker: string;   // editable — starts as originalTicker
  name: string;             // editable — filled from Yahoo or by user
  status: TickerStatus;
};

// tickerMap: keyed by originalTicker
type TickerMap = Record<string, TickerEntry>;
```

Additional state:
- `file: File | null`
- `headers: string[]` — column names parsed from CSV
- `rawRows: Record<string, string>[]` — all rows with original keys
- `defaultCurrency: string` — fallback when currency column not mapped (default "USD")
- `dateFormat: string` — selected in Step 2 (default `%Y-%m-%d`)
- `verifyProgress: { done: number; total: number }` — shown during auto-verification
- `importResult: { success: number; errors: string[]; imported: string[] } | null`

---

## Step 1 — Select File

### Layout
- Dashed drop zone (click to open file picker), same as current
- "Download template" link (unchanged)
- Two info blocks **above** the drop zone:

### CSV Format Block
A compact table describing expected columns:

| Column | Required | Example values |
|---|---|---|
| Date | ✓ | `2024-01-15`, `15.01.2024`, `15/01/2024` |
| Type | ✓ | `buy`, `sell` |
| Ticker | ✓ | `AAPL`, `EUNL.DE`, `EWG.L` |
| Quantity | ✓ | `10`, `0.5` |
| Price | ✓ | `180.50` |
| Currency | optional | `USD`, `EUR`, `CZK`, `GBP` |

Note: "Column names don't need to match exactly — you'll map them in the next step."  
Note: "Name column is not required — it is loaded automatically from Yahoo Finance."

### Yahoo Finance Ticker Format Block
A collapsible (`<Collapsible>`) labelled "Which ticker format to use?" — **closed by default**.

Content: table of common Yahoo Finance exchange suffixes:

| Exchange | Suffix | Example |
|---|---|---|
| US (NYSE / NASDAQ) | *(none)* | `AAPL` |
| Germany (XETRA) | `.DE` | `EUNL.DE` |
| London (LSE) | `.L` | `EWG.L` |
| Paris (Euronext) | `.PA` | `AIR.PA` |
| Amsterdam | `.AS` | `ASML.AS` |
| Milan | `.MI` | `ENI.MI` |
| Swiss Exchange | `.SW` | `NESN.SW` |
| Prague (PSE) | `.PR` | `CEZ.PR` |
| Hong Kong | `.HK` | `0700.HK` |
| Tokyo | `.T` | `7203.T` |
| Toronto | `.TO` | `RY.TO` |
| Australia (ASX) | `.AX` | `CBA.AX` |

### Error Handling
If the selected file cannot be parsed or yields zero valid rows, an inline `Alert` (destructive) is shown on this step. The user stays on `select` and can try another file.

### Footer
- Cancel button

---

## Step 2 — Column Mapping

### Layout
- **File info bar**: filename, row count, "Change file" button (→ back to `select`)
- **Required columns** grid (2 columns):
  - Date — `<Select>` of headers + confidence badge + date format selector (`%Y-%m-%d`, `%d.%m.%Y`, `%d/%m/%Y`, free-text input)
  - Type — `<Select>` of headers + confidence badge
  - Ticker — `<Select>` of headers + confidence badge
  - Quantity — `<Select>` of headers + confidence badge
  - Price — `<Select>` of headers + confidence badge
- **Optional columns** grid:
  - Currency — `<Select>` of headers (or `__none__`) + confidence badge; if `__none__`, show "Default currency" fallback `<Select>` (USD/EUR/CZK/GBP)
- **CSV Preview** — toggleable (collapsed by default), shows first 5 rows; same `<Eye>/<EyeOff>` toggle as bank accounts

### Auto-suggestions
On load, run the same heuristic header-matching as the current modal to pre-fill the column map. Show confidence badges (green ≥90%, yellow ≥70%) matching `CsvImportDialog` pattern.

### Footer
- Back (→ `select`)
- Next (disabled until Date, Type, Ticker, Quantity, Price are all mapped)

---

## Step 3 — Ticker Review

### Entry behaviour
On entering this step:
1. Extract all **unique** ticker values from the mapped Ticker column
2. Build initial `tickerMap` with `status: "pending"` for each
3. Start sequential verification (see Rate Limiting below)

### Layout
- **Progress bar / counter**: "Verifying X of Y tickers…" — hidden once all are done
- **"Retry failed" button**: visible only when ≥1 ticker has `status: "failed"`; re-runs sequential verification for failed entries only
- **Ticker list**: one row per unique ticker

### Ticker Row
Each row contains (left to right):
- **Status icon**: spinner (searching), ✓ green (found), ✗ red (not_found), ⚠ yellow (failed)
- **Ticker input**: editable text field, pre-filled with `resolvedTicker`
- **Search button** (magnifier icon, `<Loader2>` when searching): fires `priceApi.searchStockTickers(resolvedTicker)`, same picker `<AlertDialog>` as `AddInvestmentModal` for multiple results
- **Name input**: editable text field
  - `found`: pre-filled from Yahoo Finance name; user may overwrite
  - `not_found`: empty, red border — user must fill before proceeding
  - `failed`: empty, yellow border — user may fill or retry

### Validation
"Import X records" button is disabled when any ticker has:
- `status: "pending"` or `status: "searching"`
- `status: "not_found"` with empty name
- `status: "failed"` with empty name

### Rate Limiting
- Tickers verified **sequentially** with a **300ms delay** between calls
- If a call throws (network error, rate limit, any exception): set that ticker's status to `"failed"` and continue to the next
- User can manually retry failed tickers via the Search button or the "Retry failed" bulk button
- Sequential retry for bulk: same 300ms delay, only processes `status: "failed"` entries

### Footer
- Back (→ `mapping`)
- "Import X records" (→ `importing`) — X is total CSV row count

---

## Step 4 — Importing

Unchanged from current: full-screen spinner, delayed subtitle after 5s ("Looking for details, loading historical prices...").

The frontend transforms rows before calling `importTransactions`:
1. Remap keys using `columnMap` → standard keys (`Date`, `Type`, `Ticker`, `Quantity`, `Price`, `Currency`)
2. For each row, replace `Ticker` value with `tickerMap[originalTicker].resolvedTicker`
3. Inject `Name` from `tickerMap[originalTicker].name`
4. If Currency column was not mapped, fill from `defaultCurrency`

Then calls: `investmentsApi.importTransactions(transformedRows, defaultCurrency)`

---

## Step 5 — Done

Unchanged from current: success count + imported list (green) + error list (red), close button.

---

## Files Changed

| File | Change |
|---|---|
| `src/components/stocks/ImportInvestmentsModal.tsx` | Full rewrite |
| `src/i18n/locales/en/stocks.json` | New/updated keys under `import.*` |
| `src/i18n/locales/cs/stocks.json` | Same keys in Czech |

No Rust, no shared types, no other frontend files.

---

## Out of Scope

- Persisting column mapping as a preset (can be added later)
- Drag-and-drop file upload
- Changes to bank accounts CSV import
- Any Rust backend changes
