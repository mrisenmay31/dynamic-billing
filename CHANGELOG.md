# Changelog — Dynamic Billing / ClockToBill

Historical build log and session notes. Current architecture, business rules, and
constraints live in `CLAUDE.md`. This file is the running record of *what was built
when* and *why* — keep it out of the working reference to keep CLAUDE.md lean.

## Milestone summary
| Milestone | Status | Confirmed |
|---|---|---|
| M1 — Auth, Supabase, seed data | ✅ Complete | 2026-05-25 |
| M2a — QBO OAuth + token storage | ✅ Complete | 2026-06-02 |
| M2b — QB Time OAuth + polling | ✅ Complete | 2026-06-08 |
| M3 — Customer mapping UI | ✅ Complete | 2026-06-02 |
| M4 — Billing run engine | ✅ Complete | 2026-06-03 |
| M5 — Review queue DB wiring | ✅ Complete | 2026-06-04 |
| M6 — QBO invoice send | ✅ Complete | 2026-06-04 |
| UI polish + dynamic billing run page | ✅ Complete | 2026-06-12 |
| Role-based access (owner/assistant) | ✅ Complete | 2026-06-25 |
| M7 — UAT with Lea Ann + Amber | 🔲 Next | Dry-run plan ready; TC-17 billable fix outstanding |

Build order / dependencies: M2a → M3 → M4 → M5 → M6 → (swap to Lea Ann's real
credentials) → M7. M2b slots in parallel — does not block M4–M6.

---

## M4 — what was built (2026-06-03)
- **`src/lib/billing/engine.ts`** — pure billing computation: groups time_entries by customer, sums seconds, applies `ceil(seconds/900)*0.25` rounding, looks up per-customer rate/description overrides
- **`POST /api/billing-runs`** — idempotent: returns existing run if one exists for the month; otherwise calls engine, writes billing_runs + invoice_drafts rows, logs audit event
- **"Import from QBO Time" button** — wired to the API; uses `window.location.href` for hard navigation after success to bypass Next.js router cache
- **`page.tsx`** — now queries latest billing run dynamically (no hardcoded month)
- **RLS bug fixed** — `firm_users` policy had infinite recursion (`select firm_id from firm_users` inside its own policy); fixed to `user_id = auth.uid()`. This was silently blocking all authenticated DB reads.

## M5 — what was built (2026-06-04)
- **`PATCH /api/invoice-drafts/[id]`** — updates `invoice_drafts`: accepts `{ status, rounded_hours, description }`. Recalculates `total_amount` server-side when hours change.
- **"Approve & Send Invoice" button** — calls send endpoint, shows spinner while saving, collapses card on success
- **Debounced PATCH (700ms)** — hours and description edits persist to DB automatically; all input paths covered (direct input, manual adj, +0.25/+0.50/+0.75 buttons)
- **"Send All Approved Invoices"** — fires all send calls in parallel via Promise.all

## M6 — what was built (2026-06-04)
- **`src/lib/qbo/invoices.ts`** — `fetchOrCreateQboItemId` (looks up item by name, creates Service item linked to first income account if not found), `fetchQboCustomerEmail` (reads PrimaryEmailAddr from QBO customer), `createQboInvoice`, `sendQboInvoice`
- **`POST /api/invoice-drafts/[id]/send`** — atomic send: idempotency check → write guard → customer email fetch → item lookup/create → QBO invoice create → QBO send → DB write (`qbo_invoice_id`, `qbo_invoice_number`, `sent_at`, `status=sent`)
- **`GET /api/qbo/items`** — debug endpoint to list QBO product/service names (keep for troubleshooting)
- Invoice date logic: `billing_month + 1 month = TxnDate`; DueDate = TxnDate + 5 days
- Idempotency: checks `qbo_invoice_id` first; generates + persists `qbo_idempotency_key` before any QBO call
- On send failure after successful create: saves `qbo_invoice_id` + sets `status=error` so orphaned invoice is trackable
- **Confirmed working in QBO sandbox** (2026-06-04) — invoices 1038/1039/1040 created and sent

## M2b — what was built (2026-06-08)
- **`src/lib/qb-time/auth.ts`** — QB Time OAuth helpers: `getAuthorizationUrl`, `exchangeCodeForTokens`, `refreshQbTimeTokens`, `saveQbTimeConnection`, `getValidQbTimeToken` (auto-refresh 5 min before expiry), `getQbTimeConnectionStatus`
- **`GET /api/auth/qb-time/connect`** — initiates OAuth with CSRF state cookie
- **`GET /api/auth/qb-time/callback`** — exchanges code for tokens, stores encrypted in `qb_time_connections`, redirects to `/invoices?connected=qb_time`
- **`POST /api/qb-time/sync-jobcodes`** — fetches all active jobcodes, auto-matches to DB customers by name, inserts new mappings (never overwrites existing `customer_id`), logs to `integration_sync_logs`
- **`POST /api/qb-time/sync-timesheets`** — accepts `{start_date, end_date}`, fetches with `supplemental_data=yes` for user names + jobcode names, upserts on `(firm_id, qb_time_entry_id)` (idempotent), handles both clock-in/clock-out and duration-based entry types, per-entry errors are non-fatal, logs to `integration_sync_logs`
- **Settings page** — QB Time connection row: Connected badge + date, "Connect QB Time" button, "Sync Now" button (syncs current calendar month)
- **`InvoicesClient.tsx`** — added `qbTimeConnected` + `qbTimeConnectedAt` to `InvoicesClientProps`; `page.tsx` fetches both QBO and QB Time status in parallel

## Pre-production hardening — what was built (2026-06-09)
- **`src/lib/crypto/tokens.ts`** — replaced base64 stub with real AES-256-GCM. Format: `iv:authTag:ciphertext` (hex). Random IV per call. Throws descriptively if `TOKEN_ENCRYPTION_KEY` missing or malformed. `TOKEN_ENCRYPTION_KEY` added to Vercel.
- **Domain rename** — all code/doc references updated from `dynamic-billing.vercel.app` to `app.clocktobill.com`
- **`src/app/privacy/page.tsx`** — static Privacy Policy; publicly accessible without auth; contact email `support@ctaintegrity.com`
- **`src/app/terms/page.tsx`** — static Terms of Service (EULA); publicly accessible without auth; contact email `support@ctaintegrity.com`
- **`src/middleware.ts`** — added `/privacy` and `/terms` to public routes (no redirect to `/login`)
- Both legal pages required for Intuit App Assessment Questionnaire submission; live at `https://app.clocktobill.com/privacy` and `https://app.clocktobill.com/terms`

## UI polish + dynamic billing run page — what was built (2026-06-12)

**Rebrand:**
- **`src/app/login/page.tsx`** — heading changed from "Dynamic Billing" to "ClockToBill"; "P&L Business Services" subheading removed
- **`src/app/layout.tsx`** — browser tab title updated to "ClockToBill"
- **`src/lib/email/templates/test.ts`** and **`src/app/api/admin/test-email/route.ts`** — "Dynamic Billing" → "ClockToBill"

**Dynamic billing run page (month selector spec):**
- **`src/app/invoices/page.tsx`** — now accepts `?month=YYYY-MM-DD` search param; queries matching billing run or falls back to latest. Added `allRuns` query for dropdown. **Critical scope fix:** entries query now has `.gte('started_at', bm).lt('started_at', nextMonth)` to prevent cross-month data bleed. Entry date year derived from `billingRun.billing_month` (not hardcoded 2026). Added `sent: boolean` to each template. Added `getPreviousMonthISO()` using Eastern timezone via `Intl.DateTimeFormat`. Passes `currentRun`, `availableRuns`, `defaultGenerateMonth`, `firmName` props.
- **`src/app/invoices/InvoicesClient.tsx`** — major overhaul:
  - Helper functions (pure string math, no `new Date()` for display — avoids UTC-midnight timezone bug): `parseBillingMonth`, `addMonths`, `entriesMonthLabel`, `entriesMonthName`, `runMonthLabel`, `runMonthName`, `invoiceDateFromBillingMonth`, `invoiceDueDateFromBillingMonth`, `dropdownLabel`, `computeRawStats`, `runDisplayStatus`
  - `runDisplayStatus` computes badge from draft statuses (not stale `billing_runs.status`): In Review (0 sent, amber) / Partially Sent (some, yellow) / Sent (all, green)
  - `MonthSelectorDropdown` sub-component — plain `<select>`, `router.push` for read navigation
  - All hardcoded "April 2026" / "May 2026" / date strings replaced with helper function calls
  - `handleGenerate` sends `defaultGenerateMonth` (Eastern prev-month) as `billingMonth`; navigates with `window.location.href` (not `router.push`) to bust Next.js router cache
  - Empty state when `billingMonth === null` (no runs yet or `?month=` with no match)
  - `firmName` prop added and passed through to `InvoiceQueueView` and `SettingsView` sub-functions
  - Settings stat line replaced: `${templates.length} clients · ${allEntries.length} time entries · ${formatCurrency(liveTotalBilling)}…`

**Run status sync:**
- **`src/lib/billing/run-status.ts`** — NEW FILE: `recomputeBillingRunStatus(adminClient, billingRunId)` — reads draft statuses, writes `pending`/`partially_sent`/`sent` to `billing_runs.status`. Best-effort (never throws into the send flow).
- **`src/app/api/invoice-drafts/[id]/send/route.ts`** — calls `recomputeBillingRunStatus` after success write, no-email 422 error, and QBO send failure 502 error.

## Password auth + forgot/reset password flow — what was built (2026-06-15)
- **`src/app/login/page.tsx`** — email + password is now the primary login method in production (was magic-link-only). Added "Forgot password?" link inline with password label. Magic link demoted to secondary option ("Sign in with a magic link instead"). No env-gating — both modes available in all environments.
- **`src/app/forgot-password/page.tsx`** — NEW FILE: public page; calls `supabase.auth.resetPasswordForEmail` with `redirectTo: https://app.clocktobill.com/api/auth/callback?next=/reset-password`. This routes the PKCE code through the existing callback route (server-side exchange) before landing on `/reset-password` with an active session. Direct `redirectTo: /reset-password` does NOT work — `@supabase/ssr`'s browser client does not auto-process hash tokens or fire `PASSWORD_RECOVERY` reliably.
- **`src/app/reset-password/page.tsx`** — NEW FILE: public client component; on mount calls `getSession()` — session is already established by the time the callback redirects here. Shows password + confirm fields; calls `supabase.auth.updateUser({ password })`; redirects to `/invoices` on success. Also handles `?code` param (PKCE direct) and `onAuthStateChange('PASSWORD_RECOVERY')` (implicit) as fallbacks.
- **Supabase dashboard (confirmed config):** Site URL = `https://app.clocktobill.com`; Redirect URLs include `https://app.clocktobill.com/api/auth/callback`, `https://app.clocktobill.com/reset-password`, `http://localhost:3000/api/auth/callback`. Old `dynamic-billing.vercel.app` entries removed.
- **`src/middleware.ts`** — extracted `authBypassRoutes = ['/forgot-password', '/reset-password']` shared by both guards. Added authenticated redirect: logged-in user on `/login` → `/invoices` (bypass routes excluded so a user with an active session can still complete password reset).
- **`src/app/invoices/InvoicesClient.tsx`** — added Account section to Settings view with `SignOutButton` component (`supabase.auth.signOut` → `/login`) and "Reset password" link to `/forgot-password`.

## ✅ Resolved — capture `intuit_tid` from QBO API responses (2026-06-17)
Every QBO API response includes an `intuit_tid` header — Intuit's trace ID for support escalations. Now captured:
- **`src/lib/qbo/invoices.ts`** — added `getIntuitTid(res)` + `throwQboError(label, res)` helpers. Every QBO failure now throws an Error whose message embeds `[intuit_tid: …]`, so the trace ID is persisted to `invoice_drafts.last_error` on any failed send. `createQboInvoice` and `sendQboInvoice` now return `intuitTid` on success.
- **`src/app/api/invoice-drafts/[id]/send/route.ts`** — on successful send, writes an `invoice_sent` audit log to `audit_logs.details` with `create_intuit_tid` and `send_intuit_tid`.
- **`src/app/api/qbo/items/route.ts`** — debug endpoint now returns `intuit_tid` in both success and error responses.

---

## Session 2026-06-22 — multi-tenancy, pre-Lea-Ann OAuth test, self-service mapping

Goal of the session: connect **CTA Integrity's own** QBO + QB Time accounts and run the full pipeline end-to-end as a dry run before onboarding Lea Ann.

### Shipped this session (all merged to `main`, deployed to `app.clocktobill.com`)
- **Multi-tenancy** — removed the hardcoded P&L `FIRM_ID` from all 9 server files. New `src/lib/auth/firm.ts` → `getFirmContext(supabase)` returns `{ userId, firmId }` from `firm_users`. Added tenant-scope guards on the invoice-draft **send** and **PATCH** routes. `page.tsx` resolves the firm explicitly (throws a clear error if a logged-in user has no firm — avoids a /login redirect loop). Matt's login maps to the **CTA Integrity, LLC** firm (`0a2a776d-27f8-494c-91a3-834d0698bee8`); P&L (`00000000-…0001`) is untouched.
- **Auth-page legitimacy** — new `src/components/AuthFooter.tsx` (links to clocktobill.com, Privacy, Terms, support@ctaintegrity.com + copyright) on `/login`, `/forgot-password`, `/reset-password`; login now states the product + "A product of CTA Integrity, LLC". Done to clear the Safe Browsing flag (below).
- **All Time Entries decoupled from billing runs** — `page.tsx` now reads the `time_entries` table directly into a new `timeEntries` prop (independent of any run). `AllTimeEntriesView` reads from it; added a month selector ("All months" + each month with data, default = latest), dynamic client-filter options, and an "Unmapped" badge/banner. (The old coupling to billing-run drafts is why it showed "May 2026 / 0 entries.") The run-scoped `allEntries` still feeds the Billing Run + Settings views.
- **Self-service jobcode → QBO-customer mapping** — new `GET /api/qb-time/jobcodes` (synced jobcodes + mapping status) and `POST /api/qb-time/jobcodes/assign` (find-or-create the `customers` row from the chosen QBO customer, upsert the jobcode→customer mapping, and **backfill `customer_id` onto existing time entries** — no re-sync needed). Client Mapping **Panel B** rewritten from a static mockup into a live table: each jobcode gets a QBO-customer dropdown + Save. This is now the supported way to onboard any firm's clients — **no hand-creating DB rows**.

### New / changed key source files this session
```
src/lib/auth/firm.ts                         — getFirmContext(): per-request { userId, firmId } from firm_users (replaces hardcoded FIRM_ID)
src/components/AuthFooter.tsx                 — company-identity footer for auth pages
src/app/api/qb-time/jobcodes/route.ts         — GET: synced jobcodes + current mapping status
src/app/api/qb-time/jobcodes/assign/route.ts  — POST: find-or-create customer + map jobcode + backfill entries
```
All 9 previously-hardcoded files (`page.tsx`, `billing-runs`, invoice-drafts `send` + `[id]`, `qb-time/sync-timesheets`, `qb-time/sync-jobcodes`, `customers/sync-qbo`, `customers/mappings`, `customers/[id]`, `qbo/items`) now call `getFirmContext`.

### CTA Integrity state (confirmed in DB, project `vvmfbtvxsjeyrmsqodon`)
- Firm `0a2a776d-27f8-494c-91a3-834d0698bee8`. `qbo_write_enabled` flipped to `true` 2026-06-23 (see below).
- QBO **and** QB Time both connected (tokens encrypted under the CTA firm). QBO customer sync works (used during mapping).
- 9 June-2026 time entries across 3 jobcodes — Baine & Company (`255802360`), Knox Physical Therapy (`255802522`), Knoxville Title Agency LLC (`255802204`) — **all mapped** to auto-created customers via the new Panel B flow.

### Operational items
- ✅ **Google Safe Browsing flag** on `clocktobill.com` — **cleared 2026-06-23**. Google Search Console emailed "Review successful for clocktobill.com". (Original flag: new-domain + login-form false positive; remediated via the **Report Incorrect Phishing Warning** form submitted 2026-06-22.)
- **OAuth redirect URIs** — both QBO and QB Time connects succeeded this session, so the registered redirect URIs are correct (`https://app.clocktobill.com/api/auth/qbo/callback` on the Intuit **Production** keys tab; `https://app.clocktobill.com/api/auth/qb-time/callback` in the QB Time API add-on).

---

## Session 2026-06-22 (part 2) — Generate Drafts fix + Billing Run polish + invoice-status simplification

Three small UI changes shipped after the part-1 multi-tenancy / mapping work.

### Generate Drafts — fixed + dropdown added (commit `3329673`)
The hardcoded `defaultGenerateMonth` (always = previous calendar month) is gone. Now:
- `InvoicesClient` (parent) owns lifted state: `generateMonth`, `generating`, `toasts` + `addToast`. The **toast root is lifted from `InvoiceQueueView` to the parent** so both views share one set of toasts.
- `generateMonthOptions` = months that actually have synced time entries, newest first, formatted `YYYY-MM-01`. Default `generateMonth` = newest entry month; falls back to `defaultGenerateMonth` only when nothing's synced.
- New `GenerateMonthDropdown` (controlled `<select>`, distinct from the read-only `MonthSelectorDropdown`); renders in **both** the Billing Run empty state and the Invoice Queue header.
- Parent `handleGenerate()` now wraps try/catch + toast + `generating` flag — the Billing Run empty-state path used to swallow the 422; both Generate buttons now report success/failure.
- Invoice Queue header button label: "Import from QBO Time" → **"Generate Drafts"** (matches the actual semantic — the real QBO Time import lives in Settings → Sync Now).

### Billing Run dashboard polish (commit `e95279b`)
- Removed the *"{X}'s time is billed in {Y}, this is standard practice."* subline.
- Replaced the static 4-step "Billing Run Progress" mockup (Imported / Reviewed / Drafts Prepared / QBO Drafts Created — the last two were the same step in our one-shot Approve & Send flow) with a real **Send Progress** bar: *"N of M invoices sent"* + a fill bar colored by `runDisplayStatus().color` (amber → yellow → green).
- Removed the "How this fits your existing tools" callout.

### Invoice status — 3 states → 2 (commit `a6df001`)
The per-card status dropdown was doing two unrelated jobs: passive review flags (Needs Review / Ready to Draft) AND a destructive action (Sent — silently fired the QBO send call). Collapsed to a read-only badge:
- `InvoiceStatus` type: `"needs_review" | "ready_to_draft" | "draft_created"` → `"in_review" | "sent"`.
- `STATUS_CONFIG` reduced to 2 entries.
- `StatusDropdown` + `handleStatusChange` removed.
- New `StatusBadge` (read-only pill, same visual language as the Billing Run dashboard's run-status badge).
- Sending is now **exclusively** via the per-card **Approve & Send Invoice** button or the **Send All Approved Invoices** bulk action.

---

## Session 2026-06-23 — CTA Integrity end-to-end dry run

First fully-live run through production QBO. Flipped `qbo_write_enabled = true` on CTA firm (`0a2a776d-…`), generated drafts for June 2026 (3 customers: Baine $375, Knox PT $562.50, KTA $500), Approved & Sent all three. Customer emails in CTA QBO were repointed to Matt's inboxes beforehand to avoid hitting real P&L customers. All three invoices created + sent atomically; `qbo_invoice_id`, `sent_at`, idempotency keys, and create+send `intuit_tid`s all persisted correctly. **No code changes shipped this session.**

### Findings from the live run + fixes
1. **`qbo_invoice_number` saved as `null` on all 3 June invoices** — root cause: CTA QBO had "Custom transaction numbers" toggled ON, so QBO did not auto-generate `DocNumber` and our send response came back with an empty value. QBO renders these as "Invoice undefined". **Fix:** turned off Settings → Account and Settings → Sales → Sales form content → "Custom transaction numbers" in CTA QBO. (Cannot backfill the existing 3 — `DocNumber` is immutable on QBO invoices.) Same toggle must be verified in Lea Ann's QBO before M7.
2. **Line items showed "Hours" instead of "Hourly Accounting services"** — root cause: `QBO_ITEM_NAME` env var was still set in Vercel (likely value `"Hours"`), overriding the code default. **Fix:** deleted `QBO_ITEM_NAME` from all three Vercel environments + redeployed. (Note: a misspelled `QB_ITEM_NAME` — no O — also exists in Vercel; harmless because the code doesn't read it, but can be cleaned up.)
3. **400 "Request Header Or Cookie Too Large" on the View and Pay link from `matt@ctaintegrity.com`** — **not a bug**. nginx at `links.notification.intuit.com` rejects when the browser sends too many/too-large Intuit cookies. The same email opened cleanly from `mrisenmay@gmail.com` and `mrisenmay@hotmail.com`. Real customers (no accumulated Intuit cookies) will not hit this.

### Re-test confirmed both fixes
Inserted a single July-2026 test entry directly into `time_entries` (Baine, 2.00 hr, `qb_time_entry_id = 'test-retest-baine-2026-07-15-001'`) — couldn't reuse June drafts because the send route's idempotency check short-circuits on `qbo_invoice_id`. Generated July drafts, Approved & Sent. Result: `qbo_invoice_number = "1001"` persisted, QBO line item shows "Hourly Accounting services". Both fixes verified end-to-end.

### State to clean up at Matt's discretion (not blocking)
- 4 real invoices now exist in CTA Integrity's production QBO against the three "P&L-style" customer records (Baine `qbo_customer_id 3`, Knox PT `4`, KTA `2`, plus the July retest Baine #1001 on `qbo_customer_id 3`). Customer email addresses on those records were rewritten to Matt's inboxes. Matt can void/delete these in QBO if he wants CTA's books clean.
- One synthetic time entry remains: `time_entries.qb_time_entry_id = 'test-retest-baine-2026-07-15-001'` (CTA firm). Notes field explicitly labels it as the retest entry. Safe to delete by `qb_time_entry_id` filter.

### Net result
End-to-end pipeline (Generate Drafts → review → Approve & Send → real QBO invoice created → real email delivered → invoice viewable in QBO with a real `DocNumber` and the correct line item) is **proven on production QBO**. The remaining gate to M7 is now purely operational (see the pre-production checklist in `CLAUDE.md`).

---

## Session 2026-06-25 — M7 dry-run prep, role-based access, transcript review

Prep session for the 2026-06-26 onboarding with **Lea Ann + Amber**. Planning/advising session; the only code shipped was the role-based access change (built in a parallel terminal session). Plan-as-deliverable lives in `ONBOARDING-DRY-RUN-TEST-PLAN.md`.

### Shipped this session
- **Role-based access control (commit `4644b52`)** — `firm_users.role` is now enforced. `getFirmContext()` returns `role`; new `isOwner(role)` (`= 'owner' || 'admin'`) in `src/lib/auth/firm.ts`. Server **403 guards** on `invoice-drafts/[id]/send` and both `auth/{qbo,qb-time}/connect` routes for non-owners (the security boundary). UI hides Send + Connect for `assistant` via `canSend`/`canConnect` (role flows `page.tsx` → `InvoicesClient`). Legacy `admin` rows + null role default to full access, so CTA/P&L are unaffected. Decision: **Amber = `assistant` (no send, no connect), Lea Ann = `owner`.** No DB migration (admin treated as owner). Diff reviewed; 403 fires before any QBO call. ⚠️ `tsc` was reported clean by the building agent but not independently re-run here.

### Authored (no code) — `ONBOARDING-DRY-RUN-TEST-PLAN.md`
Full production dry-run plan: branching/safety note, pre-flight checks, **CTA firm-scoped reset SQL** (FK-safe; keeps `firms`+`firm_users`; resets `qbo_write_enabled=true`, $125, "Monthly Bookkeeping"), **TC-1–19**, edge cases, pre-prod checklist, bug tracker, terminal prompt templates, and Appendices A (Amber role spec + invite SQL), B (transcript review), C (TC-17 billable fix prompt).

### Transcript review (added `call_transcripts/2026-05-20-…md`, the prototype walkthrough)
Reviewed both Lea Ann calls vs. plan + code. Key findings:
- **🔴 Non-billable/flat-rate time is not filtered (CRITICAL).** `sync-timesheets/route.ts:167` hardcodes `is_billable: true`; `engine.ts:28` filter is a no-op; mapping is the only gate. Lea Ann logs non-billable analysis time to flat-rate clients on purpose and must not be billed for it. Answers the old "do flat-rate clients appear in QB Time" open question (yes). Fix = TC-17 / Appendix C (capture real flag, or add `customers.exclude_from_billing`). **Outstanding — resolve before real billing.**
- **Duplicate client profiles** (Amy vs. Amber clock into two records for one client) must merge to one invoice — architecture supports it (many jobcodes → one customer); test = TC-18.
- **Scale**: real volume ~164–187 invoices/month vs. 3-client prototype; parallel "Send All" may hit rate limits (added to Known Gaps).
- **Scope expectations**: Matt pitched replacing BillerGenie (payments/merchant processing) on 5-20 — those tables exist but are unwired; pilot keeps BillerGenie. Don't imply the payment portal ships now.
- Confirmations: rounding math matches her real numbers (11h53m→12.00, 31h34m→31.75); manual 1st-of-month trigger; review gate; send-direct; high-touch buffer; approval visibility not needed ("I catch it"). Amber's prep-vs-send division validates the No-send tier.

### Next session = the dry run
Start from `ONBOARDING-DRY-RUN-TEST-PLAN.md` §1 → run in order. Branch: `claude/cta-integrity-onboarding-test-7tazih` (do NOT merge to `main` mid-run). First real correctness gate is TC-17; hand Appendix C to the terminal session once QB Time is connected with real data.
