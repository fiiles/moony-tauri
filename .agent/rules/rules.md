---
trigger: always_on
---

## Moony Project Rules

When working on this project, ALWAYS follow the standards in `.agent/DEVELOPMENT_STANDARDS.md`.

### Quick Reference - Critical Rules

1. **Thin Commands Only**: Never put business logic in `#[tauri::command]` functions. Delegate to `src-tauri/src/services/`.

2. **Single Source of Truth**: If single-create and bulk-import need the same logic, extract to a shared function in services. Never copy-paste.

3. **Validate in Rust**: All input validation happens in Rust via `validate()` methods on Insert* types. Never trust frontend data.

4. **No .unwrap()**: Use `.expect("reason")` or proper error handling (`?` operator). Only exception: tests.

5. **Generated Types**: Use types from `shared/generated-types.ts`, not manual TypeScript interfaces.

6. **Event Cleanup**: All `listen()` calls must have corresponding `unlisten()` in useEffect cleanup.

### Before Completing Any Task

Run these checks:
```bash
npm run lint && npm run typecheck
cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && cargo test
```

### Project Structure

- `src-tauri/src/commands/` → Thin Tauri handlers
- `src-tauri/src/services/` → Business logic (THE source of truth)
- `src-tauri/src/models/` → Data types with validation
- `src/lib/tauri-api.ts` → Frontend API client (all invokes go here)
- `shared/` → Generated types shared between Rust and TS