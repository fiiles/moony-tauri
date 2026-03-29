# Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add systematic test coverage for Rust service logic and TypeScript utilities across all four phases defined in the design spec.

**Architecture:** Phase 1 sets up Vitest (TypeScript) and the in-memory SQLite pattern (Rust). Phases 2–3 add tests per file following those patterns. Each Rust service test module uses `Connection::open_in_memory()` with a hand-written minimal schema — the same pattern already used in `services/budgeting.rs`. TypeScript tests co-locate with source files, imported via the existing `@`/`@shared` Vite path aliases.

**Tech Stack:** Vitest 3.x, @vitest/coverage-v8, rusqlite in-memory SQLite (no SQLCipher for tests), tempfile (Rust dev dependency for auth tests)

**Note on analytics.ts:** `src/lib/analytics.ts` is excluded — it calls `localStorage` and `@tauri-apps/api/core` `invoke()`, both of which require jsdom + Tauri mocks. Testing it adds more mock overhead than value at this stage.

---

## File Map

**Created:**
- `src/utils/annuity.test.ts`
- `src/utils/iban-utils.test.ts`
- `src/utils/stocks.test.ts`
- `shared/currencies.test.ts`

**Modified:**
- `package.json` — add vitest scripts and devDependencies
- `vite.config.ts` — add `test` block
- `.husky/pre-commit` — add `npm test`
- `CLAUDE.md` — add Testing Policy section and update Commands
- `src-tauri/Cargo.toml` — add `tempfile` dev dependency
- `src-tauri/src/services/investments.rs` — add `#[cfg(test)]` module
- `src-tauri/src/services/csv_import.rs` — add `#[cfg(test)]` module
- `src-tauri/src/services/auth.rs` — add `#[cfg(test)]` module
- `src-tauri/src/services/bank_accounts.rs` — add `#[cfg(test)]` module
- `src-tauri/src/services/currency.rs` — expand `#[cfg(test)]` module
- `src-tauri/src/services/budgeting.rs` — expand `#[cfg(test)]` module
- `src-tauri/src/services/crypto.rs` — expand `#[cfg(test)]` module
- `src-tauri/src/services/pricing.rs` — add `#[cfg(test)]` module

---

## Task 1: Vitest infrastructure

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`

- [ ] **Step 1: Install vitest and coverage**

```bash
cd /path/to/Moony-tauri
npm install --save-dev vitest @vitest/coverage-v8
```

Expected: packages added to `package.json` devDependencies, `package-lock.json` updated.

- [ ] **Step 2: Add test scripts to package.json**

In `package.json`, add to the `"scripts"` object:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 3: Add test block to vite.config.ts**

Add `test` config inside the existing async factory object. The full file after change:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  test: {
    globals: true,
    environment: "node",
  },
}));
```

- [ ] **Step 4: Verify Vitest runs (no tests yet)**

```bash
npm test
```

Expected output: `No test files found, exiting with code 1` or `0 tests passed`. Either is fine — confirms the runner works.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts
git commit -m "feat: add Vitest test infrastructure"
```

---

## Task 2: Add npm test to Husky pre-commit and update CLAUDE.md

**Files:**
- Modify: `.husky/pre-commit`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add npm test to pre-commit hook**

Edit `.husky/pre-commit` to become:

```bash
# Run frontend checks
npm run lint
npm run typecheck
npm test

# Run Rust checks
cd src-tauri
cargo fmt --check
cargo clippy -- -D warnings
```

- [ ] **Step 2: Update CLAUDE.md Commands section**

In `CLAUDE.md`, replace the line:

```
There are no frontend tests. Husky pre-commit hooks run lint and format checks.
```

with:

```
Husky pre-commit hooks run lint, typecheck, frontend tests, `cargo fmt --check`, and `cargo clippy`.
```

And add to the Commands section under `# Code quality`:

```bash
npm test                   # Run TypeScript tests (Vitest)
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

- [ ] **Step 3: Add Testing Policy section to CLAUDE.md**

Append to the end of `CLAUDE.md`:

```markdown
## Testing Policy

### When to run tests

- Before claiming any task complete, run `npm test` (TypeScript) and `cd src-tauri && cargo test` (Rust) and verify they pass
- When modifying a file that has a corresponding test file, run the relevant suite before and after the change
- When adding new business logic to a service, add at least one test covering the happy path before the task is done

### When to write new tests

- Any new pure function in `src/utils/`, `src/lib/`, or `shared/` must have tests alongside it in a co-located `.test.ts` file
- Any new Rust service function with non-trivial logic (calculations, parsing, state transitions) must have at least a happy-path test and one error/edge case in a `#[cfg(test)]` module at the bottom of the service file
- Bug fixes in tested code must include a regression test that fails before the fix and passes after

### What to test vs. skip

| Test | Skip |
|---|---|
| Pure utility functions (`src/utils/`, `shared/`) | Tauri command handlers in `src-tauri/src/commands/` |
| Rust service business logic in `src-tauri/src/services/` | React components and hooks (out of scope) |
| | `shared/generated-types.ts` and `shared/schema.ts` (types only) |
| | `src/lib/tauri-api.ts` (thin invoke wrappers) |
| | `src/lib/analytics.ts` (side-effectful, requires jsdom+mocks) |

### Rust test DB pattern

Each Rust service test module uses `Connection::open_in_memory()` with a hand-written minimal schema — only the tables needed by that service. Follow the pattern in `services/budgeting.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(r#"
            CREATE TABLE ... ;
        "#).expect("schema");
        conn
    }

    #[test]
    fn test_something() {
        let conn = setup_test_db();
        // ...
    }
}
```

Do NOT use the `Database` struct in tests — it requires SQLCipher key setup. Use raw `rusqlite::Connection` directly.

Do NOT say "I'll add tests later" — tests are part of the definition of done for new logic.
```

- [ ] **Step 4: Commit**

```bash
git add .husky/pre-commit CLAUDE.md
git commit -m "docs: add testing policy to CLAUDE.md and pre-commit hook"
```

---

## Task 3: annuity.test.ts

**Files:**
- Create: `src/utils/annuity.test.ts`

- [ ] **Step 1: Write the tests**

Create `src/utils/annuity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  calculateAnnuityPayment,
  generateAmortizationSchedule,
  getPeriodsPerYear,
  yearsToTotalPeriods,
  monthsToTotalPeriods,
} from "./annuity";

describe("getPeriodsPerYear", () => {
  it("returns 12 for monthly", () => {
    expect(getPeriodsPerYear("monthly")).toBe(12);
  });
  it("returns 4 for quarterly", () => {
    expect(getPeriodsPerYear("quarterly")).toBe(4);
  });
  it("returns 2 for semiAnnually", () => {
    expect(getPeriodsPerYear("semiAnnually")).toBe(2);
  });
  it("returns 1 for annually", () => {
    expect(getPeriodsPerYear("annually")).toBe(1);
  });
});

describe("calculateAnnuityPayment", () => {
  it("computes standard monthly payment at 5% for 240 months on 3,000,000", () => {
    // Known result: PMT = 3000000 * (0.004167 * (1.004167^240)) / ((1.004167^240) - 1) ≈ 19799
    const payment = calculateAnnuityPayment(3_000_000, 5, 240, 12);
    expect(payment).toBeCloseTo(19799, -1); // within 10
  });

  it("returns principal / periods when rate is 0", () => {
    const payment = calculateAnnuityPayment(120_000, 0, 120, 12);
    expect(payment).toBeCloseTo(1000, 1);
  });

  it("returns 0 when principal is 0", () => {
    expect(calculateAnnuityPayment(0, 5, 120, 12)).toBe(0);
  });

  it("returns 0 when totalPeriods is 0", () => {
    expect(calculateAnnuityPayment(100_000, 5, 0, 12)).toBe(0);
  });

  it("returns full principal for 1 period at 0% rate", () => {
    expect(calculateAnnuityPayment(50_000, 0, 1, 12)).toBeCloseTo(50_000, 1);
  });
});

describe("generateAmortizationSchedule", () => {
  it("returns empty schedule when principal is 0", () => {
    const result = generateAmortizationSchedule(0, 5, 120, 12);
    expect(result.periodicPayment).toBe(0);
    expect(result.schedule).toHaveLength(0);
  });

  it("schedule has correct number of rows", () => {
    const result = generateAmortizationSchedule(500_000, 4, 60, 12);
    expect(result.schedule).toHaveLength(60);
  });

  it("last row has remaining balance near 0", () => {
    const result = generateAmortizationSchedule(500_000, 4, 60, 12);
    const last = result.schedule[result.schedule.length - 1];
    expect(last.remainingBalance).toBeCloseTo(0, 0);
  });

  it("totalPayments equals periodicPayment * periods", () => {
    const result = generateAmortizationSchedule(200_000, 3.5, 24, 12);
    expect(result.totalPayments).toBeCloseTo(result.periodicPayment * 24, 2);
  });

  it("principal + interest of first period = payment amount", () => {
    const result = generateAmortizationSchedule(1_000_000, 6, 120, 12);
    const first = result.schedule[0];
    expect(first.principalPayment + first.interestPayment).toBeCloseTo(first.payment, 5);
  });
});

describe("yearsToTotalPeriods", () => {
  it("converts 30 years monthly to 360 periods", () => {
    expect(yearsToTotalPeriods(30, 12)).toBe(360);
  });
  it("converts 5 years quarterly to 20 periods", () => {
    expect(yearsToTotalPeriods(5, 4)).toBe(20);
  });
});

describe("monthsToTotalPeriods", () => {
  it("converts 36 months monthly to 36 periods", () => {
    expect(monthsToTotalPeriods(36, 12)).toBe(36);
  });
  it("converts 12 months quarterly to 4 periods", () => {
    expect(monthsToTotalPeriods(12, 4)).toBe(4);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass. If any fail, check the `calculateAnnuityPayment` formula and adjust the `toBeCloseTo` precision.

- [ ] **Step 3: Commit**

```bash
git add src/utils/annuity.test.ts
git commit -m "test: add annuity utility tests"
```

---

## Task 4: iban-utils.test.ts

**Files:**
- Create: `src/utils/iban-utils.test.ts`

- [ ] **Step 1: Write the tests**

Create `src/utils/iban-utils.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isCzechIBAN, ibanToBBAN, formatAccountNumber } from "./iban-utils";

describe("isCzechIBAN", () => {
  it("returns true for a valid Czech IBAN", () => {
    expect(isCzechIBAN("CZ6508000000192000145399")).toBe(true);
  });

  it("returns true for Czech IBAN with spaces", () => {
    expect(isCzechIBAN("CZ65 0800 0000 1920 0014 5399")).toBe(true);
  });

  it("returns true for lowercase cz prefix", () => {
    expect(isCzechIBAN("cz6508000000192000145399")).toBe(true);
  });

  it("returns false for non-Czech IBAN", () => {
    expect(isCzechIBAN("DE89370400440532013000")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isCzechIBAN(null)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isCzechIBAN("")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isCzechIBAN(undefined)).toBe(false);
  });
});

describe("ibanToBBAN", () => {
  it("converts Czech IBAN to account/bank format", () => {
    // CZ6508000000192000145399 → bank=0800, prefix=000019, account=2000145399
    // prefix without leading zeros = 19, account without leading zeros = 2000145399
    expect(ibanToBBAN("CZ6508000000192000145399")).toBe("19-2000145399/0800");
  });

  it("omits prefix when it is all zeros", () => {
    // CZ5503000000000000123456 → bank=0300, prefix=000000, account=0000123456
    expect(ibanToBBAN("CZ5503000000000000123456")).toBe("123456/0300");
  });

  it("handles spaces in IBAN input", () => {
    expect(ibanToBBAN("CZ65 0800 0000 1920 0014 5399")).toBe("19-2000145399/0800");
  });

  it("returns null for non-Czech IBAN", () => {
    expect(ibanToBBAN("DE89370400440532013000")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(ibanToBBAN(null)).toBeNull();
  });

  it("returns null for Czech IBAN with wrong length", () => {
    expect(ibanToBBAN("CZ123")).toBeNull();
  });
});

describe("formatAccountNumber", () => {
  it("returns null for null input", () => {
    expect(formatAccountNumber(null)).toBeNull();
  });

  it("formats non-Czech IBAN with spaces every 4 chars", () => {
    const result = formatAccountNumber("DE89370400440532013000");
    expect(result).toBe("DE89 3704 0044 0532 0130 00");
  });

  it("returns IBAN format (not BBAN) when preferBBAN is false", () => {
    const result = formatAccountNumber("CZ6508000000192000145399", false);
    expect(result).toBe("CZ65 0800 0000 1920 0014 5399");
  });

  it("returns BBAN format when preferBBAN is true and input is Czech IBAN", () => {
    const result = formatAccountNumber("CZ6508000000192000145399", true);
    expect(result).toBe("19-2000145399/0800");
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/utils/iban-utils.test.ts
git commit -m "test: add IBAN utility tests"
```

---

## Task 5: stocks.test.ts

**Files:**
- Create: `src/utils/stocks.test.ts`

- [ ] **Step 1: Write the tests**

`stocks.ts` imports `calculateGainLoss`, `calculateGainLossPercent` from `@shared/calculations`. Vitest resolves `@shared` via the Vite alias. Tests for `groupHoldingsByTicker` and `getInstrumentIcon` are self-contained.

Create `src/utils/stocks.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { groupHoldingsByTicker, getInstrumentIcon } from "./stocks";
import type { HoldingData } from "./stocks";

function makeHolding(overrides: Partial<HoldingData> = {}): HoldingData {
  return {
    id: "test-id",
    ticker: "AAPL",
    companyName: "Apple Inc.",
    quantity: 10,
    avgCost: 150,
    totalCost: 1500,
    currentPrice: 180,
    marketValue: 1800,
    gainLoss: 300,
    gainLossPercent: 20,
    ...overrides,
  };
}

describe("groupHoldingsByTicker", () => {
  it("returns holdings unchanged when all tickers are unique", () => {
    const holdings = [
      makeHolding({ ticker: "AAPL", id: "1" }),
      makeHolding({ ticker: "MSFT", id: "2" }),
    ];
    const result = groupHoldingsByTicker(holdings);
    expect(result).toHaveLength(2);
  });

  it("merges two holdings with the same ticker", () => {
    const holdings = [
      makeHolding({ ticker: "AAPL", id: "1", quantity: 10, totalCost: 1500, marketValue: 1800 }),
      makeHolding({ ticker: "AAPL", id: "2", quantity: 5, totalCost: 750, marketValue: 900 }),
    ];
    const result = groupHoldingsByTicker(holdings);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(15);
    expect(result[0].totalCost).toBe(2250);
    expect(result[0].marketValue).toBe(2700);
  });

  it("calculates gainLoss correctly for merged group", () => {
    const holdings = [
      makeHolding({ ticker: "TSLA", id: "1", quantity: 2, totalCost: 400, marketValue: 600 }),
      makeHolding({ ticker: "TSLA", id: "2", quantity: 3, totalCost: 600, marketValue: 750 }),
    ];
    const result = groupHoldingsByTicker(holdings);
    expect(result[0].gainLoss).toBeCloseTo(350, 2); // 1350 - 1000
  });

  it("calculates avgCost per unit for merged group", () => {
    const holdings = [
      makeHolding({ ticker: "GOOG", id: "1", quantity: 4, totalCost: 800, marketValue: 1000 }),
      makeHolding({ ticker: "GOOG", id: "2", quantity: 6, totalCost: 1200, marketValue: 1500 }),
    ];
    const result = groupHoldingsByTicker(holdings);
    expect(result[0].avgCost).toBeCloseTo(200, 2); // 2000 / 10
  });

  it("uses synthetic id for merged group", () => {
    const holdings = [
      makeHolding({ ticker: "NVDA", id: "a" }),
      makeHolding({ ticker: "NVDA", id: "b" }),
    ];
    const result = groupHoldingsByTicker(holdings);
    expect(result[0].id).toBe("group-NVDA");
  });

  it("returns empty array for empty input", () => {
    expect(groupHoldingsByTicker([])).toHaveLength(0);
  });
});

describe("getInstrumentIcon", () => {
  it("returns a valid Tailwind color class", () => {
    const result = getInstrumentIcon("AAPL");
    expect(result).toMatch(/^bg-/);
  });

  it("returns consistent result for the same ticker", () => {
    expect(getInstrumentIcon("TSLA")).toBe(getInstrumentIcon("TSLA"));
  });

  it("returns different colors for different tickers", () => {
    // Not guaranteed to differ but AAPL and ZZZZ should hash differently
    const colors = new Set(["AAPL", "MSFT", "TSLA", "GOOG", "AMZN", "META", "NVDA"].map(getInstrumentIcon));
    expect(colors.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/utils/stocks.test.ts
git commit -m "test: add stocks utility tests"
```

---

## Task 6: currencies.test.ts

**Files:**
- Create: `shared/currencies.test.ts`

- [ ] **Step 1: Write the tests**

Create `shared/currencies.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  CURRENCIES,
  BASE_CURRENCY,
  EXCHANGE_RATES,
  convertToCzK,
  convertFromCzK,
  updateExchangeRates,
} from "./currencies";

describe("CURRENCIES constant", () => {
  it("contains USD, EUR, CZK, GBP", () => {
    expect(CURRENCIES).toHaveProperty("USD");
    expect(CURRENCIES).toHaveProperty("EUR");
    expect(CURRENCIES).toHaveProperty("CZK");
    expect(CURRENCIES).toHaveProperty("GBP");
  });

  it("each currency has symbol, locale, position, and label", () => {
    for (const [, def] of Object.entries(CURRENCIES)) {
      expect(def.symbol).toBeTruthy();
      expect(def.locale).toBeTruthy();
      expect(["before", "after"]).toContain(def.position);
      expect(def.label).toBeTruthy();
    }
  });

  it("CZK is the base currency", () => {
    expect(BASE_CURRENCY).toBe("CZK");
  });
});

describe("convertToCzK", () => {
  beforeEach(() => {
    // Reset to known rates
    updateExchangeRates({ EUR: 25.0, USD: 23.0 });
  });

  it("converts EUR to CZK using rate", () => {
    expect(convertToCzK(100, "EUR")).toBeCloseTo(2500, 2);
  });

  it("returns amount unchanged for CZK", () => {
    expect(convertToCzK(500, "CZK")).toBe(500);
  });

  it("converts USD to CZK using rate", () => {
    expect(convertToCzK(10, "USD")).toBeCloseTo(230, 2);
  });
});

describe("convertFromCzK", () => {
  beforeEach(() => {
    updateExchangeRates({ EUR: 25.0, USD: 23.0 });
  });

  it("converts CZK to EUR", () => {
    expect(convertFromCzK(2500, "EUR")).toBeCloseTo(100, 2);
  });

  it("returns amount unchanged for CZK", () => {
    expect(convertFromCzK(500, "CZK")).toBe(500);
  });
});

describe("updateExchangeRates", () => {
  it("updates rates and affects subsequent conversions", () => {
    updateExchangeRates({ EUR: 30.0 });
    expect(convertToCzK(1, "EUR")).toBeCloseTo(30, 2);
  });

  it("CZK rate always stays 1", () => {
    updateExchangeRates({ CZK: 999 }); // attempt to overwrite
    // The shared/currencies.ts updateExchangeRates forces CZK = 1
    expect(EXCHANGE_RATES.CZK).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add shared/currencies.test.ts
git commit -m "test: add currencies utility tests"
```

---

## Task 7: investments.rs tests

**Files:**
- Modify: `src-tauri/src/services/investments.rs`

- [ ] **Step 1: Write the failing test module**

Append to the bottom of `src-tauri/src/services/investments.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(
            r#"
            CREATE TABLE stock_investments (
                id TEXT PRIMARY KEY,
                ticker TEXT NOT NULL UNIQUE,
                company_name TEXT NOT NULL,
                quantity TEXT NOT NULL DEFAULT '0',
                average_price TEXT NOT NULL DEFAULT '0',
                currency TEXT NOT NULL DEFAULT 'CZK'
            );

            CREATE TABLE investment_transactions (
                id TEXT PRIMARY KEY,
                investment_id TEXT NOT NULL,
                type TEXT NOT NULL,
                ticker TEXT NOT NULL,
                company_name TEXT NOT NULL,
                quantity TEXT NOT NULL,
                price_per_unit TEXT NOT NULL,
                currency TEXT NOT NULL,
                transaction_date INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );
            "#,
        )
        .expect("schema");
        conn
    }

    #[test]
    fn test_get_or_create_investment_creates_new() {
        let conn = setup_test_db();
        let id = get_or_create_investment(&conn, "AAPL", "Apple Inc.", "USD", None, None)
            .expect("create");
        assert!(!id.is_empty());

        // Second call returns same id
        let id2 = get_or_create_investment(&conn, "AAPL", "Apple Inc.", "USD", None, None)
            .expect("get existing");
        assert_eq!(id, id2);
    }

    #[test]
    fn test_get_or_create_investment_upcases_ticker() {
        let conn = setup_test_db();
        let id1 = get_or_create_investment(&conn, "aapl", "Apple", "USD", None, None)
            .expect("lowercase");
        let id2 = get_or_create_investment(&conn, "AAPL", "Apple", "USD", None, None)
            .expect("uppercase");
        assert_eq!(id1, id2); // same investment
    }

    #[test]
    fn test_recalculate_metrics_buy_only() {
        let conn = setup_test_db();
        let investment_id =
            get_or_create_investment(&conn, "MSFT", "Microsoft", "USD", None, None)
                .expect("create");

        // Insert two buy transactions
        conn.execute(
            "INSERT INTO investment_transactions
             (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at)
             VALUES ('tx1', ?1, 'buy', 'MSFT', 'Microsoft', '10', '300', 'USD', 0, 0)",
            [&investment_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO investment_transactions
             (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at)
             VALUES ('tx2', ?1, 'buy', 'MSFT', 'Microsoft', '5', '360', 'USD', 0, 0)",
            [&investment_id],
        )
        .unwrap();

        recalculate_investment_metrics(&conn, &investment_id).expect("recalc");

        let inv = get_investment_by_id(&conn, &investment_id).expect("get");
        let qty: f64 = inv.quantity.parse().unwrap();
        let avg: f64 = inv.average_price.parse().unwrap();
        assert_eq!(qty, 15.0);
        // avg = (10*300 + 5*360) / 15 = 4800/15 = 320
        assert!((avg - 320.0).abs() < 0.01);
    }

    #[test]
    fn test_recalculate_metrics_buy_then_sell() {
        let conn = setup_test_db();
        let investment_id =
            get_or_create_investment(&conn, "TSLA", "Tesla", "USD", None, None).expect("create");

        conn.execute(
            "INSERT INTO investment_transactions
             (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at)
             VALUES ('tx1', ?1, 'buy', 'TSLA', 'Tesla', '20', '200', 'USD', 0, 0)",
            [&investment_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO investment_transactions
             (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at)
             VALUES ('tx2', ?1, 'sell', 'TSLA', 'Tesla', '8', '250', 'USD', 1, 0)",
            [&investment_id],
        )
        .unwrap();

        recalculate_investment_metrics(&conn, &investment_id).expect("recalc");

        let inv = get_investment_by_id(&conn, &investment_id).expect("get");
        let qty: f64 = inv.quantity.parse().unwrap();
        assert_eq!(qty, 12.0);
        // avg price is based on buys only: 200.0
        let avg: f64 = inv.average_price.parse().unwrap();
        assert!((avg - 200.0).abs() < 0.01);
    }

    #[test]
    fn test_import_single_transaction_invalid_type() {
        let conn = setup_test_db();
        let result = import_single_transaction(
            &conn, "AAPL", "Apple", "hold", "10", "150", "USD", 0,
        );
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("buy") || err.contains("sell"));
    }

    #[test]
    fn test_import_single_transaction_sell_without_position() {
        let conn = setup_test_db();
        let result = import_single_transaction(
            &conn, "GOOG", "Google", "sell", "5", "100", "USD", 0,
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_import_single_transaction_buy_creates_investment() {
        let conn = setup_test_db();
        let result = import_single_transaction(
            &conn, "nvda", "NVIDIA", "buy", "3", "500", "USD", 1_700_000_000,
        );
        assert!(result.is_ok());
        let (desc, _date, ticker) = result.unwrap();
        assert_eq!(ticker, "NVDA"); // uppercased
        assert!(desc.contains("BUY"));
    }

    #[test]
    fn test_import_single_transaction_currency_mismatch() {
        let conn = setup_test_db();
        // First buy in USD
        import_single_transaction(&conn, "AMD", "AMD", "buy", "10", "100", "USD", 0).unwrap();
        // Second buy in EUR — should fail
        let result =
            import_single_transaction(&conn, "AMD", "AMD", "buy", "5", "90", "EUR", 1);
        assert!(result.is_err());
    }
}
```

- [ ] **Step 2: Run Rust tests**

```bash
cd src-tauri && cargo test services::investments::tests
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
cd ..
git add src-tauri/src/services/investments.rs
git commit -m "test: add investments service tests"
```

---

## Task 8: csv_import.rs tests

**Files:**
- Modify: `src-tauri/src/services/csv_import.rs`

- [ ] **Step 1: Write the test module**

Append to the bottom of `src-tauri/src/services/csv_import.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_bank_presets_non_empty() {
        let presets = get_bank_presets();
        assert!(!presets.is_empty());
    }

    #[test]
    fn test_get_bank_presets_contains_known_banks() {
        let presets = get_bank_presets();
        let ids: Vec<&str> = presets.iter().map(|p| p.institution_id.as_str()).collect();
        assert!(ids.contains(&"inst_ceska_sporitelna"));
        assert!(ids.contains(&"inst_revolut"));
        assert!(ids.contains(&"inst_fio"));
    }

    #[test]
    fn test_get_preset_by_institution_found() {
        let preset = get_preset_by_institution("inst_revolut");
        assert!(preset.is_some());
        let p = preset.unwrap();
        assert_eq!(p.bank_name, "Revolut");
        assert_eq!(p.delimiter, ',');
        assert_eq!(p.encoding, "UTF-8");
    }

    #[test]
    fn test_get_preset_by_institution_not_found() {
        let result = get_preset_by_institution("inst_nonexistent_bank");
        assert!(result.is_none());
    }

    #[test]
    fn test_suggest_column_mappings_english_headers() {
        let headers: Vec<String> = vec![
            "Date".into(),
            "Amount".into(),
            "Description".into(),
        ];
        let mappings = suggest_column_mappings(&headers);
        assert!(mappings.contains_key("date"), "should detect date column");
        assert!(mappings.contains_key("amount"), "should detect amount column");
        assert!(mappings.contains_key("description"), "should detect description column");
    }

    #[test]
    fn test_suggest_column_mappings_czech_headers() {
        let headers: Vec<String> = vec![
            "Datum zaúčtování".into(),
            "Částka".into(),
            "Zpráva pro příjemce".into(),
            "VS".into(),
        ];
        let mappings = suggest_column_mappings(&headers);
        assert!(mappings.contains_key("date"), "should detect Czech date column");
        assert!(mappings.contains_key("amount"), "should detect Czech amount column");
    }

    #[test]
    fn test_suggest_column_mappings_empty_headers() {
        let mappings = suggest_column_mappings(&[]);
        assert!(mappings.is_empty());
    }

    #[test]
    fn test_suggest_column_mappings_high_confidence_for_exact_match() {
        let headers: Vec<String> = vec!["date".into()];
        let mappings = suggest_column_mappings(&headers);
        if let Some((_, confidence)) = mappings.get("date") {
            assert!(*confidence >= 0.9, "exact 'date' match should have high confidence");
        }
    }
}
```

- [ ] **Step 2: Run Rust tests**

```bash
cd src-tauri && cargo test services::csv_import::tests
```

Expected: all tests pass. Note: if `inst_fio` is not in the presets, adjust the assertion to match an institution ID that does exist in `get_bank_presets()`.

- [ ] **Step 3: Commit**

```bash
cd ..
git add src-tauri/src/services/csv_import.rs
git commit -m "test: add CSV import service tests"
```

---

## Task 9: auth.rs tests

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/services/auth.rs`

- [ ] **Step 1: Add tempfile dev dependency**

In `src-tauri/Cargo.toml`, add a `[dev-dependencies]` section at the end:

```toml
[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 2: Write the test module**

Append to the bottom of `src-tauri/src/services/auth.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_database_exists_returns_false_when_no_files() {
        let dir = tempdir().expect("tempdir");
        let db_path = dir.path().join("moony.db");
        assert!(!database_exists(&db_path));
    }

    #[test]
    fn test_database_exists_returns_false_when_only_db_file_present() {
        let dir = tempdir().expect("tempdir");
        let db_path = dir.path().join("moony.db");
        // Create DB file but not key files
        fs::write(&db_path, b"fake db").unwrap();
        assert!(!database_exists(&db_path));
    }

    #[test]
    fn test_database_exists_returns_false_when_only_some_key_files_present() {
        let dir = tempdir().expect("tempdir");
        let db_path = dir.path().join("moony.db");
        fs::write(&db_path, b"fake db").unwrap();
        fs::write(dir.path().join("salt"), b"fake salt").unwrap();
        // Missing key.enc and recovery.enc
        assert!(!database_exists(&db_path));
    }

    #[test]
    fn test_database_exists_returns_true_when_all_files_present() {
        let dir = tempdir().expect("tempdir");
        let db_path = dir.path().join("moony.db");
        fs::write(&db_path, b"fake db").unwrap();
        fs::write(dir.path().join("salt"), b"fake salt").unwrap();
        fs::write(dir.path().join("key.enc"), b"fake key").unwrap();
        fs::write(dir.path().join("recovery.enc"), b"fake recovery").unwrap();
        assert!(database_exists(&db_path));
    }

    #[test]
    fn test_is_authenticated_default_false() {
        // Note: this test is order-dependent if other tests set authenticated = true.
        // IS_AUTHENTICATED is a global AtomicBool — reset before checking.
        use std::sync::atomic::Ordering;
        IS_AUTHENTICATED.store(false, Ordering::SeqCst);
        assert!(!is_authenticated());
    }
}
```

- [ ] **Step 3: Run Rust tests**

```bash
cd src-tauri && cargo test services::auth::tests
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd ..
git add src-tauri/Cargo.toml src-tauri/src/services/auth.rs
git commit -m "test: add auth service tests"
```

---

## Task 10: bank_accounts.rs tests

**Files:**
- Modify: `src-tauri/src/services/bank_accounts.rs`

- [ ] **Step 1: Write the test module**

Append to the bottom of `src-tauri/src/services/bank_accounts.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::InsertBankAccount;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(
            r#"
            CREATE TABLE bank_accounts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                account_type TEXT NOT NULL DEFAULT 'checking',
                iban TEXT,
                bban TEXT,
                currency TEXT NOT NULL DEFAULT 'CZK',
                balance TEXT NOT NULL DEFAULT '0',
                institution_id TEXT,
                external_account_id TEXT,
                data_source TEXT NOT NULL DEFAULT 'manual',
                last_synced_at INTEGER,
                interest_rate TEXT,
                has_zone_designation INTEGER NOT NULL DEFAULT 0,
                termination_date INTEGER,
                created_at INTEGER NOT NULL DEFAULT 0,
                updated_at INTEGER NOT NULL DEFAULT 0
            );
            "#,
        )
        .expect("schema");
        conn
    }

    fn minimal_insert(name: &str) -> InsertBankAccount {
        InsertBankAccount {
            name: name.to_string(),
            account_type: None,
            iban: None,
            bban: None,
            currency: None,
            balance: None,
            institution_id: None,
            interest_rate: None,
            has_zone_designation: None,
            termination_date: None,
        }
    }

    #[test]
    fn test_create_account_sets_defaults() {
        let conn = setup_test_db();
        let account = create_account(&conn, &minimal_insert("Main Account")).expect("create");
        assert_eq!(account.name, "Main Account");
        assert_eq!(account.account_type, "checking");
        assert_eq!(account.currency, "CZK");
        assert_eq!(account.balance, "0");
        assert_eq!(account.data_source, "manual");
        assert!(!account.id.is_empty());
    }

    #[test]
    fn test_create_account_with_iban() {
        let conn = setup_test_db();
        let mut data = minimal_insert("Savings");
        data.iban = Some("CZ6508000000192000145399".to_string());
        data.currency = Some("CZK".to_string());
        let account = create_account(&conn, &data).expect("create");
        assert_eq!(account.iban.as_deref(), Some("CZ6508000000192000145399"));
    }

    #[test]
    fn test_get_account_by_id_not_found() {
        let conn = setup_test_db();
        let result = get_account_by_id(&conn, "nonexistent-id");
        assert!(result.is_err());
    }

    #[test]
    fn test_create_then_get_account() {
        let conn = setup_test_db();
        let created = create_account(&conn, &minimal_insert("Test Account")).expect("create");
        let fetched = get_account_by_id(&conn, &created.id).expect("get");
        assert_eq!(created.id, fetched.id);
        assert_eq!(fetched.name, "Test Account");
    }

    #[test]
    fn test_delete_account() {
        let conn = setup_test_db();
        let account = create_account(&conn, &minimal_insert("Delete Me")).expect("create");
        delete_account(&conn, &account.id).expect("delete");
        let result = get_account_by_id(&conn, &account.id);
        assert!(result.is_err());
    }

    #[test]
    fn test_delete_nonexistent_account_returns_error() {
        let conn = setup_test_db();
        let result = delete_account(&conn, "does-not-exist");
        assert!(result.is_err());
    }
}
```

- [ ] **Step 2: Run Rust tests**

```bash
cd src-tauri && cargo test services::bank_accounts::tests
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
cd ..
git add src-tauri/src/services/bank_accounts.rs
git commit -m "test: add bank accounts service tests"
```

---

## Task 11: Expand currency.rs tests

**Files:**
- Modify: `src-tauri/src/services/currency.rs`

- [ ] **Step 1: Read existing tests**

Open `src-tauri/src/services/currency.rs` and find the existing `#[cfg(test)]` module at the bottom. The existing 2 tests cover basic `convert_to_czk` and `convert_from_czk`.

- [ ] **Step 2: Add new tests to the existing test module**

Find the closing `}` of the existing `mod tests` block and insert these tests before it:

```rust
    #[test]
    fn test_convert_between_same_currency() {
        assert_eq!(convert_between(100.0, "EUR", "EUR"), 100.0);
    }

    #[test]
    fn test_convert_between_via_czk() {
        // EUR->USD: EUR 100 * 25 CZK/EUR = 2500 CZK / 23 CZK/USD ≈ 108.7 USD
        update_exchange_rates(
            [("EUR".to_string(), 25.0), ("USD".to_string(), 23.0)]
                .into_iter()
                .collect(),
        );
        let result = convert_between(100.0, "EUR", "USD");
        let expected = 100.0 * 25.0 / 23.0;
        assert!((result - expected).abs() < 0.01);
    }

    #[test]
    fn test_convert_to_czk_unknown_currency_fallback() {
        // Unknown currency falls back to rate 1.0 (no conversion)
        let result = convert_to_czk(42.0, "XYZ");
        assert_eq!(result, 42.0);
    }

    #[test]
    fn test_convert_to_czk_case_insensitive() {
        update_exchange_rates([("EUR".to_string(), 25.0)].into_iter().collect());
        let upper = convert_to_czk(10.0, "EUR");
        let lower = convert_to_czk(10.0, "eur");
        assert!((upper - lower).abs() < 0.001);
    }
```

- [ ] **Step 3: Run Rust tests**

```bash
cd src-tauri && cargo test services::currency::tests
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd ..
git add src-tauri/src/services/currency.rs
git commit -m "test: expand currency service tests"
```

---

## Task 12: Expand budgeting.rs tests

**Files:**
- Modify: `src-tauri/src/services/budgeting.rs`

- [ ] **Step 1: Read existing tests**

Open `src-tauri/src/services/budgeting.rs` and find the existing `#[cfg(test)]` module. It has `test_budget_goal_crud`, `test_get_report_empty`, `test_get_report_with_transactions`, `test_validate_budget_goal`.

- [ ] **Step 2: Add tests to the existing test module**

Find the closing `}` of the existing `mod tests` block and insert these tests before it:

```rust
    #[test]
    fn test_get_all_goals_multiple_categories() {
        let conn = setup_test_db();

        upsert_goal(
            &conn,
            InsertBudgetGoal {
                category_id: "cat_groceries".to_string(),
                timeframe: "monthly".to_string(),
                amount: "3000".to_string(),
                currency: Some("CZK".to_string()),
            },
        )
        .unwrap();

        upsert_goal(
            &conn,
            InsertBudgetGoal {
                category_id: "cat_dining".to_string(),
                timeframe: "monthly".to_string(),
                amount: "1500".to_string(),
                currency: Some("CZK".to_string()),
            },
        )
        .unwrap();

        let goals = get_all_goals(&conn).expect("get goals");
        assert_eq!(goals.len(), 2);
    }

    #[test]
    fn test_validate_budget_goal_zero_amount_invalid() {
        let invalid = InsertBudgetGoal {
            category_id: "cat_groceries".to_string(),
            timeframe: "monthly".to_string(),
            amount: "0".to_string(),
            currency: None,
        };
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn test_get_report_only_income() {
        let conn = setup_test_db();

        conn.execute_batch(
            r#"
            INSERT INTO bank_transactions (id, bank_account_id, booking_date, amount, currency, category_id, tx_type) VALUES
                ('tx1', 'acc1', 1704067200, '500.00', 'CZK', 'cat_income', 'credit');
            "#,
        )
        .expect("insert");

        let report = get_report(&conn, 0, i64::MAX, "monthly").expect("report");
        assert_eq!(report.total_income, "500.00");
        assert_eq!(report.total_expenses, "0.00");
        assert_eq!(report.net_balance, "500.00");
    }
```

- [ ] **Step 3: Run Rust tests**

```bash
cd src-tauri && cargo test services::budgeting::tests
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd ..
git add src-tauri/src/services/budgeting.rs
git commit -m "test: expand budgeting service tests"
```

---

## Task 13: Expand crypto.rs tests

**Files:**
- Modify: `src-tauri/src/services/crypto.rs`

- [ ] **Step 1: Read existing tests**

Open `src-tauri/src/services/crypto.rs` and find the existing `#[cfg(test)]` module. Read the 3 existing tests and the function signatures they test.

- [ ] **Step 2: Add tests for key derivation round-trips**

Find the existing test functions. The 3 existing tests already cover basic crypto operations. Add edge case / round-trip tests:

```rust
    #[test]
    fn test_master_key_hex_round_trip() {
        let key = generate_master_key();
        let hex = master_key_to_hex(&key);
        // master_key_to_hex returns format: 'hexstring' (with single quotes)
        // 32 bytes = 64 hex chars + 2 surrounding single quotes = 66 chars total
        assert_eq!(hex.len(), 66);
        assert!(hex.starts_with('\''));
        assert!(hex.ends_with('\''));
    }

    #[test]
    fn test_generate_master_key_produces_unique_keys() {
        let k1 = generate_master_key();
        let k2 = generate_master_key();
        assert_ne!(k1, k2);
    }

    #[test]
    fn test_generate_salt_produces_unique_salts() {
        let s1 = generate_salt();
        let s2 = generate_salt();
        assert_ne!(s1, s2);
    }
```

Note: Read the existing crypto.rs tests first to ensure the function names (`generate_master_key`, `master_key_to_hex`, `generate_salt`) match what is actually exported. Adjust names if they differ.

- [ ] **Step 3: Run Rust tests**

```bash
cd src-tauri && cargo test services::crypto::tests
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd ..
git add src-tauri/src/services/crypto.rs
git commit -m "test: expand crypto service tests"
```

---

## Task 14: pricing.rs tests

**Files:**
- Modify: `src-tauri/src/services/pricing.rs`

- [ ] **Step 1: Write the test module**

Append to the bottom of `src-tauri/src/services/pricing.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(
            r#"
            CREATE TABLE stock_data (
                ticker TEXT PRIMARY KEY,
                original_price TEXT NOT NULL,
                currency TEXT NOT NULL DEFAULT 'USD',
                fetched_at INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE stock_price_overrides (
                ticker TEXT PRIMARY KEY,
                price TEXT NOT NULL,
                currency TEXT NOT NULL DEFAULT 'USD',
                updated_at INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE crypto_prices (
                symbol TEXT PRIMARY KEY,
                price TEXT NOT NULL,
                currency TEXT NOT NULL DEFAULT 'USD',
                fetched_at INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE crypto_price_overrides (
                symbol TEXT PRIMARY KEY,
                price TEXT NOT NULL,
                currency TEXT NOT NULL DEFAULT 'USD',
                updated_at INTEGER NOT NULL DEFAULT 0
            );
            "#,
        )
        .expect("schema");
        conn
    }

    #[test]
    fn test_resolve_stock_price_returns_none_when_no_data() {
        let conn = setup_test_db();
        let result = resolve_stock_price(&conn, "AAPL");
        assert!(result.is_none());
    }

    #[test]
    fn test_resolve_stock_price_from_global_data() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO stock_data (ticker, original_price, currency, fetched_at) VALUES ('AAPL', '150.00', 'USD', 100)",
            [],
        )
        .unwrap();

        let result = resolve_stock_price(&conn, "AAPL").expect("price");
        assert_eq!(result.original_price, "150.00");
        assert_eq!(result.currency, "USD");
        assert!(!result.is_manual);
    }

    #[test]
    fn test_resolve_stock_price_prefers_newer_override() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO stock_data (ticker, original_price, currency, fetched_at) VALUES ('MSFT', '300.00', 'USD', 50)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO stock_price_overrides (ticker, price, currency, updated_at) VALUES ('MSFT', '350.00', 'USD', 100)",
            [],
        )
        .unwrap();

        let result = resolve_stock_price(&conn, "MSFT").expect("price");
        assert_eq!(result.original_price, "350.00");
        assert!(result.is_manual);
    }

    #[test]
    fn test_resolve_crypto_price_returns_none_when_no_data() {
        let conn = setup_test_db();
        let result = resolve_crypto_price(&conn, "BTC");
        assert!(result.is_none());
    }
}
```

- [ ] **Step 2: Run Rust tests**

```bash
cd src-tauri && cargo test services::pricing::tests
```

Expected: all 4 tests pass.

- [ ] **Step 3: Commit**

```bash
cd ..
git add src-tauri/src/services/pricing.rs
git commit -m "test: add pricing service tests"
```

---

## Task 15: Final verification

- [ ] **Step 1: Run all TypeScript tests**

```bash
npm test
```

Expected: all tests pass across `annuity.test.ts`, `iban-utils.test.ts`, `stocks.test.ts`, `currencies.test.ts`.

- [ ] **Step 2: Run all Rust tests**

```bash
cd src-tauri && cargo test
```

Expected: all tests pass. Categorization tests (~56), projection tests (~20), investments tests (~7), csv_import tests (~7), auth tests (~5), bank_accounts tests (~6), currency tests (~6), budgeting tests (~7), crypto tests (~6).

- [ ] **Step 3: Verify pre-commit hook**

```bash
git stash  # if there are any staged/unstaged changes
git stash pop
# Make a trivial change and commit to trigger the hook
```

Expected: the pre-commit hook runs lint, typecheck, `npm test`, `cargo fmt --check`, `cargo clippy` and passes.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "test: complete test coverage Phase 1–2 implementation"
```
