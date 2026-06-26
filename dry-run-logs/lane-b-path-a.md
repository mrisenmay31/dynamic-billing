# TC-17 Path A — Per-Entry Billable Flag from QB Time Custom Field

**Branch:** `claude/cta-billable-path-a`  
**Base:** `claude/cta-integrity-onboarding-test-7tazih` (includes sync-reconcile sweep at `de48d26` and Path B at `20f4282`)  
**Commit:** `b7f3374`  
**Date:** 2026-06-26  

## Files Changed

- `apps/web/src/app/api/qb-time/sync-timesheets/route.ts` — sole file modified (+52 / -1)

## What Was Implemented

### 1. `QbTimesheet` interface — added `customfields` field (line 18)
```ts
customfields?: Record<string, string>
```
`source_payload` was already persisting the full QB Time payload (including customfields); this just types it so per-entry access is type-safe.

### 2. `fetchBillableFieldId(token)` — new helper (lines 44–68)
Calls `GET https://rest.tsheets.com/api/v1/customfields` once per sync with the firm's Bearer token. Finds the field whose `name` contains "billable" (case-insensitive). Returns the field ID as a string, or `null` on any failure. All errors are caught internally; the function never throws.

### 3. Called once per POST, before the timesheets loop (lines 151–154)
```ts
const billableFieldId = await fetchBillableFieldId(token)
```

### 4. Per-entry `is_billable` derivation (lines 187–205)
Replaces the former hardcoded `is_billable: true` at ~line 167.

```
billableFieldId === null      → isBillable = true  (fallback, firm has no field)
rawValue === "yes" (ci)       → isBillable = true
rawValue === "no" (ci)        → isBillable = false
rawValue blank/missing        → isBillable = false + console.warn (Lea Ann rule)
```

## Fallback Branches

| Scenario | Behavior |
|---|---|
| GET /customfields HTTP error | `null` returned → `is_billable=true` for all entries + loud warn |
| Unexpected exception in lookup | `null` returned → `is_billable=true` for all entries + loud warn |
| No field named "billable" found | `null` returned → `is_billable=true` for all entries + loud warn |
| Field found, entry value = "Yes" | `is_billable=true` |
| Field found, entry value = "No" | `is_billable=false` |
| Field found, entry value blank/missing | `is_billable=false` + `console.warn` per entry ID |

The critical invariant: **only an explicit "No" or blank on a field that DOES exist yields `false`**. A firm that doesn't use this custom field at all keeps billing normally.

## What Was NOT Changed

- `engine.ts` — untouched; its existing `.eq('is_billable', true)` filter (line 28) is the downstream gate that now works correctly
- Path B (`exclude_from_billing` column on `customers`) — untouched; coexists with Path A
- Reconciliation sweep — untouched

## TSC Result

```
npx tsc --noEmit  →  (no output, exit 0)
```
Clean.

## Expected Billing Impact for CTA (from CTA dry-run data)

| Customer | Before | After |
|---|---|---|
| Greenleaf | 4.00h / $500.00 | 3.00h / $375.00 |
| Ironclad | 3.25h / $406.25 | 2.50h / $312.50 |
| Mesa Verde | 3.00h / $375.00 | 2.50h / $312.50 |
| Baine / Knox PT / Knoxville Title | unchanged (all "Yes") | unchanged |

**Total over-billing removed: $281.25**

A re-sync of June data against CTA's real QB Time account will update `is_billable` on existing entries via the `onConflict: 'firm_id,qb_time_entry_id'` upsert.
