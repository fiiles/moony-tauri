# DEPRECATED — Do Not Copy

Things that exist in this repo but must never be copied, extended, or used as
examples. Before reusing any pattern, check this list. Removal is tracked in
`docs/audits/`.

## Dead frontend code

| Path | Why it's dead | Use instead |
|---|---|---|
| `src/hooks/use-finance-data.ts` | Express-era React Query keys (`["/api/instruments"]`); nothing serves these routes since the Tauri migration | Domain hooks (`use-bank-accounts*.ts`, `use-investments.ts`, …) backed by `src/lib/tauri-api.ts` |
| `src/hooks/use-stocks.ts` | Legacy instruments support | Current investments hooks |
| `src/hooks/use-instrument-mutations.ts` | Legacy instruments support | Current investments hooks |
| `src/components/legacy/` (2 files: `DeleteInstrumentDialog.tsx`, `InstrumentFormDialog.tsx`) | Imported nowhere | The live investments dialogs |
| ~14 unused shadcn primitives in `src/components/ui/` | Never imported — harmless, but do **not** take their presence as evidence the codebase uses them | Check actual imports before citing a component as "used" |

## Legacy duplicate domain: savings

A parallel implementation over the **same** `bank_accounts` /
`bank_account_zones` tables as the bank-accounts domain. New account features
go in `bank_accounts.rs` / `use-bank-account*.ts` **only**.

| Path | What it duplicates |
|---|---|
| `src-tauri/src/commands/savings.rs` | `src-tauri/src/commands/bank_accounts.rs` |
| `savingsApi` in `src/lib/tauri-api.ts` | `bankAccountsApi` |
| `src/hooks/use-savings-accounts.ts`, `src/hooks/use-savings-account-mutations.ts` | `use-bank-account*.ts` hooks |
| `src/pages/Accounts.tsx` (route `/accounts`) | `src/pages/BankAccounts.tsx` |

## Dead DB tables

Never write features against these (see `docs/architecture/database.md` §4,
"Deprecated Tables"):

- `savings_accounts`
- `savings_account_zones`
- `instruments`
- `purchases`
- `transaction_rules`

## Deprecated type sources

| Path | Why deprecated | Use instead |
|---|---|---|
| `shared/types/extended-types.ts` | Conflicting redefinitions of canonical types | `shared/schema.ts` (the wire contract — ADR 0002) |
| Inline interfaces in `src/lib/tauri-api.ts` | Types belong in the shared contract; migrate opportunistically when touching a method | `shared/schema.ts` (ADR 0002) |

## Anti-pattern files (working code, wrong shape — don't imitate)

| Path / pattern | What's wrong | Do this instead |
|---|---|---|
| `src-tauri/src/commands/categorization.rs` error style | Returns `Result<_, String>` | Return `crate::error::AppError` (see `docs/standards/rust-backend.md` §2) |
| Fat command files: `portfolio.rs`, `projection.rs`, `cashflow.rs`, `real_estate.rs` | Business logic inside command handlers | Logic belongs in `src-tauri/src/services/`; commands stay thin |
| Inline `useMutation` in stock/crypto/real-estate/insurance modals | Mutations defined inside components, bypassing shared cache-invalidation | Put mutations in domain hooks (`src/hooks/use-*.ts`) |
| `src/hooks/useCategorization.ts` | camelCase hook filename | Kebab-case: `use-<domain>.ts` |
| Hardcoded English strings in `src/components/common/ErrorBoundary.tsx` | Bypasses i18n | Translation keys per `docs/standards/i18n.md` |
