# Form Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all ~25 dialog forms to native shadcn/ui styling — transparent input backgrounds, standard border colour, consistent section headers via `FormSection`, `DialogDescription` on every form, and correct `DialogFooter` button patterns.

**Architecture:** Three global fixes (CSS token, Input, SelectTrigger) apply to every form automatically. A new `FormSection` component replaces ad-hoc `h3 + Separator` patterns. Each form is then audited individually against a fixed checklist.

**Tech Stack:** React 18, TypeScript, shadcn/ui (Radix), react-hook-form, Tailwind CSS, Tauri 2

---

## Checklist applied to every form

For each form task below, these four things are verified and fixed:

1. **DialogDescription** — present in `<DialogHeader>`
2. **Section headers** — uses `<FormSection>` (or omitted for single-section forms)
3. **Spacing** — `space-y-6` on `<form>`, `space-y-4` inside each section
4. **DialogFooter** — `<Button variant="outline">Cancel</Button>` left, primary `<Button type="submit">` right; or `<Button className="w-full">` for simple single-action modals where no cancel is conventional (e.g. update-price modals that already close on X)

---

## Task 1: Fix `--input` CSS token

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Change the `--input` value in the `:root` block**

In `src/index.css`, line 74, change:
```css
--input: 220 13% 80%;
```
to:
```css
--input: 214.3 31.6% 91.4%;
```
Dark mode value on line 222 (`--input: 215 27.9% 16.9%`) is correct — leave it unchanged.

- [ ] **Step 2: Run typecheck to confirm nothing broke**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "fix: restore --input border token to shadcn default"
```

---

## Task 2: Fix Input background

**Files:**
- Modify: `src/components/ui/input.tsx`

- [ ] **Step 1: Change `bg-background` to `bg-transparent`**

In `src/components/ui/input.tsx` line 12, change the className string — replace `bg-background` with `bg-transparent`:

```tsx
className={cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
  className
)}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/input.tsx
git commit -m "fix: input background transparent so dialogs show white inputs"
```

---

## Task 3: Fix SelectTrigger background

**Files:**
- Modify: `src/components/ui/select.tsx`

- [ ] **Step 1: Change `bg-background` to `bg-transparent` in SelectTrigger**

In `src/components/ui/select.tsx` line 22, in the `SelectTrigger` className, replace `bg-background` with `bg-transparent`:

```tsx
className={cn(
  "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
  className
)}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/select.tsx
git commit -m "fix: select trigger background transparent to match inputs"
```

---

## Task 4: Create FormSection component

**Files:**
- Create: `src/components/ui/form-section.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Separator } from "@/components/ui/separator";

interface FormSectionProps {
  title: string;
  children: React.ReactNode;
  /** Pass true for the first section — omits the leading separator */
  first?: boolean;
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

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/form-section.tsx
git commit -m "feat: add FormSection component for consistent form section headers"
```

---

## Task 5: InsuranceFormDialog

**Files:**
- Modify: `src/components/insurance/InsuranceFormDialog.tsx`

This is the reference implementation for multi-section forms. Study it carefully — later tasks follow the same pattern.

- [ ] **Step 1: Add FormSection import and DialogDescription**

Add to the imports block:
```tsx
import { FormSection } from "@/components/ui/form-section";
```

In the JSX, inside `<DialogHeader>`, add after `<DialogTitle>`:
```tsx
<DialogDescription>
  {policy ? t('form.editDescription') : t('form.addDescription')}
</DialogDescription>
```

Note: The translation keys `form.editDescription` and `form.addDescription` may not exist yet. Use a fallback English string directly if keys are missing:
```tsx
<DialogDescription>
  {policy ? "Edit insurance policy details." : "Add a new insurance policy."}
</DialogDescription>
```

- [ ] **Step 2: Replace section headers with FormSection**

Current pattern (appears three times):
```tsx
<h3 className="text-sm font-semibold">{t('modal.basicInfo')}</h3>
...
<Separator />
<h3 className="text-sm font-semibold">{t('modal.paymentDetails')}</h3>
...
<Separator />
<h3 className="text-sm font-semibold">{t('modal.additionalInfo')}</h3>
```

Replace the form body (inside `<form className="space-y-4">`) with `space-y-6` and wrap each section in `<FormSection>`. The three `<Separator />` elements and three `<h3>` elements are removed — `FormSection` handles them:

```tsx
<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
  <FormSection title={t('modal.basicInfo')} first>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* all existing BasicInfo fields unchanged */}
    </div>
  </FormSection>

  <FormSection title={t('modal.paymentDetails')}>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* all existing PaymentDetails fields unchanged */}
    </div>
  </FormSection>

  <FormSection title={t('modal.additionalInfo')}>
    {/* coverage limits + notes fields unchanged */}
  </FormSection>
</form>
```

Remove all three standalone `<Separator />` imports usage and the three `<h3>` elements.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/insurance/InsuranceFormDialog.tsx
git commit -m "style: unify InsuranceFormDialog to shadcn form layout"
```

---

## Task 6: SellInvestmentModal + EditTransactionModal

These forms each have a single styled section header using a custom border-b approach. Replace with `FormSection` and standardise spacing.

**Files:**
- Modify: `src/components/stocks/SellInvestmentModal.tsx`
- Modify: `src/components/stocks/EditTransactionModal.tsx`

### SellInvestmentModal

- [ ] **Step 1: Add FormSection import**

```tsx
import { FormSection } from "@/components/ui/form-section";
```

- [ ] **Step 2: Replace section header and fix form spacing**

Current form opening and section:
```tsx
<form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 py-4">
  <div className="space-y-4">
    <h3 className="text-sm font-semibold text-foreground border-b pb-2">
      {t('modal.sell.transactionDetails')}
    </h3>
    <div className="grid gap-4">
      ...fields...
    </div>
  </div>
  <Button type="submit" className="w-full" ...>
```

Replace with:
```tsx
<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
  <FormSection title={t('modal.sell.transactionDetails')} first>
    <div className="grid gap-4">
      ...fields unchanged...
    </div>
  </FormSection>
  <Button type="submit" className="w-full" disabled={sellInvestment.isPending}>
    {sellInvestment.isPending ? tc('status.selling') : t('modal.sell.sellInvestment')}
  </Button>
</form>
```

### EditTransactionModal

- [ ] **Step 3: Add FormSection import**

```tsx
import { FormSection } from "@/components/ui/form-section";
```

- [ ] **Step 4: Replace section header and fix form spacing**

Current:
```tsx
<form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 py-4">
  <div className="space-y-4">
    <h3 className="text-sm font-semibold text-foreground border-b pb-2">
      Transaction Details
    </h3>
    <div className="grid gap-4">
      ...fields...
    </div>
  </div>
  <Button type="submit" className="w-full" ...>
```

Replace with:
```tsx
<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
  <FormSection title="Transaction Details" first>
    <div className="grid gap-4">
      ...fields unchanged...
    </div>
  </FormSection>
  <Button type="submit" className="w-full" disabled={updateTransaction.isPending}>
    {updateTransaction.isPending ? "Updating..." : "Update Transaction"}
  </Button>
</form>
```

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/components/stocks/SellInvestmentModal.tsx src/components/stocks/EditTransactionModal.tsx
git commit -m "style: replace border-b section headers with FormSection in sell/edit modals"
```

---

## Task 7: BuyInvestmentModal + BuyCryptoModal + SellCryptoModal

These are simple single-section forms. They have `DialogDescription` already. The only fix needed: move the submit button into a `DialogFooter` with a cancel button.

**Files:**
- Modify: `src/components/stocks/BuyInvestmentModal.tsx`
- Modify: `src/components/crypto/BuyCryptoModal.tsx`
- Modify: `src/components/crypto/SellCryptoModal.tsx`

Pattern for all three: add `DialogFooter` import, remove the `w-full` submit button from inside the form, add it in a `DialogFooter` after `</Form>`.

### BuyInvestmentModal

- [ ] **Step 1: Add DialogFooter to imports**

```tsx
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
```

- [ ] **Step 2: Move submit button to DialogFooter**

Remove from inside `<form>`:
```tsx
<Button type="submit" className="w-full" disabled={buyMutation.isPending}>
  {buyMutation.isPending ? tc('status.adding') : t('modal.buy.addPurchase')}
</Button>
```

Add after `</Form>`, before `</DialogContent>`:
```tsx
<DialogFooter>
  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
    {tc('buttons.cancel')}
  </Button>
  <Button type="submit" form="buy-investment-form" disabled={buyMutation.isPending}>
    {buyMutation.isPending ? tc('status.adding') : t('modal.buy.addPurchase')}
  </Button>
</DialogFooter>
```

Add `id="buy-investment-form"` to the `<form>` element so the external submit button works:
```tsx
<form id="buy-investment-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
```

### BuyCryptoModal

- [ ] **Step 3: Apply same pattern as BuyInvestmentModal**

Read `src/components/crypto/BuyCryptoModal.tsx` to find the current submit button location, then:
- Add `DialogFooter` to Dialog imports
- Add `id="buy-crypto-form"` to the `<form>` element
- Remove the `w-full` submit button from inside the form
- Add `<DialogFooter>` after `</Form>` with cancel + submit buttons

```tsx
<DialogFooter>
  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
    {tc('buttons.cancel')}
  </Button>
  <Button type="submit" form="buy-crypto-form" disabled={buyMutation.isPending}>
    {buyMutation.isPending ? tc('status.adding') : t('modal.buy.addPurchase')}
  </Button>
</DialogFooter>
```

### SellCryptoModal

- [ ] **Step 4: Apply same pattern**

Read `src/components/crypto/SellCryptoModal.tsx`, then:
- Add `DialogFooter` to imports
- Add `id="sell-crypto-form"` to `<form>`
- Remove full-width submit from inside form
- Add DialogFooter after `</Form>`

```tsx
<DialogFooter>
  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
    {tc('buttons.cancel')}
  </Button>
  <Button type="submit" form="sell-crypto-form" disabled={sellMutation.isPending}>
    {sellMutation.isPending ? tc('status.selling') : t('modal.sell.sellInvestment')}
  </Button>
</DialogFooter>
```

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/components/stocks/BuyInvestmentModal.tsx src/components/crypto/BuyCryptoModal.tsx src/components/crypto/SellCryptoModal.tsx
git commit -m "style: add DialogFooter with cancel button to buy/sell modals"
```

---

## Task 8: BuyOtherAssetModal + SellOtherAssetModal

Same pattern as Task 7 — single-section forms with DialogDescription but missing cancel button.

**Files:**
- Modify: `src/components/other-assets/BuyOtherAssetModal.tsx`
- Modify: `src/components/other-assets/SellOtherAssetModal.tsx`

- [ ] **Step 1: BuyOtherAssetModal — add DialogFooter import and move submit button**

Add `DialogFooter` to dialog imports. Add `id="buy-asset-form"` to `<form>`. Remove the in-form submit button. Add after `</Form>`:

```tsx
<DialogFooter>
  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
    {tc('buttons.cancel')}
  </Button>
  <Button type="submit" form="buy-asset-form" disabled={buyMutation.isPending}>
    {buyMutation.isPending ? tc('status.adding') : t('modal.buy.submit')}
  </Button>
</DialogFooter>
```

Read the file first to confirm the exact submit button text key used.

- [ ] **Step 2: SellOtherAssetModal — same pattern**

Add `DialogFooter` to imports. Add `id="sell-asset-form"` to `<form>`. Remove in-form submit. Add after `</Form>`:

```tsx
<DialogFooter>
  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
    {tc('buttons.cancel')}
  </Button>
  <Button type="submit" form="sell-asset-form" disabled={sellMutation.isPending}>
    {sellMutation.isPending ? tc('status.selling') : t('modal.sell.submit')}
  </Button>
</DialogFooter>
```

Read the file first to confirm the exact submit button text key.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/components/other-assets/BuyOtherAssetModal.tsx src/components/other-assets/SellOtherAssetModal.tsx
git commit -m "style: add DialogFooter with cancel to other-asset buy/sell modals"
```

---

## Task 9: ManualPriceModal + ManualDividendModal + UpdateCryptoPriceModal

These modals have a special button layout: primary submit + optional destructive delete, both in a `flex gap-2` row. The delete button is conditionally shown. This layout is intentional and stays. Only fix: add `DialogDescription`.

**Files:**
- Modify: `src/components/stocks/ManualPriceModal.tsx`
- Modify: `src/components/stocks/ManualDividendModal.tsx`
- Modify: `src/components/crypto/UpdateCryptoPriceModal.tsx`

- [ ] **Step 1: ManualPriceModal — add DialogDescription import and element**

Add to dialog imports:
```tsx
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
```

In the JSX after `<DialogTitle>`:
```tsx
<DialogDescription>
  {t('modals.updatePrice.description')}
</DialogDescription>
```

If the translation key doesn't exist, use:
```tsx
<DialogDescription>
  Set a manual price override for this holding.
</DialogDescription>
```

- [ ] **Step 2: ManualDividendModal — same fix**

Add `DialogDescription` to the dialog imports, then in JSX after `<DialogTitle>`:
```tsx
<DialogDescription>
  {t('modals.updateDividend.description')}
</DialogDescription>
```

Fallback if key missing:
```tsx
<DialogDescription>
  Set a manual annual dividend per share for this holding.
</DialogDescription>
```

- [ ] **Step 3: UpdateCryptoPriceModal — same fix**

Add `DialogDescription` to imports, then in JSX after `<DialogTitle>`:
```tsx
<DialogDescription>
  {t('modals.updatePrice.description')}
</DialogDescription>
```

Fallback if key missing:
```tsx
<DialogDescription>
  Set a manual price override for this crypto holding.
</DialogDescription>
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/components/stocks/ManualPriceModal.tsx src/components/stocks/ManualDividendModal.tsx src/components/crypto/UpdateCryptoPriceModal.tsx
git commit -m "style: add DialogDescription to manual price/dividend modals"
```

---

## Task 10: AddInvestmentModal + AddCryptoModal

Both are add-new-asset forms with search functionality. Read each file first to check current state of section headers and DialogDescription.

**Files:**
- Modify: `src/components/stocks/AddInvestmentModal.tsx`
- Modify: `src/components/crypto/AddCryptoModal.tsx`

- [ ] **Step 1: Read AddInvestmentModal.tsx lines 156-320 to see the full JSX**

```bash
# Already partially read — review the form JSX structure:
# Lines 156+ show: has DialogDescription, no h3 headers, space-y-4 on form, submit button at bottom inside form
```

- [ ] **Step 2: AddInvestmentModal — move submit to DialogFooter**

Current (inside form, after all fields):
```tsx
<Button type="submit" className="w-full" disabled={createInvestment.isPending}>
```

Add `DialogFooter` to dialog imports. Add `id="add-investment-form"` to `<form>`. Remove the in-form submit button. Add after `</Form>`:

```tsx
<DialogFooter>
  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
    {tc('buttons.cancel')}
  </Button>
  <Button type="submit" form="add-investment-form" disabled={createInvestment.isPending}>
    {createInvestment.isPending ? tc('status.adding') : t('modal.add.submit')}
  </Button>
</DialogFooter>
```

Read the file to confirm exact submit button label key.

- [ ] **Step 3: AddCryptoModal — same pattern**

Read `src/components/crypto/AddCryptoModal.tsx` from line 80 to end to see the form JSX. Then:
- Add `DialogFooter` to dialog imports
- Add `id="add-crypto-form"` to `<form>`
- Remove in-form submit button
- Add DialogFooter with cancel + submit

```tsx
<DialogFooter>
  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
    {tc('buttons.cancel')}
  </Button>
  <Button type="submit" form="add-crypto-form" disabled={createCrypto.isPending}>
    {createCrypto.isPending ? tc('status.adding') : t('modal.add.submit')}
  </Button>
</DialogFooter>
```

Read the file to confirm the mutation name and exact submit key.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/components/stocks/AddInvestmentModal.tsx src/components/crypto/AddCryptoModal.tsx
git commit -m "style: add DialogFooter with cancel to add investment/crypto modals"
```

---

## Task 11: BankAccountFormDialog

This form uses controlled state (no react-hook-form), raw `Label` components (correct for this pattern), already has `DialogDescription` and correct `DialogFooter` buttons. Only fix needed: spacing standardisation.

**Files:**
- Modify: `src/components/bank-accounts/BankAccountFormDialog.tsx`

- [ ] **Step 1: Fix spacing**

Current form body wrapper:
```tsx
<div className="space-y-4 py-4">
```

Change to (remove `py-4` — dialog already has `p-6`):
```tsx
<div className="space-y-4">
```

The `space-y-4` is correct here since this form has no named sections — all fields are flat. No `FormSection` needed.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/components/bank-accounts/BankAccountFormDialog.tsx
git commit -m "style: remove extra py-4 padding in BankAccountFormDialog"
```

---

## Task 12: BondsFormDialog

Uses raw `Label`, controlled state. Has `DialogDescription` and correct `DialogFooter`. Read the rest of the file (line 100+) to see the footer and confirm buttons.

**Files:**
- Modify: `src/components/bonds/BondsFormDialog.tsx`

- [ ] **Step 1: Read lines 100-230 to see the form body and footer**

```bash
# From reading: lines 113-230 show: has DialogDescription already, uses Label not FormLabel
# Footer needs to be checked - read the file
```

- [ ] **Step 2: Verify DialogFooter has correct button order**

Read `src/components/bonds/BondsFormDialog.tsx` lines 195–230. The footer should be:
```tsx
<DialogFooter>
  <Button variant="outline" onClick={handleClose}>
    {tc('buttons.cancel')}
  </Button>
  <Button onClick={handleSubmit} disabled={isLoading}>
    {isLoading ? tc('status.saving') : isEditMode ? tc('buttons.saveChanges') : t('addBond')}
  </Button>
</DialogFooter>
```

If it's different, correct the button order and variants to match the above pattern.

- [ ] **Step 3: Fix spacing**

The form body container:
```tsx
<div className="space-y-4 py-4">
```
Change to:
```tsx
<div className="space-y-4">
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/components/bonds/BondsFormDialog.tsx
git commit -m "style: unify BondsFormDialog spacing and footer buttons"
```

---

## Task 13: SavingsAccountFormDialog

Same pattern as BondsFormDialog — controlled state, raw Label, already has DialogDescription and DialogFooter.

**Files:**
- Modify: `src/components/savings/SavingsAccountFormDialog.tsx`

- [ ] **Step 1: Read the full file (line 76+) to see the form JSX and footer**

Look for the form body wrapper class and the `<DialogFooter>` section.

- [ ] **Step 2: Fix spacing and verify footer**

Change form body wrapper from `space-y-4 py-4` to `space-y-4`. Ensure footer is:
```tsx
<DialogFooter>
  <Button variant="outline" onClick={() => onOpenChange(false)}>
    {tc('buttons.cancel')}
  </Button>
  <Button onClick={handleSubmit} disabled={isLoading}>
    {isLoading ? tc('status.saving') : isEditMode ? tc('buttons.saveChanges') : t('addSavings')}
  </Button>
</DialogFooter>
```

Read the file to confirm actual translation keys and function names before editing.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/components/savings/SavingsAccountFormDialog.tsx
git commit -m "style: unify SavingsAccountFormDialog spacing and footer"
```

---

## Task 14: AddOtherAssetModal

Uses raw `Label` + `form.register()` directly (no `FormField`/`FormItem` wrappers). Missing `DialogDescription` and cancel button.

**Files:**
- Modify: `src/components/other-assets/AddOtherAssetModal.tsx`

- [ ] **Step 1: Add DialogDescription to DialogHeader**

Current:
```tsx
<DialogHeader>
  <DialogTitle>{t('modal.add.title')}</DialogTitle>
</DialogHeader>
```

Add `DialogDescription` to imports. Change to:
```tsx
<DialogHeader>
  <DialogTitle>{t('modal.add.title')}</DialogTitle>
  <DialogDescription>
    {t('modal.add.description')}
  </DialogDescription>
</DialogHeader>
```

If `modal.add.description` key doesn't exist, use:
```tsx
<DialogDescription>
  Add a new custom asset to your portfolio.
</DialogDescription>
```

- [ ] **Step 2: Add cancel button to DialogFooter**

Current footer:
```tsx
<DialogFooter>
  <Button type="submit" disabled={mutation.isPending}>
    {mutation.isPending ? tc('status.adding') : t('modal.add.submit')}
  </Button>
</DialogFooter>
```

Change to:
```tsx
<DialogFooter>
  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
    {tc('buttons.cancel')}
  </Button>
  <Button type="submit" disabled={mutation.isPending}>
    {mutation.isPending ? tc('status.adding') : t('modal.add.submit')}
  </Button>
</DialogFooter>
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/components/other-assets/AddOtherAssetModal.tsx
git commit -m "style: add DialogDescription and cancel button to AddOtherAssetModal"
```

---

## Task 15: RuleEditDialog

Uses raw `Label`, controlled state. Has `DialogDescription` in imports — verify it's used in JSX.

**Files:**
- Modify: `src/components/categorization/RuleEditDialog.tsx`

- [ ] **Step 1: Read lines 80-200 of RuleEditDialog.tsx to see JSX**

Look for the `<DialogHeader>` section and `<DialogFooter>`.

- [ ] **Step 2: Ensure DialogDescription is present in DialogHeader**

The file imports `DialogDescription`. Confirm it appears in the JSX:
```tsx
<DialogHeader>
  <DialogTitle>...</DialogTitle>
  <DialogDescription>
    {t('dialog.description')}
  </DialogDescription>
</DialogHeader>
```

If it's missing from JSX even though it's imported, add it with a fallback:
```tsx
<DialogDescription>
  {rule ? tCommon('edit') + ' categorization rule.' : 'Create a new categorization rule.'}
</DialogDescription>
```

- [ ] **Step 3: Verify DialogFooter button order**

Footer should have outline cancel left, primary save right:
```tsx
<DialogFooter>
  <Button variant="outline" onClick={() => onOpenChange(false)}>
    {tCommon('buttons.cancel')}
  </Button>
  <Button onClick={handleSave} disabled={isLoading}>
    {isLoading ? tCommon('status.saving') : tCommon('buttons.save')}
  </Button>
</DialogFooter>
```

Read the file to confirm actual handler names and keys before editing.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/components/categorization/RuleEditDialog.tsx
git commit -m "style: unify RuleEditDialog description and footer"
```

---

## Task 16: LoanFormDialog

Already has `DialogDescription` and correct `DialogFooter` (cancel `variant="outline"` left, primary submit right). The form has no section headers (single-section flat form, `space-y-4` is correct). No changes needed — verify and skip.

**Files:**
- Read only: `src/components/loans/LoanFormDialog.tsx`

- [ ] **Step 1: Confirm form is already correct**

Read lines 130–325 and verify:
1. `<DialogDescription>` is present in `<DialogHeader>` ✓ (already confirmed)
2. No `<h3>` section headers present ✓
3. `<DialogFooter>` has `variant="outline"` cancel + primary submit ✓ (lines 309–316 already correct)

If all three are confirmed, no edits needed. Skip directly to Task 17.

---

## Task 17: OneTimeCostModal

**Files:**
- Modify: `src/components/real-estate/OneTimeCostModal.tsx`

- [ ] **Step 1: Read lines 60-180 to see the full form JSX**

- [ ] **Step 2: Apply checklist**

Based on reading: this form uses `Form`/`FormField` (react-hook-form) with a `DialogTrigger`. Verify:
1. `DialogDescription` is present in `DialogHeader` — add if missing
2. `DialogFooter` has cancel + submit — add cancel if missing
3. `space-y-4` on form — correct, single-section form

Add `DialogDescription` if absent:
```tsx
<DialogDescription>
  {cost ? t('oneTimeCost.editDescription') : t('oneTimeCost.addDescription')}
</DialogDescription>
```

Fallback:
```tsx
<DialogDescription>
  {cost ? "Edit this one-time cost." : "Add a one-time cost to this property."}
</DialogDescription>
```

If no `DialogFooter` exists, the submit button is likely a `w-full` button inside the form. Apply the `id` + `DialogFooter` pattern from Task 7.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/components/real-estate/OneTimeCostModal.tsx
git commit -m "style: unify OneTimeCostModal to shadcn form layout"
```

---

## Task 18: AddRealEstateModal

This is the most complex form — multiple sections with `Separator`, `useFieldArray`, linked loan/insurance selectors. Read it carefully before editing.

**Files:**
- Modify: `src/components/real-estate/AddRealEstateModal.tsx`

- [ ] **Step 1: Read the full file — lines 48-600**

```bash
# Read src/components/real-estate/AddRealEstateModal.tsx in chunks to understand all sections
```

- [ ] **Step 2: Add FormSection import**

```tsx
import { FormSection } from "@/components/ui/form-section";
```

- [ ] **Step 3: Apply checklist**

1. Verify `DialogDescription` is in `DialogHeader` — add if missing
2. Find all `<Separator />` + `<h3>` pairs — replace with `<FormSection title="..." first={isFirst}>` wrappers
3. Change `<form className="space-y-4">` to `<form className="space-y-6">`
4. Verify `DialogFooter` has cancel + submit with correct variants

For the section replacement, the pattern is:
```tsx
// Before:
<h3 className="text-sm font-semibold">{t('modal.section.basic')}</h3>
<div className="grid ...">...fields...</div>
<Separator />
<h3 className="text-sm font-semibold">{t('modal.section.financial')}</h3>

// After:
<FormSection title={t('modal.section.basic')} first>
  <div className="grid ...">...fields...</div>
</FormSection>
<FormSection title={t('modal.section.financial')}>
  ...fields...
</FormSection>
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/components/real-estate/AddRealEstateModal.tsx
git commit -m "style: unify AddRealEstateModal to shadcn form layout"
```

---

## Task 19: AddTransactionModal (BankAccounts)

**Files:**
- Modify: `src/components/bank-accounts/AddTransactionModal.tsx`

- [ ] **Step 1: Read lines 100-260 to see the full form JSX**

- [ ] **Step 2: Apply checklist**

This form uses react-hook-form with `Form`/`FormField`. Check:
1. `DialogDescription` in `DialogHeader` — add if missing
2. No section headers expected (it's a flat transaction form) — skip `FormSection`
3. `DialogFooter` with cancel + submit — the form currently has a `DialogTrigger` (self-contained). The footer should be:

```tsx
<DialogFooter>
  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
    {tc('buttons.cancel')}
  </Button>
  <Button type="submit" disabled={createTransaction.isLoading}>
    {createTransaction.isLoading ? tc('status.adding') : tc('buttons.add')}
  </Button>
</DialogFooter>
```

Read the file to find the mutation name and current footer structure.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/components/bank-accounts/AddTransactionModal.tsx
git commit -m "style: unify AddTransactionModal to shadcn form layout"
```

---

## Task 20: ImportInvestmentsModal + CsvImportDialog (wizards — button variants only)

Both are multi-step wizards. They have `DialogDescription` already and complex state-driven UI. Do not add `FormSection`. Only fix: verify footer buttons on each step follow the cancel-left, primary-right pattern.

**Files:**
- Modify: `src/components/stocks/ImportInvestmentsModal.tsx`
- Modify: `src/components/bank-accounts/CsvImportDialog.tsx`

- [ ] **Step 1: Read ImportInvestmentsModal.tsx lines 76-end to see all step footer buttons**

For each step (`select`, `preview`, `importing`, `done`), ensure action buttons use default variant (primary) and back/cancel buttons use `variant="outline"`. Fix any that don't match.

- [ ] **Step 2: Read CsvImportDialog.tsx lines 80-end to see all step footer buttons**

Same check: for each step (`select`, `preview`, `import`, `done`), primary action = default variant, secondary/cancel = `variant="outline"`.

- [ ] **Step 3: Apply any fixes needed**

If any buttons need variant correction, edit them following this pattern:
```tsx
<DialogFooter>
  <Button variant="outline" onClick={handleBack}>
    {tc('buttons.back')}
  </Button>
  <Button onClick={handleNext} disabled={isLoading}>
    {tc('buttons.next')}
  </Button>
</DialogFooter>
```

Read the actual code first to use the correct handler names and translation keys.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/components/stocks/ImportInvestmentsModal.tsx src/components/bank-accounts/CsvImportDialog.tsx
git commit -m "style: unify wizard footer button variants in import modals"
```

---

## Task 21: Final verification

- [ ] **Step 1: Run full typecheck**

```bash
npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 2: Run tests**

```bash
npm test
```
Expected: all passing (form changes are pure JSX/CSS — no logic changed).

- [ ] **Step 3: Run Rust tests**

```bash
cd src-tauri && cargo test
```
Expected: all passing (backend untouched).

- [ ] **Step 4: Final commit if any stray changes**

```bash
git status
# If clean, done. If any uncommitted changes:
git add <files>
git commit -m "style: final form unification cleanup"
```
