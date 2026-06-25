# Onboarding Dry-Run Test Plan — ClockToBill (Dynamic Billing)

**Purpose:** Full end-to-end run-through on **production** (`app.clocktobill.com`) before the live onboarding with Lea Ann + Amber (P&L Business Services) tomorrow. Matt resets his **CTA Integrity** firm to a fresh state, then walks the entire onboarding-to-first-invoice flow using **CTA's own QBO + QB Time accounts**, exactly as a brand-new firm would.

**Scope of this session:** Planning + advising only. Code fixes/rewrites happen in a separate Claude Code terminal session. Where a step can fail, this plan includes a **ready-to-paste prompt** for that other session.

- **Date:** 2026-06-25 (onboarding: 2026-06-26)
- **Environment:** Production app + production Supabase (`vvmfbtvxsjeyrmsqodon`) + Intuit **production** OAuth
- **Test firm:** CTA Integrity, LLC — `0a2a776d-27f8-494c-91a3-834d0698bee8`
- **Test user:** `matt@ctaintegrity.com`
- **DO NOT TOUCH:** P&L pilot firm `00000000-0000-0000-0000-000000000001` (seeded demo data)

---

## Branching & environment

A git branch does **not** isolate this dry run — the things it touches (the production Supabase database and the live app deployed from `main`) are not version-controlled. So:

- **The reset and walk-through run on production by design.** This exercises the real Intuit OAuth redirect URIs, real QBO, and the exact deploy Lea Ann sees tomorrow. A preview/branch deploy would fail OAuth (redirect URIs are registered for `app.clocktobill.com`) and would test a *different* environment than the live one — not worth it the night before.
- **Your safety net is data-level, not git-level:** (1) the reset SQL is **scoped to the CTA firm** so P&L's seed is untouched, and (2) the **Supabase snapshot** from §1.7 is your only undo. Take it before §2.
- **Code stays on `claude/cta-integrity-onboarding-test-7tazih`.** Fixes from the dry run are committed there.
- **Do not merge any fix to `main` mid-run.** `main` auto-deploys to the production app; merging an unverified change would alter the environment under your feet (and the one Lea Ann hits tomorrow). Re-verify a fix on the branch, then merge deliberately — ideally after the dry run, not during it.

---

## 0. Ground rules & safety

1. **All destructive SQL is scoped to `firm_id = '0a2a776d-...8'`.** Never run an unscoped `DELETE`. Every statement in §2 has a `WHERE firm_id = ...` clause — verify it is present before executing.
2. **Run a backup/snapshot first.** Take a Supabase point-in-time snapshot (or `pg_dump` of the affected tables) before the reset so the run is reversible.
3. **Keep `firms` + `firm_users` rows for CTA.** Deleting them locks Matt out — `getFirmContext()` returns `null` and the app shows "Your account is not linked to a firm" (`src/app/invoices/page.tsx:93`). We are resetting *data*, not the account.
4. **This is production.** Real invoices will be created in and emailed from CTA's real QBO. Use a CTA customer you control (so the email lands in an inbox you own) for the send test, or a QBO customer whose email is one of yours.
5. **Record every bug** in the tracking table (§7) as you go — don't fix inline. Hand each to the terminal session via the prompt templates (§8).

---

## 1. Pre-flight checks (before resetting anything)

Confirm the production environment is healthy so a failure during the dry run is attributable to the app, not config drift.

| # | Check | How | Pass criteria |
|---|-------|-----|---------------|
| 1.1 | App is up | Load `https://app.clocktobill.com/login` | Login page renders, no 500 |
| 1.2 | Latest deploy is green | Vercel dashboard (apps/web project) | Most recent prod deploy = Ready |
| 1.3 | Required env vars present | Vercel → apps/web → Settings → Env | `INTUIT_*`, `QB_TIME_*`, `TOKEN_ENCRYPTION_KEY`, `NEXT_PUBLIC_APP_URL` set for Production |
| 1.4 | `QBO_ITEM_NAME` is **unset** | Same | Must NOT be set (overrides code default, breaks line-item name) |
| 1.5 | Intuit redirect URIs match prod | developer.intuit.com app + QB Time add-on | `…/api/auth/qbo/callback` and `…/api/auth/qb-time/callback` registered |
| 1.6 | Supabase auth redirect URLs | Supabase → Auth → URL config | Site URL `https://app.clocktobill.com`; `…/api/auth/callback` allowed |
| 1.7 | Snapshot taken | Supabase backups | Restorable snapshot exists, timestamped before reset |

---

## 2. Phase 0 — Fresh-start data reset (CTA firm only)

Run via **Supabase SQL editor** (or `mcp__Supabase__execute_sql`). Order matters because a few FKs have no cascade (`invoice_drafts.customer_id`, `payments.invoice_draft_id`).

### 2.1 Pre-reset snapshot of what exists (sanity)
```sql
select 'customers' t, count(*) from customers where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8'
union all select 'time_entries', count(*) from time_entries where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8'
union all select 'customer_mappings', count(*) from customer_mappings where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8'
union all select 'billing_runs', count(*) from billing_runs where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8'
union all select 'invoice_drafts', count(*) from invoice_drafts where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8'
union all select 'qbo_connections', count(*) from qbo_connections where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8'
union all select 'qb_time_connections', count(*) from qb_time_connections where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8';
```

### 2.2 Deletion sequence (FK-safe)
```sql
-- CTA Integrity, LLC = 0a2a776d-27f8-494c-91a3-834d0698bee8
-- Payments-related first (no-cascade FKs into invoice_drafts)
delete from processor_transactions where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8';
delete from payments              where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8';
delete from webhook_events        where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8';

-- Invoice data (drafts before runs; drafts also have a no-cascade customer_id FK)
delete from invoice_drafts        where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8';
delete from billing_runs          where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8';

-- Time + mappings + customers
delete from time_entries          where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8';
delete from payment_methods       where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8';
delete from customer_mappings     where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8';
delete from customers             where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8';

-- Integration tokens (forces fresh OAuth on both)
delete from qbo_connections       where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8';
delete from qb_time_connections   where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8';

-- Logs (optional — clear for a clean audit trail during the dry run)
delete from integration_sync_logs where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8';
delete from audit_logs            where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8';
```

### 2.3 Reset firm-level settings to the new-firm baseline
This makes the dry run mirror what Lea Ann will see, and fixes the **#1 gotcha** (sends fail silently if `qbo_write_enabled` is false).
```sql
update firms set
  qbo_write_enabled          = true,           -- REQUIRED or every send 403s (write-guard.ts)
  default_hourly_rate        = 125,            -- pilot rate
  default_invoice_description = 'Monthly Bookkeeping'
where id = '0a2a776d-27f8-494c-91a3-834d0698bee8';
```

### 2.4 Post-reset verification
```sql
-- All CTA operational tables should be 0
select 'customers' t, count(*) from customers where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8'
union all select 'time_entries', count(*) from time_entries where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8'
union all select 'invoice_drafts', count(*) from invoice_drafts where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8'
union all select 'billing_runs', count(*) from billing_runs where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8'
union all select 'qbo_connections', count(*) from qbo_connections where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8'
union all select 'qb_time_connections', count(*) from qb_time_connections where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8';

-- CTA firm + membership MUST still exist (login depends on these)
select id, name, qbo_write_enabled, default_hourly_rate from firms where id = '0a2a776d-27f8-494c-91a3-834d0698bee8';
select firm_id, user_id, role from firm_users where firm_id = '0a2a776d-27f8-494c-91a3-834d0698bee8';

-- P&L pilot firm MUST be untouched
select count(*) pl_customers from customers where firm_id = '00000000-0000-0000-0000-000000000001';
```

**Expected:** all operational counts = 0; `qbo_write_enabled = true`; CTA firm + firm_users present; P&L count unchanged (3 customers / 88 entries).

> If `firm_users` for Matt is missing (e.g. it was never created), the app will show the "not linked to a firm" error. Re-create it before continuing:
> ```sql
> insert into firm_users (firm_id, user_id, role)
> values ('0a2a776d-27f8-494c-91a3-834d0698bee8', '<matts-auth-user-id>', 'admin')
> on conflict do nothing;
> ```

---

## 3. End-to-end test cases

Walk these **in order** — each depends on the previous. For every case: perform the action, confirm the **Expected**, and check the **Watch for** failure modes. Log anything off in §7.

### TC-1 — Login (fresh session)
- **Do:** Open an incognito window → `app.clocktobill.com/login` → sign in as `matt@ctaintegrity.com` (password).
- **Expected:** Redirect to `/invoices`. App loads with **empty** state everywhere (no customers, no entries, no runs) because of the reset.
- **Watch for:** "Not linked to a firm" error (firm_users missing — see note above); stale data showing (reset incomplete or cache); redirect loop.

### TC-2 — Initial empty-state UX
- **Do:** Visit each nav view: Billing Run, Invoice Queue, All Time Entries, Client Rules, Client Mapping, Settings.
- **Expected:** Each renders a sensible empty state, not a crash or blank screen. Settings shows **both** integrations as "Not Connected."
- **Watch for:** Null-pointer crashes on empty arrays; "Generate Drafts" enabled when there's nothing to bill; misleading copy. *(This is the exact first impression Lea Ann gets — scrutinize wording.)*

### TC-3 — Connect QBO (OAuth)
- **Do:** Settings → "Connect" under QBO → authorize CTA's QBO company at Intuit → return to app.
- **Expected:** Redirect to `/invoices?connected=qbo`; Settings shows QBO **Connected** (green). `qbo_connections` row created with encrypted tokens + `realm_id`.
- **Watch for:** `error=qbo_state_mismatch` (cookie/redirect issue), `error=qbo_missing_params`, `error=qbo_no_firm`, `error=qbo_exchange_failed`. Confirm the realm is CTA's **production** company, not sandbox.
- **Verify in DB:** `select realm_id, connected_at from qbo_connections where firm_id='0a2a776d-...8';`

### TC-4 — Connect QB Time (OAuth)
- **Do:** Settings → "Connect QB Time" → authorize → return.
- **Expected:** Redirect `…?connected=qb_time`; QB Time shows Connected. `qb_time_connections` row created.
- **Watch for:** Token endpoint auth differences (QB Time uses POST-body auth, not Basic — a misconfig here surfaces as exchange failure); state mismatch. Confirm the QB Time account is the one with the jobcodes/time you expect.

### TC-5 — Sync QB Time jobcodes
- **Do:** Client Mapping view (Panel B) loads jobcodes; trigger the jobcode sync (`POST /api/qb-time/sync-jobcodes`).
- **Expected:** Active jobcodes appear with entry counts. Response `{ jobcodes, added, skipped }`. Auto-match links any jobcode whose name exactly matches an existing customer (none yet, so expect mostly unmatched).
- **Watch for:** Pagination (uses `limit` max 200, not `per_page`); rate limit (300 req / 5 min); zero jobcodes returned (wrong account / approvals add-on).

### TC-6 — Sync QBO customers + auto-match
- **Do:** Client Mapping Panel A → "Sync from QuickBooks Online" (`POST /api/customers/sync-qbo`).
- **Expected:** QBO customers pulled; any `customers` row with null `qbo_customer_id` auto-matched by exact (case-insensitive) name. Response shows `autoMatched` count.
- **Watch for:** Duplicate QBO customers (known risk — Lea Ann has some); name-mismatch leaving rows unlinked; customers with no `PrimaryEmailAddr` (will block send later — note them now).

### TC-7 — Map jobcodes → customers (find-or-create + backfill)
- **Do:** Panel B → for each jobcode pick the QBO customer → "Map" (`POST /api/qb-time/jobcodes/assign`).
- **Expected:** Atomic 3-step: find-or-create `customers` row → upsert `customer_mappings` → backfill `customer_id` onto existing `time_entries` for that jobcode. New customer appears in Panel A. Toast confirms.
- **Watch for:** Duplicate customer rows created when one already exists (find step keyed on `qbo_customer_id`); backfill silently skipped (it's non-fatal — verify entries actually got `customer_id`); mapping saved but Panel A not refreshed.
- **Verify:** `select count(*) from time_entries where firm_id='0a2a776d-...8' and customer_id is null;` should drop as you map.

### TC-8 — Sync timesheets (both entry types)
- **Do:** All Time Entries (or Settings) → "Sync Now" (`POST /api/qb-time/sync-timesheets`) for the target billing month.
- **Expected:** Entries upserted (idempotent on `qb_time_entry_id`); both clock-in/out and duration-only (manual) entries import; `started_at` bucketed in Eastern time. Response `{ processed, upserted, skipped }`.
- **Watch for:** Duration-only entries landing in the wrong month (Eastern midnight bucketing via `toEasternMidnightISO`); double-counting on re-sync; entries with unmapped jobcodes showing the "Unmapped" badge/banner. **Re-run the sync** and confirm counts are stable (idempotency).
- **Edge:** If the QB Time Approvals Add-On isn't enabled, confirm the date-range fallback pulls the full month (open question in CLAUDE.md — note actual behavior).

### TC-9 — All Time Entries review
- **Do:** Filter by month / client / employee; check totals and the Unmapped banner.
- **Expected:** Flat table reads directly from `time_entries`; filters work; unmapped count matches DB; durations/amounts look right at $125/hr.
- **Watch for:** Multiple staff on one client all present (they must all sum later); timezone display oddities; missing entries vs. the QB Time source.

### TC-10 — Generate Drafts (rounding + aggregation)
- **Do:** Billing Run (or Invoice Queue header) → pick billing month → "Generate Drafts" (`POST /api/billing-runs`).
- **Expected:** One `invoice_drafts` row **per customer** (never per entry). Per customer: `roundedHours = ceil(total_seconds / 900) * 0.25`, `total = roundedHours × rate`. `billing_runs` row created `status=pending`. Re-clicking is **idempotent** (returns existing run).
- **Watch for:** Rounding errors (must be **ceiling** to next 0.25, not nearest — verify with a hand calc, e.g. 11h53m=11.88→12.00; 31h34m=31.57→31.75); unmapped entries leaking in (engine filters `customer_id NOT NULL`); rate override precedence (`hourly_rate_override ?? firm default`); 422 "no billable entries" if mapping/sync incomplete.
- **Verify math by hand** for at least 2 clients against the DB sums.

### TC-11 — Invoice Queue review + edits
- **Do:** Invoice Queue → expand a card. Check billing-math summary, client-facing preview, raw entries table. Edit **description**, edit **final quantity (hours)**, toggle **high-touch** + quick-add buffer, set rate override.
- **Expected:** Edits debounce-PATCH to `/api/invoice-drafts/[id]`; `total_amount` recomputes as `rounded_hours × hourly_rate`; preview reflects edits; status stays "In Review" (amber) until sent.
- **Watch for:** Total not recalculating; negative/empty hours accepted; description reverting; raw staff notes leaking into the **client-facing** description (must never appear on invoice); high-touch buffer not adding to quantity.

### TC-12 — Approve & Send ONE invoice (atomic create + send) ⚠️ real invoice
- **Do:** Pick a customer whose QBO `PrimaryEmailAddr` is an inbox **you** control → "Approve & Send Invoice" (`POST /api/invoice-drafts/[id]/send`).
- **Expected (atomic):** item fetch-or-create ("Hourly Accounting services") → create QBO invoice → fetch customer email → send → DB: `status=sent`, `sent_at`, `qbo_invoice_id`, `qbo_invoice_number` saved. Toast: "Invoice sent. BillerGenie will sync…" Email arrives.
- **Watch for / known failure modes:**
  - **403** — `qbo_write_enabled=false` (should be true after §2.3).
  - **422** — customer missing `qbo_customer_id` (mapping gap) or missing `PrimaryEmailAddr` in QBO.
  - **422** — no Income account in QBO (blocks item auto-create).
  - **`qbo_invoice_number` saves null / "Invoice undefined"** — QBO "Custom transaction numbers" is **ON**. Must be OFF (Settings → Account and Settings → Sales). `DocNumber` is immutable, so this can't be backfilled — catch it now.
  - **502** — invoice created but send failed (email issue); draft records the invoice id + error. Verify the partial state is recoverable.
- **Verify:** Invoice exists in CTA's QBO with a real number; amount = qty × $125; date = 1st of following month; due = +5 days. Check `audit_logs` captured `invoice_sent` with intuit_tid.

### TC-13 — Idempotent re-send
- **Do:** Click "Approve & Send" again on the same (now sent) invoice.
- **Expected:** Returns `alreadySent=true`, no duplicate QBO invoice. Toast says already sent.
- **Watch for:** Duplicate invoice created in QBO (idempotency broken).

### TC-14 — Send All Approved
- **Do:** With ≥2 remaining drafts, "Send All Approved Invoices."
- **Expected:** Each sends (parallel); all flip to "Sent"; batch toast with count; billing run status → Sent / Partially Sent.
- **Watch for:** One failure aborting the batch vs. isolating; partial-send leaving run status wrong; rate limiting on rapid QBO calls.

### TC-15 — Billing Run dashboard accuracy
- **Do:** Billing Run view after sends.
- **Expected:** Stat cards, Send Progress bar colored by status, totals (raw time, raw amount, rounded hours, proposed billing, rounding difference) all reconcile with the queue and DB.
- **Watch for:** Totals not matching sum of drafts; progress bar wrong %; rounding-difference sign/color wrong.

### TC-16 — Settings / Account housekeeping
- **Do:** Confirm integration status, billing config copy, support contact. Test "Reset password" link and "Sign out."
- **Expected:** Sign out → `/login`; reset link → forgot-password flow works.
- **Watch for:** Broken links; stale connection status after sign-out/in.

---

## 4. Targeted edge cases & known gaps to probe

Pull from CLAUDE.md "Known Gaps / Open Questions" — explicitly try to trip these:

- **Customer with no `qbo_customer_id`** at send → should fail with a *clear* error (auto-create is a known backlog gap; confirm the error is understandable, not a stack trace).
- **Customer with no `PrimaryEmailAddr`** → 422 with actionable message.
- **Custom transaction numbers ON** in QBO → reproduces "Invoice undefined" / null number. **Confirm it's OFF** for CTA before TC-12.
- **Multiple staff → one client** → single aggregated line item, no staff breakdown on invoice.
- **High-maintenance buffer** → manually bump hours in queue; amount recalcs; buffer not persisted as a system flag (by design).
- **Duplicate QBO customers** → auto-match behavior when two QBO customers share a name.
- **Re-sync stability** → run sync-timesheets twice; counts stable, no dupes.
- **Approvals Add-On absent** → date-range fallback pulls full month.
- **QB Time refresh-token rotation** → not directly testable in one session, but note: token must overwrite on each exchange (10-day TTL). If a sync fails mid-meeting tomorrow, this is a suspect.
- **QBO token refresh** → 1-hr access token; long meeting could cross a refresh. The auto-refresh (`getValidQboToken`, 5-min skew) should handle it.

---

## 5. Pre-production checklist verification (CTA = stand-in for Lea Ann)

Confirm each before declaring "ready for tomorrow":

- [ ] Both OAuth flows authorize cleanly (TC-3, TC-4)
- [ ] "Hourly Accounting services" item exists or auto-creates in CTA QBO (TC-12)
- [ ] **"Custom transaction numbers" OFF** in QBO (TC-12) — **verify this in Lea Ann's QBO tomorrow too**
- [ ] Every customer to be invoiced has `PrimaryEmailAddr` (TC-6 / TC-12)
- [ ] `qbo_write_enabled = true` on the firm (§2.3)
- [ ] Invoice date = 1st of following month, due = +5 days (TC-12)
- [ ] Rounding = ceiling to next 0.25 (TC-10)
- [ ] Aggregation = one line item per client (TC-10/TC-12)
- [ ] Magic-link / invite flow works (needed to create Lea Ann's + Amber's users)

---

## 6. Tomorrow's onboarding readiness (carry-over notes)

Things the dry run can't fully cover but must be queued for the live session:

1. **Invite Lea Ann + Amber** via magic link → creates their auth users. Confirm each lands in a `firm_users` row for **P&L** (`00000000-…0001`), not CTA. *(Amber as admin assistant — her access model is a decision that may need code before tomorrow; see Appendix A.)*
2. **P&L `qbo_write_enabled`** must be `true` before any real send.
3. **P&L firm defaults** — set rate ($125) + description ("Monthly Bookkeeping").
4. **Known-duplicate customer list** — get from Lea Ann to pre-empt mapping confusion.
5. **Approvals Add-On status** on Lea Ann's QB Time — determines filter behavior.

---

## 7. Bug tracker (fill in during the run)

| ID | TC | Severity | Symptom | Expected | Actual | Repro steps | Status | Handed to terminal? |
|----|----|----------|---------|----------|--------|-------------|--------|---------------------|
| B-01 | | | | | | | open | |
| B-02 | | | | | | | open | |
| B-03 | | | | | | | open | |

Severity: **P0** blocks onboarding · **P1** visible/embarrassing · **P2** polish.

---

## 8. Prompt templates for the terminal Claude Code session

Paste these into the other session, filling the brackets. They reference the real files so that session lands fast.

**8.1 — Bug fix**
```
On branch claude/cta-integrity-onboarding-test-7tazih (apps/web). During an onboarding
dry run I hit this bug:

- Where: [TC-# / view name / API route, e.g. POST /api/invoice-drafts/[id]/send]
- Repro: [exact steps]
- Expected: [...]
- Actual: [error text / screenshot / DB state]
- Relevant file(s): [e.g. src/app/api/invoice-drafts/[id]/send/route.ts, src/lib/qbo/invoices.ts]

Diagnose root cause, propose the fix, then implement it. Run `npx tsc --noEmit` from
apps/web before committing. Keep the change minimal and tenant-safe (it must respect
getFirmContext / firm scoping). Commit with a clear message; do not open a PR.
```

**8.2 — Empty-state / copy polish**
```
The [view] empty state shows [problem]. A brand-new firm owner (non-technical) sees this
first. Improve the empty-state UI/copy in src/app/invoices/InvoicesClient.tsx ([View]
component). Match existing Tailwind/lucide styling. tsc clean, commit, no PR.
```

**8.3 — Send/QBO failure investigation**
```
Approve & Send failed with [status/message] for a customer in CTA's real QBO. Trace the
atomic flow in src/app/api/invoice-drafts/[id]/send/route.ts and src/lib/qbo/invoices.ts
(item fetch-or-create → create invoice → fetch email → send). Tell me which step failed
and why, whether a partial invoice now exists in QBO, and how to make the error clearer to
the user. Implement the improvement if low-risk. tsc clean, commit, no PR.
```

**8.4 — Rounding/aggregation discrepancy**
```
Generated drafts don't match my hand calc. Client [name]: DB sum = [X] seconds, I expected
roundedHours = ceil(X/900)*0.25 = [Y], invoice = [Y]*125. App shows [Z]. Audit
src/lib/billing/engine.ts and the draft creation in src/app/api/billing-runs/route.ts.
Find the discrepancy, fix, add a quick unit check if practical. tsc clean, commit, no PR.
```

---

## 9. Suggested execution order (timeboxed)

1. §1 pre-flight (10 min) → §0 backup
2. §2 reset + verify (10 min)
3. TC-1 → TC-2 empty states (10 min)
4. TC-3 → TC-8 connect + sync + map (30 min)
5. TC-9 → TC-11 review (15 min)
6. TC-12 → TC-15 send + dashboards (20 min) ⚠️ real invoice
7. §4 edge cases (20 min)
8. §5 checklist sign-off + §6 carry-over (10 min)

Log bugs as you go; batch the non-P0s to the terminal session at the end so the walk-through stays continuous.

---

## Appendix A — Amber role/permissions spec

**Decision needed before tomorrow.** Amber (admin assistant at P&L) and Lea Ann (owner) will both be members of the P&L firm. Decide what Amber can do, then choose how much (if any) code to build for it before the meeting.

### A.1 Current reality (as built today)

- `firm_users.role` exists (`text not null default 'admin'`) but is **read nowhere** in the app. `getFirmContext()` (`src/lib/auth/firm.ts:26`) selects only `firm_id`; no route checks `role`.
- **Therefore there is no access control.** Any user in a firm's `firm_users` has **identical full access**: connect/disconnect QBO + QB Time, sync, generate drafts, edit hours/description/rate, and **Approve & Send real invoices**.
- `getFirmContext` resolves the user's firm via `.maybeSingle()` on `firm_users` by `user_id` — it assumes **one firm per user**. Adding Amber to P&L is one row and works fine; it does **not** assume one user per firm.
- Net: if we do nothing, **Amber can send invoices to clients** exactly like Lea Ann. That is the gap to close (or knowingly accept) for the pilot.

### A.2 The decision

What should Amber be able to do? Pick a target tier:

| Capability | Owner (Lea Ann) | **Option 1: Full** (no code) | **Option 2: No-send** (recommended) | **Option 3: Read-only** |
|---|---|---|---|---|
| View runs / queue / entries / dashboards | ✅ | ✅ | ✅ | ✅ |
| Sync QB Time / QBO | ✅ | ✅ | ✅ | ❌ |
| Map jobcodes ↔ customers | ✅ | ✅ | ✅ | ❌ |
| Generate drafts | ✅ | ✅ | ✅ | ❌ |
| Edit hours / description / rate in queue | ✅ | ✅ | ✅ | ❌ |
| **Approve & Send invoice (real, to clients)** | ✅ | ✅ | **❌ blocked** | ❌ |
| Connect/disconnect integrations | ✅ | ✅ | ❌ | ❌ |
| Code required before tomorrow | — | **None** | **Small** | Medium |

**Recommendation: Option 2 (No-send assistant).** It matches the real division of labor — Amber does the prep (sync, map, generate, review/adjust), Lea Ann keeps the one irreversible, client-facing action (sending real invoices). It also aligns with the product's core "review gate is non-negotiable" principle: the owner owns the send.

### A.3 Concrete spec for Option 2 (No-send)

**Role model**
- Define two roles in `firm_users.role`: `owner` (Lea Ann) and `assistant` (Amber). Keep `admin` as an alias for `owner` so existing rows (default `'admin'`) keep full access — no migration/backfill needed.
- Helper: extend `getFirmContext()` to also select and return `role` (one-line change to the select + the `FirmContext` interface in `src/lib/auth/firm.ts`).

**Enforcement (server-side — the security boundary)**
- Gate the **send** route: `src/app/api/invoice-drafts/[id]/send/route.ts` returns **403** if `role` is not `owner`/`admin`. This is the only must-have for correctness — it's the irreversible action.
- Decide whether to also gate integration connect/disconnect (`src/app/api/auth/qbo/connect`, `qb-time/connect`) for assistants. Recommended yes (low effort, same pattern), but not strictly required for pilot since reconnecting isn't destructive.
- Everything else (sync, generate, map, PATCH draft edits) stays open to assistants per the table.
- **Server enforcement is mandatory** — UI hiding alone is not security; the route is the boundary.

**UI (secondary — prevents confusion, not a security control)**
- In `InvoicesClient.tsx`, when the current user is an assistant: hide/disable the **"Approve & Send Invoice"** and **"Send All Approved Invoices"** buttons and show a short note ("Sending is restricted to the firm owner"). Pass the role from the server component (`page.tsx`) down as a prop, same way `qboConnected` is passed.
- Leave all review/edit controls active so Amber can fully prep invoices.

**Out of scope for tomorrow (note, don't build):** invitation UI with role selection, multiple-firm membership, granular per-capability permissions, audit of who-changed-what beyond existing `audit_logs`. For the pilot, roles are assigned by SQL when inviting.

**Acceptance criteria (Option 2)**
- [ ] Amber (role `assistant`) can sync, map, generate, and edit drafts.
- [ ] Amber clicking send (or hitting the endpoint directly) gets **403**; no QBO invoice is created.
- [ ] Lea Ann (role `owner`/`admin`) retains full send capability.
- [ ] Existing CTA/P&L `admin` rows are unaffected (treated as owner).
- [ ] Send buttons are hidden/disabled in Amber's UI.

**Effort:** ~small — one field added to `getFirmContext`, one role check in the send route (+ optionally connect routes), and a prop-drilled conditional on two buttons. No DB migration if `admin` is treated as owner.

### A.4 If you choose Option 1 (Full, ship as-is)

No code, but **explicitly accept** that Amber can send real invoices to P&L's clients. If that's acceptable for the pilot, document it and move on — revisit role enforcement post-UAT.

> **Ask Matt to pick A.2 Option 1 / 2 / 3 today.** If Option 2 or 3, hand Appendix A.3 to the terminal session now (prompt template 8.1 with this section pasted in) so the change is built and verified on the branch before tomorrow — not merged to `main` until after the dry run.
