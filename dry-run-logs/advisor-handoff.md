# Advisor Handoff — ClockToBill Onboarding Dry Run

> **Purpose:** State for the "advisor" Claude session that triages the dry run. If that
> session's context is cleared, a fresh session reads THIS doc + the test plan + the other
> `dry-run-logs/*.md` to resume. This captures the orchestration/decision layer that is NOT
> in CLAUDE.md, the test plan, or the per-agent logs.
>
> **Keep this current.** Update it at each checkpoint (after a reset, after a TC passes,
> after a decision, when an agent finishes). Last updated: **2026-06-25**.

## Role / working model
- **Advisor mode (decided by Matt):** the advisor session does NOT execute. It reviews
  context, triages bugs, writes grounded fix/investigation prompts, and regression-checks
  results. Matt runs the work in separate terminal agents and pastes results back.
- **Relay at decision points only** (after investigation findings; before a merge) — not
  routine progress.
- **Matt keeps:** merge authority + the lane-ownership map. Agents never negotiate ownership
  through a shared file.

## Environment / hard constraints (do not violate)
- This is **production**: real Supabase (`vvmfbtvxsjeyrmsqodon`), real Intuit OAuth, real
  invoices. Test firm = **CTA Integrity, LLC** `0a2a776d-27f8-494c-91a3-834d0698bee8`.
- **Do NOT touch P&L pilot firm** `00000000-0000-0000-0000-000000000001` (seed data).
- **Do NOT merge any fix to `main` mid-run** — `main` auto-deploys to the live app Lea Ann
  hits tomorrow. Fixes stay on `claude/cta-integrity-onboarding-test-7tazih`.
- Undo = Supabase PITR / daily backup (latest pre-reset snapshot 25 Jun 08:42 UTC).
- `QBO_ITEM_NAME` must stay **unset** in Vercel (breaks line-item name if set).
- Ephemeral container: nothing survives unless committed + pushed.

## Where we are (TC sequence)
- **§1 pre-flight:** GREEN. 1.1–1.4 + 1.7 pass; 1.5 (Intuit redirect URIs) and 1.6 (Supabase
  auth URLs) accepted as low-risk (proven by prior real sends + working login) — still
  un-eyeballed.
- **§2 reset:** DONE + verified. CTA operational tables = 0; CTA `firms` row correct
  (`qbo_write_enabled=true`, rate 125, desc "Monthly Bookkeeping"); CTA `firm_users` row
  intact (Matt `29b3856e-…`, role `admin`); P&L untouched (3 customers).
- **TC-1 (login):** Matt verifying in browser (incognito).
- **TC-2 (empty states):** in progress. No P0 crashes (audit confirmed). Bugs found → see
  "Work in flight."
- **TC-3+ (connect OAuth, sync, map, generate, send):** NOT started.

## Decisions made
- **Amber role:** Option 2 "No-send assistant" — already IMPLEMENTED + reviewed in commit
  `4644b52` (server 403 on send + both connect routes; `isOwner()`; UI gating). Just needs
  TC-19 verification + role assignment tomorrow (Lea Ann=owner, Amber=assistant).
- **Orchestration:** 3-agent model. Agent 1 = investigation/findings (read-only). Agents
  2/3 = code-changing. Refinements: route ALL investigations (incl. "investigate-then-fix"
  Phase 1s) to Agent 1; parallelize ACROSS items, serialize WITHIN an item
  (investigate→decide→implement never concurrent for the same item); assign code agents by
  DISJOINT file set; **`InvoicesClient.tsx` is single-writer** (the bottleneck file); one
  task per context then log→clear→next; verify behavior not just `tsc`; scale agent count to
  disjoint work available (don't run idle agents).
- **Isolation = git worktrees**, one per lane, off the dry-run branch; merge back when
  `tsc`-clean. Only the backend lane touches `migrations/` + `src/types/supabase.ts`
  (single owner). One migration against prod at a time.

## Lane ownership map
- **Lane A (UI):** `src/app/invoices/InvoicesClient.tsx`, `src/app/invoices/page.tsx`.
- **Lane B (billing backend):** `src/lib/billing/engine.ts`,
  `src/app/api/qb-time/sync-timesheets/route.ts`, `supabase/migrations/*`,
  `src/types/supabase.ts`.
- **Lane C (send/QBO — only if TC-12 surfaces a bug):**
  `src/app/api/invoice-drafts/[id]/send/route.ts`, `src/lib/qbo/*`.
- Collision to watch: TC-17's `exclude_from_billing` UI toggle lives in Lane A's file →
  keep Lane B backend-only; the toggle is a Lane A follow-up after Lane A's batch lands.

## Work in flight
- **Agent 2 (Lane A), branch `claude/cta-ui-empty-states`, worktree `../db-lane-a`:**
  consolidated empty-state batch — all P1/P2, all in `InvoicesClient.tsx`:
  1. P1 Invoice Queue fake "<Month> · Billing Period" header (:828) + "All drafts created"
     footer (:1286–1288) on empty state.
  2. P1 All Time Entries shows "No entries match your filters" when dataset is empty
     (:1554–1565).
  3. P2 Client Rules per-client table empty with no message (:1785).
  4. P1 dead "Settings" link in Client Mapping banner (:2099; wire via `setActiveView`).
  → On return: regression-check the generated-run path before merge.
- **Agent 1 (investigation), branch `claude/cta-tc17-phase1`, worktree
  `../db-tc17-investigate`:** TC-17 Phase 1 — does QB Time expose a reliable per-entry/
  per-jobcode `billable` flag, or is mapping the only gate? Recommend Path A (capture real
  flag) vs Path B (`customers.exclude_from_billing`, recommended belt-and-suspenders).
  No-live-data parts only; live confirmation deferred to after TC-4.

## Open / pending decisions
- **TC-17 Path A vs B vs both** — pending Agent 1 findings + live QB Time data (after TC-4).
  This is the #1 correctness gate before any real billing.
- Bulk-send scale (TC-14): Lea Ann sends 164–187 invoices/mo; current "Send All" is parallel
  `Promise.all` — may need concurrency-limit + retry. Probe at TC-14.
- Duplicate-profile merge (TC-18): exercise two jobcodes → one customer → one invoice.

## How to resume the advisor
A fresh advisor session auto-loads CLAUDE.md. Then point it here:
1. Read this doc, `ONBOARDING-DRY-RUN-TEST-PLAN.md` (esp. §7 tracker + Appendices A/C), and
   any `dry-run-logs/*.md` that have been written.
2. Resume as dry-run advisor (advise-only; write prompts; triage; regression-check).
3. Paste the latest agent output to continue.

## Bug tracker
Canonical tracker is **§7 of `ONBOARDING-DRY-RUN-TEST-PLAN.md`**. Roll per-agent log entries
into it at end of day. (As of last update: 4 empty-state bugs queued to Lane A — assign B-IDs
in §7.)
