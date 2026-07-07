# MCP UX Improvements — Design Spec

**Date:** 2026-04-10  
**Scope:** Two independent UX improvements — MCP settings card copy and Insurance page MCP hints  
**Languages:** Czech (cs) + English (en) i18n files

---

## 1. MCP Settings Card (`Settings.tsx` + i18n)

### Goal

Users who know what an MCP server is should immediately understand:
- What the integration does and why it requires the app to be unlocked
- How to get the MCP server running (concrete steps with a link)

### Changes

**`mcpServer.description`** (card subtitle, always visible):

- EN: *"Allows AI assistants like Claude to access your financial data via the standard MCP protocol. The server runs locally only — no data leaves your device. The app must be unlocked because the database is encrypted — without the decryption key, no data is accessible, even to a local API."*
- CS: *"Umožňuje AI asistentům jako Claude přistupovat k vašim finančním datům přes standardní MCP protokol. Server běží výhradně lokálně — žádná data neopouštějí zařízení. Aplikace musí být odemčená, protože databáze je šifrovaná — bez hesla k dešifrování nejsou data dostupná ani pro lokální API."*

**`mcpServer.enableHint`** (hint below the toggle):

- EN: *"Starts a local HTTP API accessible only while Moony is unlocked"*
- CS: *"Spustí lokální HTTP API přístupné pouze po dobu, kdy je Moony odemčený"*

**Setup instructions** (shown when MCP is enabled) — 3 steps instead of 2:

- Step 0 (new): Ensure Node.js 18+ is installed.
  - EN: `"Make sure you have <1>Node.js 18+</1> installed."`
  - CS: `"Ujistěte se, že máte nainstalovaný <1>Node.js 18+</1>."`
- Step 1 (existing, unchanged): Download from GitHub + `npm install && npm run build`
- Step 2 (existing, unchanged): Claude Desktop config JSON

**Implementation:** Only i18n JSON changes + one new `<Trans>` list item in `McpServerCard` for step 0. No structural UI changes.

---

## 2. Insurance Page (`Insurance.tsx` + i18n)

### Goal

Users should discover that they can use the MCP server + AI to create insurance policies from documents (contracts, offers, summaries) — both when they have no policies yet and after they've added some.

### 2a. EmptyState — extra action button

When no policies exist, the existing `EmptyState` gets a second action button below "Add New Policy":

- Button label:
  - EN: *"Add via AI (MCP)"*
  - CS: *"Přidat přes AI (MCP)"*
- On click: navigates to `/settings` (using wouter's `useLocation`)
- Style: `variant="outline"` to visually subordinate it to the primary action

**EmptyState `description` stays as-is.** The button is self-explanatory for MCP-aware users.

### 2b. Dismissible banner (when policies exist)

Rendered above `<InsuranceList />` when `localStorage.getItem('moony_insurance_mcp_hint_dismissed') !== 'true'`.

**State:** `const [bannerDismissed, setBannerDismissed] = useState(() => localStorage.getItem('moony_insurance_mcp_hint_dismissed') === 'true')`

**Dismiss handler:**
```ts
function dismissBanner() {
  localStorage.setItem('moony_insurance_mcp_hint_dismissed', 'true');
  setBannerDismissed(true);
}
```

**Banner content:**
- Icon: `Bot` (lucide-react)
- Title:
  - EN: *"Did you know you can add policies via AI?"*
  - CS: *"Věděl/a jsi, že pojistky můžeš přidávat přes AI?"*
- Body:
  - EN: *"Run the MCP server, upload a contract, offer, or policy summary to Claude and ask it to add the policy for you."*
  - CS: *"Spusť MCP server, nahraj smlouvu, nabídku nebo shrnutí pojistky do Claude a požádej ho, ať pojistku přidá za tebe."*
- Link button: "Set up MCP server" / "Nastavit MCP server" → navigates to `/settings`
- X button: calls `dismissBanner()`

**Styling:** `rounded-md border bg-muted p-4 flex items-start gap-3` — consistent with existing muted info blocks in the app.

**localStorage key:** `moony_insurance_mcp_hint_dismissed`  
**Persistence:** Permanent (never resets automatically).

### i18n keys to add (`insurance.json`)

```
mcp.bannerTitle
mcp.bannerBody
mcp.setupLink
mcp.addViaAi
```

---

## Files to Change

| File | Change |
|------|--------|
| `src/i18n/locales/en/settings.json` | Update `mcpServer.description`, `mcpServer.enableHint`, add `mcpServer.setupStep0` |
| `src/i18n/locales/cs/settings.json` | Same in Czech |
| `src/i18n/locales/en/insurance.json` | Add `mcp.*` keys |
| `src/i18n/locales/cs/insurance.json` | Add `mcp.*` keys in Czech |
| `src/pages/Settings.tsx` | Add step 0 `<Trans>` list item in `McpServerCard` |
| `src/pages/Insurance.tsx` | Add banner state + render, add second button in EmptyState |

---

## Out of Scope

- MCP hints on other pages (crypto, investments, etc.)
- Checking whether MCP is actually enabled/running before showing the hint
- Any backend changes
