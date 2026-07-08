# Playbook: Add a Database Migration

Mechanics and rationale are owned by `docs/architecture/database.md` ("How Migrations
Work" + "Storage Conventions") and `docs/standards/rust-backend.md` rule 9. This file
is the execution checklist only.

## Checklist

1. **Find the next number.** Open `src-tauri/src/db/migrations.rs` and read the
   current highest `const MIGRATION_0NN`. Yours is the next number — zero-padded,
   sequential, never reused.
2. **Define the const.** Add `const MIGRATION_0NN: &str = r#"..."#;` with inline SQL
   (there are no `.sql` files). Follow the storage conventions in
   `docs/architecture/database.md`: TEXT UUID primary keys, INTEGER unix-epoch
   timestamps (`DEFAULT (unixepoch())`), money/decimals as TEXT strings, CZK-base
   aggregates, per-currency breakdowns as JSON-in-TEXT.
3. **Append the Vec entry.** Add `("0NN_short_name", MIGRATION_0NN)` to the `Vec` in
   `run_migrations()` in the same file.
4. **Never edit an applied migration** — the fix is always a new migration. If you
   need to alter existing columns (SQLite has no `ALTER COLUMN`), use
   **create-new → copy → drop → rename**: create `table_new` with the desired shape,
   `INSERT INTO ... SELECT` the data across, drop the old table and its indexes,
   rename `table_new` back, recreate indexes. Working examples: migrations 027, 028,
   031 (see `docs/architecture/database.md`).
5. **Do not add out-of-band repair checks** outside the numbered migration list
   (see the cautionary tale in `docs/architecture/database.md`).
6. **Update the docs in the same commit.** Add/amend the table's row in the catalog
   in `docs/architecture/database.md` (new table → new row with its "Since" number;
   changed columns → amend "Notable columns / constraints").

## Verify

```bash
cd src-tauri && cargo test
```

If the migration affects schema used by the app (any new/changed table or column),
also launch the app once — `npm run tauri dev` — and confirm the `[MIGRATION]` log
lines show the new migration applying without error.
