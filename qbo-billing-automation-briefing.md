# QBO Billing Automation — Project Briefing
**Prepared for:** Technical Co-Founder Onboarding
**Date:** May 13, 2026
**Author:** CTA Integrity / Matt Risenmay

---

## 1. Background & Company Context

**CTA Integrity** builds **Client Flow** — a suite of SaaS automation tools for accounting and CPA firms. The flagship product is the **Client Readiness Engine (CRE)** — a Client Flow tool that automates tax document collection and validation for CPA firms. The first beta partner is Donna Harris CPA (~100 tax returns/year).

This document covers **Dynamic Billing**, a second product under the Client Flow umbrella, identified through a prospect call on May 13, 2026 with **Lea Ann Sanford**, owner of **P&L Business Services** in Knoxville, TN.

---

## 2. The Prospect: P&L Business Services

**Firm profile:**
- ~300 bookkeeping clients; tax returns are ~10% of revenue and not actively marketed
- High-growth: replaced a lost $30K/month anesthesiology client entirely through new client acquisition with no revenue gap
- Client acquisition driven primarily by social media and local brand advertising
- Fully remote-capable team; executive assistant manages client onboarding pipeline

**Tech stack:**
- **TaxDome** — practice management, organizers, tasks, e-signatures, client portal (2nd year user; considers it transformative)
- **QuickBooks Time** (formerly TSheets) — staff time tracking; staff clock in/out per client with required notes
- **QuickBooks Online (QBO)** — core accounting, payroll, invoice generation
- **Biller Genie** — payment portal only; passes credit card fees to clients; not owned by Lea Ann's team directly; she is not attached to it

**Lea Ann's profile as a buyer:**
- Operationally sophisticated — has already eliminated most friction from her workflows
- Values the review step; does not want full automation without human oversight
- Self-identified her billing time value at **$125/hour**
- Willing to pay **$375–$500/month** for a well-executed solution

---

## 3. The Problem

Despite having an otherwise efficient operation, Lea Ann's **monthly billing process remains entirely manual** and takes **2–3 hours per month**.

### Current workflow (manual):
1. Staff clock in/out throughout the month in **QuickBooks Time**, tagged to individual clients with free-text notes (e.g., "reconcile," "payroll review")
2. At month-end, Lea Ann opens QBO and manually creates invoices client by client
3. She groups all time entries for each client into a single summarized line item — she does **not** want individual line items on the invoice (avoids client disputes over minutes)
4. She writes a human-readable description (e.g., "April 2026 Monthly Bookkeeping")
5. She rounds total monthly hours to the **next quarter hour (ceiling)** (applied at month-end across the full month, not per entry)
6. For high-maintenance clients, she manually adds time to account for phone calls and ad hoc questions
7. She reviews for staff errors (this review step is intentional and non-negotiable)
8. Invoices go out through QBO; payment is processed through Biller Genie

### Desired end state:
> *"At the end of the month, I want to click 'generate bills' and just review them to make sure they make sense."*

- Invoices auto-drafted from QBO Time data
- Summarized description per client (not raw time entry line items)
- Quarter-hour rounding applied automatically
- Draft queue for review — **not auto-send**
- Ability to edit before sending (add buffer time, correct errors)
- Send triggered manually after review

---

## 4. Market Context

### Is this a broader market problem?

**Yes.** The pain is real and widely documented:

- The **2025 State of Accounting Workflow and Automation Report** (Financial Cents, 816 respondents) confirms billing as a consistent friction point for small bookkeeping firms. The majority of respondents (71.7%) are small firms of 0–5 employees — the exact buyer profile.
- Major practice management tools — **TaxDome, Karbon, Canopy, Financial Cents** — all have billing modules, but none solve the specific workflow of: *pull QBO Time entries → aggregate + summarize → create a draft invoice with a human-readable grouped description for review.* Lea Ann uses TaxDome and considers it best-in-class, yet still does billing manually because TaxDome's billing is "cumbersome" for this use case.
- Karbon reports 18.5 hours saved per employee per week through automation — signaling that the broader market actively values time recapture.
- The industry is shifting toward **Client Advisory Services (CAS)** as a growth area, meaning bookkeeping firm owners want to shed administrative burden and move upstream. Billing is the most obvious administrative bottleneck remaining once intake and workflow are automated.

### Competitive gap:
No tool in the current market specifically bridges **QuickBooks Time → summarized draft QBO invoices with a review queue**. This gap exists because QBO Time and QBO Invoices are technically connected within Intuit's ecosystem, but the summarization, rounding logic, and review workflow are not native to either product.

---

## 5. API Feasibility Research

The following is a summary of detailed API research conducted on the QuickBooks Time REST API and the QuickBooks Online Invoice API as of May 2026.

---

### 5.1 QuickBooks Time API

**Base URL:** `https://rest.tsheets.com/api/v1`
**Status:** Active. No deprecation notice. Confirmed operational May 2026.
**Documentation:** `developers.tsheets.com` (Intuit-hosted); mirrored at `tsheetsteam.github.io/api_docs/` (last meaningful update Jan 2024 — cosmetically stale but technically current).

> **Note:** `developer.intuit.com/app/developer/qbt` returns a 404. Do not use it.
> A separate **Premium Time + Payroll GraphQL API** launched November 2025 — this is a different product targeting payroll integration and is NOT what this tool should use.

#### Pulling Timesheet Data

**Endpoint:** `GET https://rest.tsheets.com/api/v1/timesheets`

Key filter parameters:

| Parameter | Purpose |
|---|---|
| `start_date` / `end_date` | Date range filter (required unless using `ids`) |
| `jobcode_ids` | Filter by client/jobcode (comma-separated; includes children) |
| `on_the_clock=no` | Exclude in-progress entries |
| `modified_since` | Efficient incremental sync |
| `limit` | Max 200 per page (use `limit`, not `per_page` — `per_page` is deprecated) |
| `supplemental_data=yes` | Returns user and jobcode objects inline — **required for approval filtering** |

**Key fields returned per timesheet:**

| Field | Notes |
|---|---|
| `user_id` | Links to staff member |
| `jobcode_id` | Maps to client (see mapping section) |
| `duration` | In **seconds** — convert: `hours = duration / 3600` |
| `notes` | Free-text staff notes |
| `date` | Entry date |
| `type` | `regular` or `manual` — different read/write rules |
| `locked` | Does NOT mean approved — different concept |

#### Critical Gotcha: Approval Status Lives on the User Object

There is **no `approval_status` field on the timesheet record** and no approval filter parameter on the timesheets endpoint.

**Correct pattern:**
1. Pull timesheets with `supplemental_data=yes`
2. Response includes `supplemental_data.users[user_id]` with field `approved_to` (date)
3. Filter client-side: **only include timesheets where `timesheet.date ≤ user.approved_to`**

**This requires the QB Time Approvals Add-On** to be installed on the customer's account. Without it, `approved_to` does not exist. This must be confirmed with every pilot customer as a precondition.

**Alternative:** Use `/reports/payroll` endpoint — approval-aware by design, but returns payroll-oriented data structure.

#### Webhooks: None

QB Time has no developer-facing webhooks. The `/notifications` endpoint is for end-user push alerts, not API events.

**Required architecture: polling.** Use `GET /last_modified_timestamps` first — a cheap call that returns per-endpoint timestamps. Only fetch full timesheet data if the timestamp has advanced since the last poll. At 300 req/5-min per token, polling is sustainable even at moderate firm counts.

#### Authentication

QB Time uses its own OAuth 2.0 system, **separate from Intuit's platform OAuth**. Credentials are provisioned inside the QB Time web app under **Feature Add-ons → API → Add a new application** — not at developer.intuit.com.

```
# Step 1: Authorize
GET https://rest.tsheets.com/api/v1/authorize
    ?response_type=code
    &client_id=YOUR_CLIENT_ID
    &redirect_uri=https://yourapp.com/callback
    &state=RANDOM_CSRF

# Step 2: Exchange code for token
POST https://rest.tsheets.com/api/v1/grant
grant_type=authorization_code
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_SECRET
&code={code}
&redirect_uri=https://yourapp.com/callback
```

Token response includes: `access_token`, `refresh_token`, `expires_in`, `user_id`, `client_id`
No scopes — token grants full account access.
QB Time refresh token TTL is **not publicly documented** — requires hands-on testing.

#### Rate Limits

- 300 requests per 5-minute window per access token
- Returns `429 Too Many Requests` when exceeded
- Limit can be tightened dynamically if Intuit detects abuse
- Performance note: `/timesheets` returns ~200 items in ~2.75 seconds (~300KB)

#### Account Cap — Critical

QB Time API credentials default to **3 client accounts** beyond your own before Intuit requires a partner expansion conversation. This will be the binding constraint well before QBO API call limits become relevant. **Start the partner expansion conversation with Intuit early.**

---

### 5.2 QuickBooks Online Invoice API

**Endpoint:** `POST https://quickbooks.api.intuit.com/v3/company/{realmId}/invoice?minorversion=75`
**Sandbox:** `https://sandbox-quickbooks.api.intuit.com/v3/company/{realmId}/invoice?minorversion=75`

> `minorversion=75` is the minimum floor as of August 1, 2025. Older minor versions are deprecated and ignored.

#### There Is No True "Draft" State

QBO does not have a hidden draft status. An invoice created via API immediately appears in QBO as an **"Open" transaction with a balance due** — visible to the bookkeeper in the QBO UI.

However, it is **not automatically emailed.** The `EmailStatus` field controls this:

| Value | Behavior |
|---|---|
| `"NotSet"` (default) | Created silently, no email sent |
| `"NeedToSend"` | Queued for send (requires `BillEmail.Address`) |
| `"EmailSent"` | Already sent |

**Two staging options to consider:**

**Option A — Create in QBO immediately (NotSet):**
Invoice appears in QBO UI as "Open" for review. When user approves in your app, call `/invoice/{id}/send`. Simpler to build; unreviewed invoices pile up visibly in QBO before approval.

**Option B — Hold in your database until approved:**
Store the invoice payload locally. When approved, create it in QBO and trigger send in one step. Cleaner UX; no unreviewed invoices in QBO; requires more state management on your side.

**Recommendation for Lea Ann's use case:** Option B. She specifically wants a review queue that feels separate from QBO's live invoice list.

#### Line Item Structure

For the summarized-description use case, use `SalesItemLineDetail` with a generic "Bookkeeping Services" item and put the human-readable summary in the `Description` field:

```json
{
  "CustomerRef": { "value": "56" },
  "Line": [
    {
      "Description": "April 2026 Monthly Bookkeeping — 12.25 hrs",
      "Amount": 1531.25,
      "DetailType": "SalesItemLineDetail",
      "SalesItemLineDetail": {
        "ItemRef": { "value": "1" },
        "UnitPrice": 125.00,
        "Qty": 12.25
      }
    }
  ]
}
```

> **Required fields:** `CustomerRef.value`, at least one `Line[]`, `Line[].Amount`, `Line[].DetailType`, and `Line[].SalesItemLineDetail.ItemRef.value` (error code 2020 if missing).
> `Amount` must exactly equal `UnitPrice * Qty` — QBO does not auto-calculate.

#### Authentication (QBO)

- App registration: `developer.intuit.com` → Dashboard → Create App → QuickBooks Online
- Authorization URL: `https://appcenter.intuit.com/connect/oauth2`
- Token endpoint: `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer`
- Scope: `com.intuit.quickbooks.accounting`
- Access token TTL: **3,600 seconds (1 hour)**
- Refresh token TTL: **100 days rolling**, rotates every ~24–26 hours with 24-hour grace on the old token

#### Webhooks (QBO)

QBO has real webhooks. Supported events include `Invoice.Create`, `Invoice.Update`, `Customer.Create`, `Payment.Create`. Payloads are HMAC-SHA256 signed. **Known gotcha:** delivery is batched and often delayed by minutes — do not architect around real-time delivery.

#### Sandbox

QBO auto-provisions a sandbox company when you create a developer app at developer.intuit.com. Up to 10 sandbox companies per account, each pre-populated with test data.

---

### 5.3 Integration Architecture

#### Two OAuth Flows Per Firm — Not One

QBO and QB Time use completely separate credential systems. For every bookkeeping firm you onboard:
- **QBO:** OAuth via `developer.intuit.com` app credentials
- **QB Time:** OAuth via QB Time web app → Feature Add-ons → API

This means **two separate authorization redirects** during customer onboarding, and **two token sets stored per firm**.

#### Per-Tenant Token Storage Schema

```
firms table:
  - internal_firm_id (primary key)
  - qbo_realm_id
  - qbo_access_token (encrypted)
  - qbo_refresh_token (encrypted)
  - qbo_access_expires_at
  - qbo_refresh_expires_at
  - qbt_access_token (encrypted)
  - qbt_refresh_token (encrypted)
  - qbt_access_expires_at
  - qbt_account_id
```

> **Critical:** `realmId` is the QBO tenant key and must be indexed correctly. Mixing up realmIds across firms is the most dangerous data integrity failure mode.

There is **no publicly documented linkage** between a firm's QBO `realmId` and their QB Time account ID. Your app must store and associate both independently.

#### Jobcode-to-Customer Mapping — The Hardest Integration Problem

QB Time uses **jobcodes** to categorize time entries. QBO uses **Customer IDs** to link invoices. There is no native shared identifier between these two systems.

Your application must maintain a **mapping table** built during onboarding — most likely via:
1. Name-matching (QB Time jobcode name ≈ QBO customer name), presented for user confirmation
2. Or: a UI where the firm manually maps their QB Time clients to their QBO customers

This table must be maintained as clients are added or renamed in either system.

#### Polling Architecture

Since QB Time has no webhooks, the time-data sync layer is polling-based:

1. On a schedule (e.g., nightly or hourly), call `GET /last_modified_timestamps` per firm token
2. Compare returned timestamps against last-known timestamps stored in your database
3. If QB Time data has changed, fetch updated timesheets for the affected date range
4. Apply approval filter client-side (`timesheet.date ≤ user.approved_to`)
5. Update your internal timesheet cache

#### Invoice Generation Flow

```
[Scheduler] Poll QB Time → fetch approved timesheets
    ↓
[Aggregation] Group by client/jobcode, sum duration (seconds → hours)
    ↓
[Rounding] Round total per client to nearest 0.25 hours
    ↓
[Mapping] Look up QBO Customer ID from jobcode mapping table
    ↓
[Draft Creation] Store invoice payload in your DB (Option B)
    ↓
[Review Queue] Present to firm owner for review/edit/approval
    ↓
[Send] On approval: POST to QBO invoice endpoint + trigger /send
```

#### Intuit App Partner Program (July 2025 Tier System)

Intuit replaced the old "25-company dev cap → app review" model in July 2025 with a four-tier system:

| Tier | Cost | Gate to enter | API limit |
|---|---|---|---|
| Builder | Free | Self-attested compliance questionnaire | 500k CorePlus calls/month |
| Silver | Paid | App Marketplace review (2–6 weeks) | Uncapped |
| Gold | Higher | 500+ active connections | Uncapped |
| Platinum | Premium | 3,000+ active connections | Uncapped |

**For a pilot:** Builder tier is sufficient to connect real customer accounts. The compliance questionnaire is self-attested — not a formal review. The multi-week Security/Technical/Marketing review is only required to **list on the Intuit App Marketplace** (apps.com), not to connect private customers via your own onboarding flow.

**Action item:** Complete the compliance questionnaire at developer.intuit.com before connecting any real firm accounts.

---

## 6. Open Questions Requiring Hands-On Validation

The following items were flagged in research as undocumented or requiring sandbox/trial testing:

**QB Time:**
- Whether a free trial QB Time account includes the Approvals Add-On (may require paid subscription)
- QB Time refresh token TTL — not publicly documented
- Whether `supplemental_data.users` is reliably present on every timesheet response
- Whether `last_modified_timestamps` distinguishes User (approval state) changes from Timesheet changes

**QBO Invoice:**
- Whether `DescriptionOnly` line type silently strips or errors on a non-zero `Amount`
- Behavior of `EmailStatus = "EmailSent"` set at creation time
- Exact webhook delivery latency in production

**Architecture:**
- Whether the old 25-company connection cap still applies alongside the 500k CorePlus monthly cap at Builder tier
- App Marketplace review timeline as of May 2026 (no published SLA)
- Whether any internal linkage exists between a firm's QBO `realmId` and QB Time account ID
- Whether QB Time–QBO native sync exposes a stable shared mapping ID via the API

**Recommended validation sequence (estimated 1–2 days):**
1. Create QBO developer app; provision sandbox; create a draft invoice end-to-end
2. Sign up for QB Time free trial; install API Add-On; confirm Approvals Add-On availability
3. Test full approval polling flow: create timesheets, approve them, verify `approved_to` updates
4. Run both OAuth flows end-to-end from a sample web app
5. Hit QBO invoice endpoint with edge cases: missing `ItemRef`, mismatched `Amount`, `DescriptionOnly` with Amount

---

## 7. Pre-May 20 Action Items

The next call with Lea Ann is **Wednesday, May 20 at 3:00 PM Eastern.**

Before that call:

1. **Create developer.intuit.com app and complete the compliance questionnaire** — this is the only gate between you and live pilot connections.

2. **Contact Intuit/TSheets partner support to start the QB Time account cap expansion conversation** — the default 3-account cap will be the binding constraint. Don't wait until you hit it.

3. **Confirm with Lea Ann that she has the QB Time Approvals Add-On enabled and that her team uses the approval workflow.** If not, the core filtering logic requires a fallback design (user-specified cutoff date instead of API-native approval gate).

4. **Receive and review the sample documents Lea Ann is sending:** 2–3 redacted invoices and a sample QBO Time report. These establish the canonical input/output format the system must replicate.

---

## 9. Sample Data Findings (May 13, 2026)

Lea Ann sent sample materials same-day after the call. Full analysis: `lea-ann-sample-data-analysis.md`. Key findings:

**Confirmed from invoice + time report data:**
- Invoice date is always the 1st of the following month (all three invoices dated 05/01/2026 for April work)
- Rounding is **ceiling to next 0.25 hrs** — not "nearest." Confirmed by data (11h 48m → 12 hrs, not 11h 45m). Formula: `ceil(total_seconds / 900) * 0.25`
- Invoice line item is always **"Hourly Accounting services"** (QBO item name) with a short description ("Monthly Bookkeeping")
- Multiple staff members log time per client; all are aggregated into one line item

**Architecture simplification:**
- Lea Ann pays for **BillerGenie Premium**, which auto-syncs from QBO. No BillerGenie API integration is needed — invoices created in QBO flow there automatically.

**Open questions for May 20 call** (see `lea-ann-sample-data-analysis.md` Section 8 for full list):
- Does she want billing triggered manually or auto-prepared on the 1st?
- Is the QB Time Approvals Add-On enabled on her account?
- Do flat-rate clients appear in QB Time exports?
- Is $125/hr the only rate used, or do some clients have different rates?

---

## 8. Key Source Documents

| Document | Description |
|---|---|
| Call transcript: Matt & Lea Ann (P&L Business Services) | Fathom recording, May 13, 2026. [Link](https://fathom.video/calls/671102793) |
| QB Time API Reference | `developers.tsheets.com` / `tsheetsteam.github.io/api_docs/` |
| QBO Invoice API | `developer.intuit.com/app/developer/qbo` |
| Intuit App Partner Program Guide | `static.developer.intuit.com/resources/Intuit_App_Partner_Program_Guide.pdf` (v1.2, March 2026) |
| Builder Tier explainer | `medium.com/intuitdev` (Jan 2026) |
| 2025 State of Accounting Workflow Report | `financial-cents.com/resources/articles/2025-report-state-of-accounting-workflow-and-automation/` |
| API Feasibility Research (full) | `quickbooks-time-qbo-invoice-api-feasibility-research.md` (internal, May 2026) |
| Sample Data Analysis | `lea-ann-sample-data-analysis.md` (internal, May 14, 2026) |
| Call transcript | `call_transcripts/2026-05-13-matt-lea-ann-pl-business-services.md` |

---

*This document was prepared by Matt Risenmay / CTA Integrity on May 13, 2026, based on a prospect call, market research, and detailed API feasibility analysis. It is intended to bring a technical co-founder up to speed on the opportunity, the problem, and the technical landscape before the May 20 follow-up call with Lea Ann Sanford.*
