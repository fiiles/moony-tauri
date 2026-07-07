# Unified Empty States Design

**Date:** 2026-04-10
**Status:** Approved

## Goal

Unify how empty tables are displayed across the app. All pages should show the same rich empty state as Bank Accounts: a card with a large icon, bold title, muted description, and a CTA button to add the first item. Currently all other pages show a plain text message inside a table row.

## Shared `EmptyState` Component

**File:** `src/components/common/EmptyState.tsx`

```tsx
interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}
```

Renders a `<Card>` with `<CardContent className="flex flex-col items-center justify-center py-12">` containing:
- Icon wrapper: `<div className="text-muted-foreground mb-4">{icon}</div>` — caller sizes the icon to `h-12 w-12`
- `<h3 className="text-lg font-semibold">{title}</h3>`
- `<p className="text-muted-foreground text-center max-w-sm mt-2">{description}</p>`
- When `action` is provided: `<Button onClick={action.onClick} className="mt-4"><Plus className="mr-2 h-4 w-4" />{action.label}</Button>`

This matches the existing BankAccounts empty state exactly and becomes the single source of truth.

## Page-Level Empty Check Pattern

Each affected page adds a conditional block **after** the loading check, **before** rendering the table card:

```tsx
if (data.length === 0) {
  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      {/* same page header with title, subtitle, and action buttons */}
      <EmptyState
        icon={<PageIcon className="h-12 w-12" />}
        title={t('empty.title')}
        description={t('empty.description')}
        action={{ label: t('addItem'), onClick: () => setAddOpen(true) }}
      />
      {/* dialogs still rendered so they can be opened */}
    </div>
  )
}
```

The page header (title + subtitle + action buttons) is always shown, even on the empty state, so the user can still click the header-level add button.

### Tables with search filters (Investments, Crypto, Insurance)

These tables manage their own search state internally. Two distinct zero-data situations must be handled differently:

- **No data at all** (`rawData.length === 0`): page renders `<EmptyState>` instead of the table component
- **Filtered to zero** (search/filter applied but no matches): table component keeps its existing simple in-row message (`t('table.noHoldings')` etc.)

No changes needed inside these table components for the filtered case — they already handle it.

### Tables without search (Bonds, Loans, OtherAssets, RealEstate, SavingsAccounts)

Empty check moves entirely to the page level. The existing in-table empty row remains as a harmless fallback but will never be visible in practice.

## Pages Affected

| Page file | Table component | Search? | Icon |
|---|---|---|---|
| `Stocks.tsx` | `InvestmentsTable.tsx` | Yes | `TrendingUp` |
| `Crypto.tsx` | `CryptoTable.tsx` | Yes | `Bitcoin` |
| `Bonds.tsx` | `BondsTable.tsx` | No | `Banknote` |
| `Loans.tsx` | `LoansTable.tsx` | No | `CreditCard` |
| `Insurance.tsx` | `InsuranceList.tsx` | Yes | `Shield` |
| `OtherAssets.tsx` | `OtherAssetsTable.tsx` | No | `Archive` |
| `RealEstate.tsx` | inline table | No | `Home` |
| `Accounts.tsx` | `SavingsAccountsTable.tsx` | No | `PiggyBank` |

## i18n Keys

Add `empty.title` and `empty.description` to both `en/` and `cs/` for each of the 8 namespaces: `stocks`, `crypto`, `bonds`, `loans`, `insurance`, `otherAssets`, `realEstate`, `savings`.

Existing single-message keys (`noHoldings`, `noBonds`, `noLoans`, etc.) are kept unchanged — they continue to serve as the in-table filtered-to-zero message.

### Key content (EN)

| Namespace | `empty.title` | `empty.description` |
|---|---|---|
| stocks | "No investments yet" | "Add your first stock or ETF to start tracking your portfolio." |
| crypto | "No crypto holdings yet" | "Add your first cryptocurrency to start tracking your holdings." |
| bonds | "No bonds yet" | "Add your first bond to start tracking your fixed-income investments." |
| loans | "No loans yet" | "Add your first loan to start tracking your liabilities." |
| insurance | "No insurance policies yet" | "Add your first policy to start tracking your coverage." |
| otherAssets | "No assets yet" | "Add your first asset to start tracking other valuables." |
| realEstate | "No properties yet" | "Add your first property to start tracking your real estate." |
| savings | "No savings accounts yet" | "Add your first savings account to start tracking your deposits." |

Czech translations follow the same structure (to be written during implementation).

## Out of Scope

- Detail pages (BankAccountDetail, StockDetail, etc.) — they are not list pages
- In-modal empty states (transaction lists, document lists) — these are secondary contexts where a full card empty state would be excessive
- The BankAccounts page itself — already uses this pattern and is the reference implementation
