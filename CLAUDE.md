# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Moony is a privacy-focused personal finance desktop app built with Tauri 2 (Rust backend) + React 18 (TypeScript frontend). All data is stored locally in an AES-256 encrypted SQLite database (SQLCipher). No cloud sync.

## Commands

```bash
# Development
npm run tauri dev          # Start full Tauri app (Rust + React with HMR)
npm run dev                # Frontend only (Vite dev server, no Tauri)

# Build
npm run tauri build        # Production build (Rust + React, creates installers)
npm run build              # Frontend only build

# Code quality (run before committing)
npm run lint               # ESLint check
npm run lint:fix           # ESLint auto-fix
npm run format             # Prettier format
npm run format:check       # Prettier validation
npm run typecheck          # TypeScript type check (no emit)
npm test                   # Run TypeScript tests (Vitest)
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report

# Rust backend
cd src-tauri && cargo check        # Check Rust compilation
cd src-tauri && cargo clippy       # Rust linting
cd src-tauri && cargo test         # Run Rust tests
```

Husky pre-commit hooks run lint, typecheck, frontend tests (`npm test`), `cargo fmt --check`, and `cargo clippy`.

## Architecture

### Frontend ↔ Backend Communication

All frontend-to-backend calls go through `src/lib/tauri-api.ts` — a large typed wrapper around Tauri's `invoke()`. It's organized into domain namespaces: `authApi`, `bankAccountsApi`, `investmentsApi`, `portfolioApi`, `categorizationApi`, etc. Every method calls a corresponding Rust `#[tauri::command]` in `src-tauri/src/commands/`.

Shared TypeScript types live in `shared/schema.ts` (mirrors Rust structs). Path alias `@shared` maps to `./shared/`.

### Data Flow Pattern

```
UI Component
  → Custom hook (src/hooks/use-*.ts)
    → tauri-api.ts (typed invoke wrapper)
      → Rust command (src-tauri/src/commands/*.rs)
        → SQLite (encrypted via SQLCipher)
```

State management uses **TanStack React Query** for all server state. Hooks use `useQuery` for reads and `useMutation` (with cache invalidation) for writes. There is no global client-side store (no Redux/Zustand).

### App Bootstrap (src/App.tsx)

Providers are nested in this order (outermost first):
`QueryClientProvider` → `ThemeProvider` → `AuthProvider` → `I18nProvider` → `CurrencyProvider` → `SyncProvider` → `TooltipProvider` → `ErrorBoundary` → `SidebarProvider` → `Router`

### Authentication Flow

`useAuth()` (`src/hooks/use-auth.tsx`) manages three app states: `needs_setup` | `locked` | `unlocked`. First-time setup is a 2-phase flow: setup → display recovery key → confirm. All protected routes check `appStatus === "unlocked"` via `<ProtectedRoute>` (`src/lib/protected-route.tsx`).

### Currency System

CZK is the internal base currency. `CurrencyContext` (`src/lib/currency.tsx`) fetches ECB exchange rates and provides `formatCurrency()`, `formatCurrencyShort()`, and conversion helpers used throughout. The user's display currency is stored in their profile.

### Portfolio Sync

`SyncProvider` (`src/hooks/SyncProvider.tsx`) auto-runs a portfolio history backfill 15 seconds after login. It records daily snapshots of net worth for trend charts. After backfill, it invalidates relevant React Query caches.

### Routing

Uses **wouter** (not React Router). All routes except `/auth` are wrapped in `<ProtectedRoute>`. Routes are defined in `src/App.tsx`.

### Rust Backend Structure

```
src-tauri/src/
  commands/     # One file per domain (bank_accounts.rs, investments.rs, portfolio.rs, etc.)
  services/     # Business logic (categorization ML model, etc.)
  models/       # Data structs with serde derives
  db/           # SQLite migrations and connection setup
```

The largest and most complex commands are `portfolio.rs` (92KB — net worth, history, analytics), `bank_accounts.rs` (38KB — transactions, CSV import), `investments.rs` (33KB), and `projection.rs` (39KB).

### Key Path Aliases

- `@` → `src/`
- `@shared` → `shared/`

### Environment Variables

See `.env.example`. The `npm run tauri` script uses dotenv to load `.env` before running the Tauri CLI.

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
