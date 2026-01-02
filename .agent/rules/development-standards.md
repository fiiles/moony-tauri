---
trigger: always_on
---

# Moony Development Standards

> **For AI Agents:** These are the coding standards and architectural guidelines for the Moony project. Follow these rules when implementing any new feature or modifying existing code.

---

## Project Overview

**Moony** is a personal finance management desktop application built with:
- **Backend:** Tauri v2 + Rust
- **Frontend:** React + TypeScript + Vite
- **Database:** SQLite with SQLCipher encryption
- **Styling:** Tailwind CSS + shadcn/ui components

---

## 1. Architecture Principles

### 1.1 The Thin Command Rule ⚠️ CRITICAL

Tauri commands (`#[tauri::command]`) must be **thin wrappers** that:
1. Validate input at the trust boundary
2. Delegate to a service layer
3. Handle events/side effects
4. Return results

**❌ BAD - Business logic in command:**
```rust
#[tauri::command]
pub async fn create_investment(...) -> Result<Investment> {
    let ticker = data.ticker.to_uppercase();  // Business logic
    // 100 lines of DB operations...
    portfolio::update_todays_snapshot(&db).await.ok();  // Side effects mixed in
}
```

**✅ GOOD - Command delegates to service:**
```rust
#[tauri::command]
pub async fn create_investment(
    db: State<'_, Database>,
    app: AppHandle,
    data: InsertStockInvestment,
) -> Result<Investment> {
    // 1. Validate at boundary
    data.validate()?;
    
    // 2. Delegate to service
    let result = services::investments::create(&db, data).await?;
    
    // 3. Emit event
    app.emit("investment-created", &result.id).ok();
    
    Ok(result)
}
```

### 1.2 Service Layer Structure

All business logic lives in `src-tauri/src/services/`:

```
src-tauri/src/
├── commands/       # Thin Tauri command handlers
├── services/       # Business logic (THE source of truth)
│   ├── mod.rs
│   ├── investments.rs
│   ├── crypto.rs
│   ├── bank_accounts.rs
│   └── ...
├── models/         # Data types with validation
└── db/             # Database connection management
```

### 1.3 Single Source of Truth (DRY) ⚠️ CRITICAL

**NEVER** duplicate business logic. If both a single-item operation and bulk import need the same logic, extract it:

```rust
// In services/investments.rs

/// Core function - called by BOTH single create AND bulk import
pub fn create_investment_core(
    conn: &Connection,
    ticker: &str,
    company_name: &str,
) -> Result<String> {
    // Single implementation
}

/// Single item API
pub async fn create(db: &Database, data: InsertInvestment) -> Result<Investment> {
    db.with_conn(|conn| {
        create_investment_core(conn, &data.ticker, &data.company_name)
    })
}

/// Bulk import uses the same core function
pub fn import_transaction(conn: &Connection, ...) -> Result<()> {
    let id = create_investment_core(conn, ticker, name)?;
    // ...
}
```

---

## 2. Rust Standards

### 2.1 Error Handling

**NEVER use `.unwrap()` in production code.** Use one of:

```rust
// Option 1: expect() with message
conn.lock().expect("Database mutex should not be poisoned")

// Option 2: Propagate with ?
let value = some_option.ok_or_else(|| AppError::NotFound("Item not found".into()))?;

// Option 3: Default value
let qty = qty_str.parse().unwrap_or(0.0);
```

**`.unwrap()` is ONLY acceptable in:**
- Tests
- Static initialization (lazy_static)
- Cases proven impossible to fail

### 2.2 Validation on Domain Types

All "Insert*" types must have a `validate()` method:

```rust
impl InsertInvestmentTransaction {
    pub fn validate(&self) -> Result<()> {
        // Transaction type
        let tx_type = self.tx_type.to_lowercase();
        if tx_type != "buy" && tx_type != "sell" {
            return Err(AppError::Validation(
                format!("Invalid type '{}' (must be 'buy' or 'sell')", self.tx_type)
            ));
        }
        
        // Quantity must be positive
        let qty: f64 = self.quantity.parse()
            .map_err(|_| AppError::Validation("Invalid quantity".into()))?;
        if qty <= 0.0 {
            return Err(AppError::Validation("Quantity must be positive".into()));
        }
        
        Ok(())
    }
}
```

### 2.3 Database Operations

- Use parameterized queries (rusqlite::params![])
- Never concatenate user input into SQL strings
- Wrap related operations in transactions when appropriate

```rust
// ✅ GOOD - Parameterized
conn.execute(
    "INSERT INTO investments (id, ticker) VALUES (?1, ?2)",
    rusqlite::params![id, ticker],
)?;

// ❌ BAD - String concatenation
conn.execute(&format!("INSERT INTO investments (id, ticker) VALUES ('{}', '{}')", id, ticker), [])?;
```

### 2.4 Async Patterns

- Commands that trigger background work should emit events when complete
- Use `spawn_blocking` for CPU-intensive DB operations if needed

```rust
#[tauri::command]
pub async fn import_transactions(...) -> Result<ImportResult> {
    let result = do_import().await?;
    
    // Trigger recalculation in background
    let db_clone = db.inner().clone();
    tokio::spawn(async move {
        portfolio::recalculate(&db_clone).await.ok();
        app.emit("import-complete", ()).ok();
    });
    
    Ok(result)
}
```

---

## 3. TypeScript/Frontend Standards

### 3.1 Type Safety

- **DO NOT** manually create TypeScript types that mirror Rust structs
- Use generated types from `shared/generated-types.ts` (via tauri-specta)
- If generated types don't exist yet, add a TODO and create them properly

### 3.2 API Client Pattern

All Tauri invocations go through `src/lib/tauri-api.ts`:

```typescript
// ✅ GOOD - Use the API client
import { investmentsApi } from '@/lib/tauri-api';
const result = await investmentsApi.create(data);

// ❌ BAD - Direct invoke
import { invoke } from '@tauri-apps/api/core';
const result = await invoke('create_investment', { data });
```

### 3.3 Event Listeners

Always clean up event listeners:

```typescript
useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    
    const setup = async () => {
        unlisten = await listen('event-name', handler);
    };
    setup();
    
    return () => { unlisten?.(); };  // ← REQUIRED cleanup
}, []);
```

### 3.4 Error Handling

Display user-friendly errors, log technical details:

```typescript
try {
    await api.doSomething();
} catch (error) {
    console.error('Technical details:', error);
    toast.error('Something went wrong. Please try again.');
}
```

---

## 4. Security Standards

### 4.1 Trust Boundary

The frontend is UNTRUSTED. All validation must happen in Rust:

```rust
#[tauri::command]
pub async fn create_item(data: CreateItemInput) -> Result<Item> {
    // ALWAYS validate before processing
    data.validate()?;
    
    // Now safe to use
}
```

### 4.2 CSP (Content Security Policy)

Never set `"csp": null`. Use a strict policy:

```json
"csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ..."
```

### 4.3 File System Access

Only request minimum necessary permissions. Never use wildcards like `/Users/**`.

### 4.4 Sensitive Data

- Passwords/keys must use secure memory handling
- Clear sensitive data after use
- Never log sensitive information

---

## 5. Testing Requirements

### 5.1 Before Committing

Run these commands:

```bash
# Frontend
npm run lint
npm run typecheck

# Backend
cd src-tauri
cargo fmt --check
cargo clippy -- -D warnings
cargo test
```

### 5.2 Test Coverage

- Every service function should have unit tests
- Commands should have integration tests for happy path + error cases
- CSV import should test edge cases (missing columns, invalid data)

---

## 6. New Feature Checklist

When implementing a new feature, follow this checklist:

### Backend (Rust)

- [ ] Create/update model in `src/models/`
- [ ] Add `validate()` method to insert types
- [ ] Implement logic in `src/services/` (NOT in commands)
- [ ] Create thin command in `src/commands/`
- [ ] Register command in `src/lib.rs`
- [ ] Add necessary migrations in `src/db/migrations.rs`
- [ ] Update type exports for tauri-specta
- [ ] Run `cargo clippy -- -D warnings`
- [ ] Add tests

### Frontend (TypeScript)

- [ ] Add API method in `src/lib/tauri-api.ts`
- [ ] Use generated types (not manual)
- [ ] Implement UI components
- [ ] Handle loading/error states
- [ ] Clean up event listeners
- [ ] Run `npm run typecheck`
- [ ] Run `npm run lint`

---

## 7. Code Review Checklist

Before merging, verify:

- [ ] No `.unwrap()` in production code
- [ ] All input validated in Rust
- [ ] No business logic in commands
- [ ] No duplicate code between single/bulk operations
- [ ] Types are generated, not manual
- [ ] Event listeners have cleanup
- [ ] CSP is not weakened
- [ ] Tests pass

---

## 8. Common Patterns Reference

### Creating a New Entity Type

```rust
// 1. Model (src/models/widgets.rs)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Widget {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InsertWidget {
    pub name: String,
}

impl InsertWidget {
    pub fn validate(&self) -> Result<()> {
        if self.name.is_empty() {
            return Err(AppError::Validation("Name is required".into()));
        }
        Ok(())
    }
}

// 2. Service (src/services/widgets.rs)
pub fn create(conn: &Connection, data: InsertWidget) -> Result<Widget> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO widgets (id, name) VALUES (?1, ?2)",
        params![id, data.name],
    )?;
    Ok(Widget { id, name: data.name })
}

// 3. Command (src/commands/widgets.rs)
#[tauri::command]
pub async fn create_widget(
    db: State<'_, Database>,
    data: InsertWidget,
) -> Result<Widget> {
    data.validate()?;
    db.with_conn(|conn| services::widgets::create(conn, data))
}
```

### Handling Recalculations

```rust
// After modifying transactions, trigger recalculation
let result = db.with_conn(|conn| {
    services::transactions::create(conn, data)
})?;

// Update snapshot
portfolio::update_todays_snapshot(&db).await.ok();

// Trigger historical recalc if needed
if result.date < today() {
    portfolio::recalculate_from_date(&db, result.date).await.ok();
}

// Emit event for frontend
app.emit("recalculation-complete", ()).ok();
```

---

## Summary

| Priority | Rule |
|----------|------|
| 🔴 | Never put business logic in commands |
| 🔴 | Never duplicate code between single/bulk paths |
| 🔴 | Always validate input in Rust |
| 🔴 | Never use .unwrap() in production |
| 🟡 | Use generated types, not manual |
| 🟡 | Clean up event listeners |
| 🟡 | Run linters before committing |