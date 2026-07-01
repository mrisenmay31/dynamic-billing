# Advisor Handoff — ClockToBill (Dynamic Billing)

> **Purpose:** Resume state for the "advisor" Claude session. A fresh session reads THIS doc +
> ONBOARDING-DRY-RUN-TEST-PLAN.md + dry-run-logs/*.md to resume. Captures the orchestration /
> decision layer not in CLAUDE.md.
>
> **RESUME POINT (updated 2026-07-01, AP-03 SHIPPED — ready for Lea Ann to send):** `main` =
> integration = **`b94ad9e`**, deployed to prod. Everything from the dry run is LIVE (Path A, sweep,
> B-08 over-billing fix, role gating) **plus the super-admin firm-switcher and the AP-03 display-rate
> fix.** **P&L June reconciliation is DONE; June drafts generated + verified at 74 invoices /
> $45,987.50; the Billing Run/Queue now displays each client's real rate (was showing $125 for all).**
> **Immediate next = Lea Ann reviews the corrected on-screen numbers and sends June in batches**
> (watch Copper Peaks single-invoice confirm + TC-14 bulk-send rate limits). See the 2026-07-01
> session section below. Next code work branches off the current integration tip
> `origin/claude/cta-integrity-onboarding-test-7tazih` (NOT a local checkout).

## 2026-07-01 — P&L FIRST BILLING VALIDATION (June work, invoices dated 07/01)
**Inputs received from Lea Ann:** her email reply (rates + blank-billable answers) and her full June
QBO "Time Activities by Client Detail" report (`P&L Business Services, LLC_Time Activities by Client
Detail (9).xlsx`, root dir). Advisor artifacts written this session:
`dry-run-logs/june-billing-preview.csv` (per-client billing preview) and
`dry-run-logs/agent-prompts.md` (AP-01/02/03 staged fix prompts).

**Lea Ann's answers (resolved the open questions):**
- **Rates are single-rate per client** (no per-entry-rate feature gap). Her earlier $125 "slips" on
  Oak Ridge Chamber / Danny Johnson / Morristown are fixed on the QBO side; per-customer
  `hourly_rate_override` fully covers it.
- **Flat-rate clients** (IT 4 The Planet, Kennedy Dentistry, Dale Skidmore, both honor guards) — she
  tracks time for annual review only; all have **zero billable time** in June, so no invoice. PTO is
  always "No".
- **Blank-billable** — she + Amber fixed the real client ones in QB Time and re-approved; app now shows
  **0 blank** per client.

**🔴 Root cause found — stale June sync (NOT a code bug):** `handleSyncNow()`
(InvoicesClient.tsx:2699) hardcodes the sync window to the **current wall-clock month**. On July 1 every
"Sync Now" pulled JULY; June was frozen at the 06-29 15:16 snapshot, missing all late-June + this-morning
entries. **Fix applied operationally:** ran a June-range sync via browser console
(`POST /api/qb-time/sync-timesheets {start_date:'2026-06-01',end_date:'2026-06-30'}` while impersonating
P&L) → 1,222 records, swept 1. This recurs every month (you always bill the prior month after month-end)
→ real fix is to make the sync follow the selected billing month (backlog, add as an agent prompt).

**Reconciliation (app vs her QBO report):** after the June re-sync, **69/76 clients matched to the
minute**; whole book within 0.9h. Residual deltas were 3 single entries where the app is MORE correct
than her report (Knox PT 38m "PTO Logs", Oak Ridge Public Schools 22m "payroll", Sunago 15m login — all
correctly excluded as non-billable). Confirms we bill from the app/QB Time, per her "QB Time is the
standard of truth".

**Data changes applied to live P&L (all firm-scoped, verified via RETURNING):**
1. **11 rate overrides** set on `customers.hourly_rate_override`: $75 ×10 (Dandridge School Lofts,
   Danny Johnson Excavating - New, Duke Development Company, Duke Sevierville, Imaginationz Dentistry
   PLLC, Johnson's Depot & Deli, Lendall Roberts, Morristown Dentistry PLLC, Oak Ridge Chamber of
   Commerce, United Way of Anderson County) + $100 ×1 (Catamount Mgmt). Overrides also neutralize
   leftover $125-slip entries in QB Time for those customers.
2. **P&L Admin excluded** (`exclude_from_billing=true`) — one internal entry was flagged billable and
   would have self-billed $62.50; all 6 internal jobcodes (P&L Admin, Lea Ann's Work, Networking, New
   Client Consultations, Tax Returns, PTO) map to this one customer, so one exclude backstops all.

**June drafts GENERATED + verified in DB:** run `092461f6-…`, billing_month 2026-06-01, status pending,
**74 drafts / $45,987.50 / 394.25 rounded hrs / 0 zero-amount**, P&L Admin absent. Split: $125 ×63 =
$41,031.25, $75 ×10 = $4,931.25, $100 ×1 = $25.00. All 11 override drafts carry the correct
`draft.hourly_rate` (75/100) and `total_amount`. Matches `june-billing-preview.csv` exactly.

**🔴 Display bug (AP-03, PRE-SEND BLOCKER — data + send are CORRECT, only the screen is wrong):** the
Billing Run dashboard + Invoice Queue compute displayed dollars as `hours × invoiceStates.rate`, and that
rate is seeded from the firm default $125 for everyone (InvoicesClient.tsx ~2695), ignoring the override.
Screen shows **Proposed Billing $49,281.25** (394.25h × $125) vs real **$45,987.50** — the $3,293.75 gap is
the 11 $75/$100 clients rendered at $125. **Send is safe** (`send/route.ts:57,118` uses `draft.hourly_rate`;
UI rate edits aren't even persisted). Fix = plumb `draft.hourly_rate` into templates and seed the UI rate
from it. AP-03 staged in `agent-prompts.md`; Matt is running it (Agent 3). Advisor to regression-check the
diff, verify on PREVIEW (Proposed Billing = $45,987.50), then merge to main on Matt's say-so.

**Open items for the send stage:**
- **Copper Peaks** bills as ONE invoice (9.50h/$1,187.50) covering both `Copper Peaks Solutions` +
  `COPPER PEAKS LLC` jobcodes (both $125). Confirm with Lea Ann they're one client (merging vs two invoices
  costs the client $31.25 in single-vs-double rounding). Other same-rate merges (Adams ×2, Complete
  Construction ×2, Detail Driven +Payroll Only, Morristown +Payroll Returns) are fine — just intended-mapping
  confirmations.
- **Sunago Coffee** bills $31.25 off a single 6-min billable entry — trivial; confirm she wants it.
- **Batch the sends** — 74 invoices; "Send All" is parallel `Promise.all` (TC-14 rate-limit risk). Send a
  handful first, confirm QBO/BillerGenie, then the rest.
- **Run label:** header reads "July 2026 Billing Run / June 2026 Time Entries" (labels by invoice month
  07/01). Confirm that matches Lea Ann's mental model or tweak the label.

**Staged agent prompts (`dry-run-logs/agent-prompts.md`):** AP-01 paginate time_entries reads (removes
~1,000-row PostgREST cap; engine safe today at 626 rows but latent under-bill risk — PARKED branch,
do-not-merge); AP-02 self-serve per-client rate editor in Client Rules (persist `hourly_rate_override`);
AP-03 display-rate fix (above, urgent).

## P&L LIVE ONBOARDING (call 2026-06-29 — transcript in call_transcripts/2026-06-29-…md)
**Done:** Lea Ann logged in (temp pw `password123`); QBO realm `9130349883156876` + QB Time
connected; ~1,115 June entries synced. Path A resolved her billable custom field **`1701272`**
(Yes→billable 580; No 431 + blank 104 → non-billable 535 — exact match). She maps clients
herself (~4/1,115 done; only old clients have duplicates). **Amber login deferred** (break-glass
backup — may want OWNER not assistant when created).

**🔴 Open data questions (block accurate first billing; email drafted in
dry-run-logs/lea-ann-followup-email.md, with the specific client lists):**
1. **Multiple rates** — rate custom field `1933334` = **$125 / $100 / $75**. App bills flat $125.
   Need per-client `hourly_rate_override` for the non-$125 clients ($75: United Way of Anderson
   County, Lendall Roberts, Oak Ridge Chamber, Johnson's Depot & Deli, Morristown Dentistry
   (+Payroll Returns), Danny Johnson Excavating, Dandridge School Lofts, Imaginationz Dentistry
   Payroll Returns, Duke Development, Duke Sevierville; $100: Catamount Mgmt). 3 are mixed
   ($75 + one stray $125): Oak Ridge, Danny Johnson, Morristown Dentistry. **If a client truly
   bills mixed per-entry rates → feature gap (app is one rate per customer).**
2. **Blank billable (104 entries)** — Path A treats blank as non-billable. They're MIXED: PTO /
   internal "P&L Lea Ann's Work" (correctly non-billable, won't map) vs real client work like
   "IT 4 The Planet, LLC" (looks billable but unflagged → would under-bill). Cleanest: she marks
   client ones Yes/No in QB Time.

**Validation plan:** she finishes mapping + approves all June → sends full June QB Time report →
advisor reconciles per-client (billable-only totals, billable-flag match, rate handling, mapping
completeness, duplicate merges). Then set rate overrides → regenerate → confirm → she sends.
"QB Time is the standard of truth" (her words) — our sweep enforces it.

## SUPER-ADMIN FIRM-SWITCHER (shipped 2026-06-29, `7304ff6`)
Lets Matt (super-admin) click into any firm to view/verify/fix what they see. **Full access
while impersonating EXCEPT real invoice sends** (his decision).
- **Backend:** `super_admins` table (Matt `29b3856e-…` seeded); `getFirmContext` returns
  `isSuperAdmin` + `isImpersonating`, honoring an httpOnly `active_firm_id` cookie ONLY after
  verifying super_admins membership; `POST /api/admin/switch-firm` (set/clear cookie, audited);
  send route 403s while impersonating.
- **UI:** sidebar firm dropdown (super-admins only) + amber "Viewing as … sending disabled"
  banner + send buttons hidden while impersonating (`canSend = !isImpersonating && isOwner`).
- **RLS read policies** (`super_admin_read_all` on firms, customers, billing_runs, invoice_drafts,
  time_entries, customer_mappings, qbo_connections, qb_time_connections) — needed because every
  table has membership RLS and page.tsx reads through the RLS client; without them impersonation
  showed an empty workspace. Additive/permissive; non-super-admins unaffected; writes already
  bypass RLS via service-role.
- **Two near-misses caught in review (process lessons):** (a) the Lane A UI agent branched off a
  STALE base and its raw diff looked like it reverted B-08 — the 3-way merge preserved B-08
  (verified), but **agents must branch off the current integration tip**; (b) the agents gated the
  firm *context* but missed cross-firm *read access* (RLS) — caught by preview testing before main.

## DEPLOY STATE — `main` = integration = `b94ad9e`, all LIVE on app.clocktobill.com
- Empty-state batch (B-01..B-04); Path B `exclude_from_billing` (column on prod) + engine skip +
  customers PATCH; sweep (B-05, **verified live**); Path A per-entry billable (B-07, **verified
  e2e**); role gating (`isOwner`); billable badge color; B-08 over-billing UI/send fix (**verified
  live** — Greenleaf 3.00/$375, non-billable present-but-excluded); super-admin firm-switcher
  (`7304ff6`); **AP-03 display-rate fix (`b94ad9e`, shipped 2026-07-01) — Billing Run/Queue now show
  each draft's real rate instead of firm-default $125.**
- **Deploy rule:** merge to `main` from the **remote** integration ref
  (`origin/claude/cta-integrity-onboarding-test-7tazih`), never a local checkout (a stale local
  checkout once fast-forwarded main to the wrong commit). Vercel auto-deploys prod from main.

## Role / working model
- **Advisor (advise-only):** reviews context, triages, writes grounded fix/investigation prompts
  for Matt's terminal agents, **regression-checks every diff before merge** (this caught the B-08
  near-revert), performs lane→integration merges, runs SQL via Supabase MCP, applies migrations.
- **Matt keeps deploy authority** — advisor merges to `main` only on his explicit per-deploy say-so.
- **Agents:** investigations → Agent 1; code → Agent 2+ by **disjoint file set**; `InvoicesClient.tsx`
  is single-writer. **Always branch off the current integration tip** (the `7304ff6` lesson).
- Deploy-then-test is the accepted model (no real users yet beyond the CTA test firm + P&L pilot);
  preview deployments (branch alias `dynamic-billing-git-claude-cta-i-0a8b7c-…vercel.app`) let us
  verify on the shared prod DB before main — use them (login via PASSWORD, not magic link; OAuth
  only works on the prod domain).

## Environment / constraints
- **Production**: Supabase `vvmfbtvxsjeyrmsqodon`; real Intuit OAuth + invoices.
- Firms: **CTA Integrity** `0a2a776d-27f8-494c-91a3-834d0698bee8` (Matt's test firm, role admin,
  super-admin); **P&L Business Services** `00000000-0000-0000-0000-000000000001` (LIVE pilot —
  Lea Ann owner). P&L is no longer "do not touch" — it's the active pilot; just never run
  destructive UNSCOPED SQL; firm-scope everything.
- `QBO_ITEM_NAME` stays unset. Undo = Supabase PITR / daily backup. Commit + push or it's lost.
- **Vercel:** project `prj_LsROCSJBGI88KWV5qV6P8B0Ohkst`, team `team_L59vTcDN4KmtaQIZ4dpkFuCR`.

## Open follow-ups / backlog
1. **exclude_from_billing UI toggle (Lane A)** — NOT BUILT. Path A is the per-entry gate; this is
   the whole-customer flat-rate backstop so Lea Ann can flag without SQL.
2. **B-06 regenerate idempotency** — "Generate Drafts" returns the existing run without recomputing;
   advisor deletes the run+drafts first via SQL as a workaround. Real fix = explicit "regenerate"
   action (`billing-runs/route.ts`).
3. **TC-14 bulk-send scale** — Lea Ann sends 164–187/mo; "Send All" is parallel `Promise.all` —
   needs concurrency-limit + retry before real volume.
4. **Mapping dropdown clunk** — on the call it needed a re-sync to populate (polish).
5. **Per-client rate overrides** — set after Lea Ann confirms the $75/$100 clients (above).
6. **CTA dry-run TC-11/12/13/14/15/18/19** — remain but secondary to the live P&L run.

## Lane ownership map
- **Lane A (UI):** `src/app/invoices/InvoicesClient.tsx`, `page.tsx` (single-writer).
- **Lane B (billing/auth backend):** `engine.ts`, `qb-time/sync-timesheets/route.ts`,
  `customers/[id]/route.ts`, `lib/auth/firm.ts`, `api/admin/*`, `supabase/migrations/*`, `types`.
- **Lane C (send/QBO):** `invoice-drafts/[id]/send/route.ts`, `lib/qbo/*`.

## Useful queries (Supabase MCP, project vvmfbtvxsjeyrmsqodon)
- Firm scope: `firm_id='<CTA or P&L id>' and started_at>='2026-06-01' and started_at<'2026-07-01'`.
- **Billable / rate split (P&L):** group by `source_payload->'customfields'->>'1701272'` (billable)
  and `->>'1933334'` (rate). CTA's billable field is `6490032`.
- **Rounding reconcile:** `ceil(sum(duration_seconds)/900.0)*0.25` per customer vs
  `invoice_drafts.rounded_hours`/`total_amount`.

## Bug tracker (canonical = §7 of test plan)
- B-01..B-05, B-07, B-08 — FIXED + DEPLOYED + verified live.
- B-06 regenerate idempotency — OPEN (backlog; SQL workaround).
- Super-admin firm-switcher — SHIPPED + verified (preview + main).

## How to resume the advisor
Fresh advisor auto-loads CLAUDE.md. Read this doc (esp. the 2026-07-01 session section) +
ONBOARDING-DRY-RUN-TEST-PLAN.md (§7 + Appendices A/C) + dry-run-logs/*.md +
dry-run-logs/june-billing-preview.csv. Resume advise-only. **Immediate action: June reconciliation is
DONE and drafts are generated + verified (74 / $45,987.50). Next = regression-check Agent 3's AP-03
display-rate fix, verify on preview (Proposed Billing must read $45,987.50, not $49,281.25), merge to
main on Matt's say-so, then Lea Ann reviews and sends June in batches** (watch Copper Peaks single-invoice
confirmation + TC-14 bulk-send). Next code work branches off the current integration tip. Paste latest
agent/Lea-Ann output to continue.
