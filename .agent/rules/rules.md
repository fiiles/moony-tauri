---
trigger: always_on
---

## Moony Project Rules

All project rules live in one place. Read, in this order:

1. `CLAUDE.md` — the 10 non-negotiable rules + doc map
2. `docs/standards/` — per-layer standards (rust-backend, typescript-frontend, type-contract, testing, i18n, workflow)
3. `docs/playbooks/` — step-by-step checklists for common changes
4. `docs/DEPRECATED.md` — patterns and files you must not copy

This file intentionally contains no rules of its own — previous versions contradicted
CLAUDE.md (e.g. on the type system). Do not add rules here; update `docs/standards/` instead.
