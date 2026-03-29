# Test Coverage Design

**Date:** 2026-03-29
**Goal:** Add systematic test coverage across Rust services and TypeScript utilities to catch regressions and make the codebase approachable for contributors.
**Approach:** Option A — Layered coverage (pure unit tests + service integration tests with in-memory SQLite)

---

## 1. Complete Test Audit

### Rust — Commands (`src-tauri/src/commands/`)

| File | Lines | Tests | Status |
|---|---|---|---|
| `projection.rs` | ~900 | 20 | ✅ Well covered (compound growth, FV annuity, savings projections) |
| `portfolio.rs` | 92KB | 0 | ⚠️ Out of scope — test via services instead |
| `bank_accounts.rs` | 38KB | 0 | ⚠️ Out of scope — test via services instead |
| `investments.rs` | 33KB | 0 | ⚠️ Out of scope — test via services instead |
| `auth.rs` | — | 0 | ⚠️ Out of scope — test via `services/auth.rs` |
| `categorization.rs` | — | 0 | ⚠️ Out of scope — test via categorization services |
| `budgeting.rs` | — | 0 | ⚠️ Out of scope — test via `services/budgeting.rs` |
| `crypto.rs` | — | 0 | ⚠️ Out of scope — test via services instead |
| All other command files | — | 0 | ⚠️ Out of scope — commands are thin wrappers |

**Policy:** Command handlers are NOT tested directly. They depend on Tauri state which requires a running app. Business logic lives in services — test there.

### Rust — Services (`src-tauri/src/services/`)

| File | Lines | Tests | Priority | TODO |
|---|---|---|---|---|
| `investments.rs` | 505 | 1 | 🔴 High | ~15 tests: gain/loss calc, cost basis, realized P&L, FIFO/LIFO, avg price |
| `csv_import.rs` | 591 | 1 | 🔴 High | ~10 tests: field parsing, date format variants, malformed rows, encoding |
| `auth.rs` | 571 | 0 | 🔴 High | ~8 tests: first-time setup, unlock with correct/wrong password, recovery key |
| `budgeting.rs` | 627 | 4 | 🟡 Medium | ~10 tests: period calc, overspend detection, goal progress (4 exist, expand) |
| `currency.rs` | 345 | 2 | 🟡 Medium | ~6 tests: conversion math, missing rate fallback, rounding (2 exist, expand) |
| `bank_accounts.rs` | 174 | 0 | 🟡 Medium | ~6 tests: balance calculation, transaction aggregation, running total |
| `pricing.rs` | 117 | 0 | 🟡 Medium | ~4 tests: price lookup, staleness logic, missing ticker fallback |
| `crypto.rs` | 300 | 3 | 🟡 Medium | ~6 tests: holding calc, avg buy price (3 exist, expand) |
| `date_parser.rs` | 487 | 10 | ✅ Good | Revisit after CSV import tests |
| `crypto_investments.rs` | — | 1 | 🟢 Low | ~3 tests: expand edge cases |
| `local_api.rs` | — | 0 | 🟢 Low | Skip — wraps external HTTP |
| `price_api.rs` | — | 0 | 🟢 Low | Skip — wraps external HTTP |

### Rust — Categorization (`src-tauri/src/services/categorization/`)

| File | Tests | Status |
|---|---|---|
| `tokenizer.rs` | 14 | ✅ Well covered |
| `exact_match.rs` | 12 | ✅ Well covered |
| `rules.rs` | 10 | ✅ Well covered |
| `engine.rs` | 7 | ✅ Well covered |
| `ml_classifier.rs` | 5 | ✅ Good |
| `default_rules.rs` | 3 | ✅ Acceptable |
| `types.rs` | 3 | ✅ Acceptable |
| `fio_scraper.rs` | 1 | 🟢 Low priority — expand if scraper changes |
| `training_data.rs` | 1 | 🟢 Low priority |

### TypeScript — Frontend (`src/`)

| File | Lines | Tests | Priority | TODO |
|---|---|---|---|---|
| `utils/annuity.ts` | 149 | 0 | 🔴 High | ~8 tests: monthly payment, total interest, edge cases (0% rate, 1 period) |
| `utils/stocks.ts` | 146 | 0 | 🔴 High | ~8 tests: return %, gain/loss, TWR calculation helpers |
| `utils/iban-utils.ts` | 68 | 0 | 🔴 High | ~6 tests: valid/invalid IBAN formats, extraction, Czech IBANs |
| `shared/currencies.ts` | 63 | 0 | 🟡 Medium | ~4 tests: currency lookup, symbol resolution, unknown code fallback |
| `lib/analytics.ts` | 109 | 0 | 🟡 Medium | ~4 tests: pure transformation functions |
| `lib/utils.ts` | 6 | 0 | 🟢 Low | Too trivial to test |
| `lib/tauri-api.ts` | 1065 | 0 | ⚠️ Skip — thin invoke wrappers, no logic |
| `shared/schema.ts` | 887 | 0 | ⚠️ Skip — type definitions only |
| `shared/generated-types.ts` | 353 | 0 | ⚠️ Skip — generated code |
| React components (`src/components/`) | — | 0 | 🟢 Out of scope for this phase |
| React hooks (`src/hooks/`) | — | 0 | 🟢 Out of scope for this phase |

---

## 2. TypeScript Testing Infrastructure

### Setup

Add to `package.json` devDependencies:
- `vitest`
- `@vitest/coverage-v8`

Add scripts to `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

Add test config block to `vite.config.ts`:
```ts
test: {
  globals: true,
  environment: 'node',
}
```

No DOM environment needed for this phase — pure utility functions only. Switch to `jsdom` if component tests are added later.

### Test file locations

Co-locate tests with source files:
- `src/utils/annuity.test.ts`
- `src/utils/stocks.test.ts`
- `src/utils/iban-utils.test.ts`
- `shared/currencies.test.ts`
- `src/lib/analytics.test.ts`

### Pre-commit hook

Add `npm test` to the existing Husky pre-commit hook so TypeScript tests gate every commit. Rust `cargo test` is left as a manual/CI step due to compile time.

---

## 3. Rust Test Harness

### Shared test helper module

Create `src-tauri/src/test_utils.rs` (gated with `#[cfg(test)]`):

```rust
#[cfg(test)]
pub mod test_utils {
    use crate::db::Database;

    /// Spin up a fresh in-memory SQLCipher DB with all migrations applied.
    pub fn setup_test_db() -> Database { ... }

    /// Seed a minimal valid user row.
    pub fn seed_user(db: &Database) { ... }

    /// Seed a bank account and return its id.
    pub fn seed_bank_account(db: &Database, user_id: i64) -> i64 { ... }

    /// Seed a bank transaction and return its id.
    pub fn seed_transaction(db: &Database, account_id: i64, amount: f64, date: &str) -> i64 { ... }

    // Add more seed helpers as needed per service
}
```

Each test calls `setup_test_db()` independently — no shared state between tests.

### Declare in lib.rs

```rust
#[cfg(test)]
mod test_utils;
```

### Test locations

Tests live in `#[cfg(test)]` modules at the bottom of each service file (consistent with existing pattern in `projection.rs` and `budgeting.rs`).

---

## 4. Prioritized TODO

### Phase 1 — Infrastructure (do first, unblocks everything)
- [ ] Add Vitest + `@vitest/coverage-v8` to `package.json`
- [ ] Configure `vite.config.ts` test block
- [ ] Add `test`, `test:watch`, `test:coverage` scripts
- [ ] Add `npm test` to Husky pre-commit hook
- [ ] Create `src-tauri/src/test_utils.rs` with `setup_test_db()` and core seed helpers

### Phase 2 — High priority tests
- [ ] `src/utils/annuity.test.ts` (~8 tests)
- [ ] `src/utils/stocks.test.ts` (~8 tests)
- [ ] `src/utils/iban-utils.test.ts` (~6 tests)
- [ ] `services/investments.rs` tests (~15 tests, needs test DB harness)
- [ ] `services/auth.rs` tests (~8 tests, needs test DB harness)
- [ ] `services/csv_import.rs` tests (~10 tests, needs test DB harness)

### Phase 3 — Medium priority tests
- [ ] `shared/currencies.test.ts` (~4 tests)
- [ ] `src/lib/analytics.test.ts` (~4 tests)
- [ ] `services/budgeting.rs` — expand from 4 to ~10 tests
- [ ] `services/currency.rs` — expand from 2 to ~6 tests
- [ ] `services/bank_accounts.rs` (~6 tests)
- [ ] `services/pricing.rs` (~4 tests)
- [ ] `services/crypto.rs` — expand from 3 to ~6 tests

### Phase 4 — Low priority / future
- [ ] `services/crypto_investments.rs` — expand edge cases
- [ ] React component tests (separate initiative, requires `jsdom`)
- [ ] CI integration (`cargo test` + `npm test` in GitHub Actions)

---

## 5. Test Policy for Claude & Contributors

This policy is also added to `CLAUDE.md`.

### When to run tests

- Before claiming any task complete, run `npm test` (TypeScript) and `cargo test` (Rust) and verify they pass
- When modifying a file that has a corresponding test file, run the relevant suite before and after the change
- When adding new business logic to a service, add at least one test covering the happy path before the task is done

### When to write new tests

- Any new pure function in `src/utils/`, `src/lib/`, or `shared/` must have tests alongside it
- Any new Rust service function with non-trivial logic (calculations, parsing, state transitions) must have at least a happy-path test and one error/edge case
- Bug fixes in tested code must include a regression test that fails before the fix and passes after

### What to test vs. skip

- **Test:** Pure utility functions, Rust service functions with business logic
- **Skip:** Tauri command handlers (require a running app), React components (out of scope for now), generated types, thin invoke wrappers
- **Use the Rust test DB harness** (`setup_test_db()`) for any service function that touches SQLite — do not mock the database

### What Claude must NOT do

- Write tests for Tauri command handlers
- Write React component tests unless explicitly asked
- Add tests for `shared/generated-types.ts`
- Say "I'll add tests later" — tests are part of the definition of done for new logic
