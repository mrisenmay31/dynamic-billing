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

## Current Code Status (as of 2026-06-03)

### Milestone summary
| Milestone | Status | Confirmed |
|---|---|---|
| M1 — Auth, Supabase, seed data | ✅ Complete | 2026-05-25 |
| M2a — QBO OAuth + token storage | ✅ Complete | 2026-06-02 |
| M2b — QB Time OAuth + polling | ⏳ Blocked (needs QB Time account) | — |
| M3 — Customer mapping UI | ✅ Complete | 2026-06-02 |
| M4 — Billing run engine | ✅ Complete | 2026-06-03 |
| M5 — Review queue DB wiring | 🔲 Next | — |
| M6 — QBO invoice send | 🔲 Pending M5 | — |
| M7 — UAT with Lea Ann | 🔲 Pending real credentials | — |

### Tech stack
- **`apps/web/`** — Next.js 15, TypeScript, Tailwind v4, App Router, `lucide-react`
- **Supabase** — project ref `vvmfbtvxsjeyrmsqodon`, region `us-east-1`
- **Deployed:** `https://dynamic-billing.vercel.app` (auto-deploys from `main`)
- **GitHub:** `github.com/mrisenmay31/dynamic-billing` (private, `mrisenmay31`)

### Key source files
```
src/app/invoices/page.tsx              — server component; fetches latest billing run, drafts, entries, customers
src/app/invoices/InvoicesClient.tsx    — all UI/state (6 nav views); "use client"
src/app/login/page.tsx                 — password + magic link login
src/app/api/auth/callback/route.ts     — PKCE code exchange (production auth path)
src/app/api/auth/qbo/connect/route.ts  — initiates QBO OAuth
src/app/api/auth/qbo/callback/route.ts — QBO OAuth callback, stores tokens
src/app/api/billing-runs/route.ts      — POST: create billing run + invoice drafts (idempotent)
src/app/api/customers/sync-qbo/route.ts   — POST: fetch QBO customers, auto-match by name
src/app/api/customers/[id]/route.ts       — PATCH: update qbo_customer_id
src/app/api/customers/mappings/route.ts   — GET/POST/DELETE: QB Time jobcode mappings
src/lib/billing/engine.ts     — pure fn: (firmId, billingMonth) → DraftPayload[]; no DB writes
src/lib/qbo/oauth.ts          — QBO OAuth helpers (auth URL, token exchange, refresh)
src/lib/qbo/connection.ts     — getValidQboToken (auto-refresh), saveQboConnection
src/lib/qbo/customers.ts      — fetchQboCustomers (QBO Customer query)
src/lib/qbo/write-guard.ts    — throws if qbo_write_enabled = false
src/lib/supabase/client.ts    — browser Supabase client
src/lib/supabase/server.ts    — SSR Supabase client (uses next/headers cookies)
src/lib/supabase/admin.ts     — service role client (bypasses RLS)
src/lib/crypto/tokens.ts      — encrypt/decrypt stubs (base64 for now; real crypto in M2 hardening)
src/lib/audit/log.ts          — writes to audit_logs
src/middleware.ts              — auth guard; passes /login, /api/auth/**, /auth/callback
```

### Nav views in InvoicesClient.tsx
1. **Billing Run** — summary dashboard; stat cards, progress indicator, totals
2. **Invoice Queue** — per-client review cards with billing math, invoice preview, time entries, adjustment controls; "Approve & Send Invoice" button per card; "Send All Approved Invoices" bulk action
3. **All Time Entries** — filterable flat table of all 88 April 2026 entries
4. **Client Rules** — firm-wide defaults + per-client overrides (rate, description, high-touch flag)
5. **Client Mapping** — QBO customer sync + manual match UI; QB Time jobcode panel (scaffolded, awaiting M2b)
6. **Settings** — integration status, billing behavior config

### Invoice Queue button labels (updated 2026-06-02)
- Per-card button: **"Approve & Send Invoice"** (was "Create QuickBooks Draft")
- Bulk action: **"Send All Approved Invoices"** (was "Create all QBO drafts")
- Status badge when sent: **"Sent"** (was "Draft Created in QBO")
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
- Vercel env vars required: `INTUIT_CLIENT_ID`, `INTUIT_CLIENT_SECRET`, `INTUIT_ENVIRONMENT=sandbox`, `INTUIT_REDIRECT_URI=https://dynamic-billing.vercel.app/api/auth/qbo/callback`
- **⚠️ Sandbox test invoices** — invoices 1038/1039/1040 exist in QBO sandbox from M6 testing (2026-06-04); not a problem, just FYI

### Pre-production checklist (before connecting Lea Ann's real account)
- **Remove `QBO_ITEM_NAME` env var from Vercel** — was set to `Hours` for sandbox testing; must be deleted before production so the default `Hourly Accounting services` is used. Leaving it in will create invoices with the wrong line item name.
- **Change `INTUIT_ENVIRONMENT` to `production`** in Vercel env vars
- **M2b (QB Time OAuth)** must be completed before real time data can flow — still blocked pending a QB Time developer account
- **Lea Ann must authorize both OAuth flows** — QBO connect (M2a flow already works) and QB Time connect (M2b, not yet built)

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
Magic link → email → click → `/api/auth/callback?code=XXX` → PKCE exchange → session cookies → `/invoices`

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

### Known gap — auto-create QBO customer (post-M6 backlog)
If a customer in Dynamic Billing has no `qbo_customer_id` mapped, the send currently fails with a clear error. The fix: at send time, if `qbo_customer_id` is null, create the customer in QBO using `display_name`, save the new ID back to `customers.qbo_customer_id`, and proceed. Same pattern as item auto-create. Not blocking for pilot (Lea Ann's clients already exist in QBO), but needed before onboarding new firms.

---

## Build Order

| Step | What | Blocked by |
|---|---|---|
| M2a ✅ | QBO OAuth + token storage | — |
| M2b ⏳ | QB Time OAuth + polling + timesheet pull | QB Time account |
| M3 ✅ | Customer mapping UI + QBO customer sync | M2a |
| M4 ✅ | Billing run engine + Generate Drafts wiring | M3 |
| M5 ✅ | Review queue DB wiring + approve/send actions | M4 |
| M6 ✅ | QBO invoice create + send + idempotency | M5 |
| — | Swap to Lea Ann's real credentials | Lea Ann |
| M7 | UAT | Real credentials + M6 |

M2b slots in parallel at any point — does not block M4–M6.

---

## Vercel Deployment Notes
- Root Directory: `apps/web`
- Framework: Next.js, Output: default (`.next`)
- Auto-deploys from `main` via GitHub integration
- Required env vars: all from `apps/web/.env.local.example` plus `NEXT_PUBLIC_APP_URL=https://dynamic-billing.vercel.app`

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
