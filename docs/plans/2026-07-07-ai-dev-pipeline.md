# AI Development Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the consolidated AI-agent rulebook (docs tree, standards, playbooks, ADRs, thin CLAUDE.md), realign quality gates (tiered git hooks, CI), and clean up contradictory docs — per `docs/specs/2026-07-07-ai-dev-pipeline-design.md`.

**Architecture:** Docs + tooling config only (spec D1) — zero app source changes. Gate config lands first so later doc commits enjoy the fast pre-commit hook. Every doc task ends with grep-verifiable checks instead of unit tests. Facts baked into this plan come from the 2026-07-07 7-agent exploration; executors must not re-derive them.

**Tech Stack:** Markdown, Husky v9, lint-staged, GitHub Actions, npm scripts.

**Ground rules for every task (from spec §4 — violating these is task failure):**
- Do NOT modify any file under `src/`, `src-tauri/src/`, or `shared/` (except `git mv` of docs and README/CONTRIBUTING edits listed here).
- Do NOT refactor code, add tests, delete dead code, or "fix" violations you notice — phase 2 only reports them.
- Do NOT touch `.vscode/settings.json` (has unrelated uncommitted user edits) or `package-lock.json` beyond what `npm install -D lint-staged` produces.
- Commit after each task with the exact message given. All commits end with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: package.json — honest test script, aligned lint budget, lint-staged

**Files:**
- Modify: `package.json` (scripts block, lines 6–20; add lint-staged config + devDependency)

- [ ] **Step 1: Install lint-staged**

Run: `npm install -D lint-staged`
Expected: added to `devDependencies`, `package-lock.json` updated, exit 0.

- [ ] **Step 2: Edit the scripts block**

Change exactly these three scripts (leave all others untouched):

```json
"lint": "eslint . --max-warnings 120",
"lint:fix": "eslint . --fix",
"test": "vitest run",
```

(`lint` gains the budget CI previously appended ad hoc — local and CI now identical, per spec §3.3. `test` drops `--passWithNoTests` — an empty suite must fail, per spec finding "deleting every test file stays green".)

- [ ] **Step 3: Add lint-staged config**

Add as a top-level key in `package.json` (after `"scripts"`):

```json
"lint-staged": {
  "src/**/*.{ts,tsx}": [
    "prettier --write",
    "eslint --fix --max-warnings 0"
  ],
  "src/**/*.css": [
    "prettier --write"
  ]
}
```

Scope note: patterns mirror the existing `format` glob (`src/**/*.{ts,tsx,css}`) on purpose — `shared/` and root configs have never been Prettier-formatted; widening the glob would reformat source files, which spec D1 forbids. `--max-warnings 0` applies only to *newly staged* files, so new code can't add warnings while the repo-wide budget stays 120.

- [ ] **Step 4: Verify**

Run: `npm run lint && npm test && npx lint-staged --help >/dev/null && node -e "JSON.parse(require('fs').readFileSync('package.json'))" && echo OK`
Expected: lint passes (50 warnings < 120), 79 tests pass, `OK` printed.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: align lint budget, drop passWithNoTests, add lint-staged"
```

(Old slow pre-commit still runs here — last slow commit.)

---

### Task 2: Tiered git hooks (spec D10)

**Files:**
- Modify: `.husky/pre-commit` (replace entire content)
- Create: `.husky/pre-push`

- [ ] **Step 1: Replace `.husky/pre-commit`** with exactly:

```sh
# Fast tier (<10s): staged-file lint/format, typecheck, Rust format.
# Heavy checks (tests, clippy) run in .husky/pre-push and CI.
npx lint-staged
npm run typecheck

cd src-tauri
cargo fmt --check
```

- [ ] **Step 2: Create `.husky/pre-push`** with exactly:

```sh
# Heavy tier: full test suites + clippy, once per push (see docs/standards/workflow.md).
npm test

cd src-tauri
cargo clippy -- -D warnings
cargo test
```

- [ ] **Step 3: Make it executable**

Run: `chmod +x .husky/pre-push && ls -l .husky/`
Expected: both hooks present, `-rwxr-xr-x`.

- [ ] **Step 4: Verify hook speed with a throwaway commit**

```bash
git add .husky/pre-commit .husky/pre-push
time git commit -m "build: tier git hooks — fast pre-commit, heavy pre-push

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Expected: commit succeeds; `time` shows total under ~15s (lint-staged skips — no staged src files; typecheck ~5s; cargo fmt ~1s, no compilation). If it exceeds 30s something regressed — investigate before proceeding.

---

### Task 3: CI realignment

**Files:**
- Modify: `.github/workflows/ci.yml` (lines 10–31 frontend job, line 28 lint step)
- Modify: `.github/workflows/dependency-check.yml` (lines 18, 21 action versions)

- [ ] **Step 1: Update the frontend job in `ci.yml`**

Rename job `lint-and-typecheck` → `frontend` (name: `Frontend`), change the ESLint step to use the script's own budget, and append format + test steps. The job's steps become:

```yaml
      - name: Checkout repository
        uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: TypeScript type check
        run: npm run typecheck

      - name: Prettier format check
        run: npm run format:check

      - name: Frontend tests
        run: npm test
```

(Fixes spec finding: "CI never runs the frontend test suite". Rust job stays untouched — it already runs fmt/clippy/audit/test/generated-types gate.)

- [ ] **Step 2: Align action versions in `dependency-check.yml`**

Line 18: `actions/checkout@v4` → `actions/checkout@v6`. Line 21: `actions/setup-node@v4` → `actions/setup-node@v6`. Nothing else.

- [ ] **Step 3: Verify YAML parses**

Run: `python3 -c "import yaml,sys; [yaml.safe_load(open(f)) for f in ['.github/workflows/ci.yml','.github/workflows/dependency-check.yml']]; print('OK')"`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/dependency-check.yml
git commit -m "ci: run frontend tests and format check, align lint budget and action versions"
```

---

### Task 4: Fix stale paths in .claude settings

**Files:**
- Modify: `.claude/settings.json` (replace entire content)
- Modify: `.claude/settings.local.json` (gitignored — local edit only)

- [ ] **Step 1: Replace `.claude/settings.json`** with exactly:

```json
{
  "permissions": {
    "allow": [
      "Read(//Users/<user>/.cargo/registry/src/**)",
      "Bash(cargo check)",
      "Bash(gtimeout 15 npm run dev)",
      "Bash(pkill -f \"cargo\")"
    ]
  }
}
```

(Preserves the two useful uncommitted additions; drops the one-off grep permission and `additionalDirectories`, both hard-coded to the repo's old `/Users/<user>/Documents/…` location.)

- [ ] **Step 2: Clean `settings.local.json`**

Remove every `allow` entry whose string contains `/Documents/Programování/` (old repo location — dead permissions). Keep everything else byte-identical. Verify with:

Run: `grep -c "Documents/Programov" .claude/settings.local.json || echo CLEAN`
Expected: `CLEAN`.

- [ ] **Step 3: Commit** (settings.local.json is gitignored; only settings.json commits)

```bash
git add .claude/settings.json
git commit -m "chore: drop stale old-repo-path permissions from claude settings"
```

---

### Task 5: Consolidate specs/plans into docs/specs + docs/plans (spec D5)

**Files:**
- Move: `docs/superpowers/specs/*.md` (6 files) → `docs/specs/`, `docs/superpowers/plans/*.md` (6 files) → `docs/plans/`
- Create: `docs/specs/README.md`, `docs/plans/README.md`

- [ ] **Step 1: Move with history**

```bash
git mv docs/superpowers/specs/2026-03-29-test-coverage-design.md docs/superpowers/specs/2026-04-03-stock-twr-chart-design.md docs/superpowers/specs/2026-04-10-empty-states-design.md docs/superpowers/specs/2026-04-10-form-unification-design.md docs/superpowers/specs/2026-04-10-mcp-ux-improvements-design.md docs/superpowers/specs/2026-04-11-stocks-csv-import-ux-design.md docs/specs/
git mv docs/superpowers/plans/2026-03-29-test-coverage.md docs/superpowers/plans/2026-04-03-stock-twr-chart.md docs/superpowers/plans/2026-04-10-empty-states.md docs/superpowers/plans/2026-04-10-form-unification.md docs/superpowers/plans/2026-04-10-mcp-ux-improvements.md docs/superpowers/plans/2026-04-11-stocks-csv-import-ux.md docs/plans/
rmdir docs/superpowers/specs docs/superpowers/plans docs/superpowers
```

- [ ] **Step 2: Create `docs/specs/README.md`** with exactly:

```markdown
# Design Specs

Design documents for features, one per feature, named `YYYY-MM-DD-<topic>-design.md`.

> **⚠️ Point-in-time snapshots.** A spec describes the design *as approved on its date*. It is
> not maintained afterward and must not be treated as current documentation of the codebase.
> For current rules see `docs/standards/`; for current architecture see `docs/architecture/`.

New specs (superpowers brainstorming output) go in this directory — this location is the
project preference and overrides any skill default.
```

- [ ] **Step 3: Create `docs/plans/README.md`** with exactly:

```markdown
# Implementation Plans

Implementation plans, one per feature, named `YYYY-MM-DD-<topic>.md`. Each pairs with a
spec in `docs/specs/`.

> **⚠️ Point-in-time snapshots.** A plan is frozen once executed. File paths, line numbers,
> and code excerpts inside describe the codebase *as of the plan date* and rot afterward.
> Never follow an old plan's instructions for new work — consult `docs/standards/` and
> `docs/playbooks/` instead.

New plans (superpowers writing-plans output) go in this directory — this location is the
project preference and overrides any skill default.
```

- [ ] **Step 4: Verify**

Run: `ls docs/specs | wc -l && ls docs/plans | wc -l && test ! -d docs/superpowers && echo GONE`
Expected: `9` (6 moved + multicurrency + this pipeline spec + README), `9` (6 moved + multicurrency + this plan + README), `GONE`.

- [ ] **Step 5: Commit**

```bash
git add -A docs/
git commit -m "docs: consolidate specs and plans into docs/specs and docs/plans (spec D5)"
```

---

### Task 6: docs/architecture/overview.md

**Files:**
- Create: `docs/architecture/overview.md`

- [ ] **Step 1: Write the file.** Required content (all facts verified 2026-07-07; write as clean markdown with these sections):

**Stack:** Tauri 2 (Rust backend, ~31k lines, 206 `#[tauri::command]` handlers in 19 files under `src-tauri/src/commands/`) + React 18/TypeScript (~39k lines, 208 files) + SQLCipher-encrypted SQLite (37 append-only migrations in `src-tauri/src/db/migrations.rs`, ~51 tables). wouter routing, TanStack React Query (server state; no Redux/Zustand), shadcn/ui (new-york) + Tailwind, react-i18next (en/cs, 17 namespaces), sonner toasts.

**The sacred data flow** (diagram):
```
UI component (src/pages/, src/components/<domain>/)
  → hook: src/hooks/use-<domain>.ts (useQuery) + use-<domain>-mutations.ts (useMutation)
    → src/lib/tauri-api.ts — <domain>Api namespace (the ONLY place invoke() is called)
      → #[tauri::command] in src-tauri/src/commands/<domain>.rs (thin)
        → business logic in src-tauri/src/services/<domain>.rs (takes &Connection)
          → SQLCipher SQLite
```

**Canonical examples to copy** (explicit section — agents copy these, never the outliers):
- Thin command + service + tests: `src-tauri/src/commands/budgeting.rs` (63 lines) + `src-tauri/src/services/budgeting.rs` (686 lines, `#[cfg(test)]` at bottom).
- Minimal CRUD domain: `src-tauri/src/commands/bonds.rs` (122 lines) + `src/hooks/use-bonds.ts` + `use-bond-mutations.ts`.
- Mutation hook with correct cache invalidation + snapshot: `src/hooks/use-bank-account-mutations.ts`.
- Dialog/form page pattern: `src/pages/Accounts.tsx` (lifted dialog state) with react-hook-form + zodResolver.

**Domain map table** — columns: Domain | Tables | Rust | Frontend. One row per domain with these exact values: auth/profile (`app_config`, `user_profile` | `commands/auth.rs` + `services/auth.rs` | `use-auth.tsx`, `auth-page.tsx`, `Settings.tsx`); bank accounts (`institutions`, `bank_accounts`, `bank_account_zones`, `bank_transactions`, `csv_import_presets`, `csv_import_batches` | `commands/bank_accounts.rs` + `services/{bank_accounts,csv_import,date_parser}.rs` | `BankAccounts.tsx`, `BankAccountDetail.tsx`, `use-bank-account*.ts`, `components/bank-accounts/`); categorization (`transaction_categories`, `categorization_rules`, `learned_payees` | `commands/categorization.rs` + `services/categorization/` (10 files) | `CategorizationRules.tsx`, `useCategorization.ts`); budgeting (`budget_goals` | `commands/budgeting.rs` + `services/budgeting.rs` | `Budgeting.tsx`, `components/budgeting/`); stocks (`stock_investments`, `investment_transactions`, `stock_data`, `stock_price_overrides`, `dividend_data`, `dividend_overrides`, `stock_value_history`, `stock_tags`, `stock_investment_tags`, `stock_tag_groups` | `commands/{investments,stock_tags,price_api}.rs` + `services/{investments,price_api,pricing}.rs` | `Stocks.tsx`, `StockDetail.tsx`, `StocksAnalysis.tsx`, `components/stocks/`); crypto (`crypto_investments`, `crypto_transactions`, `crypto_prices`, `crypto_price_overrides`, `crypto_value_history` | `commands/crypto.rs` + `services/{crypto,crypto_investments}.rs` | `Crypto.tsx`, `CryptoDetail.tsx`); bonds (`bonds` | `commands/bonds.rs` | `Bonds.tsx`, `use-bond*.ts`); loans (`loans` | `commands/loans.rs` | `Loans.tsx`, `AnnuityCalculator.tsx`, `src/utils/annuity.ts`); real estate (`real_estate` + 6 child tables | `commands/real_estate.rs` | `RealEstate*.tsx`, `EstateCalculator.tsx`, `components/real-estate/`); insurance (`insurance_policies`, `insurance_documents` | `commands/insurance.rs` | `Insurance*.tsx`); other assets (`other_assets`, `other_asset_transactions`, `entity_history` | `commands/other_assets.rs` | `OtherAssets.tsx`); portfolio/net-worth (`portfolio_metrics_history`, `entity_history`, `stock_value_history`, `crypto_value_history` | `commands/portfolio.rs` (also currently hosts exchange-rate commands at lines ~518–560) | `Dashboard.tsx`, `SyncProvider.tsx`, `PortfolioValueTrendChart.tsx`, `shared/calculations/`); currency (`exchange_rates`, `exchange_rate_history` | commands inside `portfolio.rs` + `services/currency.rs` (ECB) | `src/lib/currency.tsx`, `shared/currencies.ts`); cashflow/projection (`cashflow_items`, `projection_settings` | `commands/cashflow.rs`, `commands/projection.rs` | `Cashflow.tsx`, `Projection.tsx`); export/local API (`commands/export.rs`; `services/local_api.rs` — optional token-gated axum HTTP/MCP server, off by default, enabled via `user_profile.mcp_server_enabled`).

**Bootstrap & auth:** provider nesting from `src/App.tsx` (QueryClientProvider → ThemeProvider → AuthProvider → I18nProvider → CurrencyProvider → SyncProvider → TooltipProvider → ErrorBoundary → SidebarProvider → Router); auth states `needs_setup | locked | unlocked`; `SyncProvider` runs portfolio backfill 15s after unlock then invalidates caches.

**Known structural debt** (link, don't fix): fat command files (`portfolio.rs` 2,863 lines, `projection.rs` 1,171, `real_estate.rs` 1,037, `cashflow.rs` 896) hold logic that belongs in services — see `docs/DEPRECATED.md` and the current audit in `docs/audits/`.

- [ ] **Step 2: Verify**

Run: `grep -c "budgeting" docs/architecture/overview.md` (≥3) and `grep -n "portfolio.rs" docs/architecture/overview.md` (present).

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/overview.md
git commit -m "docs: add architecture overview with domain map and canonical examples"
```

---

### Task 7: docs/architecture/database.md

**Files:**
- Create: `docs/architecture/database.md`
- Read (source material): `src-tauri/src/db/migrations.rs`

- [ ] **Step 1: Derive the table catalog.** Read `src-tauri/src/db/migrations.rs` (1,189 lines, MIGRATION_001–037) and produce a table-by-domain reference. For each table: name, purpose (one line), owning domain, and notable columns/constraints. Group by the domains from Task 6's map.

- [ ] **Step 2: Write the file** with sections:

1. **How migrations work:** append-only inline SQL consts in `migrations.rs`; add `const MIGRATION_038: &str = r#"..."#;` + a `("038_short_name", MIGRATION_038)` entry in the Vec in `run_migrations()`; tracked in `_migrations`; run automatically on DB open; never edit an applied migration; SQLite ALTER limitations handled via create-new/copy/drop/rename (cite migrations 027, 028, 031 as examples); note the historical out-of-band repair at `migrations.rs:80-94` as a cautionary tale, not a pattern.
2. **Storage conventions:** TEXT UUID primary keys (`Uuid::new_v4().to_string()`; system-seeded rows use readable prefixes like `cat_groceries`, `inst_fio`); INTEGER unix-epoch timestamps with `DEFAULT (unixepoch())`; **all money/decimal values are TEXT strings** (exception: `exchange_rates.rate` / `exchange_rate_history.rate` are REAL); CZK is the base currency; per-currency breakdowns are JSON strings in TEXT columns (`portfolio_metrics_history.*_by_currency DEFAULT '{}'`); paired override tables (`stock_data`+`stock_price_overrides`, `crypto_prices`+`crypto_price_overrides`, `dividend_data`+`dividend_overrides`); history tables use `(date, key)` UNIQUE constraints.
3. **Table catalog** from Step 1.
4. **⚠️ Deprecated tables — never write features against these:** `savings_accounts`, `savings_account_zones` (superseded by `bank_accounts` in migration 015), `instruments`, `purchases` (legacy, superseded by `stock_investments`), `transaction_rules` (superseded by `categorization_rules`, migration 021).

- [ ] **Step 3: Verify**

Run: `grep -c "CREATE TABLE" src-tauri/src/db/migrations.rs` and confirm the catalog covers every non-deprecated table (spot-check 5 random ones). Run `grep -n "savings_accounts" docs/architecture/database.md` — must appear under Deprecated.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/database.md
git commit -m "docs: add database schema reference with deprecated-table registry"
```

---

### Task 8: ADRs

**Files:**
- Create: `docs/architecture/decisions/README.md` and five ADRs `0001`–`0005`

- [ ] **Step 1: Create `README.md`** — index table (number, title, date, status) + template: sections `Status` (Accepted), `Context`, `Decision`, `Consequences`. State the rule: ADRs are immutable; superseding requires a new ADR linking back.

- [ ] **Step 2: Write the five ADRs** (each ≤1 page, dated 2026-07-07, status Accepted; content sourced from spec §2):

- `0001-czk-base-currency-and-money-as-text.md` — CZK is the internal base; all monetary values stored as TEXT to avoid float drift; conversion at display time via ECB rates (`services/currency.rs`, `shared/currencies.ts`); consequence: parsing with `.parse().unwrap_or(0.0)` silently zero-coerces — flagged for audit.
- `0002-schema-ts-is-the-wire-contract.md` — `shared/schema.ts` (hand-written, imported by ~70 files) is canonical (D7). `shared/generated-types.ts` (specta output, imported by nothing) is a drift detector only; regenerate with `cd src-tauri && cargo test generate_bindings -- --ignored`; CI diffs it. `shared/types/extended-types.ts` is deprecated. Full codegen migration (tauri-specta) is explicitly deferred — record as "reconsider when".
- `0003-tiered-ai-workflow.md` — D2 + D10. Tier definitions: **feature** (new command/table/page/domain, or >~150 lines) → full superpowers flow (brainstorm → spec in `docs/specs/` → plan in `docs/plans/` → TDD → code review → verification); **small fix** (bug fix, copy change, config tweak) → TDD + gates + verification, no spec/plan. Gates: fast pre-commit / heavy pre-push / authoritative CI.
- `0004-local-api-token-gated-writes.md` — D6: the local HTTP/MCP server (`services/local_api.rs`) intentionally exposes write endpoints (e.g. `POST /insurance`); protection = off-by-default + bearer token; README must describe it honestly (Task 15); consequence: every new write endpoint must be listed in README's API section.
- `0005-yahoo-finance-for-prices.md` — Yahoo Finance replaced Marketstack for stock quotes (`services/price_api.rs`); rationale: free tier limits; consequence: unofficial API, breakage risk accepted, manual override tables exist as fallback.

- [ ] **Step 3: Verify**

Run: `ls docs/architecture/decisions/ | wc -l` → `6`. Grep each ADR for `## Status`, `## Context`, `## Decision`, `## Consequences` — all four present in all five.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/decisions/
git commit -m "docs: backfill five ADRs and decision template"
```

---

### Task 9: docs/standards — rust-backend.md, type-contract.md, testing.md

**Files:**
- Create: `docs/standards/rust-backend.md`, `docs/standards/type-contract.md`, `docs/standards/testing.md`

- [ ] **Step 1: `rust-backend.md`.** Rules (each with a one-line why + a pointer to a real example):

1. Commands are thin: `#[tauri::command] pub async fn` validates input, delegates to `src-tauri/src/services/<domain>.rs` functions taking `&Connection`, maps results. Canonical: `commands/budgeting.rs`. Anti-example (do not copy): `commands/portfolio.rs`.
2. Errors: always `crate::error::AppError` (serializes to string over IPC); `Err(AppError::NotFound)` when UPDATE/DELETE affects 0 rows; **never** `Result<_, String>` (`commands/categorization.rs` is a known violation, not a pattern).
3. Validation at the trust boundary: every `Insert*` struct implements `validate() -> Result<(), AppError>` returning `AppError::Validation` with i18n keys (e.g. `"validation.bondNameRequired"`); commands call `data.validate()?` before any DB work; never trust frontend data.
4. No `.unwrap()` outside `#[cfg(test)]`; use `?` or `.expect("reason")`. Beware `.parse().unwrap_or(0.0)` on money strings — silently zero-coerces; prefer propagating a parse error.
5. DB access: `db: State<'_, Database>` + `db.with_conn(|conn| ...)` in commands; services take plain `&Connection` (keeps them testable).
6. Registration (3 manual points, all required): function in `commands/<domain>.rs` → module in `commands/mod.rs` → entry in `tauri::generate_handler![]` in `src-tauri/src/lib.rs` (grouped by domain comment). A missed lib.rs entry fails only at runtime.
7. Serde: derive `Serialize, Deserialize, specta::Type`; per-field `#[serde(rename = "camelCase")]` (project style — 334 existing per-field renames; do not switch to `rename_all`). A forgotten rename silently ships snake_case to the frontend.
8. Shared state via Tauri managed state + `Arc` (example: `CategorizationState`, `commands/categorization.rs:21`); CPU-heavy work in `tauri::async_runtime::spawn_blocking`; logging via `println!` with bracketed prefixes (`[MIGRATION]`, `[DB]`).
9. Migrations: per `docs/architecture/database.md` — append-only, next number, never edit applied ones.

- [ ] **Step 2: `type-contract.md`.** Open with the ruling (ADR 0002): schema.ts is canonical, generated-types.ts is the drift detector. Then **the 7-step procedure for adding/changing a command** (numbered, no step optional):

1. Write the `#[tauri::command]` in `src-tauri/src/commands/<domain>.rs` (per rust-backend.md).
2. Declare new module in `commands/mod.rs` if it's a new file.
3. Add to `generate_handler![]` in `src-tauri/src/lib.rs`.
4. New/changed structs in `src-tauri/src/models/<domain>.rs`: derive `specta::Type`, per-field camelCase renames.
5. Register the type in `collect_types()` in `src-tauri/src/bindings.rs`; run `cd src-tauri && cargo test generate_bindings -- --ignored`; commit the regenerated `shared/generated-types.ts` (CI diffs it — an out-of-sync file fails the build).
6. Hand-mirror the type into `shared/schema.ts` — this is what the frontend imports. Field names camelCase; money fields are `string` (they are TEXT on the wire — e.g. `currentPrice: string`, never `number`).
7. Add the typed wrapper in `src/lib/tauri-api.ts` under the domain's `*Api` namespace: snake_case command-name string, camelCase args object, return type imported from `@shared/schema`.

Close with **drift rules:** never add a field on one side only; never widen a type in schema.ts beyond what Rust serializes; `extended-types.ts` and inline interfaces in tauri-api.ts are deprecated (see DEPRECATED.md); if schema.ts and Rust disagree, Rust is the truth and schema.ts is the bug.

- [ ] **Step 3: `testing.md`.** Reproduce CLAUDE.md's current policy (when to run, what to test/skip, the in-memory `rusqlite::Connection` pattern with the `services/budgeting.rs:458` example, no `Database` struct in tests, Vitest is node-env — **no jsdom, no component/hook tests; do not change the test environment**) plus the spec §3.2 amendment, stated exactly:

> Command handlers are exempt from testing **only while they are thin** (validate → delegate → map). Business logic living in a command file (calculations, aggregation, multi-step SQL transactions) counts as service logic: when you touch it, either move it to `src-tauri/src/services/` (with tests) or add `#[cfg(test)]` tests in place. "It's in commands/" is not an exemption for logic.

Also: bug fixes require a regression test that fails before/passes after; new pure functions in `src/utils/`, `src/lib/`, `shared/` require co-located `.test.ts`; note that coverage thresholds are a planned gate, blocked on the `shared/calculations/` backlog item (see audit), not yet enforced.

- [ ] **Step 4: Verify**

Run: `grep -n "AppError" docs/standards/rust-backend.md | head -3` (present); `grep -c "schema.ts" docs/standards/type-contract.md` (≥5); `grep -n "only while they are thin" docs/standards/testing.md` (present).

- [ ] **Step 5: Commit**

```bash
git add docs/standards/
git commit -m "docs: add rust, type-contract, and testing standards"
```

---

### Task 10: docs/standards — typescript-frontend.md, i18n.md, workflow.md

**Files:**
- Create: `docs/standards/typescript-frontend.md`, `docs/standards/i18n.md`, `docs/standards/workflow.md`

- [ ] **Step 1: `typescript-frontend.md`.** Rules:

1. Never call `invoke()` outside `src/lib/tauri-api.ts`; components/hooks import the `*Api` namespaces.
2. File layout: pages = PascalCase default exports in `src/pages/`, registered in `src/App.tsx` inside `<ProtectedRoute>` (wouter `Switch`; only `/auth` is public); components = named exports in `src/components/<domain>/`; hooks = kebab-case `use-<domain>.ts` (reads) + `use-<domain>-mutations.ts` (writes) — `useCategorization.ts` is the legacy naming outlier, don't copy it. Aliases `@/` → src, `@shared` → shared.
3. React Query: kebab-case array keys (`["bank-accounts"]`, `["bank-account", id]`); global defaults are `staleTime: Infinity, retry: false` (`src/lib/queryClient.ts`) — opt into freshness explicitly. **Mutation contract:** invalidate the domain key(s) + `["portfolio-metrics"]` + `["cashflow-report"]`, then `await portfolioApi.recordSnapshot()` and invalidate `["portfolio-history"]`. Reference: `src/hooks/use-bank-account-mutations.ts`. Put mutations in dedicated hook files, not inline in modals (inline `useMutation` in stocks/crypto/real-estate components is legacy debt, not a pattern).
4. Forms: react-hook-form + `zodResolver` + shadcn `Form`/`FormField`; zod messages are i18n keys. Dialogs: shadcn `Dialog`/`AlertDialog`, open-state lifted to the page (`addDialogOpen`/`editDialogOpen`/`deleteDialogOpen` + `selectedItem` — see `src/pages/Accounts.tsx`).
5. Styling: Tailwind utilities with semantic tokens only (`bg-background`, `text-muted-foreground`, `positive`/`negative` for gains/losses); `cn()` from `@/lib/utils`; no inline hex colors; charts = recharts. `src/components/ui/` is vendored shadcn — ESLint-excluded; never hand-edit casually.
6. Errors/toasts: sonner + `translateApiError` (`src/lib/translate-api-error.ts`) for backend error keys.
7. Event listeners: every Tauri `listen()` gets its `unlisten()` in useEffect cleanup.
8. Currency: convert via `convertToCzK` from `@shared/currencies`; format via `formatCurrency`/`formatCurrencyShort` from `useCurrency()`; queries needing rates key on `ratesTimestamp` (see `src/pages/Dashboard.tsx:64`).

- [ ] **Step 2: `i18n.md`.** Every user-facing string in BOTH `src/i18n/locales/en/<ns>.json` AND `cs/<ns>.json` — fallbackLng masks missing Czech, so en-only strings pass silently and rot the cs locale; new namespaces also registered in `src/i18n/index.ts`; pattern: `useTranslation('<domain>')` + `const { t: tc } = useTranslation('common')`; backend `AppError::Validation` carries i18n keys mapped by `translate-api-error.ts`; verification: `node -e` JSON-parse both files + eyeball key parity for the namespace touched.

- [ ] **Step 3: `workflow.md`.** Content:

1. **Tiers (ADR 0003):** table — trigger, required stages. Feature (new command/table/page/domain or >~150 lines): brainstorm → spec (`docs/specs/YYYY-MM-DD-<topic>-design.md`) → plan (`docs/plans/YYYY-MM-DD-<topic>.md`) → TDD → code review → verification-before-completion. Small fix: TDD + gates + verification. When unsure, ask the user which tier.
2. **Gates:** pre-commit (lint-staged + typecheck + cargo fmt, <10s) at every commit; pre-push (npm test + clippy + cargo test) at push; CI (everything + generated-types drift + cargo audit) authoritative. `--no-verify` is an emergency hatch, never a habit; anything skipped locally must still pass CI.
3. **Commits:** Conventional Commits (`feat:`/`fix:`/`docs:`/`chore:`/`build:`/`ci:`/`test:`/`refactor:`); small and frequent; trunk-based on `main`.
4. **Definition of done:** gates green (`npm run lint && npm run typecheck && npm test`, `cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && cargo test`), tests per `testing.md`, both locales updated, docs updated if behavior changed (README for features, `database.md` for tables, ADR for decisions).
5. **Doc freshness rules:** specs/plans are frozen snapshots (see their READMEs); standards/architecture/ADRs are living docs — update them in the same PR/commit that invalidates them; never state file sizes/line numbers in living docs (they rot — name files by role instead).

- [ ] **Step 4: Verify**

Run: `grep -n "recordSnapshot" docs/standards/typescript-frontend.md` (present); `grep -n "fallbackLng" docs/standards/i18n.md` (present); `grep -n "no-verify" docs/standards/workflow.md` (present).

- [ ] **Step 5: Commit**

```bash
git add docs/standards/
git commit -m "docs: add frontend, i18n, and workflow standards"
```

---

### Task 11: docs/playbooks — four step-by-step checklists

**Files:**
- Create: `docs/playbooks/add-tauri-command.md`, `add-db-migration.md`, `add-asset-domain.md`, `add-frontend-page.md`

Each playbook is a numbered checklist an agent executes top-to-bottom, every item concrete (exact file, exact action), ending with a **Verify** section listing the commands to run. They restate no rationale — they link to the standard that owns it.

- [ ] **Step 1: `add-tauri-command.md`** — the 7 steps from `type-contract.md` expanded to checklist form, plus: write the service function first (TDD: failing test in the service's `#[cfg(test)]`), then the command wrapper; Verify: `cd src-tauri && cargo test && cargo clippy -- -D warnings`, `cargo test generate_bindings -- --ignored`, `git diff --exit-code shared/generated-types.ts`, `npm run typecheck`.

- [ ] **Step 2: `add-db-migration.md`** — read current max migration number in `src-tauri/src/db/migrations.rs`; add `const MIGRATION_0NN` + Vec entry; follow storage conventions (link `database.md` §2); if altering columns use create-new/copy/drop/rename; update `docs/architecture/database.md` catalog in the same commit; Verify: `cargo test` (migrations run against in-memory DBs in service tests) + launch app once if schema-affecting.

- [ ] **Step 3: `add-asset-domain.md`** — the full checklist for a new asset class, in order: migration (playbook 2) → `models/<domain>.rs` with `Insert*` + `validate()` → `services/<domain>.rs` with tests → `commands/<domain>.rs` thin wrappers → `mod.rs` + `lib.rs` registration → bindings + regenerate → `shared/schema.ts` mirror → `tauri-api.ts` namespace → `use-<domain>.ts` + `use-<domain>-mutations.ts` (full mutation contract incl. `recordSnapshot`) → page + `App.tsx` route → `components/<domain>/` → i18n namespace en+cs + `index.ts` → **portfolio integration:** net-worth inclusion requires touching `commands/portfolio.rs` metrics + `portfolio_metrics_history` total/`*_by_currency` columns + backfill (link ADR 0001, `database.md`) → README feature list. Verify: full gate suite + manual app run.

- [ ] **Step 4: `add-frontend-page.md`** — page file (PascalCase, default export) → route in `src/App.tsx` under `<ProtectedRoute>` → sidebar entry (find nav component via `grep -r "Bonds" src/components` for the sidebar list) → hooks per standards → i18n namespace → Verify: `npm run lint && npm run typecheck && npm test` + visual check.

- [ ] **Step 5: Verify + commit**

Run: `ls docs/playbooks/ | wc -l` → `4`; each file ends with a `## Verify` section (`grep -l "## Verify" docs/playbooks/*.md | wc -l` → `4`).

```bash
git add docs/playbooks/
git commit -m "docs: add four agent playbooks with verification checklists"
```

---

### Task 12: docs/DEPRECATED.md

**Files:**
- Create: `docs/DEPRECATED.md`

- [ ] **Step 1: Write the registry.** Header: "Things that exist in this repo but must never be copied, extended, or used as examples. Before reusing any pattern, check this list. Removal is tracked in `docs/audits/`." Entries (grouped, each with path + why + what to use instead):

**Dead frontend code:** `src/hooks/use-finance-data.ts` (Express-era `["/api/instruments"]` keys); `src/hooks/use-stocks.ts`; `src/hooks/use-instrument-mutations.ts` (legacy instruments support); `src/components/legacy/` (2 files, imported nowhere); ~14 unused shadcn primitives in `src/components/ui/` (harmless, but don't take them as usage evidence).
**Legacy duplicate domain:** `src-tauri/src/commands/savings.rs` + `savingsApi` (tauri-api.ts) + `src/hooks/use-savings-account*.ts` + `src/pages/Accounts.tsx` route `/accounts` — parallel implementation over the SAME `bank_accounts`/`bank_account_zones` tables as the bank-accounts domain. New account features go in `bank_accounts.rs`/`use-bank-account*.ts` ONLY.
**Dead DB tables:** `savings_accounts`, `savings_account_zones`, `instruments`, `purchases`, `transaction_rules` (see `database.md` §4).
**Deprecated type sources:** `shared/types/extended-types.ts` (conflicting redefinitions); inline interfaces in `src/lib/tauri-api.ts` (migrate opportunistically to `shared/schema.ts` — ADR 0002).
**Anti-pattern files (working code, wrong shape — don't imitate):** `commands/categorization.rs` error style (`Result<_, String>`); fat command files `portfolio.rs`, `projection.rs`, `cashflow.rs`, `real_estate.rs` (logic belongs in services); inline `useMutation` in stock/crypto/real-estate/insurance modals; `useCategorization.ts` camelCase hook naming; hardcoded English strings in `ErrorBoundary`.

- [ ] **Step 2: Verify + commit**

Run: `grep -c "savings" docs/DEPRECATED.md` (≥3).

```bash
git add docs/DEPRECATED.md
git commit -m "docs: add do-not-copy deprecation registry"
```

---

### Task 13: CLAUDE.md rewrite (thin router)

**Files:**
- Modify: `CLAUDE.md` (full rewrite, target ≤160 lines)

- [ ] **Step 1: Rewrite.** Keep: project overview paragraph (unchanged), Commands section (unchanged bash block), path aliases, env-vars note. Remove: stale file sizes ("92KB" etc.), the duplicated testing policy details, architecture prose now owned by `docs/architecture/overview.md`. Add, in this order:

1. **"The 10 rules (non-negotiable)"** — exactly the ten from the spec §3.1, one line each, each ending with a pointer like `→ docs/standards/type-contract.md`.
2. **"Where the docs live"** — table: `docs/architecture/overview.md` (system map, canonical examples), `database.md` (schema + migrations), `decisions/` (ADRs), `docs/standards/` (per-layer rules), `docs/playbooks/` (step-by-step checklists: command, migration, domain, page), `docs/DEPRECATED.md` (**check before copying any pattern**), `docs/specs/` + `docs/plans/` (frozen snapshots — never current truth), `docs/audits/` (known violations).
3. **"Workflow"** — three lines: tiered process per `docs/standards/workflow.md` (feature → spec+plan; small fix → TDD+verify); specs go in `docs/specs/`, plans in `docs/plans/` (overrides superpowers defaults); gates = fast pre-commit / heavy pre-push / authoritative CI.
4. **Testing policy** — keep the summary table + in-memory-DB pattern (it's load-bearing for agents), add one line: "Full policy incl. the thin-command amendment: `docs/standards/testing.md`."
5. **Type regeneration command** (previously undocumented, CI-gated): `cd src-tauri && cargo test generate_bindings -- --ignored`.

- [ ] **Step 2: Verify**

Run: `wc -l CLAUDE.md` (≤170); `grep -c "docs/" CLAUDE.md` (≥10); `grep -n "92KB" CLAUDE.md` (no matches).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: rewrite CLAUDE.md as thin router into docs/ rulebook"
```

---

### Task 14: .agent/rules → pointers

**Files:**
- Modify: `.agent/rules/rules.md` (replace content below frontmatter)
- Modify: `.agent/rules/development-standards.md` (replace entire content)

- [ ] **Step 1: Replace `rules.md`** content (KEEP the `trigger: always_on` frontmatter exactly) with:

```markdown
## Moony Project Rules

All project rules live in one place. Read, in this order:

1. `CLAUDE.md` — the 10 non-negotiable rules + doc map
2. `docs/standards/` — per-layer standards (rust-backend, typescript-frontend, type-contract, testing, i18n, workflow)
3. `docs/playbooks/` — step-by-step checklists for common changes
4. `docs/DEPRECATED.md` — patterns and files you must not copy

This file intentionally contains no rules of its own — previous versions contradicted
CLAUDE.md (e.g. on the type system). Do not add rules here; update `docs/standards/` instead.
```

- [ ] **Step 2: Replace `development-standards.md`** entire content with:

```markdown
# Moved

These standards were consolidated into `docs/standards/` on 2026-07-07
(see `docs/specs/2026-07-07-ai-dev-pipeline-design.md`, decision D4).

- Rust rules → `docs/standards/rust-backend.md`
- Type system → `docs/standards/type-contract.md` (note: ADR 0002 reversed §3.1 of the
  old version of this file — `shared/schema.ts` IS the canonical contract)
- Testing → `docs/standards/testing.md`
- Frontend → `docs/standards/typescript-frontend.md`
```

- [ ] **Step 3: Verify + commit**

Run: `grep -n "DEVELOPMENT_STANDARDS" .agent/rules/rules.md` → no matches (the broken reference is gone).

```bash
git add .agent/rules/
git commit -m "docs: retire .agent/rules into pointers to docs/standards"
```

---

### Task 15: README, CONTRIBUTING, historical banners

**Files:**
- Modify: `README.md` (three claims), `CONTRIBUTING.md`, `docs/Categorization.md`, `docs/training_guide.md`

- [ ] **Step 1: README fixes** (locate by content, line numbers may have drifted):

1. The local-API bullet claiming "Read-only access — The API exposes only read endpoints; your data cannot be modified through it" → rewrite per ADR 0004, e.g.: "**Token-gated access** — the API is off by default; when enabled it requires a bearer token and exposes read endpoints plus selected write endpoints (currently insurance creation). Anyone with the token can read and modify that data — treat the token like a password."
2. Display-currency claim "CZK, EUR, USD, GBP" → "15 currencies (CZK base)".
3. CSV import claim "FIO Bank format" → "FIO, ČSOB, Raiffeisen, Moneta, and Revolut formats (auto-detected)".

- [ ] **Step 2: CONTRIBUTING.md** — replace the fork/PR-template process with reality: trunk-based on `main`, solo maintainer + AI agents, tiered workflow (link `docs/standards/workflow.md`), gates (pre-commit/pre-push/CI), conventional commits. Delete the reference to the nonexistent PR template.

- [ ] **Step 3: Historical banners** — prepend to both `docs/Categorization.md` and `docs/training_guide.md`:

```markdown
> **⚠️ Historical snapshot (2026-01-04).** This document describes the categorization
> subsystem as originally built and has not been maintained; the system has since been
> extended. File paths and links may be stale. For current structure see
> `docs/architecture/overview.md`.
```

Also in both files: delete or de-link the broken `file:///Users/<user>/Documents/…` absolute links (convert the visible text to plain repo-relative paths).

- [ ] **Step 4: Verify**

Run: `grep -n "read endpoints" README.md` (new text present); `grep -c "file:///" docs/Categorization.md docs/training_guide.md` → `0` in both; `grep -n "PR template" CONTRIBUTING.md` → no matches.

- [ ] **Step 5: Commit**

```bash
git add README.md CONTRIBUTING.md docs/Categorization.md docs/training_guide.md
git commit -m "docs: fix stale README claims, honest local-API description, historical banners"
```

---

### Task 16: Final verification against spec success criteria

**Files:** none (verification only)

- [ ] **Step 1: Gates run everywhere they should** — `.github/workflows/ci.yml` contains `npm test`, `npm run format:check`, `npm run lint` (no inline budget); `.husky/pre-commit` has no test/clippy; `.husky/pre-push` has `npm test`, clippy, `cargo test`; `package.json` test script has no `--passWithNoTests`.

- [ ] **Step 2: Zero contradictions** — run and expect NO matches:

```bash
grep -rn "DEVELOPMENT_STANDARDS.md" .agent/ CLAUDE.md
grep -rn "DO NOT manually create TypeScript types" .agent/
grep -n "92KB\|38KB\|33KB" CLAUDE.md
grep -rn "read-only" README.md
grep -rn "docs/superpowers" CLAUDE.md docs/standards/ docs/playbooks/
```

- [ ] **Step 3: Router integrity** — every `docs/…` path referenced in CLAUDE.md exists:

```bash
grep -o "docs/[a-zA-Z0-9/_.-]*" CLAUDE.md | sort -u | while read p; do test -e "$p" || echo "BROKEN: $p"; done
```

Expected: no output.

- [ ] **Step 4: Full gate suite green**

```bash
npm run lint && npm run typecheck && npm test && npm run format:check
cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && cargo test
```

Expected: all pass (79 TS tests, ~148 Rust tests).

- [ ] **Step 5: Timed doc commit** — make a trivial docs edit, commit, confirm pre-commit <10s. Then revert the edit.

- [ ] **Step 6: Mark this plan's checkboxes complete and commit**

```bash
git add docs/plans/2026-07-07-ai-dev-pipeline.md
git commit -m "docs: mark ai-dev-pipeline plan executed"
```

---

### Task 17 (Phase 2): Standards compliance audit

**Files:**
- Create: `docs/audits/2026-07-07-standards-audit.md`

**Executor note:** this task is run by the orchestrating session directly (multi-agent Workflow), not a plan subagent — it needs the Workflow tool.

- [ ] **Step 1: Run the audit workflow.** One auditor per standard file (rust-backend, typescript-frontend, type-contract, testing, i18n) + one DEPRECATED-usage auditor. Each reads its standard, then greps/reads the codebase for violations. Every finding then goes to an adversarial verifier (separate agent) that must reproduce the evidence (`file:line`) or kill the finding.

- [ ] **Step 2: Write the report.** Sections: methodology; summary counts by severity; findings grouped by standard, each with `file:line`, rule violated, severity (`blocker` = will corrupt data/money math or break the contract; `should-fix` = compounds if agents copy it; `nice-to-have`), and a one-paragraph remediation task sized for one future superpowers session. Include the spec §3.5 known candidates only if independently verified.

- [ ] **Step 3: Commit**

```bash
git add docs/audits/2026-07-07-standards-audit.md
git commit -m "docs: add standards compliance audit report"
```
