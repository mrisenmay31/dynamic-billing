# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **History lives in `CHANGELOG.md`** — per-milestone "what was built" detail and dated
> session logs. This file is the working reference: architecture, business rules,
> constraints, and the current file map. Status as of 2026-06-25: M1–M6 + UI polish +
> role-based access (owner/assistant) complete; **M7 (UAT with Lea Ann + Amber) is next**.
> A full production dry-run test plan exists at **`ONBOARDING-DRY-RUN-TEST-PLAN.md`** (run
> it before/at onboarding). **#1 open correctness risk: non-billable/flat-rate time is not
> filtered** — see Known Gaps.

## Project Overview

This is **Dynamic Billing** (product name **ClockToBill**) — a product under the **Client Flow** umbrella by CTA Integrity. Client Flow is a suite of SaaS automation tools for accounting and CPA firms. Dynamic Billing automates monthly invoice generation for bookkeeping firms: pull approved time entries from **QuickBooks Time (QB Time)**, aggregate and round them per client, and send invoices via **QuickBooks Online (QBO)** after firm owner review.

The primary design reference is `qbo-billing-automation-briefing.md`. Read it before making any architectural decisions.

**Target buyer:** Small bookkeeping firms (1–10 staff) using QB Time + QBO. First pilot: Lea Ann Sanford, P&L Business Services, Knoxville TN.

**BillerGenie:** Lea Ann uses BillerGenie Premium, which auto-syncs invoices from QBO. No BillerGenie API integration needed — invoices sent via QBO flow there automatically.

## Core Business Logic

- **Aggregation:** All time entries for a client in a billing period collapse into a **single line item** — never individual entries on the invoice.
- **Rounding:** Total hours per client rounded UP to the next 0.25 hours (ceiling), applied at month-end across the full month (not per entry). Formula: `ceil(total_seconds / 900) * 0.25`. Confirmed by invoice data — "nearest" is incorrect.
- **Review gate is non-negotiable:** Invoices must go into a review queue for firm owner approval before sending. Never auto-send.
- **Billing trigger is manual:** Lea Ann clicks "Generate Drafts" — no auto-scheduling.
- **Invoice description format:** Short, human-readable — default is simply **"Monthly Bookkeeping"**. Occasionally customized for context (e.g., "Monthly Bookkeeping Services-2026 recons caught up (1st Quarter)"). Raw staff notes from QB Time are never shown on the invoice. Description field must be editable in the review queue.
- **Invoice date:** Always the 1st of the following month (e.g., April work → dated 05/01). Due date is 5 days later.
- **QBO line item:** Product/service name is **"Hourly Accounting services"** — must match exactly for `ItemRef` lookup. Rate is $125/hr (uniform across all hourly clients for this pilot).
- **Multiple staff per client:** Several employees log time to the same client in a single month. All entries are summed together into one line item — staff breakdown is never exposed on the invoice.
- **High-maintenance client buffer:** ~5 clients get 15–45 min manually added at review time. No system flag — Lea Ann identifies them by name. The review queue must expose an editable hours field; default is the ceiling-rounded total, she bumps it up as needed. Amount recalculates as `edited_hours × $125`.

**Calculation pipeline:**
```
rawSeconds (from time_entries.duration_seconds)
  → roundedHours = ceil(rawSeconds / 900) * 0.25   ← ceiling to next 0.25
  → finalQty = roundedHours + manualAdjustment
  → invoiceTotal = finalQty × rate
```

## Integration Architecture

### Two Separate OAuth Systems Per Firm
QBO and QB Time use **completely independent** OAuth 2.0 flows. Every firm onboarded requires two separate authorization redirects and two token sets stored in the database.

- **QBO OAuth:** via `developer.intuit.com` (scope: `com.intuit.quickbooks.accounting`). Access token TTL: 1 hour. Refresh token TTL: 100 days rolling. Token endpoint uses **HTTP Basic Auth**.
- **QB Time OAuth:** provisioned inside the QB Time web app under Feature Add-ons → API (not at developer.intuit.com). No scopes — token grants full account access. Access token TTL: 10 days. Refresh token **rotates** — must overwrite stored token after every exchange. Token endpoint uses **POST body auth** (`client_id`/`client_secret` in body, NOT Basic Auth — unlike QBO).

### Polling Architecture (QB Time Has No Webhooks)
1. Call `GET /last_modified_timestamps` per firm — cheap check
2. If timestamps advanced, fetch timesheets with `supplemental_data=yes`
3. Filter approved entries client-side: include only timesheets where `timesheet.date ≤ supplemental_data.users[user_id].approved_to`

The **QB Time Approvals Add-On** is what makes step 3 possible — it adds an `approved_to` date to each user object. Without it, the field does not exist. **If not enabled:** fall back to a simple date-range filter — pull all billable entries within the calendar month. Likely safe for Lea Ann since her EA approves weekly and billing happens after month-end.

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
**"Approve & Send Invoice" creates AND sends in one atomic step.** No second step in QBO. The review gate lives entirely in Dynamic Billing. Do NOT design a "create draft in QBO, then send separately" flow. Hold the payload in `invoice_drafts` until approval; on approval POST to the QBO invoice endpoint → immediately POST to `/send` on the returned invoice ID. No `EmailStatus: "NotSet"` staging.

### Jobcode-to-Customer Mapping
No native shared identifier between QB Time jobcodes and QBO customer IDs. The app maintains a `customer_mappings` table (jobcode → customer_id) and `customers.qbo_customer_id`. Onboarding is **self-service** via Client Mapping → Panel B: each synced jobcode gets a QBO-customer dropdown + Save. `POST /api/qb-time/jobcodes/assign` finds-or-creates the `customers` row, upserts the mapping, and backfills `customer_id` onto existing time entries (no re-sync needed). **Never hand-create DB rows for this.**

> **Jobcode `billable` flag is always `false`** — it's a firm-level setting that defaults `false` regardless of the UI. Do NOT filter on it. The customer mapping IS the billable gate: if a timesheet's `jobcode_id` maps to a customer, it's billable.

> **Entry types** — clock-in/clock-out entries have real `start`/`end` timestamps; duration-based (manual) entries have `null`/empty `start`/`end` (only `date` + `duration` meaningful). `sync-timesheets` handles both: uses `ts.start` if valid, else midnight Eastern on `ts.date`. `started_at` is attributed in Eastern Time (`America/New_York`) for billing-month bucketing; `toEasternMidnightISO()` resolves EDT/EST via the Intl offset at noon UTC.

### Required QBO Invoice Fields
- `CustomerRef.value` (QBO customer ID — from `customers.qbo_customer_id`)
- `Line[].Amount` (must equal `UnitPrice * Qty` exactly — QBO does not auto-calculate)
- `Line[].DetailType`: use `SalesItemLineDetail`
- `Line[].SalesItemLineDetail.ItemRef.value` (missing triggers error 2020)
- API version: `minorversion=75` minimum

### Multi-Tenancy
No hardcoded firm ID. `src/lib/auth/firm.ts` → `getFirmContext(supabase)` returns `{ userId, firmId, role }` from `firm_users` per request; all firm-scoped server routes call it, and send/PATCH routes enforce tenant-scope guards. Matt's login → **CTA Integrity, LLC** (`0a2a776d-27f8-494c-91a3-834d0698bee8`); P&L (`00000000-…0001`) is the seeded pilot firm.

**Role-based access (commit `4644b52`):** `firm_users.role` is now enforced. `isOwner(role)` (in `firm.ts`) = `role === 'owner' || 'admin'` (legacy `admin` rows keep full access; null defaults to `admin`). Server 403 guards on `invoice-drafts/[id]/send` and both `auth/{qbo,qb-time}/connect` routes block non-owners. UI hides Send + Connect for `assistant` via `canSend`/`canConnect` (role passed from `page.tsx` → `InvoicesClient`). Tier: **owner** = full incl. send + connect; **assistant** = sync/map/generate/edit but **no send, no connect**. Assign roles by SQL at invite time. (UI hiding is secondary; the 403 is the boundary.)

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
- **QB Time timesheets pagination:** Use `limit` (max 200), not `per_page` (deprecated).
- **`qbo_write_enabled` flag:** `src/lib/qbo/write-guard.ts` throws if `false` on the firm row. Must be `true` before any QBO write (invoice creation) can succeed.

## Open Questions (unresolved)

- **QB Time Approvals Add-On:** Enabled on Lea Ann's account? Determines approval-date filter vs. simple date-range filter.
- **Flat-rate clients:** ~~Do they appear in QB Time exports?~~ **ANSWERED (5-20 call): yes** — Lea Ann logs *non-billable* time to flat-rate/monthly/tax clients on purpose (for rate analysis) and does NOT want it invoiced. See the "non-billable time not filtered" Known Gap — this is the #1 correctness risk to resolve before real billing.
- **Multiple billing rates:** Is $125/hr universal for all hourly clients, or do some differ?
- **QBO Item ID:** Need the exact internal ID for "Hourly Accounting services" in Lea Ann's real QBO for `ItemRef` lookup (system auto-creates if missing).

## Pre-production checklist (before connecting Lea Ann's real account)

- **Lea Ann must authorize both OAuth flows** — Settings → Connect QBO and Settings → Connect QB Time.
- **Confirm `"Hourly Accounting services"` item exists** in her real QBO (auto-creates if missing, but confirm).
- **Verify "Custom transaction numbers" is OFF** — Settings → Account and Settings → Sales → Sales form content. When ON, QBO doesn't auto-generate `DocNumber`, the send response returns no invoice number, `qbo_invoice_number` saves `null`, and QBO renders "Invoice undefined". (Hit during the CTA dry run; `DocNumber` is immutable so it can't be backfilled.)
- **Verify every QBO customer to be invoiced has `PrimaryEmailAddr`** — the send call 422s without one.
- **Invite Lea Ann** via magic link (creates her auth user).
- **Obtain known-duplicate customer list** from Lea Ann (some clients may have duplicate QBO entries).

## Known Gaps (backlog)

- **🔴 Non-billable / flat-rate time is not filtered (CRITICAL, pre-pilot).** `sync-timesheets/route.ts:167` hardcodes `is_billable: true` on every entry; `QbTimesheet` carries no billable field; `engine.ts:28`'s `is_billable` filter is therefore a no-op. The *only* billing gate is the customer mapping, so a mis-mapped/auto-matched flat-rate client turns non-billable analysis time into a real hourly invoice — directly violating Lea Ann's hard requirement. Fix options (see `ONBOARDING-DRY-RUN-TEST-PLAN.md` TC-17 + Appendix C): (A) capture the real billable flag on sync if her data exposes one; (B) add a customer-level `exclude_from_billing` flag (recommended belt-and-suspenders since mapping is the gate). Resolve before connecting real billing data.
- **Bulk send at scale** — Lea Ann sends ~164–187 invoices/month; "Send All" fires sends in parallel (`Promise.all`). A real burst may hit QB Time (300/5min) / QBO rate limits and partially fail. Likely needs concurrency-limiting + retry. (Prototype only exercised 3 clients.)
- **Auto-create QBO customer** — if a `customers` row has no `qbo_customer_id`, send fails with a clear error. Fix: at send time, create the QBO customer from `display_name`, save the new ID back, proceed (same pattern as item auto-create). Not blocking for pilot (Lea Ann's clients exist in QBO); needed before onboarding new firms.
- **QBO token revocation** — `src/lib/qbo/oauth.ts` has no revocation call; "disconnect" only deletes stored tokens, doesn't hit `https://developer.api.intuit.com/v2/oauth2/tokens/revoke`. Implement post-UAT (see TODO in that file).

---

## Tech Stack & Deployment

- **`apps/web/`** — Next.js 15, TypeScript, Tailwind v4, App Router, `lucide-react`. Root Directory in Vercel: `apps/web`; auto-deploys from `main`. Env vars: all from `apps/web/.env.local.example` plus `NEXT_PUBLIC_APP_URL=https://app.clocktobill.com`.
- **`marketing/`** — standalone static HTML landing page; separate Vercel project (Framework: **Other**, Root Directory `marketing`, no build step); `marketing/vercel.json` handles headers + clean URLs. Deployed at `clocktobill.com`. Nav "Log in" → `app.clocktobill.com/login`; Calendly CTAs → `https://calendly.com/ctaintegrity/30min`.
- **Supabase** — project ref `vvmfbtvxsjeyrmsqodon`, region `us-east-1`.
- **Deployed:** app `https://app.clocktobill.com`; marketing `https://clocktobill.com`.
- **GitHub:** `github.com/mrisenmay31/dynamic-billing` (private).

**Intuit / Vercel env (production, confirmed):** `INTUIT_CLIENT_ID`, `INTUIT_CLIENT_SECRET`, `INTUIT_REDIRECT_URI=https://app.clocktobill.com/api/auth/qbo/callback`, `INTUIT_ENVIRONMENT=production`; `QB_TIME_CLIENT_ID`, `QB_TIME_CLIENT_SECRET`, `QB_TIME_REDIRECT_URI=https://app.clocktobill.com/api/auth/qb-time/callback`; `TOKEN_ENCRYPTION_KEY` (AES-256-GCM). `QBO_ITEM_NAME` must stay **unset** — when set it overrides the code default and breaks the line-item name.

**Supabase auth config:** Site URL `https://app.clocktobill.com`; Redirect URLs include `…/api/auth/callback`, `…/reset-password`, and `http://localhost:3000/api/auth/callback`.

## Current Code Map

```
src/app/invoices/page.tsx              — server component; resolves firm, fetches run/drafts/entries/customers
src/app/invoices/InvoicesClient.tsx    — all UI/state (6 nav views); "use client"
src/app/login|forgot-password|reset-password/page.tsx — auth pages (public; see Auth Flow)
src/app/privacy|terms/page.tsx         — static legal pages (public, no auth)
src/app/api/auth/callback/route.ts     — PKCE code exchange (production auth path)
src/app/api/auth/qbo/{connect,callback}/route.ts     — QBO OAuth
src/app/api/auth/qb-time/{connect,callback}/route.ts — QB Time OAuth
src/app/api/billing-runs/route.ts      — POST: create billing run + invoice drafts (idempotent)
src/app/api/invoice-drafts/[id]/route.ts       — PATCH: update hours/description/status (recalcs total)
src/app/api/invoice-drafts/[id]/send/route.ts  — POST: atomic QBO create + send + DB write
src/app/api/customers/sync-qbo/route.ts        — POST: fetch QBO customers, auto-match by name
src/app/api/customers/[id]/route.ts            — PATCH: update qbo_customer_id
src/app/api/customers/mappings/route.ts        — GET/POST/DELETE: jobcode mappings
src/app/api/qb-time/sync-jobcodes/route.ts     — POST: sync + auto-match jobcodes
src/app/api/qb-time/sync-timesheets/route.ts   — POST: pull timesheets (both entry types)
src/app/api/qb-time/jobcodes/route.ts          — GET: synced jobcodes + mapping status
src/app/api/qb-time/jobcodes/assign/route.ts   — POST: find-or-create customer + map + backfill entries
src/app/api/qbo/items/route.ts                 — GET: debug list of QBO product/service names
src/lib/auth/firm.ts          — getFirmContext(): per-request { userId, firmId, role } from firm_users; isOwner(role) gate
src/lib/billing/engine.ts     — pure fn: (firmId, billingMonth) → DraftPayload[]; no DB writes
src/lib/billing/run-status.ts — recomputeBillingRunStatus: syncs billing_runs.status from draft statuses
src/lib/qbo/oauth.ts          — QBO OAuth helpers (auth URL, exchange, refresh)
src/lib/qbo/connection.ts     — getValidQboToken (auto-refresh), saveQboConnection
src/lib/qbo/customers.ts      — fetchQboCustomers
src/lib/qbo/invoices.ts       — fetchOrCreateQboItemId, fetchQboCustomerEmail, create/sendQboInvoice (+ intuit_tid capture)
src/lib/qbo/write-guard.ts    — throws if qbo_write_enabled = false
src/lib/qb-time/auth.ts       — QB Time OAuth helpers (POST-body auth; rotating refresh token)
src/lib/supabase/{client,server,admin}.ts — browser / SSR / service-role clients
src/lib/crypto/tokens.ts      — AES-256-GCM encrypt/decrypt; requires TOKEN_ENCRYPTION_KEY
src/lib/audit/log.ts          — writes to audit_logs
src/components/AuthFooter.tsx — company-identity footer on auth pages
src/middleware.ts             — auth guard; public + bypass routes; /login→/invoices when authed
```

### Nav views in InvoicesClient.tsx
1. **Billing Run** — summary dashboard; stat cards, Send Progress bar (colored by run status), totals; month selector.
2. **Invoice Queue** — per-client review cards (billing math, invoice preview, time entries, adjustment controls); read-only **StatusBadge** ("In Review" amber / "Sent" green); per-card **"Approve & Send Invoice"** button + bulk **"Send All Approved Invoices"**; header has a controlled `GenerateMonthDropdown` + **"Generate Drafts"** button. Sending is *only* via the buttons — no status dropdown. Toast: "Invoice sent. BillerGenie will sync the payment portal automatically."
3. **All Time Entries** — filterable flat table read directly from `time_entries` (decoupled from billing runs); month selector ("All months" + each month with data), dynamic client filter, "Unmapped" badge/banner.
4. **Client Rules** — firm-wide defaults + per-client overrides (rate, description, high-touch flag).
5. **Client Mapping** — QBO customer sync + manual match; Panel B live jobcode→QBO-customer assignment.
6. **Settings** — integration status (QBO + QB Time connect/sync), billing config, support contact, Account section (sign out, reset password).

### Auth Flow
- **Password (primary):** email + password → `signInWithPassword` → `/invoices`.
- **Forgot password:** `/forgot-password` → `resetPasswordForEmail(redirectTo=…/api/auth/callback?next=/reset-password)` → email → callback does server-side PKCE exchange → `/reset-password` (session already active) → `updateUser({ password })` → `/invoices`. Direct `redirectTo: /reset-password` does NOT work — `@supabase/ssr` browser client won't reliably process hash tokens / fire `PASSWORD_RECOVERY`.
- **Magic link (fallback):** `signInWithOtp` → email → `/api/auth/callback?code=…` → PKCE → `/invoices`.
- **Local dev:** `matt@ctaintegrity.com` / `devpassword123`.

### Seeded DB data (P&L pilot firm)
- **Firm:** P&L Business Services, LLC — `00000000-0000-0000-0000-000000000001`
- **Customers:** 3 (KTA, Baine, Knox PT) — `…000010/11/12`
- **Time entries:** 88 April 2026 entries across the 3 customers (static seed)
- **Matt's auth user:** `29b3856e-8ce4-424b-a083-ceb14af7372d`

## CLI Commands (run from `apps/web/`)
- Dev server: `npm run dev`
- Type check: `npx tsc --noEmit`
- Apply seed data: `supabase db query --linked -f supabase/seed.sql`
- Push migrations: `supabase db push`
- Regenerate types: `supabase gen types typescript --linked 2>/dev/null > src/types/supabase.ts`
- Generate magic link (no email): `node --env-file=.env.local scripts/get-magic-link.mjs`

## Key Project Files
- `qbo-billing-automation-briefing.md` — primary design reference
- `ONBOARDING-DRY-RUN-TEST-PLAN.md` — full production dry-run/UAT test plan (TC-1–19, CTA reset SQL, Amber role spec, transcript review, fix prompts)
- `lea-ann-sample-data-analysis.md` — confirmed findings from sample invoices + time report
- `call_transcripts/2026-05-13-matt-lea-ann-pl-business-services.md` — discovery call transcript
- `call_transcripts/2026-05-20-matt-lea-ann-pl-business-services.md` — prototype walkthrough (billable/flat-rate, duplicate profiles, volume, payments scope)
- `sample_data/time_reports/P&L Client Time Entires.xlsx` — April 2026 QB Time export
- `sample_data/invoices/Invoice 5101/5138/5141.pdf` — sample invoices (Baine, Knox PT, KTA)

## Key External Resources
- QB Time API: `https://rest.tsheets.com/api/v1` (docs: `tsheetsteam.github.io/api_docs/`)
- QBO Invoice API: `https://quickbooks.api.intuit.com/v3/company/{realmId}/invoice` (sandbox: `https://sandbox-quickbooks.api.intuit.com/...`)
- QBO OAuth: `https://appcenter.intuit.com/connect/oauth2`
- Call transcript (Lea Ann Sanford, May 13 2026 — discovery): `https://fathom.video/calls/671102793`
- Call transcript (Lea Ann Sanford, May 20 2026 — prototype walkthrough): `https://fathom.video/calls/679614071`
