# Advisor Handoff — ClockToBill (Dynamic Billing)

> **Purpose:** Resume state for the "advisor" Claude session. A fresh session reads THIS doc +
> ONBOARDING-DRY-RUN-TEST-PLAN.md + dry-run-logs/*.md to resume. Captures the orchestration /
> decision layer not in CLAUDE.md.
>
> **RESUME POINT (updated 2026-06-29, after super-admin ship):** `main` = integration =
> `7304ff6`, fully deployed to prod. Everything from the dry run is LIVE (Path A, sweep, B-08
> over-billing fix, role gating) **plus the new super-admin firm-switcher**. **P&L (Lea Ann)
> onboarded live** and bills **July 1**. **Immediate next = P&L first-billing validation:**
> waiting on Lea Ann's reply to the follow-up email (rates + blank-billable), then she sends
> her full June QB Time report → advisor reconciles per-client before she sends invoices.
> Next code work branches off **`7304ff6`** (the current integration tip).

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

## DEPLOY STATE — `main` = integration = `7304ff6`, all LIVE on app.clocktobill.com
- Empty-state batch (B-01..B-04); Path B `exclude_from_billing` (column on prod) + engine skip +
  customers PATCH; sweep (B-05, **verified live**); Path A per-entry billable (B-07, **verified
  e2e**); role gating (`isOwner`); billable badge color; B-08 over-billing UI/send fix (**verified
  live** — Greenleaf 3.00/$375, non-billable present-but-excluded); super-admin firm-switcher.
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
Fresh advisor auto-loads CLAUDE.md. Read this doc + ONBOARDING-DRY-RUN-TEST-PLAN.md (§7 +
Appendices A/C) + dry-run-logs/*.md. Resume advise-only. **Immediate action: when Lea Ann replies
with the rate/blank answers + her June QB Time report, run the per-client reconciliation (rates,
billable match, rounding, mapping/dupes), set per-client rate overrides, regenerate, confirm —
before she sends.** Next code work branches off `7304ff6`. Paste latest agent/Lea-Ann output to continue.
