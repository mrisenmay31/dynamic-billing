# Advisor Handoff — ClockToBill Onboarding Dry Run

> **Purpose:** Resume state for the "advisor" Claude session that triages the dry run. A fresh
> session reads THIS doc + the test plan + the other `dry-run-logs/*.md` to resume. Captures
> the orchestration/decision layer not in CLAUDE.md, the test plan, or per-agent logs.
>
> **RESUME POINT (updated 2026-06-26):** Mid rounding/billable validation. CTA June
> `time_entries` + `billing_run` + `invoice_drafts` are ALL CLEARED (0). **Immediate next
> action: user resyncs June in the app, then advisor reconciles (see "IN-FLIGHT" below).**
> Separately, **TC-17 Path A is GREENLIT but not yet implemented** (code task — spec below).

## Role / working model
- **Advisor mode:** advisor does NOT execute the dry run. Reviews context, triages, writes
  grounded fix/investigation prompts for Matt's terminal agents, regression-checks diffs,
  performs lane→integration merges (never to `main` mid-run), and runs read-only/CTA-scoped
  SQL via Supabase MCP to verify. Matt runs agents + pastes results back. Relay at decision
  points only.
- **Matt keeps:** merge authority (delegated per-merge) + lane-ownership map.

## Environment / hard constraints
- **Production**: Supabase `vvmfbtvxsjeyrmsqodon`, real Intuit OAuth, real invoices. Test firm
  = **CTA Integrity, LLC** `0a2a776d-27f8-494c-91a3-834d0698bee8`. Matt's user
  `29b3856e-8ce4-424b-a083-ceb14af7372d` (role `admin`).
- **Do NOT touch P&L** `00000000-0000-0000-0000-000000000001` (3 customers, 0 prod time
  entries — the "88 April entries" is local-seed-only).
- **Do NOT merge to `main` mid-run.** Deliberate `integration → main` deploy AFTER the dry
  run, BEFORE onboarding. **All merged fixes are NOT live yet** (live app deploys from `main`).
- Undo = Supabase PITR / daily backup. `QBO_ITEM_NAME` stays unset (verified).
- Ephemeral container: commit + push or it's lost. Integration branch =
  `claude/cta-integrity-onboarding-test-7tazih` (latest pushed; sweep merged @ 77bdb76+).

## Where we are (TC sequence)
- §1 pre-flight + §2 reset: DONE. TC-1/TC-2: DONE (4 empty-state bugs fixed+merged).
- TC-3–TC-8 (connect, sync, map): DONE.
- TC-9/TC-10 (review + Generate + rounding): DONE on initial clean synthetic data (math OK).
- **NOW: realistic rounding + billable validation in progress** (see IN-FLIGHT). Matt keyed
  P&L's real April data into CTA's QB Time as June entries (messy durations + multi-staff that
  the clean synthetic data never exercised), plus 3 mixed-billable test clients.
- Not yet: TC-11 (queue edits), TC-12–15 (send + dashboards), TC-16, TC-18, TC-19, §4.

## IN-FLIGHT: rounding + billable validation (resume here)
**Goal:** validate ceiling rounding on messy data AND surface the non-billable bug live.
**State:** CTA June `time_entries`=0, `billing_run`=0, `invoice_drafts`=0 (advisor cleared, so
resync is an exact mirror since the sweep isn't deployed). CTA's QB Time holds the full June
dataset: 6 clients, ~100 entries.

**Data fidelity already checked** (April xlsx vs June QB Time report): Knox PT (11:48) and
Knoxville Title (31:34) matched exactly. Baine had ONE error — the 06/20 entry was 3:49 with a
duplicated description; **Matt fixed it to 3:50 / "bank trans & recon"** → Baine now 11:53.
(Minor cosmetic: Baine "phone call with tyler" dated 06/28, source is 04/29 → 06/29; doesn't
affect total.)

**Resume sequence:**
1. Matt clicks **Sync Now** (defaults to current month = June). Tell advisor "synced".
2. Advisor reconciles via SQL: per-client entry counts match the QB Time report, and the 3 P&L
   raw totals = **Baine 11:53, Knox PT 11:48, Knoxville Title 31:34**.
3. Matt clicks **Generate Drafts** (June run is deleted, so it computes fresh).
4. Advisor verifies ceiling rounding on the Billing Run:
   - Baine 11:53 → **12.00 hrs / $1,500**
   - Knox PT 11:48 → **12.00 hrs / $1,500**
   - Knoxville Title 31:34 → **31.75 hrs / $3,968.75**
   (These match CLAUDE.md's confirmed hand-checks: 11h53m→12.00, 31h34m→31.75.)
5. **Expected "wrong" result (NOT a new bug):** because Path A isn't deployed, the 3 mixed
   test clients will over-bill (non-billable "No" entries counted). Correct billable-only
   targets:
   - Greenleaf: billed 4.00/$500 → should be **3.00 / $375**
   - Ironclad: billed 3.25/$406.25 → should be **2.50 / $312.50**
   - Mesa Verde: billed 3.00/$375 → should be **2.50 / $312.50**
6. **Optional interim Path A test (no deploy):** simulate Path A by backfilling is_billable
   from the custom field, then regenerate to hand-verify corrected totals:
   `update time_entries set is_billable = (source_payload->'customfields'->>'6490032'='Yes')`
   `where firm_id='0a2a776d-...' and started_at>='2026-06-01' and started_at<'2026-07-01';`
   (6490032 is CTA's "Billable?" field ID — firm-specific.) Then delete June run+drafts and
   regenerate; engine.ts's is_billable filter then yields the billable-only totals above.

## Decisions
- **Amber role:** Option 2 No-send assistant — IMPLEMENTED `4644b52`. Verify via TC-19; assign
  roles tomorrow (Lea Ann=owner, Amber=assistant).
- **TC-17 (non-billable) — Path A GREENLIT (revised by live data).** Per-entry billable lives
  in a QB Time **custom field** (CTA's is ID `6490032`, values "Yes"/"No"), present in every
  synced `source_payload.customfields`. Pattern is MIXED (clients with both billable +
  non-billable entries), so Path B (whole-customer exclude_from_billing, already merged) can't
  fix it — Path A (per-entry) is required and is the #1 pre-onboarding correctness item.
- **Orchestration:** 3-agent model; investigations→Agent 1; parallelize across items, serialize
  within an item; code agents by DISJOINT file set; `InvoicesClient.tsx` and
  `sync-timesheets/route.ts` are single-writer; one task per context → log → clear → next;
  verify behavior not just tsc; worktree isolation per lane.

## Lane ownership map
- **Lane A (UI):** `InvoicesClient.tsx`, `page.tsx`.
- **Lane B (billing backend):** `engine.ts`, `qb-time/sync-timesheets/route.ts`,
  `customers/[id]/route.ts`, `supabase/migrations/*`, `types/supabase.ts`.
  ⚠️ Path A edits `sync-timesheets/route.ts` (which holds the merged sweep) → build on the
  merged integration branch, not in parallel.
- **Lane C (send/QBO — if TC-12 surfaces a bug):** `invoice-drafts/[id]/send/route.ts`,
  `lib/qbo/*`.

## Completed & merged (integration branch, tsc clean, pushed)
- **B-01..B-04 (Lane A):** empty-state batch.
- **TC-17 Path B (Lane B):** `exclude_from_billing` column (APPLIED TO PROD) + engine skip +
  customers PATCH + types.
- **B-05 sweep (Lane B):** sync deletes entries removed in QB Time (window+firm scoped;
  empty-fetch guard; partial-fetch safe; protects sent-invoice customers). @ 77bdb76.

## NEXT TASK (code) — TC-17 Path A — GREENLIT, not yet implemented
Edits `sync-timesheets/route.ts` ON TOP of the merged sweep (new branch off integration, e.g.
`claude/cta-billable-path-a`):
1. Custom field ID is firm-specific — do NOT hardcode. On sync, `GET /customfields`, find the
   field named "Billable?" (or similar), get its ID. (CTA's = 6490032; confirm name in QB Time
   UI.)
2. Replace hardcoded `is_billable: true` (~:167) with `customfields[billableFieldId]`:
   `"Yes"`→true, `"No"`→false.
3. Blank/missing guard: only explicit `"Yes"`→billable; `"No"`/blank→non-billable AND warn.
   Confirm against Lea Ann's data tomorrow.
4. `engine.ts:28`'s is_billable filter then excludes non-billable. Path A + Path B coexist.
5. tsc clean; log to dry-run-logs/lane-b-path-a.md; commit; no PR/merge to main.

## Open follow-ups
1. **B-07 Path A** — GREENLIT, NEXT code task (spec above).
2. **exclude_from_billing UI toggle (Lane A)** — UNBLOCKED; needed in pre-onboarding deploy.
3. **B-06 regenerate idempotency** — "Generate Drafts" returns existing run without recomputing;
   must delete run+drafts to re-test. (`billing-runs/route.ts`.)
4. **TC-14 bulk-send scale**; **TC-18 duplicate-profile merge**.
5. **Pre-onboarding deploy bundle** (integration→main): empty-state + Path B + sweep + Path A +
   exclude UI toggle. Then it all goes live + becomes testable for Lea Ann.

## Useful queries (Supabase MCP, project vvmfbtvxsjeyrmsqodon)
- **Rounding reconcile:** sum `duration_seconds` per customer for the month, compute
  `ceil(secs/900)*0.25`, diff vs `invoice_drafts.rounded_hours`/`total_amount`.
- **Billable split:** group entries by `source_payload->'customfields'->>'6490032'` per customer.
- CTA June scope filter: `firm_id='0a2a776d-27f8-494c-91a3-834d0698bee8' and started_at>=
  '2026-06-01' and started_at<'2026-07-01'`.

## Bug tracker (canonical = §7 of test plan)
- B-01..B-05 — FIXED + MERGED.
- B-06 regenerate idempotency — OPEN.
- B-07 TC-17 Path A — GREENLIT, NEXT code task.

## How to resume the advisor
Fresh advisor auto-loads CLAUDE.md. Read this doc + ONBOARDING-DRY-RUN-TEST-PLAN.md (§7 +
Appendices A/C) + dry-run-logs/*.md. Resume advise-only. **Immediate action: ask Matt to
confirm the June resync is done, then run the reconciliation (IN-FLIGHT step 2).** Path A is
the standing next code task.
