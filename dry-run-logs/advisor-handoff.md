# Advisor Handoff — ClockToBill Onboarding Dry Run

> **Purpose:** State for the "advisor" Claude session that triages the dry run. If that
> session's context is cleared, a fresh session reads THIS doc + the test plan + the other
> `dry-run-logs/*.md` to resume. Captures the orchestration/decision layer that is NOT in
> CLAUDE.md, the test plan, or the per-agent logs.
>
> **Keep current.** Update at each checkpoint. Last updated: **2026-06-25 (post Lane A+B merge)**.

## Role / working model
- **Advisor mode (decided by Matt):** the advisor session does NOT execute the dry run. It
  reviews context, triages bugs, writes grounded fix/investigation prompts, regression-checks
  agent results, and performs lane→integration-branch merges. Matt runs the work in separate
  terminal agents and pastes results back.
- **Relay at decision points only** (after investigation findings; before/at a merge).
- **Matt keeps:** merge authority (delegated to advisor per-merge) + the lane-ownership map.

## Environment / hard constraints (do not violate)
- **Production**: real Supabase (`vvmfbtvxsjeyrmsqodon`), real Intuit OAuth, real invoices.
  Test firm = **CTA Integrity, LLC** `0a2a776d-27f8-494c-91a3-834d0698bee8`.
- **Do NOT touch P&L pilot firm** `00000000-0000-0000-0000-000000000001` (seed data).
- **Do NOT merge to `main` mid-run** — `main` auto-deploys to the live app. Fixes live on
  `claude/cta-integrity-onboarding-test-7tazih`. The deliberate `integration → main` deploy
  happens AFTER the dry run, BEFORE onboarding (see "Not-live sequencing").
- Undo = Supabase PITR / daily backup (pre-reset snapshot 25 Jun 08:42 UTC).
- `QBO_ITEM_NAME` must stay **unset** in Vercel.
- Ephemeral container: nothing survives unless committed + pushed.

## Where we are (TC sequence)
- **§1 pre-flight:** GREEN (1.1–1.4 + 1.7 pass; 1.5/1.6 accepted low-risk).
- **§2 reset:** DONE + verified. CTA tables = 0; firm row correct (write_enabled=true, rate
  125, "Monthly Bookkeeping"); CTA firm_users intact (Matt `29b3856e-…`, role `admin`);
  P&L untouched (3 customers).
- **TC-1 (login):** done (Matt, browser).
- **TC-2 (empty states):** done. No P0 crashes. 4 bugs found → all fixed + merged (see below).
- **TC-3+ (connect OAuth, sync, map, generate, send):** NOT started — this is the next step.

## Decisions made
- **Amber role:** Option 2 "No-send assistant" — IMPLEMENTED in commit `4644b52`. Verify via
  TC-19; assign roles tomorrow (Lea Ann=owner, Amber=assistant).
- **TC-17 (non-billable):** Per QB Time API, billable lives only on the jobcode in
  supplemental_data and is firm-default-false; no per-entry flag exists. **DECISION: ship
  Path B now** (`customers.exclude_from_billing` column + engine skip), **defer Path A**
  (`is_billable: jc?.billable`) to a live-data go/no-go at TC-4 — shipping Path A blind would
  zero out all billing if every jobcode returns false. is_billable hardcode/filter left
  UNTOUCHED for now.
- **Orchestration:** 3-agent model. Agent 1 = investigation (read-only). Agents 2/3 = code.
  Route ALL investigations to Agent 1; parallelize ACROSS items, serialize WITHIN an item;
  assign code agents by DISJOINT file set; **`InvoicesClient.tsx` is single-writer**; one task
  per context then log→clear→next; verify behavior not just tsc; scale agents to disjoint
  work. Isolation = git worktrees per lane; only backend lane touches migrations/types.

## Lane ownership map
- **Lane A (UI):** `src/app/invoices/InvoicesClient.tsx`, `page.tsx`.
- **Lane B (billing backend):** `src/lib/billing/engine.ts`,
  `src/app/api/qb-time/sync-timesheets/route.ts`, `src/app/api/customers/[id]/route.ts`,
  `supabase/migrations/*`, `src/types/supabase.ts`.
- **Lane C (send/QBO — if TC-12 surfaces a bug):** `invoice-drafts/[id]/send/route.ts`,
  `lib/qbo/*`.

## Completed & merged (integration branch @ 11cab3e, tsc clean, pushed)
- **Lane A — empty-state batch (B-01..B-04):** IQ fake "<Month> · Billing Period" header +
  "All drafts created" footer on empty; All Time Entries "no entries yet" vs filtered-empty;
  Client Rules empty-table message; dead "Settings" link wired. Regression-verified
  (generated-run path intact). Log: dry-run-logs/lane-a-empty-states.md.
- **Lane B — TC-17 Path B:** migration `20260625000000_add_exclude_from_billing.sql`
  (APPLIED TO PROD via MCP, additive default false); engine.ts skips excluded customers
  (draft math preserved; P&L seed unaffected); customers PATCH route accepts the field; types
  regenerated. Regression-verified. Log: dry-run-logs/lane-b-billable-fix.md.

## 🔴 Not-live sequencing (critical — read before testing fixes)
The merged fixes are on the integration branch but **NOT deployed**. The live app deploys
from `main`. So tonight's dry run (against prod) still shows OLD behavior:
- Empty-state copy tonight = old.
- **TC-17 step 3 cannot be tested against the live app yet** — the deployed engine has no
  exclude skip logic (the prod DB column exists, but live code doesn't use it).
**Plan:** Before onboarding tomorrow, do a deliberate `integration → main` deploy shipping
together: empty-state polish + Path B engine/route + the exclude_from_billing UI toggle (and
Path A if TC-4 says so). That's when it all goes live + becomes testable for Lea Ann.

## Open follow-ups (queued)
1. **exclude_from_billing UI toggle (Lane A)** — UNBLOCKED now (Lane A batch merged). Calls
   the new PATCH route. MUST be in the pre-onboarding deploy so Lea Ann can flag flat-rate
   clients. Tonight it can be set via SQL for testing.
2. **TC-4 Path A go/no-go (Agent 1)** — once QB Time connects: do any real jobcodes return
   `billable: true`? Yes → also ship Path A. All false (expected) → Path B + mapping
   discipline is complete; remove the dead is_billable filter for clarity.
3. **TC-14 bulk-send scale** — 164–187 invoices/mo; "Send All" is parallel Promise.all; may
   need concurrency-limit + retry. Probe at TC-14.
4. **TC-18 duplicate-profile merge** — two jobcodes → one customer → one invoice. Exercise.

## How to resume the advisor
A fresh advisor auto-loads CLAUDE.md. Then: read this doc + `ONBOARDING-DRY-RUN-TEST-PLAN.md`
(§7 + Appendices A/C) + any `dry-run-logs/*.md`, resume advise-only, paste latest agent/TC
output to continue.

## Bug tracker
Canonical = §7 of `ONBOARDING-DRY-RUN-TEST-PLAN.md`. B-01..B-04 (empty-state) fixed+merged.
Roll per-agent logs into §7 at end of day.
