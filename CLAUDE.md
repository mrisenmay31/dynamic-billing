# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Dynamic Billing** — a product under the **Client Flow** umbrella by CTA Integrity. Client Flow is a suite of SaaS automation tools for accounting and CPA firms. Dynamic Billing automates monthly invoice generation for bookkeeping firms: pull approved time entries from **QuickBooks Time (QB Time)**, aggregate and round them per client, and create draft invoices in **QuickBooks Online (QBO)** for human review before sending.

The primary design reference is `qbo-billing-automation-briefing.md`. Read it before making any architectural decisions.

**Target buyer:** Small bookkeeping firms (1–10 staff) using QB Time + QBO. First pilot: Lea Ann Sanford, P&L Business Services, Knoxville TN.

**BillerGenie:** Lea Ann uses BillerGenie Premium, which auto-syncs invoices from QBO. No BillerGenie API integration needed — invoices created in QBO flow there automatically.

## Core Business Logic

- **Aggregation:** All time entries for a client in a billing period collapse into a **single line item** — never individual entries on the invoice.
- **Rounding:** Total hours per client rounded UP to the next 0.25 hours (ceiling), applied at month-end across the full month (not per entry). Formula: `ceil(total_seconds / 900) * 0.25`. Confirmed by invoice data — "nearest" is incorrect.
- **Review gate is non-negotiable:** Invoices must go into a review queue for firm owner approval before sending. Never auto-send.
- **Invoice description format:** Short, human-readable — default is simply **"Monthly Bookkeeping"**. Occasionally customized for context (e.g., "Monthly Bookkeeping Services-2026 recons caught up (1st Quarter)"). Raw staff notes from QB Time are never shown on the invoice. Description field must be editable in the review queue.
- **Invoice date:** Always the 1st of the following month (e.g., April work → dated 05/01). Due date is 5 days later.
- **QBO line item:** Product/service name is **"Hourly Accounting services"** — must match exactly for `ItemRef` lookup. Rate is $125/hr (uniform across all hourly clients for this pilot).
- **Multiple staff per client:** Several employees log time to the same client in a single month. All entries are summed together into one line item — staff breakdown is never exposed on the invoice.
- **High-maintenance client buffer:** ~5 clients get 15–45 min manually added at review time. No system flag — Lea Ann identifies them by name. The review queue must expose an editable hours field; default is the ceiling-rounded total, she bumps it up as needed. Amount recalculates as `edited_hours × $125`.

## Integration Architecture

### Two Separate OAuth Systems Per Firm
QBO and QB Time use **completely independent** OAuth 2.0 flows. Every firm onboarded requires two separate authorization redirects and two token sets stored in the database.

- **QBO OAuth:** via `developer.intuit.com` (scope: `com.intuit.quickbooks.accounting`). Access token TTL: 1 hour. Refresh token TTL: 100 days rolling.
- **QB Time OAuth:** provisioned inside the QB Time web app under Feature Add-ons → API (not at developer.intuit.com). No scopes — token grants full account access.

### Polling Architecture (QB Time Has No Webhooks)
1. Call `GET /last_modified_timestamps` per firm — cheap check
2. If timestamps advanced, fetch timesheets with `supplemental_data=yes`
3. Filter approved entries client-side: include only timesheets where `timesheet.date ≤ supplemental_data.users[user_id].approved_to`

The **QB Time Approvals Add-On** is what makes step 3 possible — it adds an `approved_to` date to each user object, indicating how far their timesheets have been reviewed. Without it, the `approved_to` field does not exist.

**If Approvals Add-On is NOT enabled:** fall back to a simple date-range filter — pull all billable entries within the calendar month. This is likely safe for Lea Ann's workflow since her EA approves weekly and billing happens after month-end, so all entries are finalized before "generate drafts" is clicked. Confirm on May 20 call.

The Approvals Add-On is a **data integrity gate**, not a billing trigger. Invoice generation is always initiated manually by the firm owner.

### Invoice Generation Flow
```
Poll QB Time → fetch approved timesheets
  → Group by jobcode/client, sum duration (seconds → hours)
  → Ceiling-round to next 0.25 hrs per client
  → Look up QBO Customer ID from jobcode-to-customer mapping table
  → Store draft invoice payload in DB (do NOT create in QBO yet)
  → Present in review queue
  → On approval: POST to QBO invoice endpoint, then call /send
```

### Staging Strategy for Invoices
Use **Option B** (hold in your DB until approved): do not create the invoice in QBO until the firm owner approves it. `EmailStatus` should be `"NotSet"` at creation; trigger `/send` explicitly after approval.

### Jobcode-to-Customer Mapping
There is no native shared identifier between QB Time jobcodes and QBO customer IDs. The app must maintain a mapping table, built during onboarding via name-matching + user confirmation UI. This table must be kept current as clients are added/renamed.

### Required QBO Invoice Fields
- `CustomerRef.value` (QBO customer ID)
- `Line[].Amount` (must equal `UnitPrice * Qty` exactly — QBO does not auto-calculate)
- `Line[].DetailType`: use `SalesItemLineDetail`
- `Line[].SalesItemLineDetail.ItemRef.value` (missing triggers error 2020)
- API version: `minorversion=75` minimum

### Per-Tenant DB Schema (Key Fields)
```
firms:
  qbo_realm_id          -- QBO tenant key; index carefully; mixing realms = data breach
  qbo_access_token      -- encrypted
  qbo_refresh_token     -- encrypted
  qbo_access_expires_at
  qbo_refresh_expires_at
  qbt_access_token      -- encrypted
  qbt_refresh_token     -- encrypted
  qbt_access_expires_at
  qbt_account_id
```

## Critical Constraints

- **QB Time account cap:** Default 3 client accounts per app credential before Intuit requires partner expansion. Start the expansion conversation with Intuit before hitting the cap.
- **Intuit App Partner Program (July 2025):** Builder tier (free, self-attested compliance questionnaire) is sufficient for pilot. Full Marketplace review required only to list on apps.com.
- **QB Time rate limit:** 300 requests per 5-minute window per token.
- **QB Time timesheets endpoint pagination:** Use `limit` parameter (max 200), not `per_page` (deprecated).

## Open Questions (confirm on May 20 call with Lea Ann)

- **Billing trigger:** manual "generate drafts" button, or auto-prepared on the 1st of each month?
- **QB Time Approvals Add-On:** enabled on her account? Determines whether to use approval-date filter or simple date-range filter.
- **Flat-rate clients:** do they appear in QB Time exports? If so, system needs to skip or handle them separately.
- **Multiple billing rates:** is $125/hr universal for all hourly clients, or do some differ?
- **QBO Item ID:** need the exact internal ID for "Hourly Accounting services" item during onboarding setup.

## Open Technical Questions (pre-build validation)

- QB Time refresh token TTL (undocumented — requires hands-on testing)
- Whether `last_modified_timestamps` distinguishes user approval changes from timesheet edits
- Whether any internal linkage exists between a firm's QBO `realmId` and QB Time account ID
- Whether QB Time free trial includes the Approvals Add-On

See Section 6 of the briefing for the full validation sequence.

## Current Code Status (as of 2026-05-20)

### What exists
- **`apps/web/`** — Next.js 15 app (TypeScript, Tailwind v4, App Router, `lucide-react`)
  - Live prototype deployed at `https://dynamic-billing.vercel.app`
  - GitHub: `github.com/mrisenmay31/dynamic-billing` (private, `mrisenmay31`)
  - Single route at `/invoices` — hardcoded April 2026 demo data, no backend

#### App shell (`apps/web/src/app/invoices/page.tsx`)
All UI lives in this single file. All five nav views are fully implemented. Persistent left sidebar (`#2D6A4F`). Latest commit: see `git log`.

**Shared state (lifted to `InvoicesPage`):**
- `sharedHighTouch: Record<string, boolean>` — high-touch flag per client, shared between Invoice Queue and Client Rules
- `sharedDescriptions: Record<string, string>` — invoice description per client, shared between Invoice Queue and Client Rules
- `firmDefaultRate: number` — firm-wide default hourly rate, shared between Client Rules and Invoice Queue (seeds initial card rate)
- `sharedClientRates: Record<string, number>` — per-client hourly rate, shared between Client Rules and Invoice Queue (seeds initial card rate)
- `invoiceStates: Record<string, InvoiceState>` — full invoice state per client (hours, rate, status, etc.), shared between Invoice Queue and Billing Run
- Rates set in Client Rules seed Invoice Queue on mount; Invoice Queue still allows inline overrides after seeding
- Billing Run stat cards and totals derive from live `invoiceStates` — reflect any manual hour adjustments made in Invoice Queue

1. **Billing Run** (default on load):
   - Page header: "May 2026 Billing Run / April 2026 Time Entries" with "In Review" badge
   - 4 summary cards: Clients Ready, Proposed Billing (live from `invoiceStates`), Rounded Hours (live from `invoiceStates`), Time Saved
   - 4-step progress indicator (step 2 "Reviewed Time" is active)
   - Billing totals breakdown panel with +$62.64 rounding highlight
   - Review summary with time-saved comparison chips
   - Product fit callout with `QBO Time → ... → BillerGenie` pill chain

2. **Invoice Queue** — review queue with 3 real April 2026 client cards:
   - Page header: **"Import from QBO Time"** button (simulates QB Time pull); toast: "April 2026 time entries imported from QuickBooks Time. Review drafts below."
   - Collapsed card: client name, invoice # (numeric only, e.g. 5141 — no INV- prefix), amount, hrs@rate, **3-state status dropdown** (Needs Review / Ready to Draft / Draft Created in QBO), expand chevron
   - Expanded card sections (in order):
     1. **Billing Math Summary** — green-tinted panel with static rows (raw time, decimal hrs, rounded hrs, rate) + live rows (manual adjustment, final qty, invoice total)
     2. **Client-Facing Invoice Preview** — QBO-style document with P&L Business Services header, Bill To, date 05/01/2026, due 05/06/2026, one line item (Hourly Accounting services), live qty/amount
     3. **Raw QBO Time Entries** — scrollable table with all complete entries + totals row (entry count, raw HH:MM, pre-rounding amount)
     4. **Adjustment Controls** — high-touch toggle (shared with Client Rules; reveals amber warning + +0.25/+0.50/+0.75/Custom quick-add buttons), description textarea (shared with Client Rules), final qty input, manual adjustment input, adjustment reason, rate, internal note
     5. **Card footer** — invoice total + "Create QuickBooks Draft" button
   - Stats row: Drafts Ready, Total Hours, Total Billed
   - Bottom action bar: pending count + total + **"Create all QBO drafts"** button with muted sub-label "Sends to QuickBooks Online"
   - Toast on individual draft creation: "Draft created in QuickBooks. BillerGenie will handle payment portal sync after invoice is sent."

3. **All Time Entries** — fully implemented:
   - Flattened from `TEMPLATES` via `ALL_ENTRIES` constant — single source of truth, no duplicate data
   - Page header with "April 2026 Import — QuickBooks Time" sub-label
   - 4-stat bar (Total Entries, Total Raw Time, Total Raw Amount, Clients) — updates dynamically with filters
   - Contextual note panel (left green accent border) explaining data provenance
   - Sticky filter bar: search by staff note (with X clear), client dropdown, employee dropdown (derived dynamically), billable dropdown, date sort toggle (Oldest/Newest First), Clear filters link
   - Full 9-column table: Date, Client, Employee, Product/Service, Staff Note (most space, wraps), Duration, Rate, Billable (green pill), Amount (right-aligned, DM Mono)
   - Alternating row backgrounds, hover highlight, no vertical borders
   - Summary footer row (`#f3f4f6`) with entry count, summed duration, summed amount for filtered rows
   - Empty state with Search icon, heading, subtext, and Clear filters button
   - Total dataset: 88 entries, 55:15 raw time, $6,906.25 raw amount (per-entry rounded), 7 unique employees

4. **Client Rules** — fully implemented:
   - **Firm-Wide Defaults** panel: editable hourly rate, product/service, invoice description, invoice terms, due-date offset; rounding rule row is read-only with explanatory note
   - **Per-Client Overrides** table: per-client hourly rate, invoice description (with "custom" badge when non-default), high-touch toggle (shared with Invoice Queue), notes field; amber left border + background tint on high-touch rows
   - **How Rounding Works** reference panel: formula in monospace, example table (11h 53m → 12.00 hrs, etc.)
   - **High-Touch Client Buffer** callout: explains the 15–45 min manual buffer workflow

5. **Settings** — fully implemented:
   - **Integrations & Data Sources** panel: QBO Time import source (with future API note), QuickBooks Online (slate "Ready to Connect" badge — not green), BillerGenie (slate "Syncs via Premium Plan" badge — not green), BillerGenie plan + pricing
   - **Billing Behavior** panel: Auto-send Off (red pill), Require approval On (green pill), invoice date rule, due date rule, rounding method
   - **How This Fits Your Existing Tools** callout: pipeline chip row with "Billing Review Dashboard" highlighted in green, ArrowRight icons between chips
   - **About** panel: prototype attribution, DM Mono data summary line

#### Client data (complete, exact April 2026 QBO export)
- Knoxville Title Agency LLC: 52 entries, 31:34 raw → 31.75 rounded hrs → $3,968.75
- Baine & Company: 11 entries, 11:53 raw → 12.00 rounded hrs → $1,500.00 (non-default description)
- Knox Physical Therapy: 25 entries, 11:48 raw → 12.00 rounded hrs → $1,500.00

#### Utility functions in page.tsx
- `ceilToQuarterHour(totalMinutes)` — ceiling rounding formula
- `formatHHMM`, `formatCurrency`, `formatHours` — display helpers
- `sumDurations(durations[])` — sum HH:MM strings to HH:MM (integer minutes, no float drift)
- `durationToAmount(duration, rate)` — per-entry amount rounded to 2 decimal places
- `inputFocusHandlers()` — shared green focus ring for all inputs

#### Data constants
- `DEFAULT_RATE = 125`
- `TEMPLATES: InvoiceTemplate[]` — 3 clients, entries as `{ date, staff, note, duration }`
- `ALL_ENTRIES: FlatEntry[]` — flattened from TEMPLATES, adds `client`, year to date, `productService`, `billable`, `amount`

#### Shared components
- `ToggleSwitch` — reusable toggle used in Invoice Queue and Client Rules

#### Calculation logic
```
rawMinutes (static) → decimalHours = rawMinutes/60 → roundedHours = ceilToQuarterHour(rawMinutes)
→ finalQty = roundedHours + manualAdjustment (user input, default 0.00)
→ invoiceTotal = finalQty × rate
```
All display surfaces (Billing Math Summary, Invoice Preview, card header, stats, action bar) derive from the same `state.hours` value.

### What does NOT exist yet
- No database, no Supabase project
- No QB Time or QBO API integration
- No OAuth flows
- No worker process
- No authentication
- The full scaffold plan is at `/Users/mattrisenmay/.claude/plans/now-let-s-scaffold-the-squishy-gizmo.md`

### Vercel deployment notes
- Root Directory must be set to `apps/web` in Vercel Project Settings
- Framework Preset: Next.js
- Output Directory: default (`.next`) — do NOT override to `apps/web/.next`
- Deploys automatically from `main` branch via GitHub integration

### Next steps after May 20 call
Build the real scaffold per the plan: Supabase schema, QB Time + QBO OAuth flows, polling worker on Railway, review queue wired to real data.

## Key Project Files

- `qbo-billing-automation-briefing.md` — primary design reference; read before any architectural decisions
- `lea-ann-sample-data-analysis.md` — confirmed findings from Lea Ann's sample invoices + time report (May 14, 2026)
- `call_transcripts/2026-05-13-matt-lea-ann-pl-business-services.md` — full call transcript with timestamped Fathom links
- `sample_data/time_reports/P&L Client Time Entires.xlsx` — April 2026 QB Time export (3 clients, real data)
- `sample_data/invoices/Invoice 5101/5138/5141.pdf` — sample invoices for Baine & Company, Knox Physical Therapy, Knoxville Title Agency LLC

## Key External Resources

- QB Time API: `https://rest.tsheets.com/api/v1` (docs: `tsheetsteam.github.io/api_docs/`)
- QBO Invoice API: `https://quickbooks.api.intuit.com/v3/company/{realmId}/invoice`
- QBO sandbox: `https://sandbox-quickbooks.api.intuit.com/v3/company/{realmId}/invoice`
- QBO OAuth: `https://appcenter.intuit.com/connect/oauth2`
- Call transcript (Lea Ann Sanford, May 13 2026): `https://fathom.video/calls/671102793`
