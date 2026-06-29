# Lane A — is_billable Audit
**Date:** 2026-06-26  
**Branch:** claude/cta-integrity-onboarding-test-7tazih  
**Auditor:** read-only investigation, no app code changed

---

## Audit Table

| Site (file:line) | What it computes | Filters is_billable? | Sent to client / display only | Needs fix? |
|---|---|---|---|---|
| `page.tsx:105–113` | DB query for `entries` (time_entries for billing month + customer IDs) | **N** — no `.eq('is_billable', true)` on this query | Source data for rawMinutes + template.entries | **YES** (or filter in-memory below) |
| `page.tsx:120` | `rawMinutes` = sum of `duration_seconds` for all customerEntries | **N** — sums ALL entries (billable + non-billable) | → `InvoiceTemplate.rawMinutes` → invoiceStates.hours → body of every send call | **YES — ROOT FIX** |
| `page.tsx:130–135` | `template.entries[]` — list of entries for invoice card time-entries display | **N** — maps ALL customerEntries | Display only (invoice card expand) | **YES** (cosmetic — non-billable entries appear in the card) |
| `page.tsx:139–151` | `allEntries` (FlatEntry[]) — built from template.entries, passed to BillingRunDashboardView | **N** — inherits unfiltered template.entries | Display only (Billing Run dashboard raw stats) | **YES** (dashboard raw stats overstate hours/amount) |
| `InvoicesClient.tsx:2699` | `invoiceStates[id].hours` initial value = `ceilToQuarterHour(t.rawMinutes)` | **N** — rawMinutes is unfiltered (page.tsx:120) | This value is sent in every single/bulk send POST body | **YES** (fixed by fixing page.tsx:120) |
| `InvoicesClient.tsx:559–560` | `liveRoundedHours`, `liveTotalBilling` in BillingRunDashboardView header stat cards | **N** — sums invoiceStates.hours (unfiltered rawMinutes) | Display only (stat cards) | **YES** (fixed by fixing page.tsx:120) |
| `InvoicesClient.tsx:605` | `rawStats = computeRawStats(allEntries)` — totalRawTime + totalRawAmount | **N** — allEntries is unfiltered | Display only (Billing Run "Billing Totals" table) | **YES** (fixed by filtering allEntries at page.tsx:139) |
| `InvoicesClient.tsx:606` | `roundingDiff = liveTotalBilling - rawStats.totalRawAmount` | **N** — both operands unfiltered | Display only (Billing Run "Rounding / adjustment difference") | **YES** (fixed once both rawStats and liveTotalBilling are fixed) |
| `InvoicesClient.tsx:737–740` | `allTotalHours`, `allTotalBilled`, `pendingTotal` (Invoice Queue header stats) | **N** — sums invoiceStates.hours (unfiltered) | Display only (Invoice Queue "Total Hours" / "Total Billed" / footer remaining) | **YES** (fixed by fixing page.tsx:120) |
| `InvoicesClient.tsx:886–890` | Per-card `roundedHours`, `amount`, `rawAmount` (billing math display + card header amount) | **N** — uses rawMinutes (unfiltered) | **DISPLAY AND SEND**: `amount` shown on card header; `roundedHours` is the baseline for manual adjustments sent to QBO | **YES — ROOT FIX** (fixed by fixing page.tsx:120) |
| `InvoicesClient.tsx:940–941` | "Raw QBO Time" and "Decimal hours" rows in "How this invoice was calculated" | **N** — uses rawMinutes (unfiltered) | Display only (billing math section) | **YES** (fixed by fixing page.tsx:120) |
| `InvoicesClient.tsx:1057` | "Raw total" entry-count label in time-entries section of card | **N** — uses rawMinutes (unfiltered) | Display only | **YES** (fixed by fixing page.tsx:120) |
| `InvoicesClient.tsx:759–765` — single send | `rounded_hours: states[id].hours` sent in POST body to `/api/invoice-drafts/[id]/send` | **N** — states[id].hours from unfiltered rawMinutes | **→ QBO invoice qty → CLIENT BILL** | **YES — CRITICAL SEND PATH** (fixed by fixing page.tsx:120) |
| `InvoicesClient.tsx:793–800` — Send All | `rounded_hours: states[t.id].hours` in each parallel POST body | **N** — same as above | **→ QBO invoice qty → CLIENT BILL** | **YES — CRITICAL SEND PATH** (fixed by fixing page.tsx:120) |
| `send/route.ts:48–50` | `finalHours = body.rounded_hours ?? draft.rounded_hours`; `finalAmount = finalHours * hourly_rate` | Trusts passed value — no recompute from entries | **→ QBO invoice qty → CLIENT BILL** | No independent fix needed — correct if body is fixed |
| `[id]/route.ts (PATCH):45–50` | `total_amount = rounded_hours * hourly_rate` when hours are patched | Trusts passed `rounded_hours` — no recompute from raw entries | DB update (not directly sent to client) | No independent fix needed — recomputes from passed value only |
| `engine.ts:28` | DB query for entries: `.eq('is_billable', true)` | **YES** — correct | Drives `invoice_drafts.rounded_hours` written to DB at Generate Drafts time | No fix needed |
| `billing-runs/route.ts` | Calls `computeBillingDrafts` (engine.ts) only — no second computation | **YES** (via engine) | Writes correct `rounded_hours` to DB | No fix needed |

---

## Critical Send-Path Trace

```
engine.ts (Generate Drafts)
  → filters is_billable=true ✓
  → writes correct rounded_hours to invoice_drafts DB row ✓

page.tsx:120 (page load / SSR)
  → re-fetches entries WITHOUT is_billable filter ✗
  → rawMinutes = sum of ALL (billable + non-billable) seconds ✗
  → InvoiceTemplate.rawMinutes = wrong value ✗

InvoicesClient.tsx:2699 (useState init)
  → invoiceStates[id].hours = ceilToQuarterHour(rawMinutes) ✗
  → in-memory "hours" is inflated ✗

createDraft() / createAllDrafts() [single + bulk send]
  → POST body: { rounded_hours: states[id].hours } ✗

send/route.ts:48
  → finalHours = body.rounded_hours (takes body, ignores correct DB value) ✗
  → QBO invoice qty = wrong (over-billed) ✗
  → SENT TO CLIENT ✗
```

The DB `invoice_drafts.rounded_hours` (written by the engine) is **correct**, but the UI overwrites it at send time by passing an unfiltered value in the request body. The send route correctly prefers the body over the DB value (to flush debounce), which means the correct DB value is never used unless the UI fixes what it puts in the body.

---

## PATCH Debounce Safety

When Lea Ann edits hours manually (`debouncedPatch`) → `PATCH /api/invoice-drafts/[id]` with `{ rounded_hours: newHours }` → DB is updated to the manually-edited value → send route then uses either the body value (from the click-time `states[id].hours`) or the DB value. In normal flow both are the same (the debounce typically fires before send). No independent recompute from raw entries occurs here — so PATCH is safe once the UI holds the correct initial hours.

---

## Verdict

**The `page.tsx:120` fix (filter rawMinutes to `is_billable=true`) is necessary and sufficient to close the over-billing bug on the send path.** It cascades correctly through:
- `InvoiceTemplate.rawMinutes` (fixed)
- `invoiceStates[id].hours` initial value (fixed)
- Single send and Send All POST bodies (fixed)
- QBO invoice qty and client bill (fixed)
- Invoice Queue per-card billing math display (fixed)
- Billing Run dashboard `liveRoundedHours` + `liveTotalBilling` stat cards (fixed)

**However, two additional fix sites have display-only bugs that remain after the page.tsx:120 fix alone:**

### Additional fix site 1 — `page.tsx:130` (template.entries list)
Filter `customerEntries` to `is_billable=true` before mapping to `template.entries`. Without this, the invoice card's time-entries expansion still shows non-billable entries, which would confuse Lea Ann ("why is this entry here if it's not being billed?").

### Additional fix site 2 — `page.tsx:139–151` (allEntries, Billing Run dashboard raw stats)
`allEntries` is built from `template.entries`. Once site 1 is fixed, this flows through automatically — `rawStats.totalRawTime`, `rawStats.totalRawAmount`, and `roundingDiff` in the dashboard will all show billable-only figures, consistent with the billing math.

If site 1 is not fixed, allEntries will still include non-billable durations → the dashboard "Total raw time imported" and "Total raw amount (pre-rounding)" will be overstated relative to actual billing, and the "Rounding / adjustment difference" will be misleading.

---

## Recommended Fix Scope

```
MUST (over-billing / send path):
  page.tsx:120 — change:
    customerEntries.reduce((sum, e) => sum + e.duration_seconds, 0)
  to:
    customerEntries.filter(e => e.is_billable).reduce((sum, e) => sum + e.duration_seconds, 0)

SHOULD (display consistency):
  page.tsx:130 — also filter template.entries to is_billable=true so the
    invoice card's time-entry list matches the billing math.

  page.tsx:139–151 — allEntries flows from template.entries, so this is
    fixed automatically once page.tsx:130 is fixed.
```

No fix needed in: `engine.ts`, `billing-runs/route.ts`, `send/route.ts`, `[id]/route.ts (PATCH)`.
