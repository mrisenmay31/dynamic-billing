## 2026-06-25 — Empty-state audit (read-only, TC-2)

- **Scope:** All six nav views in `src/app/invoices/InvoicesClient.tsx` + `src/app/invoices/page.tsx`, firm reset to brand-new empty state (zero customers, time_entries, billing_runs, invoice_drafts; both integrations disconnected). Checked for crashes, misleading UI, and dangerous enabled buttons on empty data.
- **Code changed:** NONE (read-only audit)

---

### Findings

| View | Verdict | File:line | Expression / issue | Severity |
|---|---|---|---|---|
| Billing Run | **safe** | `InvoicesClient.tsx:562` | `if (!billingMonth)` guard returns well-formed empty-state UI; Generate Drafts disabled via `!hasSyncedEntries`; `GenerateMonthDropdown` self-returns null when `options.length === 0` (L503) | — |
| Invoice Queue | **risk** | `InvoicesClient.tsx:828` | `{runMonthLabel(billingMonth)} · Billing Period` — `billingMonth` is fed `activeBillingMonth = billingMonth ?? defaultGenerateMonth` (L2722), so with no run the header renders a fake period e.g. "June 2026 · Billing Period" | P1 |
| Invoice Queue | **risk** | `InvoicesClient.tsx:1286–1288` | Bottom action bar: `pendingTemplates.length > 0 ? ... : <span>All drafts created — nothing left to review</span>` — fires when `templates = []`, implying a completed workflow when nothing has ever been done | P1 |
| All Time Entries | **risk** | `InvoicesClient.tsx:1554–1565` | `filtered.length === 0` branch renders "No entries match your filters" + "Try adjusting your search or clearing the filters" + "Clear filters" button — triggers when `timeEntries = []` (no data at all, not filtered); guidance is wrong for a genuinely empty dataset | P1 |
| Client Rules | **risk** | `InvoicesClient.tsx:1785` | `{templates.map(...)}` in Per-Client Overrides `<tbody>` — renders empty table with column headers and zero rows, no empty-state message or call to action | P2 |
| Client Mapping | **safe** | `InvoicesClient.tsx:2093, 2219` | `!qboConnected` amber banner (Panel A) + `!qbTimeConnected` lock message (Panel B) both present; `customers.map` over `[]` renders empty tbody cleanly | — |
| Settings | **safe** | `InvoicesClient.tsx:2376–2439` | Both integrations render "Not Connected" badges; `{templates.length} clients · {allEntries.length} time entries · {formatCurrency(liveTotalBilling)}` renders "0 clients · 0 time entries · $0.00" cleanly | — |

**Additional detail — non-crash risks confirmed safe:**

- All `.reduce` calls over `templates = []` / `allEntries = []` use numeric initial values → return `0`, never `NaN`. (L559–560, L735–738, L1196–1198)
- `sendPct` division: guarded `templates.length === 0 ? 0 : Math.round(sentCount / templates.length * 100)` (L610) ✅
- `generateMonthOptions[0] ?? defaultGenerateMonth` (L2688) — safe when options are empty ✅
- `months[0] ?? ""` in All Time Entries (L1341) — safe ✅
- `invoiceStates[t.id]` lookup only occurs inside `templates.map(...)` iterations; both initialized from the same `templates` prop ✅
- `GenerateMonthDropdown` and "Generate Drafts" button both correctly disabled on empty data in both Billing Run (L580, L597) and Invoice Queue (L839) ✅
- No `.find()` result used without optional chaining or undefined check ✅

---

### Disposition

| ID | View | Severity | Issue | Status |
|---|---|---|---|---|
| B-01 | Invoice Queue | P1 | Fake billing-period header ("June 2026 · Billing Period") when no run exists — `activeBillingMonth` fallback leaks into queue header | Queued: Lane A consolidated empty-state fix |
| B-02 | Invoice Queue | P1 | "All drafts created — nothing left to review" footer fires on empty `templates = []`, implies completed workflow | Queued: Lane A consolidated empty-state fix |
| B-03 | All Time Entries | P1 | Wrong empty-state copy: "No entries match your filters" + "Clear filters" fires when dataset is genuinely empty (no sync yet) | Queued: Lane A consolidated empty-state fix |
| B-04 | Client Rules | P2 | Per-Client Overrides table renders empty tbody with headers and no guidance message | Queued: Lane A consolidated empty-state fix |

All four items are non-blocking for the dry-run walk-through (no crashes; core flows — connect, sync, map, generate — are unaffected). Fix before the P&L live onboarding to avoid first-impression confusion for Lea Ann.

---

### NOT covered

- Any server route behavior under empty state (API routes, billing engine, send flow) — out of scope for this UI audit
- `src/middleware.ts` auth guard behavior
- The `src/app/invoices/page.tsx` server component itself (fetches with empty results return `[]` / `null` cleanly via `?? []` / `?? ''` guards throughout; no null-safety issues found)
- Mobile sidebar / toast / `SignOutButton` (no data dependency)
- Any view not in the six nav items (login, forgot-password, reset-password, privacy, terms)
