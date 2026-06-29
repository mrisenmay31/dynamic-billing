# Advisor Handoff — ClockToBill Onboarding Dry Run

> **Purpose:** Resume state for the "advisor" Claude session that triages the dry run. A fresh
> session reads THIS doc + the test plan + the other `dry-run-logs/*.md` to resume. Captures
> the orchestration/decision layer not in CLAUDE.md, the test plan, or per-agent logs.
>
> **RESUME POINT (updated 2026-06-29, after P&L onboarding call):** B-08 over-billing fix
> DEPLOYED + **verified live** (Greenleaf 3.00/$375, non-billable present-but-excluded). B-05
> sweep + Path A verified live. **P&L (Lea Ann) is now ONBOARDED LIVE** — logged in, QBO + QB
> Time connected, ~1,115 June entries synced; Path A resolved her billable field (`1701272`).
> **Immediate next = the P&L first-billing validation (she bills July 1).** Two open data
> questions block accurate billing — see "P&L LIVE ONBOARDING" below. CTA dry-run TC-11→TC-19
> remain but are secondary to the live P&L run.

## P&L LIVE ONBOARDING (call 2026-06-29 — transcript: call_transcripts/2026-06-29-…md)
**Done:** Lea Ann logged in (temp pw `password123`, told to reset); QBO (realm `9130349883156876`)
+ QB Time connected; ~1,115 June entries synced (06-01→06-29). Path A resolved her billable
custom field **`1701272`** (Yes→billable 580; No 431 + blank 104 → non-billable 535 — exact
match). She bills **July 1** for June. **Amber login deferred** (break-glass backup, not billing
prep — may want OWNER not assistant when created).

**🔴 Open data questions (block accurate first billing — drafted in dry-run-logs/lea-ann-followup-email.md):**
1. **Multiple rates** — rate custom field `1933334` shows **$125 / $100 / $75**. App bills flat
   $125 (firm default). Need per-client rate overrides for non-$125 clients. NOT resolved on the
   call. If a single client has mixed per-entry rates → feature gap (app is one rate per customer).
2. **Blank billable (104 entries)** — Path A treats blank as non-billable. Confirm her convention
   (blank = bill or not?). Risk of under-billing.

**Validation plan (before any send):** she finishes mapping (only ~4/1,115 mapped so far) +
approves all June → sends full June QB Time report → advisor reconciles per-client (billable-only
totals, billable-flag match, **rate handling per client**, mapping completeness). "QB Time is the
standard of truth" — our sweep enforces it.

**Smaller items:** mapping dropdown was clunky on the call (needed a re-sync to populate) → polish
bug. Confirm she resets the temp password / uses magic link.

## Role / working model
- **Advisor mode:** advisor does NOT execute the dry run. Reviews context, triages, writes
  grounded fix/investigation prompts for Matt's terminal agents, regression-checks diffs,
  performs lane→integration merges, and runs read-only/CTA-scoped SQL via Supabase MCP to
  verify. Matt runs agents + pastes results back. Relay at decision points only.
- **Investigations → Agent 1.** Code tasks → Agent 2 (and others) by disjoint file set.
- **Matt keeps merge + deploy authority.** NOTE: the original "never merge to main mid-run"
  rule was **deliberately overridden** — we flipped to deploy-then-test because there are no
  real users yet (only CTA test + P&L seed) and the high-value fixes (Path A, sweep, role)
  can only be verified against a real deploy. Advisor may merge to `main` **only on Matt's
  explicit per-deploy instruction** (granted twice so far).

## Environment / hard constraints
- **Production**: Supabase `vvmfbtvxsjeyrmsqodon`, real Intuit OAuth, real invoices. Test firm
  = **CTA Integrity, LLC** `0a2a776d-27f8-494c-91a3-834d0698bee8`. Matt's user
  `29b3856e-8ce4-424b-a083-ceb14af7372d` (role `admin`).
- **Do NOT touch P&L** `00000000-0000-0000-0000-000000000001`.
- Undo = Supabase PITR / daily backup. `QBO_ITEM_NAME` stays unset (verified).
- Ephemeral container: commit + push or it's lost. Integration branch =
  `claude/cta-integrity-onboarding-test-7tazih`.
- **Vercel:** project `dynamic-billing` (`prj_LsROCSJBGI88KWV5qV6P8B0Ohkst`), team
  `team_L59vTcDN4KmtaQIZ4dpkFuCR`. Auto-deploys prod from `main`. Verify deploys via Vercel MCP.

## DEPLOY STATE (current)
- **`main` = integration = `20d526e`.** Fully caught up; no pending code.
- **Everything below is LIVE on `app.clocktobill.com`:**
  - Empty-state batch (B-01..B-04)
  - Path B `exclude_from_billing` column (already on prod DB) + engine skip + customers PATCH
  - Sync reconciliation **sweep** (B-05) — **VERIFIED live** (deleted 4 in QB Time → swept 4, protected 0)
  - Path A per-entry `is_billable` from QB Time custom field (B-07) — **verified live**
  - Role-based access / `isOwner` (assistant tier)
  - Billable badge color (green Yes / red No) — `494e1bd`
  - `.claude/settings.json` `$schema` fix (`0c4046b`) — was breaking Matt's terminal launch
  - **B-08 (P0): exclude non-billable from UI billed total + send body** — `20d526e`. page.tsx
    `rawMinutes` now billable-only; non-billable rows shown greyed + badged; allEntries (dashboard)
    billable-only. The UI was showing Greenleaf 4.00/$500 (incl. a non-billable hr) and would
    SEND that, though the engine draft was correctly 3.00/$375. Agent-1 audit confirmed page.tsx:120
    is the necessary+sufficient send-path root fix.
- **Deploy-history gotcha (resolved):** the first deploy only fast-forwarded `main` to
  `25eec6d` (an old intermediate) because Matt's **local integration branch was stale at
  `25eec6d`**. Caught via sync-log/`is_billable` mismatch + git ancestry; fixed by merging
  from the **remote** ref `origin/claude/cta-integrity-onboarding-test-7tazih`. Lesson: always
  merge to `main` from the remote integration ref, not a local checkout.

## Path A verification (done, live)
After deploy + a fresh June re-sync, `time_entries.is_billable` split is correct:
**95 "Yes" → true, 4 "No" → false, 0 mismatches** (custom field `6490032`, CTA firm-specific).
The 4 non-billable entries: Greenleaf 2, Ironclad 1, Mesa Verde 1.
⚠️ **June `invoice_drafts` are STALE** — generated 21:14 under old code (all billable), never
regenerated, so they still show the over-bill (Greenleaf 4.00/$500, Ironclad 3.25/$406.25,
Mesa Verde 3.00/$375). B-06 idempotency means "Generate Drafts" won't recompute; must delete
run+drafts first. After regenerate the billable-only targets are:
- Greenleaf **3.00 / $375**, Ironclad **2.50 / $312.50**, Mesa Verde **2.50 / $312.50**
- P&L unchanged: Baine **12.00 / $1,500**, Knox PT **12.00 / $1,500**, Knoxville Title **31.75 / $3,968.75**
- (Baine raw is 11:52 / 42,768s, not 11:53 — 3 entries keyed as 2-decimal hours in QB Time:
  3.83/1.47/0.13 → ±12s; net −12s; rounds to 12.00 either way. Test-data quirk, not a bug.)

## IN-FLIGHT: NEXT TASK — sweep delete-test (B-05 live verification)
**Goal:** prove "QB Time is the master of truth" — a deletion in QB Time propagates on re-sync.
**Why it matters:** this is the guarantee Matt explicitly cares about; the sweep code is live
but its delete path has never run against prod.
**Recommended method (zero billing impact):** delete one of the **non-billable "No"** entries
in QB Time (Greenleaf/Ironclad/Mesa Verde) — removing it doesn't change any billable total.
**Sequence:**
1. Note the target entry's `qb_time_entry_id` (advisor can pull it via SQL beforehand).
2. Matt deletes that entry in CTA's QB Time.
3. Matt clicks **Sync Now (June)**.
4. Advisor verifies via SQL + sync log:
   - the orphan row is **gone** from `time_entries` (CTA June count drops by 1),
   - latest `integration_sync_logs.error_details` shows **`swept: 1`** (and `protected: 0`),
   - no other rows disturbed.
5. **Edge checks worth doing** (from sweep design): empty-fetch guard (a window that returns 0
   timesheets must NOT mass-delete) and sent-invoice protection (orphan for a customer with a
   `sent` draft is preserved + warned). The empty-fetch case is easy to reason about; the
   sent-invoice case naturally falls out of TC-12 later.
**If swept != 1 or the row remains:** hand to Agent 1 to investigate the sweep window/scoping.

## AFTER the sweep test
1. **Regenerate June drafts** to flow Path A (and the deletion) into billing: advisor runs the
   CTA-scoped cleanup (`delete from invoice_drafts` then `billing_runs` for the June run,
   firm-scoped), Matt clicks Generate Drafts, advisor confirms the billable-only targets above.
2. Continue remaining TCs (see below).

## Remaining TCs (live deploy is now the correct artifact)
- **TC-11** queue edits (description, hours, high-touch buffer, rate override → PATCH recalcs)
- **TC-12** Approve & Send ONE — ⚠️ real invoice. Watch: 403 (write-guard/role), 422 (no
  email / no qbo_customer_id), **Custom transaction numbers must be OFF** (else "Invoice
  undefined"), item auto-create. Use a CTA customer whose email you control.
- **TC-13** idempotent re-send (no duplicate QBO invoice)
- **TC-14** Send All (scale risk: Lea Ann does 164–187/mo; prototype = 3)
- **TC-15** Billing Run dashboard reconciliation
- **TC-18** duplicate-profile merge (two jobcodes → one customer → one invoice)
- **TC-19** assistant role 403 (UI + direct `curl` to send + connect; flip CTA role then back)

## Open follow-ups / backlog
1. **exclude_from_billing UI toggle (Lane A)** — STILL NOT BUILT. Path A is the per-entry gate;
   the toggle is belt-and-suspenders for whole-customer flat-rate exclusion. Needed before
   onboarding so Lea Ann can flag without SQL.
2. **B-06 regenerate idempotency** — "Generate Drafts" returns existing run without recomputing;
   decide a real fix (explicit "regenerate" action). (`billing-runs/route.ts`.)
3. **TC-14 bulk-send scale** — likely needs concurrency-limit + retry before real volume.
4. **Tomorrow's onboarding:** invite Lea Ann (owner) + Amber (assistant) on P&L; set roles via
   test-plan Appendix A.6; P&L `qbo_write_enabled=true`; P&L defaults ($125 / "Monthly
   Bookkeeping"); confirm Custom transaction numbers OFF + customer emails in her real QBO;
   get known-duplicate customer list.

## Lane ownership map
- **Lane A (UI):** `InvoicesClient.tsx`, `page.tsx` (single-writer).
- **Lane B (billing backend):** `engine.ts`, `qb-time/sync-timesheets/route.ts`,
  `customers/[id]/route.ts`, `supabase/migrations/*`, `types/supabase.ts`.
- **Lane C (send/QBO):** `invoice-drafts/[id]/send/route.ts`, `lib/qbo/*`.

## Useful queries (Supabase MCP, project vvmfbtvxsjeyrmsqodon)
- CTA June scope: `firm_id='0a2a776d-27f8-494c-91a3-834d0698bee8' and started_at>='2026-06-01'
  and started_at<'2026-07-01'`.
- **Billable split / Path A check:** group by `is_billable` and
  `source_payload->'customfields'->>'6490032'`.
- **Sweep check:** CTA June `count(*)` before/after; latest `integration_sync_logs`
  `error_details->>'swept'`.
- **Rounding reconcile:** `ceil(sum(duration_seconds)/900.0)*0.25` per customer vs
  `invoice_drafts.rounded_hours`/`total_amount`.

## Bug tracker (canonical = §7 of test plan)
- B-01..B-05 — FIXED + MERGED + **DEPLOYED**.
- B-05 sweep — **delete-behavior VERIFIED live** (deleted 4 in QB Time → swept 4, protected 0). Done.
- B-06 regenerate idempotency — OPEN (backlog; workaround = advisor CTA-scoped run+draft delete).
- B-07 Path A — FIXED + DEPLOYED + **verified live end-to-end** (data + draft: Greenleaf
  non-billable hr present-but-excluded → engine draft 3.00/$375).
- B-08 over-billing UI/send — FIXED + DEPLOYED (`20d526e`). UI billed total + send body now
  exclude non-billable; pending live re-verify after the B-08 deploy goes READY.

## How to resume the advisor
Fresh advisor auto-loads CLAUDE.md. Read this doc + ONBOARDING-DRY-RUN-TEST-PLAN.md (§7 +
Appendices A/C) + dry-run-logs/*.md. Resume advise-only. **Immediate action: confirm the B-08
prod deploy (`20d526e`) is READY, then re-verify Greenleaf = 3.00/$375 in the live Invoice
Queue (non-billable entry greyed + badged, no regenerate needed). Then proceed to TC-11 →
TC-12 (real send) → TC-13/14/15/18/19.** B-08 was the last known correctness blocker before
real send.
