# Unified Empty States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace plain in-table "no data" text on 8 pages with the same rich empty state card pattern used by Bank Accounts (icon + title + description + CTA button).

**Architecture:** Create a shared `EmptyState` component. Each page conditionally renders it instead of the table when raw data is empty. Tables with search/filter keep their existing plain-text "no results" row for the filtered-to-zero case. No changes to table components required.

**Tech Stack:** React 18, TypeScript, react-i18next, shadcn/ui (`Card`, `CardContent`, `Button`)

---

## File Map

| Action | File |
|---|---|
| Create | `src/components/common/EmptyState.tsx` |
| Modify (EN i18n) | `src/i18n/locales/en/stocks.json` |
| Modify (EN i18n) | `src/i18n/locales/en/crypto.json` |
| Modify (EN i18n) | `src/i18n/locales/en/bonds.json` |
| Modify (EN i18n) | `src/i18n/locales/en/loans.json` |
| Modify (EN i18n) | `src/i18n/locales/en/insurance.json` |
| Modify (EN i18n) | `src/i18n/locales/en/otherAssets.json` |
| Modify (EN i18n) | `src/i18n/locales/en/realEstate.json` |
| Modify (EN i18n) | `src/i18n/locales/en/savings.json` |
| Modify (CS i18n) | `src/i18n/locales/cs/stocks.json` |
| Modify (CS i18n) | `src/i18n/locales/cs/crypto.json` |
| Modify (CS i18n) | `src/i18n/locales/cs/bonds.json` |
| Modify (CS i18n) | `src/i18n/locales/cs/loans.json` |
| Modify (CS i18n) | `src/i18n/locales/cs/insurance.json` |
| Modify (CS i18n) | `src/i18n/locales/cs/otherAssets.json` |
| Modify (CS i18n) | `src/i18n/locales/cs/realEstate.json` |
| Modify (CS i18n) | `src/i18n/locales/cs/savings.json` |
| Modify (page) | `src/pages/Stocks.tsx` |
| Modify (page) | `src/pages/Crypto.tsx` |
| Modify (page) | `src/pages/Bonds.tsx` |
| Modify (page) | `src/pages/Loans.tsx` |
| Modify (page) | `src/pages/Insurance.tsx` |
| Modify (page) | `src/pages/OtherAssets.tsx` |
| Modify (page) | `src/pages/RealEstate.tsx` |
| Modify (page) | `src/pages/Accounts.tsx` |

---

### Task 1: Create `EmptyState` component

**Files:**
- Create: `src/components/common/EmptyState.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/components/common/EmptyState.tsx
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="text-muted-foreground mb-4">{icon}</div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground text-center max-w-sm mt-2">{description}</p>
        {action && <div className="mt-4">{action}</div>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd /path/to/Moony-tauri && npm run typecheck
```

Expected: no errors related to EmptyState.

- [ ] **Step 3: Commit**

```bash
git add src/components/common/EmptyState.tsx
git commit -m "feat: add shared EmptyState component"
```

---

### Task 2: Add EN i18n keys for all 8 namespaces

**Files:**
- Modify: `src/i18n/locales/en/stocks.json`
- Modify: `src/i18n/locales/en/crypto.json`
- Modify: `src/i18n/locales/en/bonds.json`
- Modify: `src/i18n/locales/en/loans.json`
- Modify: `src/i18n/locales/en/insurance.json`
- Modify: `src/i18n/locales/en/otherAssets.json`
- Modify: `src/i18n/locales/en/realEstate.json`
- Modify: `src/i18n/locales/en/savings.json`

- [ ] **Step 1: Add to `en/stocks.json`**

Insert after the `"loading"` line:

```json
    "empty": {
        "title": "No investments yet",
        "description": "Add your first stock or ETF to start tracking your portfolio."
    },
```

- [ ] **Step 2: Add to `en/crypto.json`**

Insert after the `"loading"` line:

```json
    "empty": {
        "title": "No crypto holdings yet",
        "description": "Add your first cryptocurrency to start tracking your holdings."
    },
```

- [ ] **Step 3: Add to `en/bonds.json`**

Insert after the `"loading"` line:

```json
    "empty": {
        "title": "No bonds yet",
        "description": "Add your first bond to start tracking your fixed-income investments."
    },
```

- [ ] **Step 4: Add to `en/loans.json`**

Insert after the `"loading"` line:

```json
    "empty": {
        "title": "No loans yet",
        "description": "Add your first loan to start tracking your liabilities."
    },
```

- [ ] **Step 5: Add to `en/insurance.json`**

Insert after the `"loading"` line:

```json
    "empty": {
        "title": "No insurance policies yet",
        "description": "Add your first policy to start tracking your coverage."
    },
```

- [ ] **Step 6: Add to `en/otherAssets.json`**

Insert after the `"loading"` line:

```json
    "empty": {
        "title": "No assets yet",
        "description": "Add your first asset to start tracking other valuables."
    },
```

- [ ] **Step 7: Add to `en/realEstate.json`**

Insert after the `"loading"` line:

```json
    "empty": {
        "title": "No properties yet",
        "description": "Add your first property to start tracking your real estate."
    },
```

- [ ] **Step 8: Add to `en/savings.json`**

Insert after the `"loading"` line:

```json
    "empty": {
        "title": "No savings accounts yet",
        "description": "Add your first savings account to start tracking your deposits."
    },
```

- [ ] **Step 9: Commit**

```bash
git add src/i18n/locales/en/
git commit -m "i18n(en): add empty state keys for all asset pages"
```

---

### Task 3: Add CS i18n keys for all 8 namespaces

**Files:**
- Modify: `src/i18n/locales/cs/stocks.json`
- Modify: `src/i18n/locales/cs/crypto.json`
- Modify: `src/i18n/locales/cs/bonds.json`
- Modify: `src/i18n/locales/cs/loans.json`
- Modify: `src/i18n/locales/cs/insurance.json`
- Modify: `src/i18n/locales/cs/otherAssets.json`
- Modify: `src/i18n/locales/cs/realEstate.json`
- Modify: `src/i18n/locales/cs/savings.json`

Mirror the same `"empty"` object at the same position (after `"loading"`) in each CS file.

- [ ] **Step 1: Add to `cs/stocks.json`**

```json
    "empty": {
        "title": "Zatím žádné investice",
        "description": "Přidejte svou první akcii nebo ETF a začněte sledovat portfolio."
    },
```

- [ ] **Step 2: Add to `cs/crypto.json`**

```json
    "empty": {
        "title": "Zatím žádné kryptoměny",
        "description": "Přidejte svou první kryptoměnu a začněte sledovat své pozice."
    },
```

- [ ] **Step 3: Add to `cs/bonds.json`**

```json
    "empty": {
        "title": "Zatím žádné dluhopisy",
        "description": "Přidejte svůj první dluhopis a začněte sledovat investice s fixním výnosem."
    },
```

- [ ] **Step 4: Add to `cs/loans.json`**

```json
    "empty": {
        "title": "Zatím žádné půjčky",
        "description": "Přidejte svou první půjčku a začněte sledovat své závazky."
    },
```

- [ ] **Step 5: Add to `cs/insurance.json`**

```json
    "empty": {
        "title": "Zatím žádné pojistky",
        "description": "Přidejte svou první pojistku a začněte sledovat své pojistné smlouvy."
    },
```

- [ ] **Step 6: Add to `cs/otherAssets.json`**

```json
    "empty": {
        "title": "Zatím žádná aktiva",
        "description": "Přidejte své první aktivum a začněte sledovat ostatní cennosti."
    },
```

- [ ] **Step 7: Add to `cs/realEstate.json`**

```json
    "empty": {
        "title": "Zatím žádné nemovitosti",
        "description": "Přidejte svou první nemovitost a začněte sledovat svůj realitní majetek."
    },
```

- [ ] **Step 8: Add to `cs/savings.json`**

```json
    "empty": {
        "title": "Zatím žádné spořicí účty",
        "description": "Přidejte svůj první spořicí účet a začněte sledovat své vklady."
    },
```

- [ ] **Step 9: Commit**

```bash
git add src/i18n/locales/cs/
git commit -m "i18n(cs): add empty state keys for all asset pages"
```

---

### Task 4: Update Stocks page

**Files:**
- Modify: `src/pages/Stocks.tsx`

The `Stocks.tsx` page computes `holdings` from `investments`. When `holdings.length === 0`, render `EmptyState` instead of `InvestmentsTable`. The `PortfolioValueTrendChart` and `InvestmentsSummary` remain visible (they show zeros gracefully).

- [ ] **Step 1: Add imports**

At the top of `src/pages/Stocks.tsx`, add these two imports alongside the existing import block:

```tsx
import { TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
```

- [ ] **Step 2: Replace `<InvestmentsTable>` with conditional**

Find this block in the return:

```tsx
      <InvestmentsTable
        holdings={holdings}
        isLoading={refreshPricesMutation.isPending}
        onViewDetail={handleViewDetailClick}
      />
```

Replace with:

```tsx
      {holdings.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-12 w-12" />}
          title={t('empty.title')}
          description={t('empty.description')}
          action={<AddInvestmentModal />}
        />
      ) : (
        <InvestmentsTable
          holdings={holdings}
          isLoading={refreshPricesMutation.isPending}
          onViewDetail={handleViewDetailClick}
        />
      )}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Stocks.tsx
git commit -m "feat: add rich empty state to Stocks page"
```

---

### Task 5: Update Crypto page

**Files:**
- Modify: `src/pages/Crypto.tsx`

Same pattern as Stocks. `Crypto.tsx` computes `holdings` from `cryptoInvestments`.

- [ ] **Step 1: Add imports**

```tsx
import { Bitcoin } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
```

- [ ] **Step 2: Replace `<CryptoTable>` with conditional**

Find:

```tsx
            <CryptoTable
                holdings={holdings}
                isLoading={refreshPricesMutation.isPending}
```

(The full block ends with `/>` or `/>` after a few more props — locate the full `<CryptoTable ... />` block.)

Replace with:

```tsx
            {holdings.length === 0 ? (
              <EmptyState
                icon={<Bitcoin className="h-12 w-12" />}
                title={t('empty.title')}
                description={t('empty.description')}
                action={<AddCryptoModal />}
              />
            ) : (
              <CryptoTable
                holdings={holdings}
                isLoading={refreshPricesMutation.isPending}
              />
            )}
```

Note: `AddCryptoModal` is already imported in `Crypto.tsx`.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Crypto.tsx
git commit -m "feat: add rich empty state to Crypto page"
```

---

### Task 6: Update Bonds page

**Files:**
- Modify: `src/pages/Bonds.tsx`

`Bonds.tsx` receives `bonds` from `useBonds()`. No search — when `bonds.length === 0`, show EmptyState.

- [ ] **Step 1: Add imports**

```tsx
import { Banknote } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
```

- [ ] **Step 2: Replace `<BondsTable>` with conditional**

Find:

```tsx
      <BondsTable bonds={bonds} onEdit={handleEditClick} onDelete={handleDeleteClick} />
```

Replace with:

```tsx
      {bonds.length === 0 ? (
        <EmptyState
          icon={<Banknote className="h-12 w-12" />}
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Button onClick={handleAddClick} className="transition-all duration-200">
              <Plus className="mr-2 h-4 w-4" />
              {t('addBond')}
            </Button>
          }
        />
      ) : (
        <BondsTable bonds={bonds} onEdit={handleEditClick} onDelete={handleDeleteClick} />
      )}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Bonds.tsx
git commit -m "feat: add rich empty state to Bonds page"
```

---

### Task 7: Update Loans page

**Files:**
- Modify: `src/pages/Loans.tsx`

`Loans.tsx` receives `loans` from `useLoans()`.

- [ ] **Step 1: Add imports**

```tsx
import { CreditCard } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
```

- [ ] **Step 2: Replace `<LoansTable>` with conditional**

Find:

```tsx
      <LoansTable
        loans={loans}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
      />
```

Replace with:

```tsx
      {loans.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-12 w-12" />}
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Button onClick={handleAddClick} className="transition-all duration-200">
              <Plus className="mr-2 h-4 w-4" />
              {t('addLoan')}
            </Button>
          }
        />
      ) : (
        <LoansTable
          loans={loans}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
        />
      )}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Loans.tsx
git commit -m "feat: add rich empty state to Loans page"
```

---

### Task 8: Update Insurance page

**Files:**
- Modify: `src/pages/Insurance.tsx`

`Insurance.tsx` already fetches `policies` with `useQuery`. `InsuranceList` fetches the same data internally but we check at the page level. The add button for Insurance uses `InsuranceFormDialog` with a `trigger` prop — we pass the same trigger pattern into the EmptyState action.

- [ ] **Step 1: Add imports**

```tsx
import { EmptyState } from "@/components/common/EmptyState";
```

(`Shield` and `Plus` are already imported. `Button` and `InsuranceFormDialog` are already imported.)

- [ ] **Step 2: Replace `<InsuranceList />` with conditional**

Find:

```tsx
      <InsuranceList />
```

Replace with:

```tsx
      {!policies || policies.length === 0 ? (
        <EmptyState
          icon={<Shield className="h-12 w-12" />}
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <InsuranceFormDialog
              trigger={
                <Button className="transition-all duration-200">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('addPolicy')}
                </Button>
              }
            />
          }
        />
      ) : (
        <InsuranceList />
      )}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Insurance.tsx
git commit -m "feat: add rich empty state to Insurance page"
```

---

### Task 9: Update OtherAssets page

**Files:**
- Modify: `src/pages/OtherAssets.tsx`

`OtherAssets.tsx` computes `items = assets || []`. The table is wrapped in a `<Card>` block inline in the page. Replace that Card block with a conditional.

- [ ] **Step 1: Add import**

```tsx
import { EmptyState } from "@/components/common/EmptyState";
```

(`Archive` is already imported.)

- [ ] **Step 2: Replace the table Card with conditional**

Find this entire block:

```tsx
            <Card className="border shadow-sm card-hover">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold tracking-tight">{t('table.title')}</h2>
                    </div>
                    <div className="rounded-lg border">
                        <OtherAssetsTable
                            assets={items}
                            onBuy={handleBuy}
                            onSell={handleSell}
                            onViewTransactions={handleViewTransactions}
                            onDelete={handleDelete}
                        />
                    </div>
                </div>
            </Card>
```

Replace with:

```tsx
            {items.length === 0 ? (
              <EmptyState
                icon={<Archive className="h-12 w-12" />}
                title={t('empty.title')}
                description={t('empty.description')}
                action={
                  <Button onClick={() => setIsAddModalOpen(true)} className="transition-all duration-200">
                    <Plus className="mr-2 h-4 w-4" /> {t('addAsset')}
                  </Button>
                }
              />
            ) : (
              <Card className="border shadow-sm card-hover">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold tracking-tight">{t('table.title')}</h2>
                  </div>
                  <div className="rounded-lg border">
                    <OtherAssetsTable
                      assets={items}
                      onBuy={handleBuy}
                      onSell={handleSell}
                      onViewTransactions={handleViewTransactions}
                      onDelete={handleDelete}
                    />
                  </div>
                </div>
              </Card>
            )}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/OtherAssets.tsx
git commit -m "feat: add rich empty state to OtherAssets page"
```

---

### Task 10: Update RealEstate page

**Files:**
- Modify: `src/pages/RealEstate.tsx`

`RealEstate.tsx` fetches `realEstates` via `useQuery`. The table is rendered inline inside a `<Card>` block. Replace that entire Card block with a conditional. `AddRealEstateModal` manages its own open state and has a default built-in button trigger — it can be used directly as the action.

- [ ] **Step 1: Add import**

```tsx
import { EmptyState } from "@/components/common/EmptyState";
```

(`Home` is already imported.)

- [ ] **Step 2: Replace the table Card with conditional**

Find this block (starts after the summary grid, ends before `</div>` that closes the page wrapper):

```tsx
      <Card className="border shadow-sm card-hover">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold mb-6">{t('table.title')}</h2>
          </div>

          <div className="rounded-lg border">
            <Table>
              ...entire table including the {(!sortedRealEstates || sortedRealEstates.length === 0) && (...)} block...
            </Table>
          </div>
        </div>
      </Card>
```

Replace with:

```tsx
      {!realEstates || realEstates.length === 0 ? (
        <EmptyState
          icon={<Home className="h-12 w-12" />}
          title={t('empty.title')}
          description={t('empty.description')}
          action={<AddRealEstateModal />}
        />
      ) : (
        <Card className="border shadow-sm card-hover">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold mb-6">{t('table.title')}</h2>
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader className="[&_th]:bg-muted/50">
                  <TableRow>
                    <TableHead className="text-xs font-medium uppercase text-muted-foreground cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('name')}>
                      <span className="flex items-center">{t('table.name')}<SortIcon column="name" /></span>
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase text-muted-foreground cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('address')}>
                      <span className="flex items-center">{t('table.address')}<SortIcon column="address" /></span>
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase text-muted-foreground cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('type')}>
                      <span className="flex items-center">{t('table.type')}<SortIcon column="type" /></span>
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase text-muted-foreground cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('purchasePrice')}>
                      <span className="flex items-center justify-end">{t('table.purchasePrice')}<SortIcon column="purchasePrice" /></span>
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase text-muted-foreground cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('marketValue')}>
                      <span className="flex items-center justify-end">{t('table.value')}<SortIcon column="marketValue" /></span>
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase text-muted-foreground">{t('table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRealEstates?.map((re) => (
                    <TableRow
                      key={re.id}
                      className="cursor-pointer row-interactive"
                      onClick={() => setLocation(`/real-estate/${re.id}`)}
                    >
                      <TableCell className="font-medium">{re.name}</TableCell>
                      <TableCell>{re.address}</TableCell>
                      <TableCell className="capitalize">{t(`types.${re.type}`)}</TableCell>
                      <TableCell className="text-right data-value">
                        {formatCurrency(convertToCzK(Number(re.purchasePrice), re.purchasePriceCurrency as CurrencyCode))}
                      </TableCell>
                      <TableCell className="text-right data-value">
                        {formatCurrency(convertToCzK(Number(re.marketPrice), re.marketPriceCurrency as CurrencyCode))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/real-estate/${re.id}`);
                        }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>
      )}
```

Note: the old in-row `{(!sortedRealEstates || sortedRealEstates.length === 0) && (...)}` block is removed — it is no longer reachable since the Card only renders when `realEstates.length > 0`.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/RealEstate.tsx
git commit -m "feat: add rich empty state to RealEstate page"
```

---

### Task 11: Update Accounts (savings) page

**Files:**
- Modify: `src/pages/Accounts.tsx`

`Accounts.tsx` receives `accounts` from `useSavingsAccounts()`. Uses the `savings` i18n namespace.

- [ ] **Step 1: Add imports**

```tsx
import { PiggyBank } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
```

- [ ] **Step 2: Replace `<SavingsAccountsTable>` with conditional**

Find:

```tsx
      <SavingsAccountsTable
        accounts={accounts}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
      />
```

Replace with:

```tsx
      {accounts.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="h-12 w-12" />}
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Button onClick={handleAddClick} className="transition-all duration-200">
              <Plus className="mr-2 h-4 w-4" />
              {t('addAccount')}
            </Button>
          }
        />
      ) : (
        <SavingsAccountsTable
          accounts={accounts}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
        />
      )}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Accounts.tsx
git commit -m "feat: add rich empty state to Accounts (savings) page"
```

---

### Task 12: Final verification

- [ ] **Step 1: Run full typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass (no new tests needed — React components are out of scope per project testing policy).

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no new lint errors.
