# Form Unification Design

**Date:** 2026-04-10  
**Scope:** All dialog/modal forms across the app (Settings inline forms excluded)  
**Goal:** Unified shadcn/ui native look — white input backgrounds, standard borders, consistent section headers, description text, and footer buttons across all ~25 dialog forms.

---

## 1. Input & Border Token Fix

Two component changes and one CSS token change. No per-form work needed — these are global.

### `src/components/ui/input.tsx`
Change `bg-background` → `bg-transparent` in the className string.

**Why:** `DialogContent` uses `bg-card` (white). Inputs currently use `bg-background` (grey `220 14.3% 95.9%`), so they appear grey inside white dialogs. Making inputs transparent lets them inherit the white dialog background.

### `src/components/ui/select.tsx` (SelectTrigger)
Same change: `bg-background` → `bg-transparent` in the className string.

### `src/index.css` — light mode `--input` token
```css
/* Before */
--input: 220 13% 80%;

/* After (shadcn default) */
--input: 214.3 31.6% 91.4%;
```
Dark mode `--input: 215 27.9% 16.9%` is already correct — leave it unchanged.

---

## 2. FormSection Component

**File:** `src/components/ui/form-section.tsx`

```tsx
import { Separator } from "@/components/ui/separator";

interface FormSectionProps {
  title: string;
  children: React.ReactNode;
  first?: boolean; // true = no leading separator (for first section)
}

export function FormSection({ title, children, first = false }: FormSectionProps) {
  return (
    <div className="space-y-4">
      {!first && <Separator />}
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {children}
    </div>
  );
}
```

**Usage pattern inside a form:**
```tsx
<form className="space-y-6">
  <FormSection title="Basic Information" first>
    <div className="grid grid-cols-2 gap-4">
      {/* fields */}
    </div>
  </FormSection>

  <FormSection title="Payment Details">
    <div className="grid grid-cols-2 gap-4">
      {/* fields */}
    </div>
  </FormSection>
</form>
```

Replaces the current inconsistent pattern of raw `<h3 className="text-sm font-semibold">` + standalone `<Separator />` elements.

---

## 3. Per-Form Audit Checklist

Applied identically to all ~25 dialog forms listed below.

### Checklist

| Item | Current | Target |
|---|---|---|
| Section headers | Raw `<h3>` with varying classes | `<FormSection title="...">` (first section gets `first` prop) |
| `DialogDescription` | Missing in most forms | Short one-line description added to `DialogHeader` |
| `DialogFooter` buttons | Mostly correct, a few outliers | Cancel: `variant="outline"`, Submit: default (primary); cancel always left |
| Raw `<label>` elements | Some currency combo labels use bare `<label>` | Replace with `<Label>` from `@/components/ui/label` |
| Form spacing | Mix of `space-y-4`/`space-y-6` | `space-y-6` on the `<form>` element, `space-y-4` inside each `<FormSection>` |
| Standalone `<Separator />` | Sometimes duplicated or misplaced | Remove — `FormSection` handles separators |

### Forms in Scope

| Domain | Files |
|---|---|
| Insurance | `InsuranceFormDialog.tsx` |
| Stocks | `AddInvestmentModal.tsx`, `BuyInvestmentModal.tsx`, `SellInvestmentModal.tsx`, `EditTransactionModal.tsx`, `ManualDividendModal.tsx`, `ManualPriceModal.tsx`, `ImportInvestmentsModal.tsx` |
| Bank Accounts | `BankAccountFormDialog.tsx`, `AddTransactionModal.tsx`, `CsvImportDialog.tsx` |
| Crypto | `AddCryptoModal.tsx`, `BuyCryptoModal.tsx`, `SellCryptoModal.tsx`, `UpdateCryptoPriceModal.tsx`, `CoinGeckoApiKeyModal.tsx` |
| Loans | `LoanFormDialog.tsx` |
| Real Estate | `AddRealEstateModal.tsx`, `OneTimeCostModal.tsx` |
| Bonds | `BondsFormDialog.tsx` |
| Other Assets | `AddOtherAssetModal.tsx`, `BuyOtherAssetModal.tsx`, `SellOtherAssetModal.tsx` |
| Savings | `SavingsAccountFormDialog.tsx` |
| Categorization | `RuleEditDialog.tsx` |

### Single-section forms

Forms with only one group of fields (e.g. `CoinGeckoApiKeyModal`, `ManualPriceModal`) do not need `FormSection` at all — no section header makes sense when there is only one section. These forms should simply use `space-y-4` on the `<form>` element and skip the `FormSection` wrapper entirely.

### Not in scope
- Settings page inline forms (`ChangePasswordForm`, `ProfileForm`, `ApiKeysCard`) — these use `Card` components on a page, not dialogs. Separate effort.
- Delete/confirmation `AlertDialog` components — these have no form fields.

---

## 4. What Is Not Changing

- No logic, validation, or mutation code changes
- No translation keys added or removed
- No new form fields
- No changes to the Settings page
- No changes to dark mode `--input` token (already correct)
- The purple primary color (`--primary: 262.1 83.3% 57.8%`) is preserved as-is — submit buttons stay purple
