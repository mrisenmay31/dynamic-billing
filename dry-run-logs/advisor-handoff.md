# Advisor Handoff — ClockToBill Onboarding Dry Run

> **Purpose:** Resume state for the "advisor" Claude session that triages the dry run. A fresh
> session reads THIS doc + the test plan + the other `dry-run-logs/*.md` to resume. Captures
> the orchestration/decision layer not in CLAUDE.md, the test plan, or per-agent logs.
>
> **RESUME POINT (last updated 2026-06-25):** Sync-reconcile sweep just MERGED to the
> integration branch (`77bdb76`). **Next task: implement TC-17 Path A (GREENLIT).** See
> "NEXT TASK" below — everything needed to write that prompt is captured here.

## Role / working model
- **Advisor mode:** advisor does NOT execute the dry run. Reviews context, triages, writes
  grounded fix/investigation prompts for Matt's terminal agents, regression-checks their
  diffs, performs lane→integration merges (never to `main` mid-run). Matt runs agents + pastes
  results back. Relay at decision points only.
- **Matt keeps:** merge authority (delegated per-merge) + lane-ownership map.

## Environment / hard constraints
- **Production**: Supabase `vvmfbtvxsjeyrmsqodon`, real Intuit OAuth, real invoices. Test firm
  = **CTA Integrity, LLC** `0a2a776d-27f8-494c-91a3-834d0698bee8`. Matt's user
  `29b3856e-8ce4-424b-a083-ceb14af7372d` (role `admin`).
- **Do NOT touch P&L** `00000000-0000-0000-0000-000000000001` (seed; 3 customers, 0 prod time
  entries — the "88 April entries" is local-seed-only, NOT in prod).
- **Do NOT merge to `main` mid-run.** Deliberate `integration → main` deploy happens AFTER the
  dry run, BEFORE onboarding (see "Not-live sequencing").
- Undo = Supabase PITR / daily backup (pre-reset snapshot 25 Jun 08:42 UTC).
- `QBO_ITEM_NAME` must stay unset in Vercel (verified absent).
- Ephemeral container: commit + push or it's lost. Integration branch =
  `claude/cta-integrity-onboarding-test-7tazih` @ **77bdb76**.

## Where we are (TC sequence)
- **§1 pre-flight + §2 reset:** DONE + verified.
- **TC-1 (login), TC-2 (empty states):** DONE. 4 empty-state bugs found → fixed + merged.
- **TC-3–TC-8 (connect QBO+QB Time, sync jobcodes, map, sync timesheets):** DONE (Matt).
  CTA has 6 customers + 20 June time_entries synced from CTA's real QB Time.
- **TC-9 / TC-10 (review + Generate Drafts):** DONE for June (billing_month `2026-06-01`).
  Rounding/aggregation math hand-verified against DB = all OK on the clean synced data.
  ⚠️ BUT see TC-17 finding — that "clean" data actually contains non-billable entries being
  wrongly billed.
- **ACTIVE: TC-17 Path A (GREENLIT)** — see NEXT TASK.
- Not yet done: TC-11 (queue edits), TC-12–15 (send + dashboards), TC-16, TC-18, TC-19, §4.

## Decisions
- **Amber role:** Option 2 No-send assistant — IMPLEMENTED `4644b52`. Verify via TC-19; assign
  roles tomorrow (Lea Ann=owner, Amber=assistant).
- **TC-17 (non-billable) — REVISED by live data:** Phase 1 (code+docs) said "jobcode billable
  always false → ship Path B only." **The live CTA payloads overturned that.** A per-entry
  custom field carries the billable signal (details in NEXT TASK). Pattern is MIXED (clients
  with both billable + non-billable entries), which Path B (whole-customer) cannot fix.
  **DECISION: Path B already shipped (belt-and-suspenders for whole flat-rate clients); Path A
  is GREENLIT and is the #1 pre-onboarding correctness item.**
- **Orchestration:** 3-agent model; route investigations to Agent 1; parallelize across items,
  serialize within an item; assign code agents by DISJOINT file set; `InvoicesClient.tsx` and
  now `sync-timesheets/route.ts` are single-writer; one task per context → log → clear → next;
  verify behavior not just tsc; worktree isolation per lane.

## Lane ownership map
- **Lane A (UI):** `src/app/invoices/InvoicesClient.tsx`, `page.tsx`.
- **Lane B (billing backend):** `src/lib/billing/engine.ts`,
  `src/app/api/qb-time/sync-timesheets/route.ts`, `src/app/api/customers/[id]/route.ts`,
  `supabase/migrations/*`, `src/types/supabase.ts`.
  ⚠️ `sync-timesheets/route.ts` now holds the merged sweep; **Path A edits the SAME file** →
  Path A must build on the merged integration branch, not in parallel.
- **Lane C (send/QBO — if TC-12 surfaces a bug):** `invoice-drafts/[id]/send/route.ts`,
  `lib/qbo/*`.

## Completed & merged (integration branch @ 77bdb76, tsc clean, pushed)
- **B-01..B-04 (Lane A):** empty-state batch (IQ header/footer, All Time Entries copy, Client
  Rules empty table, dead Settings link). Log: dry-run-logs/lane-a-empty-states.md.
- **TC-17 Path B (Lane B):** migration `20260625000000_add_exclude_from_billing.sql` (APPLIED
  TO PROD); engine skips excluded customers; customers PATCH accepts the field; types regen.
  Log: dry-run-logs/lane-b-billable-fix.md.
- **B-05 sync-reconcile sweep (Lane B):** sync now deletes entries removed in QB Time
  (window+firm scoped; empty-fetch guard; partial-fetch safe; protects sent-invoice
  customers). Regression-verified from the diff. Log: dry-run-logs/lane-b-sync-reconcile.md.

## 🔴 NEXT TASK — TC-17 Path A (per-entry billable from custom field) — GREENLIT
**Finding (from CTA's real synced data, no token needed — it's in `source_payload`):**
- Each timesheet's `source_payload.customfields` carries field **`6490032`** with values
  `"Yes"`/`"No"` (no blanks in CTA June data). This is a per-entry "Billable?" flag.
  (Confirm the field's NAME in the QB Time UI / GET /customfields — values strongly imply it.)
- **Live bug, real dollars** — current code bills non-billable entries. June over-billing:
  - Greenleaf: billed 4.00h/$500, should be 3.00h/$375 (2 "No" entries = 1.00h).
  - Ironclad: billed 3.25h/$406.25, should be 2.50h/$312.50 (1 "No" = 0.75h).
  - Mesa Verde: billed 3.00h/$375, should be 2.50h/$312.50 (1 "No" = 0.50h).
  - Baine / Knox PT / Knoxville Title: all "Yes", correct. **Total over-bill $281.25.**
- **Why Path A is required:** these are MIXED clients — Path B (whole-customer
  exclude_from_billing) can't drop just the "No" entries. Per-entry is the only fix.

**Implementation spec (Lane B, edits `sync-timesheets/route.ts` ON TOP of the merged sweep):**
1. The custom field ID is **firm-specific** (`6490032` is CTA's; Lea Ann's differs). Do NOT
   hardcode the ID. On sync, call `GET /customfields` to find the field named "Billable?"
   (or similar) → get its ID for that firm.
2. Replace the hardcoded `is_billable: true` (route.ts ~:167) with a value derived from
   `source_payload.customfields[billableFieldId]`: `"Yes"` → true, `"No"` → false.
3. **Blank/missing guard:** CTA has no blanks, but Lea Ann's might. Recommend: only explicit
   `"Yes"` → billable; `"No"` and blank/missing → non-billable AND `console.warn` the blanks
   (safer for her "never bill non-billable" rule; nothing silently over-bills). CONFIRM
   against her real data tomorrow.
4. `engine.ts:28` already filters `is_billable = true` → it then correctly excludes non-billable.
5. Path A + Path B coexist (per-entry filter + whole-customer exclude). Don't remove Path B.
6. Constraints: firm-scoped; tsc clean; commit on a new branch (e.g. `claude/cta-billable-path-a`)
   off integration @ 77bdb76; log to dry-run-logs/lane-b-path-a.md; no PR/merge to main.

**How to TEST Path A without deploying (it's not-live like everything else):** is_billable is
set at SYNC time, so existing rows won't change until re-sync with new code. Interim test:
one-off SQL to backfill `time_entries.is_billable` from `source_payload.customfields->>'6490032'`
on the existing 20 CTA June entries (simulates Path A), then delete+regenerate the June run,
then verify corrected totals (Greenleaf 3.00/$375, Ironclad 2.50/$312.50, Mesa Verde
2.50/$312.50, others unchanged). The Path A code makes it permanent at sync time.

## 🔴 Not-live sequencing (pre-onboarding deploy bundle)
Merged fixes are on the integration branch but NOT deployed (live app runs from `main`). The
dry run tonight shows OLD behavior. **Before onboarding, do a deliberate `integration → main`
deploy** shipping together: empty-state polish (B-01..04), Path B, sweep (B-05), Path A (B-07),
and the exclude_from_billing UI toggle. That's when it all goes live + becomes testable for
Lea Ann.

## Open follow-ups
1. **B-07 Path A** — GREENLIT, NEXT TASK (spec above).
2. **exclude_from_billing UI toggle (Lane A)** — UNBLOCKED (Lane A batch merged). Calls the
   customers PATCH route. Needed in the pre-onboarding deploy so Lea Ann can flag whole
   flat-rate clients. Tonight settable via SQL.
3. **B-06 regenerate idempotency** — "Generate Drafts" returns the existing run without
   recomputing; to re-test after re-sync you must delete the run+drafts first. Candidate fix:
   recompute on regenerate, or a UI "re-generate" action. (`billing-runs/route.ts`.)
4. **TC-14 bulk-send scale** (164–187 invoices/mo; parallel Promise.all may throttle).
5. **TC-18 duplicate-profile merge** — two jobcodes → one customer → one invoice.

## CTA June data state (for the rounding/billable test)
- June `billing_run` + `invoice_drafts`: **DELETED** by advisor (clean slate for regenerate).
- 20 June `time_entries`: **still present**, MIXED billable/non-billable (see finding). All
  `is_billable = true` currently (the bug).
- Matt's plan: input P&L April messy data into CTA's QB Time (dated June) + resync to stress
  rounding with realistic durations + multi-staff (CTA's synthetic data was all clean
  quarter-hours, single-staff — never exercised round-UP or multi-staff summing). With the
  sweep now merged (once deployed/used), resync self-reconciles; until then clear June
  time_entries manually before re-sync for a clean test.

## Useful verification queries (advisor ran these via Supabase MCP, project vvmfbtvxsjeyrmsqodon)
- **Rounding reconcile:** sum `time_entries.duration_seconds` per customer for the month,
  compute `ceil(secs/900)*0.25`, diff vs `invoice_drafts.rounded_hours`/`total_amount`.
- **Billable split:** group June entries by `source_payload->'customfields'->>'6490032'`
  per customer → shows billed-today vs should-bill.

## How to resume the advisor
Fresh advisor auto-loads CLAUDE.md. Then: read this doc + `ONBOARDING-DRY-RUN-TEST-PLAN.md`
(§7 + Appendices A/C) + `dry-run-logs/*.md`. Resume advise-only. **Immediate next action:
write the Lane B Path A prompt (spec above) and log B-06 + B-07 to §7.** Paste latest TC/agent
output to continue.

## Bug tracker (canonical = §7 of test plan)
- B-01..B-04 empty-state — FIXED + MERGED.
- B-05 sync-reconcile sweep — FIXED + MERGED.
- B-06 regenerate idempotency — OPEN (backlog/decide).
- B-07 TC-17 Path A per-entry billable — GREENLIT, NEXT TASK.

## Agent status
- Agent 1 (TC-17 Phase 1) on `claude/cta-tc17-phase1` — findings committed; was blocked on
  TOKEN_ENCRYPTION_KEY but that's MOOT (signal found in DB source_payload). Stand down or
  re-task to Path A.
- Lane A / Lane B / sync-reconcile agents — done, merged. Safe to clear.
