# Lane B: Sync Reconciliation Sweep

**Date:** 2026-06-25  
**Branch:** `claude/cta-sync-reconcile`  
**Status:** Complete — `npx tsc --noEmit` clean (EXIT:0)  

## Files changed

- `apps/web/src/app/api/qb-time/sync-timesheets/route.ts` — only file touched

## What changed

Added a reconciliation sweep that runs after the upsert loop on every successful timesheet sync. The sweep makes `time_entries` for the synced window exactly mirror what QB Time returned — entries deleted or voided in QB Time are hard-deleted from ClockToBill.

## Safety guards

1. **Empty-fetch guard:** If QB Time returns 0 timesheets, the sweep is skipped entirely and a `console.warn` is emitted. Never mass-deletes a window on an empty response.
2. **Window scope:** Sweep queries `started_at >= lower AND started_at < upper` where `lower = toEasternMidnightISO(start_date)` and `upper = toEasternMidnightISO(day_after_end_date)`. Uses the same Eastern-midnight helper as the upsert path so bucketing is consistent.
3. **Billed-work protection:** Before deleting any orphan, the sweep checks `invoice_drafts` for `status = 'sent'` for the firm. Orphans whose `customer_id` maps to a sent invoice are **not** deleted — they are counted as `protected` and a `console.warn` is emitted identifying the specific `time_entry.id`, `qb_time_entry_id`, and `customer_id`. These need human review (entry deleted in QB Time after invoice was already sent).
4. **Sweep failure isolation:** The entire sweep runs in its own `try/catch`. A sweep error is logged and counted but does not roll back the upserts that already succeeded.
5. **Tenant scope:** Every query and delete is `.eq('firm_id', firmId)` from `getFirmContext`.

## Response / logging

- API response now includes: `{ processed, upserted, skipped, swept, protected }`
- `integration_sync_logs.error_details` now includes: `{ start_date, end_date, swept, protected }` (packed into the existing `jsonb` column — no schema change needed)

## Commit SHA

See `git log claude/cta-sync-reconcile` after push.

## Handoff

The sweep is safe to run in production. The two cases to watch on first live sync:
- `swept > 0` → entries genuinely removed in QB Time; confirm they were not billable work
- `protected > 0` → check server logs for the specific `customer_id`; someone deleted a QB Time entry after you already sent the invoice; investigate manually
