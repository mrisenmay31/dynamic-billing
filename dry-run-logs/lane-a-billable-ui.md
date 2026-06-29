# Lane A — Billable UI Fix

**Branch:** `claude/cta-billable-ui-fix`
**Date:** 2026-06-29
**Severity:** P0 — over-billing bug found during CTA dry run

## Problem

The Invoice Queue recomputed billed hours from ALL time entries, ignoring `is_billable`.
Path A sets `is_billable = false` on non-billable entries at sync time. But `page.tsx`
was summing `duration_seconds` across all entries for a customer, inflating `rawMinutes`.
That inflated value fed:
- The "Raw QBO Time" display
- The ceiling-rounding calculation
- The editable "Final invoice quantity" default (the value actually sent)

Example: Greenleaf showed 4.00 hrs / $500 instead of the engine's correct 3.00 / $375,
and "Approve & Send" would have invoiced the non-billable hour.

## Root Cause

`page.tsx:119-120` filtered `customerEntries` by `customer_id` only, not `is_billable`.
`rawMinutes` was computed from the full set.

## Fix (3 changes)

### 1. `page.tsx` — rawMinutes from billable-only entries

```ts
const billableEntries = customerEntries.filter((e) => e.is_billable === true)
const rawMinutes = Math.round(billableEntries.reduce((sum, e) => sum + e.duration_seconds, 0) / 60)
```

`customerEntries` (all entries for the customer) is kept for the full entry list passed
to the template, so non-billable rows are still visible in the review table.

### 2. `page.tsx` — propagate `billable` flag on each entry

```ts
entries: customerEntries.map((e) => ({
  ...
  billable: e.is_billable,
})),
```

### 3. `page.tsx` — filter allEntries to billable-only

`allEntries` feeds the Billing Run Dashboard aggregate stat cards. Filtered to
`e.billable !== false` to keep those numbers consistent with what gets billed.

### 4. `InvoicesClient.tsx` — TimeEntry interface

Added `billable?: boolean` field.

### 5. `InvoicesClient.tsx` — visual flagging in time entries table

Non-billable rows (`entry.billable === false`) are:
- Rendered at 50% opacity
- Show a red "Non-billable — excluded" badge next to the note

The footer "Raw total" and "Pre-rounding" values are automatically correct because they
derive from `template.rawMinutes` (fixed in step 1). Entry count in the footer shows
all entries (including non-billable) for full transparency.

## Invariants preserved

- `send/route.ts` untouched — trusts `rounded_hours` from the patch, which now defaults
  to `ceilToQuarterHour(rawMinutes)` where `rawMinutes` is billable-only. Correct.
- `engine.ts` untouched — already correct.
- Clients with zero non-billable entries: `billableEntries === customerEntries`, behavior
  unchanged.
- The editable hours field defaults to `ceilToQuarterHour(t.rawMinutes)` which is now
  billable-only. Lea Ann bumps from there for high-touch; non-billable time is invisible
  to the billed quantity.

## Verification checklist

- [ ] Customer with mix of billable + non-billable shows billed hours = billable-only total
- [ ] Non-billable rows visible in internal review table, greyed + tagged
- [ ] "Final invoice quantity" default = ceil(billable minutes / 15) * 0.25
- [ ] Clients with no non-billable entries: display unchanged
- [ ] `tsc --noEmit` clean ✓
