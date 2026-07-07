# MCP UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve MCP server UX by rewriting the Settings card copy to explain security reasoning and setup steps clearly, and add MCP-awareness hints on the Insurance page (dismissible banner + EmptyState button).

**Architecture:** Pure UI changes — i18n JSON updates for both languages (cs/en) plus targeted edits to `Settings.tsx` (one new `<Trans>` list item) and `Insurance.tsx` (useState banner + second EmptyState action button). No new files, no backend changes, no tests required (React components are out of scope per project testing policy).

**Tech Stack:** React 18, react-i18next (Trans component), lucide-react icons, wouter (useLocation), localStorage

---

## File Map

| File | Change |
|------|--------|
| `src/i18n/locales/en/settings.json` | Update `mcpServer.description`, `mcpServer.enableHint`; add `mcpServer.setupStep0` |
| `src/i18n/locales/cs/settings.json` | Same keys in Czech |
| `src/pages/Settings.tsx` | Add step 0 `<Trans>` `<li>` before existing step 1 |
| `src/i18n/locales/en/insurance.json` | Add `mcp.bannerTitle`, `mcp.bannerBody`, `mcp.setupLink`, `mcp.addViaAi` |
| `src/i18n/locales/cs/insurance.json` | Same keys in Czech |
| `src/pages/Insurance.tsx` | Add useState banner + render; add second button in EmptyState |

---

### Task 1: Update MCP i18n keys in settings (EN + CS)

**Files:**
- Modify: `src/i18n/locales/en/settings.json`
- Modify: `src/i18n/locales/cs/settings.json`

- [ ] **Step 1: Update EN settings.json — mcpServer section**

Replace the entire `mcpServer` object in `src/i18n/locales/en/settings.json` with:

```json
"mcpServer": {
    "title": "AI Assistant (MCP Server)",
    "description": "Allows AI assistants like Claude to access your financial data via the standard MCP protocol. The server runs locally only — no data leaves your device. The app must be unlocked because the database is encrypted — without the decryption key, no data is accessible, even to a local API.",
    "enable": "Enable MCP Server",
    "enableHint": "Starts a local HTTP API accessible only while Moony is unlocked",
    "runningOnPort": "MCP Server running on port {{port}}",
    "setupInstructions": "Setup Instructions:",
    "setupStep0": "Make sure you have <1>Node.js 18+</1> installed.",
    "setupStep1": "Download the MCP server from <2>github.com/fiiles/moony-mcp</2> and run <1>npm install && npm run build</1>.",
    "setupStep2": "Add the following to your Claude Desktop config (replace paths with <1>absolute</1> paths to your actual directories):",
    "setupNote": "Note: Do not use the tilde (~) in JSON paths. Use the full absolute path.",
    "updateFailed": "Failed to update MCP server setting"
}
```

- [ ] **Step 2: Update CS settings.json — mcpServer section**

Replace the entire `mcpServer` object in `src/i18n/locales/cs/settings.json` with:

```json
"mcpServer": {
    "title": "AI Asistent (MCP Server)",
    "description": "Umožňuje AI asistentům jako Claude přistupovat k vašim finančním datům přes standardní MCP protokol. Server běží výhradně lokálně — žádná data neopouštějí zařízení. Aplikace musí být odemčená, protože databáze je šifrovaná — bez hesla k dešifrování nejsou data dostupná ani pro lokální API.",
    "enable": "Povolit MCP Server",
    "enableHint": "Spustí lokální HTTP API přístupné pouze po dobu, kdy je Moony odemčený",
    "runningOnPort": "MCP Server běží na portu {{port}}",
    "setupInstructions": "Instrukce k nastavení:",
    "setupStep0": "Ujistěte se, že máte nainstalovaný <1>Node.js 18+</1>.",
    "setupStep1": "Stáhněte MCP server z <2>github.com/fiiles/moony-mcp</2> a spusťte <1>npm install && npm run build</1>.",
    "setupStep2": "Přidejte následující do vaší Claude Desktop konfigurace (nahraďte cesty <1>absolutními</1> cestami k vašim skutečným složkám):",
    "setupNote": "Poznámka: Nepoužívejte v cestách JSON vlnovku (~). Použijte celou absolutní cestu.",
    "updateFailed": "Nepodařilo se aktualizovat nastavení MCP serveru"
}
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/en/settings.json src/i18n/locales/cs/settings.json
git commit -m "feat: improve MCP settings card copy with security explanation and Node.js prereq"
```

---

### Task 2: Add step 0 to Settings.tsx setup instructions

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Add step 0 `<li>` before existing step 1**

In `src/pages/Settings.tsx`, find the `<ol>` inside `McpServerCard` (around line 372). Replace the `<ol>` block:

```tsx
<ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
  <li>
    <Trans i18nKey="mcpServer.setupStep1" t={t}>
      Download the MCP server from <a href="https://github.com/fiiles/moony-mcp" target="_blank" rel="noopener noreferrer" className="underline text-foreground hover:text-primary">github.com/fiiles/moony-mcp</a> and run <code>npm install && npm run build</code>.
    </Trans>
  </li>
  <li><Trans i18nKey="mcpServer.setupStep2" t={t}>Add the following to your Claude Desktop config (replace paths with <strong>absolute</strong> paths to your actual directories):</Trans></li>
</ol>
```

with:

```tsx
<ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
  <li>
    <Trans i18nKey="mcpServer.setupStep0" t={t}>
      Make sure you have <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="underline text-foreground hover:text-primary">Node.js 18+</a> installed.
    </Trans>
  </li>
  <li>
    <Trans i18nKey="mcpServer.setupStep1" t={t}>
      Download the MCP server from <a href="https://github.com/fiiles/moony-mcp" target="_blank" rel="noopener noreferrer" className="underline text-foreground hover:text-primary">github.com/fiiles/moony-mcp</a> and run <code>npm install && npm run build</code>.
    </Trans>
  </li>
  <li><Trans i18nKey="mcpServer.setupStep2" t={t}>Add the following to your Claude Desktop config (replace paths with <strong>absolute</strong> paths to your actual directories):</Trans></li>
</ol>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/<user>/Documents/Programování/FinanceApp/Moony-tauri && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat: add Node.js prereq step to MCP server setup instructions"
```

---

### Task 3: Add MCP i18n keys in insurance (EN + CS)

**Files:**
- Modify: `src/i18n/locales/en/insurance.json`
- Modify: `src/i18n/locales/cs/insurance.json`

- [ ] **Step 1: Add `mcp` object to EN insurance.json**

Add the following top-level key to `src/i18n/locales/en/insurance.json` (e.g. after `"documents": {...}`):

```json
"mcp": {
    "bannerTitle": "Did you know you can add policies via AI?",
    "bannerBody": "Run the MCP server, upload a contract, offer, or policy summary to Claude and ask it to add the policy for you.",
    "setupLink": "Set up MCP server",
    "addViaAi": "Add via AI (MCP)"
}
```

- [ ] **Step 2: Add `mcp` object to CS insurance.json**

Add the following top-level key to `src/i18n/locales/cs/insurance.json`:

```json
"mcp": {
    "bannerTitle": "Věděl/a jsi, že pojistky můžeš přidávat přes AI?",
    "bannerBody": "Spusť MCP server, nahraj smlouvu, nabídku nebo shrnutí pojistky do Claude a požádej ho, ať pojistku přidá za tebe.",
    "setupLink": "Nastavit MCP server",
    "addViaAi": "Přidat přes AI (MCP)"
}
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/en/insurance.json src/i18n/locales/cs/insurance.json
git commit -m "feat: add MCP hint i18n keys to insurance translations"
```

---

### Task 4: Add MCP banner and EmptyState button to Insurance.tsx

**Files:**
- Modify: `src/pages/Insurance.tsx`

- [ ] **Step 1: Add imports**

Add `Bot` to the lucide-react import and add `useLocation` from wouter. Replace the current import lines at the top of `src/pages/Insurance.tsx`:

```tsx
import { InsuranceList } from "@/components/insurance/InsuranceList";
import { InsuranceFormDialog } from "@/components/insurance/InsuranceFormDialog";
import { Button } from "@/components/ui/button";
import { Plus, Shield, Bot, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { insuranceApi, exportApi } from "@/lib/tauri-api";
import { InsurancePolicy } from "@shared/schema";
import { SummaryCard } from "@/components/common/SummaryCard";
import { EmptyState } from "@/components/common/EmptyState";
import { useCurrency } from "@/lib/currency";
import { convertToCzK, convertFromCzK, type CurrencyCode } from "@shared/currencies";
import { useTranslation } from "react-i18next";
import { ExportButton } from "@/components/common/ExportButton";
import { useState } from "react";
import { useLocation } from "wouter";
```

- [ ] **Step 2: Add banner state and navigate hook inside the component**

After the line `const { t } = useTranslation('insurance');` inside `export default function Insurance()`, add:

```tsx
const [, navigate] = useLocation();
const [bannerDismissed, setBannerDismissed] = useState(
  () => localStorage.getItem('moony_insurance_mcp_hint_dismissed') === 'true'
);

function dismissBanner() {
  localStorage.setItem('moony_insurance_mcp_hint_dismissed', 'true');
  setBannerDismissed(true);
}
```

- [ ] **Step 3: Add banner above InsuranceList**

Find the line `<InsuranceList />` in the JSX (inside the `else` branch of the empty state check). Replace:

```tsx
      ) : (
        <InsuranceList />
      )}
```

with:

```tsx
      ) : (
        <>
          {!bannerDismissed && (
            <div className="rounded-md border bg-muted p-4 flex items-start gap-3">
              <Bot className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">{t('mcp.bannerTitle')}</p>
                <p className="text-xs text-muted-foreground">{t('mcp.bannerBody')}</p>
                <button
                  onClick={() => navigate('/settings')}
                  className="text-xs underline text-foreground hover:text-primary"
                >
                  {t('mcp.setupLink')}
                </button>
              </div>
              <button
                onClick={dismissBanner}
                className="text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <InsuranceList />
        </>
      )}
```

- [ ] **Step 4: Add second button to EmptyState**

Find the `EmptyState` block (around line 97). Replace:

```tsx
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
```

with:

```tsx
        <EmptyState
          icon={<Shield className="h-12 w-12" />}
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <div className="flex flex-col items-center gap-2">
              <InsuranceFormDialog
                trigger={
                  <Button className="transition-all duration-200">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('addPolicy')}
                  </Button>
                }
              />
              <Button
                variant="outline"
                className="transition-all duration-200"
                onClick={() => navigate('/settings')}
              >
                <Bot className="mr-2 h-4 w-4" />
                {t('mcp.addViaAi')}
              </Button>
            </div>
          }
        />
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/<user>/Documents/Programování/FinanceApp/Moony-tauri && npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Insurance.tsx
git commit -m "feat: add MCP banner and AI shortcut to Insurance page"
```
