# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Dynamic Billing** — a product under the **Client Flow** umbrella by CTA Integrity. Client Flow is a suite of SaaS automation tools for accounting and CPA firms. Dynamic Billing automates monthly invoice generation for bookkeeping firms: pull approved time entries from **QuickBooks Time (QB Time)**, aggregate and round them per client, and send invoices via **QuickBooks Online (QBO)** after firm owner review.

The primary design reference is `qbo-billing-automation-briefing.md`. Read it before making any architectural decisions.

**Target buyer:** Small bookkeeping firms (1–10 staff) using QB Time + QBO. First pilot: Lea Ann Sanford, P&L Business Services, Knoxville TN.

**BillerGenie:** Lea Ann uses BillerGenie Premium, which auto-syncs invoices from QBO. No BillerGenie API integration needed — invoices sent via QBO flow there automatically.

## Core Business Logic

- **Aggregation:** All time entries for a client in a billing period collapse into a **single line item** — never individual entries on the invoice.
- **Rounding:** Total hours per client rounded UP to the next 0.25 hours (ceiling), applied at month-end across the full month (not per entry). Formula: `ceil(total_seconds / 900) * 0.25`. Confirmed by invoice data — "nearest" is incorrect.
- **Review gate is non-negotiable:** Invoices must go into a review queue for firm owner approval before sending. Never auto-send.
- **Billing trigger is manual:** Lea Ann clicks "Generate Drafts" — no auto-scheduling. Confirmed 2026-06-02.
- **Invoice description format:** Short, human-readable — default is simply **"Monthly Bookkeeping"**. Occasionally customized for context (e.g., "Monthly Bookkeeping Services-2026 recons caught up (1st Quarter)"). Raw staff notes from QB Time are never shown on the invoice. Description field must be editable in the review queue.
- **Invoice date:** Always the 1st of the following month (e.g., April work → dated 05/01). Due date is 5 days later.
- **QBO line item:** Product/service name is **"Hourly Accounting services"** — must match exactly for `ItemRef` lookup. Rate is $125/hr (uniform across all hourly clients for this pilot).
- **Multiple staff per client:** Several employees log time to the same client in a single month. All entries are summed together into one line item — staff breakdown is never exposed on the invoice.
- **High-maintenance client buffer:** ~5 clients get 15–45 min manually added at review time. No system flag — Lea Ann identifies them by name. The review queue must expose an editable hours field; default is the ceiling-rounded total, she bumps it up as needed. Amount recalculates as `edited_hours × $125`.

## Integration Architecture

### Two Separate OAuth Systems Per Firm
QBO and QB Time use **completely independent** OAuth 2.0 flows. Every firm onboarded requires two separate authorization redirects and two token sets stored in the database.

- **QBO OAuth:** via `developer.intuit.com` (scope: `com.intuit.quickbooks.accounting`). Access token TTL: 1 hour. Refresh token TTL: 100 days rolling.
- **QB Time OAuth:** provisioned inside the QB Time web app under Feature Add-ons → API (not at developer.intuit.com). No scopes — token grants full account access. Access token TTL: 10 days. Refresh token **rotates** — must overwrite stored token after every exchange.

### Polling Architecture (QB Time Has No Webhooks)
1. Call `GET /last_modified_timestamps` per firm — cheap check
2. If timestamps advanced, fetch timesheets with `supplemental_data=yes`
3. Filter approved entries client-side: include only timesheets where `timesheet.date ≤ supplemental_data.users[user_id].approved_to`

The **QB Time Approvals Add-On** is what makes step 3 possible — it adds an `approved_to` date to each user object. Without it, the `approved_to` field does not exist.

**If Approvals Add-On is NOT enabled:** fall back to a simple date-range filter — pull all billable entries within the calendar month. Likely safe for Lea Ann since her EA approves weekly and billing happens after month-end.

### Invoice Generation Flow
```
Lea Ann clicks "Generate Drafts" (manual trigger)
  → Read time_entries from DB for the billing month + firm
  → Group by customer_id, sum duration_seconds
  → Ceiling-round to next 0.25 hrs per customer
  → Look up rate from customers table (hourly_rate_override or firm default)
  → Write invoice_drafts rows to DB
  → Present in Invoice Queue for review
  → Lea Ann reviews, edits hours/description as needed
  → Clicks "Approve & Send Invoice"
  → POST invoice to QBO, immediately call /send — invoice goes to client
  → BillerGenie picks it up automatically from QBO
```

**Confirmed by Lea Ann (2026-06-02):** "Approve & Send Invoice" creates AND sends in one atomic step. No second step in QBO. The review gate lives entirely in Dynamic Billing. Do NOT design a "create draft in QBO, then send separately" flow.

### Staging Strategy for Invoices
Hold invoice payload in `invoice_drafts` DB table until Lea Ann approves in Dynamic Billing. On approval: POST to QBO invoice endpoint → immediately POST to `/send` on the returned invoice ID. No `EmailStatus: "NotSet"` staging. Send is atomic with creation.

### Jobcode-to-Customer Mapping
No native shared identifier between QB Time jobcodes and QBO customer IDs. The app maintains a `customer_mappings` table (jobcode → customer_id) and `customers.qbo_customer_id`. Built during onboarding via name-match + user confirmation UI (M3 — complete).

### Required QBO Invoice Fields
- `CustomerRef.value` (QBO customer ID — from `customers.qbo_customer_id`)
- `Line[].Amount` (must equal `UnitPrice * Qty` exactly — QBO does not auto-calculate)
- `Line[].DetailType`: use `SalesItemLineDetail`
- `Line[].SalesItemLineDetail.ItemRef.value` (missing triggers error 2020)
- API version: `minorversion=75` minimum

### Per-Tenant DB Schema (Key Tables)
```
firms                  — firm settings, default rate, qbo_write_enabled flag
firm_users             — user ↔ firm membership
qbo_connections        — QBO OAuth tokens per firm (encrypted)
qb_time_connections    — QB Time OAuth tokens per firm (encrypted)
customers              — billing clients; qbo_customer_id links to QBO
customer_mappings      — QB Time jobcode → customer_id mapping
time_entries           — imported QB Time entries; customer_id FK
billing_runs           — one per billing month per firm
invoice_drafts         — computed drafts held until approved + sent
audit_logs             — all write actions logged
integration_sync_logs  — QB Time poll history
```
Full schema: `apps/web/supabase/migrations/20260525232144_remote_schema.sql`

## Critical Constraints

- **QB Time account cap:** Default 3 client accounts per app credential before Intuit requires partner expansion.
- **Intuit App Partner Program:** Builder tier (free, self-attested) is sufficient for pilot.
- **QB Time rate limit:** 300 requests per 5-minute window per token.
- **QB Time timesheets endpoint pagination:** Use `limit` parameter (max 200), not `per_page` (deprecated).
- **`qbo_write_enabled` flag:** `src/lib/qbo/write-guard.ts` throws if this is `false` on the firm row. Must be set to `true` before any QBO write (invoice creation) can succeed.

## Open Questions (still unresolved)

- **QB Time Approvals Add-On:** Enabled on Lea Ann's account? Determines approval-date filter vs. simple date-range filter.
- **Flat-rate clients:** Do they appear in QB Time exports? If so, system needs to skip or flag them.
- **Multiple billing rates:** Is $125/hr universal for all hourly clients, or do some differ?
- **QBO Item ID:** Need the exact internal ID for "Hourly Accounting services" item in Lea Ann's real QBO — required for M6 `ItemRef` lookup. (Sandbox has its own item ID for dev/test.)

## Resolved Questions

- **Billing trigger:** Manual. Lea Ann clicks "Generate Drafts." Confirmed 2026-06-02.
- **Send flow:** One-step "Approve & Send" — creates and sends atomically. Confirmed 2026-06-02.
- **QB Time refresh token TTL:** Rotates on every exchange — always overwrite stored token.
- **OAuth registrations:** Completely separate. QBO via developer.intuit.com; QB Time via TSheets API Add-On inside the account.
- **QBO user invite needed from Lea Ann:** No. OAuth app authorization is independent of QBO user roles.

---

## Current Code Status (as of 2026-06-22)

### Milestone summary
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
| M7 — UAT with Lea Ann | 🔲 Next | Pending pre-production checklist |

### Tech stack
- **`apps/web/`** — Next.js 15, TypeScript, Tailwind v4, App Router, `lucide-react`
- **`marketing/`** — standalone static HTML landing page; own `vercel.json`; deployed separately at `clocktobill.com`
- **Supabase** — project ref `vvmfbtvxsjeyrmsqodon`, region `us-east-1`
- **Deployed (app):** `https://app.clocktobill.com` (auto-deploys from `main`)
- **Deployed (marketing):** `https://clocktobill.com` — separate Vercel project, Root Directory: `marketing` (setup in progress 2026-06-10)
- **GitHub:** `github.com/mrisenmay31/dynamic-billing` (private, `mrisenmay31`)

### Key source files
```
src/app/invoices/page.tsx              — server component; fetches latest billing run, drafts, entries, customers
src/app/invoices/InvoicesClient.tsx    — all UI/state (6 nav views); "use client"
src/app/login/page.tsx                 — password + magic link login; "Forgot password?" link
src/app/forgot-password/page.tsx       — sends Supabase password reset email; public route
src/app/reset-password/page.tsx        — handles recovery token via onAuthStateChange; public route
src/app/api/auth/callback/route.ts     — PKCE code exchange (production auth path)
src/app/api/auth/qbo/connect/route.ts  — initiates QBO OAuth
src/app/api/auth/qbo/callback/route.ts — QBO OAuth callback, stores tokens
src/app/api/billing-runs/route.ts      — POST: create billing run + invoice drafts (idempotent)
src/app/api/customers/sync-qbo/route.ts   — POST: fetch QBO customers, auto-match by name
src/app/api/customers/[id]/route.ts       — PATCH: update qbo_customer_id
src/app/api/customers/mappings/route.ts   — GET/POST/DELETE: QB Time jobcode mappings
src/lib/billing/engine.ts         — pure fn: (firmId, billingMonth) → DraftPayload[]; no DB writes
src/lib/billing/run-status.ts     — recomputeBillingRunStatus: syncs billing_runs.status from draft statuses after each send
src/lib/qbo/oauth.ts          — QBO OAuth helpers (auth URL, token exchange, refresh)
src/lib/qbo/connection.ts     — getValidQboToken (auto-refresh), saveQboConnection
src/lib/qbo/customers.ts      — fetchQboCustomers (QBO Customer query)
src/lib/qbo/write-guard.ts    — throws if qbo_write_enabled = false
src/lib/supabase/client.ts    — browser Supabase client
src/lib/supabase/server.ts    — SSR Supabase client (uses next/headers cookies)
src/lib/supabase/admin.ts     — service role client (bypasses RLS)
src/lib/crypto/tokens.ts      — AES-256-GCM encrypt/decrypt; requires TOKEN_ENCRYPTION_KEY env var
src/lib/audit/log.ts          — writes to audit_logs
src/middleware.ts              — auth guard; unauthenticated → /login (except public routes); authenticated on /login → /invoices (except /forgot-password, /reset-password)
src/app/privacy/page.tsx      — static Privacy Policy page (public, no auth required)
src/app/terms/page.tsx        — static Terms of Service page (public, no auth required)
```

### Nav views in InvoicesClient.tsx
1. **Billing Run** — summary dashboard; stat cards, progress indicator, totals; month selector dropdown
2. **Invoice Queue** — per-client review cards with billing math, invoice preview, time entries, adjustment controls; read-only **StatusBadge** ("In Review" → "Sent"); "Approve & Send Invoice" button per card; "Send All Approved Invoices" bulk action. Header has a billing-period dropdown next to the Generate Drafts button.
3. **All Time Entries** — filterable flat table of time entries (scoped to selected month)
4. **Client Rules** — firm-wide defaults + per-client overrides (rate, description, high-touch flag)
5. **Client Mapping** — QBO customer sync + manual match UI; QB Time jobcode panel (scaffolded; M2b live but jobcode-to-customer linking UI not yet wired)
6. **Settings** — integration status, billing behavior config

### Invoice Queue button labels (updated 2026-06-22)
- Per-card button: **"Approve & Send Invoice"** (was "Create QuickBooks Draft")
- Bulk action: **"Send All Approved Invoices"** (was "Create all QBO drafts")
- Per-card status: read-only **StatusBadge** — "In Review" (amber) or "Sent" (green). No dropdown; sending is exclusively via the button. (Replaced the 3-state dropdown 2026-06-22 — see Session part-2 below.)
- Header button: **"Generate Drafts"** (was "Import from QBO Time"; renamed 2026-06-22 to match the actual semantic).
- Toast: "Invoice sent. BillerGenie will sync the payment portal automatically."

### Seeded DB data
- **Firm:** P&L Business Services, LLC — UUID `00000000-0000-0000-0000-000000000001`
- **Customers:** 3 (KTA, Baine, Knox PT) — UUIDs `...000010`, `...000011`, `...000012`
- **Time entries:** 88 April 2026 entries across 3 customers (static seed — M4 computes from these)
- **Billing run:** seeded run UUID `...000020` is no longer used; M4 generates a fresh run via "Import from QBO Time"
- **Matt's auth user:** UUID `29b3856e-8ce4-424b-a083-ceb14af7372d`
- **Local dev password:** `devpassword123` (password auth on login page; magic link also available)

### M4 — what was built (2026-06-03)
- **`src/lib/billing/engine.ts`** — pure billing computation: groups time_entries by customer, sums seconds, applies `ceil(seconds/900)*0.25` rounding, looks up per-customer rate/description overrides
- **`POST /api/billing-runs`** — idempotent: returns existing run if one exists for the month; otherwise calls engine, writes billing_runs + invoice_drafts rows, logs audit event
- **"Import from QBO Time" button** — wired to the API; uses `window.location.href` for hard navigation after success to bypass Next.js router cache
- **`page.tsx`** — now queries latest billing run dynamically (no hardcoded month)
- **RLS bug fixed** — `firm_users` policy had infinite recursion (`select firm_id from firm_users` inside its own policy); fixed to `user_id = auth.uid()`. This was silently blocking all authenticated DB reads.

### QBO connection (sandbox + Vercel)
- Connected: sandbox realm `9341456547194357`
- Tokens stored encrypted in `qbo_connections` table
- `qbo_write_enabled = true` on firm row (set 2026-06-04)
- Customer mappings: 3 DB customers linked to sandbox QBO customer IDs (manual match, sandbox names don't match real names)
- Vercel env vars: `INTUIT_CLIENT_ID`, `INTUIT_CLIENT_SECRET`, `INTUIT_REDIRECT_URI=https://app.clocktobill.com/api/auth/qbo/callback` — all confirmed set with **production credentials** as of 2026-06-09. `INTUIT_ENVIRONMENT=production` confirmed.
- **⚠️ Sandbox test invoices** — invoices 1038/1039/1040 exist in QBO sandbox from M6 testing (2026-06-04); not a problem, just FYI

### QB Time connection (test account + Vercel)
- Test account: CTA Integrity LLC
- 3 test jobcodes: Knoxville Title Agency LLC (255802204), Baine & Company (255802360), Knox Physical Therapy (255802522)
- 9 June 2026 test entries seeded: 8 duration-based (no start/end timestamps), 1 clock-in/clock-out
- Tokens stored encrypted in `qb_time_connections` table
- Vercel env vars required: `QB_TIME_CLIENT_ID`, `QB_TIME_CLIENT_SECRET`, `QB_TIME_REDIRECT_URI=https://app.clocktobill.com/api/auth/qb-time/callback`
- Connect flow: Settings page → "Connect QB Time" → `/api/auth/qb-time/connect` → QB Time OAuth → callback stores tokens

### QB Time — critical implementation notes
- **Token endpoint uses POST body auth** — `client_id` and `client_secret` go in the POST body, NOT as HTTP Basic Auth (unlike QBO). See `src/lib/qb-time/auth.ts`.
- **Jobcode `billable` flag is always `false`** — The `billable` field on the QB Time jobcode API object is a firm-level setting that defaults to `false` regardless of what the UI shows. Do NOT filter on it. The customer mapping is the correct billable gate: if a timesheet's `jobcode_id` maps to a customer, it's billable.
- **Duration-based vs clock-in/clock-out entries** — QB Time supports two entry types. Clock-in/clock-out entries have real `start`/`end` timestamps. Duration-based entries (manually entered hours) have `null` or empty `start`/`end` — only `date` (YYYY-MM-DD) and `duration` are meaningful. The `sync-timesheets` route handles both: uses `ts.start` if valid, falls back to midnight Eastern on `ts.date` if not.
- **`started_at` timezone** — Eastern Time (`America/New_York`) for billing month attribution. The `toEasternMidnightISO()` helper in `sync-timesheets/route.ts` reads the Intl offset at noon UTC to correctly resolve EDT (-04:00) vs EST (-05:00).

### Pre-production checklist (before connecting Lea Ann's real account)

**Done:**
- ✅ `QBO_ITEM_NAME` env var **actually** removed from Vercel 2026-06-23 (this note previously said "removed 2026-06-09" but it was still set — discovered during the CTA dry run when invoice line items showed up as the override value instead of the code default `Hourly Accounting services`)
- ✅ `INTUIT_ENVIRONMENT` set to `production` in Vercel
- ✅ Domain set to `app.clocktobill.com`; Resend sending domain verified on `clocktobill.com`
- ✅ AES-256-GCM token encryption implemented (replaces base64 stub)
- ✅ `TOKEN_ENCRYPTION_KEY` generated and added to Vercel env vars
- ✅ Static Privacy Policy live at https://app.clocktobill.com/privacy
- ✅ Static Terms of Service (EULA) live at https://app.clocktobill.com/terms
- ✅ Support contact (support@ctaintegrity.com) added to Settings page
- ✅ Intuit App Assessment Questionnaire approved June 9
- ✅ Production QBO Client ID + Secret obtained and in Vercel
- ✅ `INTUIT_ENVIRONMENT=production` confirmed in Vercel
- ✅ App redeployed with production credentials

**Still outstanding:**
- **Lea Ann must authorize both OAuth flows** — QBO connect (Settings → Connect QBO) and QB Time connect (Settings → Connect QB Time)
- **Confirm `"Hourly Accounting services"` item exists** in Lea Ann's real QBO (system will auto-create if missing, but confirm)
- **Verify "Custom transaction numbers" is OFF in Lea Ann's QBO** — Settings → Account and Settings → Sales → Sales form content. When ON, QBO does not auto-generate `DocNumber`, the send response returns no invoice number, our `qbo_invoice_number` saves as `null`, and QBO renders the invoice as "Invoice undefined". Discovered during the CTA dry run 2026-06-23.
- **Verify every QBO customer to be invoiced has `PrimaryEmailAddr`** — send call 422s if missing. Lea Ann's prod customers likely do; spot check before M7.
- **Invite Lea Ann** via magic link (creates her auth user)
- **Obtain known-duplicate customer list from Lea Ann** before M7 (some clients may have duplicate QBO entries)

### Calculation logic
```
rawSeconds (from time_entries.duration_seconds)
  → rawMinutes = rawSeconds / 60
  → decimalHours = rawMinutes / 60
  → roundedHours = ceil(rawMinutes / 15) * 0.25   ← ceiling to next 0.25
  → finalQty = roundedHours + manualAdjustment
  → invoiceTotal = finalQty × rate
```

### Auth flow (production — Vercel)
- **Password:** email + password → `signInWithPassword` → `/invoices`
- **Forgot password:** `/forgot-password` → `resetPasswordForEmail` → email → click → `/reset-password` → `onAuthStateChange(PASSWORD_RECOVERY)` → `updateUser({ password })` → `/invoices`
- **Magic link (fallback):** "Sign in with a magic link instead" → `signInWithOtp` → email → click → `/api/auth/callback?code=XXX` → PKCE exchange → session cookies → `/invoices`

### Auth flow (local dev)
Password login: `matt@ctaintegrity.com` / `devpassword123` → `/invoices`

---

### M5 — what was built (2026-06-04)
- **`PATCH /api/invoice-drafts/[id]`** — updates `invoice_drafts`: accepts `{ status, rounded_hours, description }`. Recalculates `total_amount` server-side when hours change.
- **"Approve & Send Invoice" button** — calls send endpoint, shows spinner while saving, collapses card on success
- **Debounced PATCH (700ms)** — hours and description edits persist to DB automatically; all input paths covered (direct input, manual adj, +0.25/+0.50/+0.75 buttons)
- **"Send All Approved Invoices"** — fires all send calls in parallel via Promise.all

### M6 — what was built (2026-06-04)
- **`src/lib/qbo/invoices.ts`** — `fetchOrCreateQboItemId` (looks up item by name, creates Service item linked to first income account if not found), `fetchQboCustomerEmail` (reads PrimaryEmailAddr from QBO customer), `createQboInvoice`, `sendQboInvoice`
- **`POST /api/invoice-drafts/[id]/send`** — atomic send: idempotency check → write guard → customer email fetch → item lookup/create → QBO invoice create → QBO send → DB write (`qbo_invoice_id`, `qbo_invoice_number`, `sent_at`, `status=sent`)
- **`GET /api/qbo/items`** — debug endpoint to list QBO product/service names (keep for troubleshooting)
- Invoice date logic: `billing_month + 1 month = TxnDate`; DueDate = TxnDate + 5 days
- Idempotency: checks `qbo_invoice_id` first; generates + persists `qbo_idempotency_key` before any QBO call
- On send failure after successful create: saves `qbo_invoice_id` + sets `status=error` so orphaned invoice is trackable
- **Confirmed working in QBO sandbox** (2026-06-04) — invoices 1038/1039/1040 created and sent

### M2b — what was built (2026-06-08)
- **`src/lib/qb-time/auth.ts`** — QB Time OAuth helpers: `getAuthorizationUrl`, `exchangeCodeForTokens`, `refreshQbTimeTokens`, `saveQbTimeConnection`, `getValidQbTimeToken` (auto-refresh 5 min before expiry), `getQbTimeConnectionStatus`
- **`GET /api/auth/qb-time/connect`** — initiates OAuth with CSRF state cookie
- **`GET /api/auth/qb-time/callback`** — exchanges code for tokens, stores encrypted in `qb_time_connections`, redirects to `/invoices?connected=qb_time`
- **`POST /api/qb-time/sync-jobcodes`** — fetches all active jobcodes, auto-matches to DB customers by name, inserts new mappings (never overwrites existing `customer_id`), logs to `integration_sync_logs`
- **`POST /api/qb-time/sync-timesheets`** — accepts `{start_date, end_date}`, fetches with `supplemental_data=yes` for user names + jobcode names, upserts on `(firm_id, qb_time_entry_id)` (idempotent), handles both clock-in/clock-out and duration-based entry types, per-entry errors are non-fatal, logs to `integration_sync_logs`
- **Settings page** — QB Time connection row: Connected badge + date, "Connect QB Time" button, "Sync Now" button (syncs current calendar month)
- **`InvoicesClient.tsx`** — added `qbTimeConnected` + `qbTimeConnectedAt` to `InvoicesClientProps`; `page.tsx` fetches both QBO and QB Time status in parallel

### Pre-production hardening — what was built (2026-06-09)
- **`src/lib/crypto/tokens.ts`** — replaced base64 stub with real AES-256-GCM. Format: `iv:authTag:ciphertext` (hex). Random IV per call. Throws descriptively if `TOKEN_ENCRYPTION_KEY` missing or malformed. `TOKEN_ENCRYPTION_KEY` added to Vercel.
- **Domain rename** — all code/doc references updated from `dynamic-billing.vercel.app` to `app.clocktobill.com`
- **`src/app/privacy/page.tsx`** — static Privacy Policy; publicly accessible without auth; contact email `support@ctaintegrity.com`
- **`src/app/terms/page.tsx`** — static Terms of Service (EULA); publicly accessible without auth; contact email `support@ctaintegrity.com`
- **`src/middleware.ts`** — added `/privacy` and `/terms` to public routes (no redirect to `/login`)
- Both legal pages required for Intuit App Assessment Questionnaire submission; live at `https://app.clocktobill.com/privacy` and `https://app.clocktobill.com/terms`

### UI polish + dynamic billing run page — what was built (2026-06-12)

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

### Password auth + forgot/reset password flow — what was built (2026-06-15)
- **`src/app/login/page.tsx`** — email + password is now the primary login method in production (was magic-link-only). Added "Forgot password?" link inline with password label. Magic link demoted to secondary option ("Sign in with a magic link instead"). No env-gating — both modes available in all environments.
- **`src/app/forgot-password/page.tsx`** — NEW FILE: public page; calls `supabase.auth.resetPasswordForEmail` with `redirectTo: https://app.clocktobill.com/api/auth/callback?next=/reset-password`. This routes the PKCE code through the existing callback route (server-side exchange) before landing on `/reset-password` with an active session. Direct `redirectTo: /reset-password` does NOT work — `@supabase/ssr`'s browser client does not auto-process hash tokens or fire `PASSWORD_RECOVERY` reliably.
- **`src/app/reset-password/page.tsx`** — NEW FILE: public client component; on mount calls `getSession()` — session is already established by the time the callback redirects here. Shows password + confirm fields; calls `supabase.auth.updateUser({ password })`; redirects to `/invoices` on success. Also handles `?code` param (PKCE direct) and `onAuthStateChange('PASSWORD_RECOVERY')` (implicit) as fallbacks.
- **Supabase dashboard (required config):** Site URL must be `https://app.clocktobill.com`; `https://app.clocktobill.com/api/auth/callback` and `https://app.clocktobill.com/reset-password` must be in Redirect URLs allowlist.
- **`src/middleware.ts`** — extracted `authBypassRoutes = ['/forgot-password', '/reset-password']` shared by both guards. Added authenticated redirect: logged-in user on `/login` → `/invoices` (bypass routes excluded so a user with an active session can still complete password reset).
- **`src/app/invoices/InvoicesClient.tsx`** — added Account section to Settings view with `SignOutButton` component (`supabase.auth.signOut` → `/login`) and "Reset password" link to `/forgot-password`.
- **Supabase dashboard (confirmed config):** Site URL = `https://app.clocktobill.com`; Redirect URLs include `https://app.clocktobill.com/api/auth/callback`, `https://app.clocktobill.com/reset-password`, `http://localhost:3000/api/auth/callback`. Old `dynamic-billing.vercel.app` entries removed.

### Known gap — auto-create QBO customer (post-M6 backlog)
If a customer in Dynamic Billing has no `qbo_customer_id` mapped, the send currently fails with a clear error. The fix: at send time, if `qbo_customer_id` is null, create the customer in QBO using `display_name`, save the new ID back to `customers.qbo_customer_id`, and proceed. Same pattern as item auto-create. Not blocking for pilot (Lea Ann's clients already exist in QBO), but needed before onboarding new firms.

### Known gap — QBO token revocation (post-UAT backlog)
`src/lib/qbo/oauth.ts` has no revocation endpoint. Current "disconnect" flow only deletes stored tokens from the DB; it does not call `https://developer.api.intuit.com/v2/oauth2/tokens/revoke` to invalidate the token at Intuit. Implement post-UAT. See TODO comment in `src/lib/qbo/oauth.ts`.

### ✅ Resolved — capture `intuit_tid` from QBO API responses (2026-06-17)
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
- Firm `0a2a776d-27f8-494c-91a3-834d0698bee8`. **`qbo_write_enabled = false`** — must be flipped to `true` before the actual send test.
- QBO **and** QB Time both connected (tokens encrypted under the CTA firm). QBO customer sync works (used during mapping).
- 9 June-2026 time entries across 3 jobcodes — Baine & Company (`255802360`), Knox Physical Therapy (`255802522`), Knoxville Title Agency LLC (`255802204`) — **all now mapped** to auto-created customers via the new Panel B flow.

### Pre-send checklist for the CTA dry run
- Flip `firms.qbo_write_enabled = true` for `0a2a776d-…`.
- Confirm the 3 mapped QBO customers have **email addresses** (the send step requires one; otherwise it errors and marks the draft `error`).
- "Hourly Accounting services" item auto-creates in QBO if missing.

### Operational items still pending (not code)
- ✅ **Google Safe Browsing flag** on `clocktobill.com` — **cleared 2026-06-23**. Google Search Console emailed "Review successful for clocktobill.com"; warnings being removed within a few hours. (Original flag: new-domain + login-form false positive; remediated via the **Report Incorrect Phishing Warning** form submitted 2026-06-22.)
- **OAuth redirect URIs** — both QBO and QB Time connects succeeded this session, so the registered redirect URIs are correct (`https://app.clocktobill.com/api/auth/qbo/callback` on the Intuit **Production** keys tab; `https://app.clocktobill.com/api/auth/qb-time/callback` in the QB Time API add-on).

---

## Session 2026-06-22 (part 2) — Generate Drafts fix + Billing Run polish + invoice-status simplification

Three small UI changes shipped after the part-1 multi-tenancy / mapping work. CTA dry run is now unblocked at the code level (only DB flag + customer-email checks remain).

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
2. **Line items showed "Hours" instead of "Hourly Accounting services"** — root cause: `QBO_ITEM_NAME` env var was still set in Vercel (likely value `"Hours"`), overriding the code default. CLAUDE.md previously said it was removed 2026-06-09 but it wasn't. **Fix:** deleted `QBO_ITEM_NAME` from all three Vercel environments + redeployed. (Note: a misspelled `QB_ITEM_NAME` — no O — also exists in Vercel; harmless because the code doesn't read it, but can be cleaned up.)
3. **400 "Request Header Or Cookie Too Large" on the View and Pay link from `matt@ctaintegrity.com`** — **not a bug**. nginx at `links.notification.intuit.com` rejects when the browser sends too many/too-large Intuit cookies. The same email opened cleanly from `mrisenmay@gmail.com` and `mrisenmay@hotmail.com`. Real customers (no accumulated Intuit cookies) will not hit this.

### Re-test confirmed both fixes
Inserted a single July-2026 test entry directly into `time_entries` (Baine, 2.00 hr, `qb_time_entry_id = 'test-retest-baine-2026-07-15-001'`) — couldn't reuse June drafts because the send route's idempotency check short-circuits on `qbo_invoice_id`. Generated July drafts, Approved & Sent. Result: `qbo_invoice_number = "1001"` persisted, QBO line item shows "Hourly Accounting services". Both fixes verified end-to-end.

### State to clean up at Matt's discretion (not blocking)
- 4 real invoices now exist in CTA Integrity's production QBO against the three "P&L-style" customer records (Baine `qbo_customer_id 3`, Knox PT `4`, KTA `2`, plus the July retest Baine #1001 on `qbo_customer_id 3`). Customer email addresses on those records were rewritten to Matt's inboxes. Matt can void/delete these in QBO if he wants CTA's books clean.
- One synthetic time entry remains: `time_entries.qb_time_entry_id = 'test-retest-baine-2026-07-15-001'` (CTA firm). Notes field explicitly labels it as the retest entry. Safe to delete by `qb_time_entry_id` filter.

### Net result
End-to-end pipeline (Generate Drafts → review → Approve & Send → real QBO invoice created → real email delivered → invoice viewable in QBO with a real `DocNumber` and the correct line item) is **proven on production QBO**. The remaining gate to M7 is now purely operational: invite Lea Ann, get her to authorize both OAuth flows, verify her QBO settings (`Custom transaction numbers` off, customer emails present, `Hourly Accounting services` item or willingness to auto-create), confirm her duplicate-customer list.

---

## Build Order

| Step | What | Blocked by |
|---|---|---|
| M2a ✅ | QBO OAuth + token storage | — |
| M2b ✅ | QB Time OAuth + polling + timesheet pull | — |
| M3 ✅ | Customer mapping UI + QBO customer sync | M2a |
| M4 ✅ | Billing run engine + Generate Drafts wiring | M3 |
| M5 ✅ | Review queue DB wiring + approve/send actions | M4 |
| M6 ✅ | QBO invoice create + send + idempotency | M5 |
| — | Swap to Lea Ann's real credentials | Lea Ann |
| M7 | UAT | Real credentials + M6 |

M2b slots in parallel at any point — does not block M4–M6.

---

## Vercel Deployment Notes

### App (`app.clocktobill.com`)
- Root Directory: `apps/web`
- Framework: Next.js, Output: default (`.next`)
- Auto-deploys from `main` via GitHub integration
- Required env vars: all from `apps/web/.env.local.example` plus `NEXT_PUBLIC_APP_URL=https://app.clocktobill.com`

### Marketing site (`clocktobill.com`)
- Separate Vercel project pointing at the same `mrisenmay31/dynamic-billing` repo
- Root Directory: `marketing`
- Framework: **Other** (plain HTML, no build step)
- Domain: `clocktobill.com` (and optionally `www.clocktobill.com` → redirect)
- `marketing/vercel.json` handles security headers and clean URLs automatically
- Nav "Log in" link → `https://app.clocktobill.com/login`
- Both Calendly CTA buttons → `https://calendly.com/ctaintegrity/30min`
- **Status as of 2026-06-10:** files merged to `main`; Vercel project setup in progress (root directory picker issue being worked through)

## CLI Commands (run from `apps/web/`)
- Dev server: `npm run dev`
- Type check: `npx tsc --noEmit`
- Apply seed data: `supabase db query --linked -f supabase/seed.sql`
- Push migrations: `supabase db push`
- Regenerate types: `supabase gen types typescript --linked 2>/dev/null > src/types/supabase.ts`
- Generate magic link (no email): `node --env-file=.env.local scripts/get-magic-link.mjs`

## Key Project Files
- `qbo-billing-automation-briefing.md` — primary design reference
- `lea-ann-sample-data-analysis.md` — confirmed findings from sample invoices + time report
- `call_transcripts/2026-05-13-matt-lea-ann-pl-business-services.md` — full call transcript
- `sample_data/time_reports/P&L Client Time Entires.xlsx` — April 2026 QB Time export
- `sample_data/invoices/Invoice 5101/5138/5141.pdf` — sample invoices (Baine, Knox PT, KTA)

## Key External Resources
- QB Time API: `https://rest.tsheets.com/api/v1` (docs: `tsheetsteam.github.io/api_docs/`)
- QBO Invoice API: `https://quickbooks.api.intuit.com/v3/company/{realmId}/invoice`
- QBO sandbox: `https://sandbox-quickbooks.api.intuit.com/v3/company/{realmId}/invoice`
- QBO OAuth: `https://appcenter.intuit.com/connect/oauth2`
- Call transcript (Lea Ann Sanford, May 13 2026): `https://fathom.video/calls/671102793`
