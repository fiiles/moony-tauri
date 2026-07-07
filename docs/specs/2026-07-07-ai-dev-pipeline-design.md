# AI Development Pipeline — Design Spec

**Date:** 2026-07-07
**Status:** Approved (pending final spec review)
**Scope ruling:** Docs + tooling config only. No app source code changes. Findings about existing code are reported in a phase-2 audit, not fixed.

## 1. Problem

Moony was built largely through AI-driven sessions. Future feature work will use the superpowers workflow (brainstorm → spec → plan → TDD → review). For that to work without degrading the codebase, agents need one consistent, accurate, enforced set of rules.

A 7-agent exploration (2026-07-07) found the problem is **contradiction and drift, not absence**:

- **Contradictory instructions.** CLAUDE.md says shared types live in hand-written `shared/schema.ts`; `.agent/rules/development-standards.md` §3.1 says the opposite ("use `shared/generated-types.ts` via tauri-specta" — tauri-specta is not installed). `.agent/rules/rules.md:7` references a nonexistent path (`.agent/DEVELOPMENT_STANDARDS.md`). Agent behavior depends on which file loads first.
- **Four type sources for one wire contract.** `shared/schema.ts` (918 lines, imported by 70 files — the real contract), `shared/generated-types.ts` (specta output, imported by zero files, CI-gated but the gate is stale), `shared/types/extended-types.ts` (redefines two schema.ts types with conflicting field types), ~20 inline interfaces in `src/lib/tauri-api.ts`. Nothing checks schema.ts against Rust; live drift already exists (phantom `BankAccount.excludeFromBalance`; 7 `*ByCurrency` fields never regenerated).
- **Inverted quality gates.** CI never runs the frontend Vitest suite; pre-commit never runs `cargo test`; `npm test` uses `--passWithNoTests`; ESLint budget differs between CI (`--max-warnings 120`) and local (unlimited).
- **Untested money math.** `shared/calculations/` (6 modules, 21 exported pure functions) has zero tests despite CLAUDE.md mandating them. `src-tauri/src/commands/portfolio.rs` (2,863 lines) holds most recent feature logic with exactly 1 test because "commands are exempt" — the logic never moved to services.
- **Agent traps.** Live legacy duplicate domain (`commands/savings.rs` writes the same tables as `commands/bank_accounts.rs`); dead hooks/components/tables with no deprecation markers; 14 frozen plan/spec files (~8,570 lines, 76% of all markdown) split across two directory conventions; README false claims (read-only API, 4 currencies, FIO-only CSV).

## 2. Decisions

| # | Decision | Ruling |
|---|----------|--------|
| D1 | Scope | Docs + tooling config only; no source changes; phase-2 audit reports, doesn't fix |
| D2 | Workflow | Tiered: features → full superpowers flow; small fixes → TDD + gates + verification |
| D3 | Gates | Local (Husky) + GitHub Actions CI as the authoritative gate |
| D4 | Approach | A: consolidated rulebook in `docs/` + thin CLAUDE.md router + enforcement realignment |
| D5 | Spec/plan home | `docs/specs/` + `docs/plans/` (tool-agnostic); older `docs/superpowers/` files `git mv`'d in |
| D6 | Local API writes | **Feature, kept.** README security section rewritten to honestly describe token-gated write access. ADR records the decision |
| D7 | Type contract | `shared/schema.ts` is canonical; `generated-types.ts` is a drift detector only; `extended-types.ts` deprecated; full codegen migration deferred |
| D8 | Coverage thresholds | Documented as planned gate, NOT enabled (would fail on untested `shared/calculations/`, fixing that is source work → phase-2 backlog) |
| D9 | CHANGELOG | Not created (ADRs + conventional commits + release tags suffice) |

## 3. Deliverables

### 3.1 Documentation tree

```
CLAUDE.md                          rewritten: thin router (~150 lines)
docs/
  architecture/
    overview.md                    stack, data flow, domain map, canonical examples
    database.md                    ~51 tables by domain, deprecated tables, storage conventions
    decisions/
      README.md                    ADR index + template
      0001-czk-base-currency-and-money-as-text.md
      0002-schema-ts-is-the-wire-contract.md
      0003-tiered-ai-workflow.md
      0004-local-api-token-gated-writes.md
      0005-yahoo-finance-for-prices.md
  standards/
    rust-backend.md                thin commands → services, AppError, validate(), no .unwrap(), test pattern
    typescript-frontend.md         pages/hooks/components, React Query keys + invalidation + recordSnapshot, forms, styling, shadcn boundary
    type-contract.md               7-step add-a-command procedure, canonical type source, drift check command
    testing.md                     what to test vs skip (amended thin-command rule), definition of done
    i18n.md                        en + cs both mandatory, namespace registration, error-key flow
    workflow.md                    tier definitions, superpowers stage mapping, commit conventions, spec/plan locations
  playbooks/
    add-tauri-command.md           literal step-by-step checklists,
    add-db-migration.md            each ending with verification commands
    add-asset-domain.md
    add-frontend-page.md
  DEPRECATED.md                    do-not-copy registry
  specs/  plans/                   consolidated (see 3.4)
```

**CLAUDE.md rewrite** keeps: command reference, architecture summary (correct file sizes removed in favor of rules — size annotations rot), testing policy pointer, and adds: the ~10 non-negotiable rules, pointer map into `docs/`, spec/plan location preference for superpowers, and the `generate_bindings` regeneration command.

**The ~10 non-negotiable rules** (final wording during implementation):
1. Never call `invoke()` outside `src/lib/tauri-api.ts`.
2. `shared/schema.ts` is the wire contract — follow `docs/standards/type-contract.md` when touching it.
3. New Rust types: per-field `#[serde(rename = "camelCase")]`, register in `bindings.rs`, regenerate `generated-types.ts`.
4. Thin commands: business logic goes in `src-tauri/src/services/`, taking `&Connection`. Use `AppError`, never `Result<_, String>`.
5. `Insert*` structs get `validate()`; commands call it before DB work. No `.unwrap()` outside tests.
6. Migrations are append-only in `migrations.rs`; next number + Vec entry; never edit an applied migration.
7. Mutations invalidate domain keys + `["portfolio-metrics"]` + `["cashflow-report"]`, then `recordSnapshot()` + invalidate `["portfolio-history"]` (reference: `use-bank-account-mutations.ts`).
8. Every user-facing string lands in BOTH `en/` and `cs/` locale files.
9. Check `docs/DEPRECATED.md` before copying any pattern; never extend the savings path or dead tables.
10. Money is TEXT, timestamps are unix epoch INTEGER, PKs are TEXT UUIDs, CZK is base.

### 3.2 Contradiction resolution

- `.agent/rules/rules.md` and `.agent/rules/development-standards.md` replaced by short pointer files into `docs/standards/` (files kept so tools auto-loading `.agent/` still resolve; content lives in one place).
- ADR 0002 records D7 (type contract). `extended-types.ts` and the inline tauri-api interfaces listed in DEPRECATED.md as "do not extend, migrate opportunistically".
- `docs/standards/testing.md` amends the exemption: command handlers are exempt **only when thin**; logic in fat command files counts as service logic — when touched, it must gain tests or move to a service (phase-2 backlog lists current offenders).

### 3.3 Enforcement realignment (config only)

| Change | File | Detail |
|--------|------|--------|
| CI runs frontend tests | `.github/workflows/ci.yml` | add `npm test -- --run` to frontend job |
| CI checks formatting | `.github/workflows/ci.yml` | add `npm run format:check` |
| Align ESLint budget | `package.json` + `ci.yml` | `--max-warnings 120` moves into the npm `lint` script; CI calls the script |
| Kill `--passWithNoTests` | `package.json` | remove flag from `test` script |
| Pre-commit runs Rust tests | `.husky/pre-commit` | add `cargo test` (~6s) |
| Fix stale permission paths | `.claude/settings.json`, `.claude/settings.local.json` | replace old `Documents/…` repo path |
| Align Action versions | `.github/workflows/*.yml` | consistent checkout/setup-node majors |

Explicitly NOT done now: coverage thresholds (D8), schema.ts↔Rust automated contract check (needs codegen — source work, phase-2 recommendation), lint-staged (avoid new dep; revisit if pre-commit gets slow).

### 3.4 Docs cleanup

- `git mv docs/superpowers/specs/* docs/specs/`, `git mv docs/superpowers/plans/* docs/plans/`; remove empty `docs/superpowers/`; add `docs/specs/README.md` + `docs/plans/README.md` marking contents as point-in-time snapshots (not current documentation) and stating naming convention `YYYY-MM-DD-<topic>-{design,plan}.md`.
- README.md: rewrite the local-API security bullet per D6 (token-gated read/write, off by default); fix currency count (15) and CSV formats (FIO, ČSOB, Raiffeisen, Moneta, Revolut).
- Add "historical snapshot" banner to `docs/Categorization.md` and `docs/training_guide.md`; fix/remove broken `file:///…/Documents/…` links.
- CONTRIBUTING.md: describe the real trunk-based solo + AI-agent flow; remove references to nonexistent PR template or add nothing that isn't practiced.
- CLAUDE.md stale size annotations removed (e.g. "portfolio.rs 92KB" — actual 109KB).

### 3.5 Phase 2 — standards compliance audit

After deliverables land: a multi-agent workflow audits the code against each standard file and writes `docs/audits/2026-07-07-standards-audit.md`:

- One auditor per standard (rust-backend, typescript-frontend, type-contract, testing, i18n) + one for DEPRECATED usage.
- Findings adversarially verified before inclusion (no plausible-but-wrong entries).
- Each finding: `file:line`, rule violated, severity (blocker/should-fix/nice-to-have), suggested remediation task sized for a future superpowers session.
- Known candidates from exploration (to verify, not assume): untested `shared/calculations/`; `categorization.rs` error convention; fat commands (portfolio, projection, cashflow, real_estate); savings/bank-accounts duplication; dead code list; schema.ts drift instances; hardcoded ErrorBoundary strings; inline mutations in 25 components.

Report only — remediation is future work the user schedules.

## 4. Out of scope (recorded so agents don't "helpfully" do it)

- Any refactoring (splitting portfolio.rs, removing savings path, deleting dead code).
- Type codegen migration (tauri-specta / ts-rs adoption).
- Writing the missing tests (audit lists them; separate sessions fix them).
- Coverage gates, lint-staged, CHANGELOG, PR templates.
- Removing local-API write endpoints (kept per D6).

## 5. Success criteria

1. A fresh agent session given only CLAUDE.md can locate every rule needed to add a full asset domain without reading contradictory guidance.
2. Every stated gate actually runs somewhere authoritative: lint, typecheck, format, TS tests, cargo fmt/clippy/test all in CI; the same set (minus release build) in pre-commit.
3. Zero contradictions remain between CLAUDE.md, `.agent/rules/`, README, and `docs/`.
4. The phase-2 audit produces a ranked, verified backlog in `docs/audits/`.
