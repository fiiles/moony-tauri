# Architecture Overview

System map for Moony: stack, data flow, canonical examples, and the domain map.
All facts (line counts, file counts, table counts) verified 2026-07-07.

## Stack

- **Tauri 2** — Rust backend, ~31k lines, 206 `#[tauri::command]` handlers in 19 files under `src-tauri/src/commands/`.
- **React 18 / TypeScript** — frontend, ~39k lines, 208 files.
- **SQLCipher-encrypted SQLite** — 37 append-only migrations in `src-tauri/src/db/migrations.rs`, ~51 tables.
- **wouter** — routing (not React Router).
- **TanStack React Query** — all server state; no Redux/Zustand.
- **shadcn/ui** (new-york) + **Tailwind** — UI components and styling.
- **react-i18next** — en/cs locales, 17 namespaces.
- **sonner** — toasts.

## The Sacred Data Flow

Every feature follows this path — no layer-skipping:

```
UI component (src/pages/, src/components/<domain>/)
  → hook: src/hooks/use-<domain>.ts (useQuery) + use-<domain>-mutations.ts (useMutation)
    → src/lib/tauri-api.ts — <domain>Api namespace (the ONLY place invoke() is called)
      → #[tauri::command] in src-tauri/src/commands/<domain>.rs (thin)
        → business logic in src-tauri/src/services/<domain>.rs (takes &Connection)
          → SQLCipher SQLite
```

To see the whole flow end to end, read the budgeting domain top to bottom — it is the cleanest implementation of every layer.

## Canonical Examples to Copy

When building something new, copy these — never the outliers:

- **Thin command + service + tests:** `src-tauri/src/commands/budgeting.rs` (63 lines) + `src-tauri/src/services/budgeting.rs` (686 lines, `#[cfg(test)]` at bottom).
- **Minimal CRUD domain:** `src-tauri/src/commands/bonds.rs` (122 lines) + `src/hooks/use-bonds.ts` + `use-bond-mutations.ts`.
- **Mutation hook with correct cache invalidation + snapshot:** `src/hooks/use-bank-account-mutations.ts`.
- **Dialog/form page pattern:** `src/pages/Accounts.tsx` (lifted dialog state) with react-hook-form + zodResolver.

## Domain Map

| Domain | Tables | Rust | Frontend |
|---|---|---|---|
| auth/profile | `app_config`, `user_profile` | `commands/auth.rs` + `services/auth.rs` | `use-auth.tsx`, `auth-page.tsx`, `Settings.tsx` |
| bank accounts | `institutions`, `bank_accounts`, `bank_account_zones`, `bank_transactions`, `csv_import_presets`, `csv_import_batches` | `commands/bank_accounts.rs` + `services/{bank_accounts,csv_import,date_parser}.rs` | `BankAccounts.tsx`, `BankAccountDetail.tsx`, `use-bank-account*.ts`, `components/bank-accounts/` |
| categorization | `transaction_categories`, `categorization_rules`, `learned_payees` | `commands/categorization.rs` + `services/categorization/` (10 files) | `CategorizationRules.tsx`, `useCategorization.ts` |
| budgeting | `budget_goals` | `commands/budgeting.rs` + `services/budgeting.rs` | `Budgeting.tsx`, `components/budgeting/` |
| stocks | `stock_investments`, `investment_transactions`, `stock_data`, `stock_price_overrides`, `dividend_data`, `dividend_overrides`, `stock_value_history`, `stock_tags`, `stock_investment_tags`, `stock_tag_groups` | `commands/{investments,stock_tags,price_api}.rs` + `services/{investments,price_api,pricing}.rs` | `Stocks.tsx`, `StockDetail.tsx`, `StocksAnalysis.tsx`, `components/stocks/` |
| crypto | `crypto_investments`, `crypto_transactions`, `crypto_prices`, `crypto_price_overrides`, `crypto_value_history` | `commands/crypto.rs` + `services/{crypto,crypto_investments}.rs` | `Crypto.tsx`, `CryptoDetail.tsx` |
| bonds | `bonds` | `commands/bonds.rs` | `Bonds.tsx`, `use-bond*.ts` |
| loans | `loans` | `commands/loans.rs` | `Loans.tsx`, `AnnuityCalculator.tsx`, `src/utils/annuity.ts` |
| real estate | `real_estate` + 6 child tables | `commands/real_estate.rs` | `RealEstate*.tsx`, `EstateCalculator.tsx`, `components/real-estate/` |
| insurance | `insurance_policies`, `insurance_documents` | `commands/insurance.rs` | `Insurance*.tsx` |
| other assets | `other_assets`, `other_asset_transactions`, `entity_history` | `commands/other_assets.rs` | `OtherAssets.tsx` |
| portfolio/net-worth | `portfolio_metrics_history`, `entity_history`, `stock_value_history`, `crypto_value_history` | `commands/portfolio.rs` (also currently hosts exchange-rate commands at lines ~518–560) | `Dashboard.tsx`, `SyncProvider.tsx`, `PortfolioValueTrendChart.tsx`, `shared/calculations/` |
| currency | `exchange_rates`, `exchange_rate_history` | commands inside `portfolio.rs` + `services/currency.rs` (ECB) | `src/lib/currency.tsx`, `shared/currencies.ts` |
| cashflow/projection | `cashflow_items`, `projection_settings` | `commands/cashflow.rs`, `commands/projection.rs` | `Cashflow.tsx`, `Projection.tsx` |
| export/local API | — | `commands/export.rs`; `services/local_api.rs` — optional token-gated axum HTTP/MCP server, off by default, enabled via `user_profile.mcp_server_enabled` | — |

## Bootstrap & Auth

Provider nesting from `src/App.tsx` (outermost first):

```
QueryClientProvider → ThemeProvider → AuthProvider → I18nProvider → CurrencyProvider
  → SyncProvider → TooltipProvider → ErrorBoundary → SidebarProvider → Router
```

- Auth states: `needs_setup | locked | unlocked`.
- `SyncProvider` runs a portfolio history backfill 15 seconds after unlock, then invalidates the relevant React Query caches.

## Known Structural Debt

Fat command files hold logic that belongs in services (link, don't fix):

- `portfolio.rs` — 2,863 lines
- `projection.rs` — 1,171 lines
- `real_estate.rs` — 1,037 lines
- `cashflow.rs` — 896 lines

See `docs/DEPRECATED.md` and the current audit in `docs/audits/`.
