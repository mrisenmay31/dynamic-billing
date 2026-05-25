# Dynamic Billing — Decisions Log

*Canonical record of locked decisions for the Dynamic Billing project. Commit this file to `/docs/DECISIONS.md` in the `dynamic_billing` repo. Update it whenever a new decision is made or an open question is resolved. Do not remove superseded decisions — mark them `[SUPERSEDED]` and note what replaced them.*

---

## How to use this file

- **Locked:** Decision is final. Do not revisit without a documented reason.
- **Open:** Decision is pending. Trigger to resolve is noted.
- **Superseded:** Decision was changed. Original entry preserved for traceability.

---

## Architecture

| # | Decision | Status | Date | Rationale |
|---|---|---|---|---|
| A-01 | Frontend/app server: **Next.js (App Router)** on **Vercel** | Locked | 2026-05-22 | Extends existing prototype; single deployment target; no additional infra |
| A-02 | Database: **Supabase Postgres** | Locked | 2026-05-22 | Built-in auth, RLS, Vault for secrets; free tier covers Phase 1 scope |
| A-03 | Auth: **Supabase Auth, magic link only** — no password sign-in | Locked | 2026-05-22 | Simplest secure auth for a single-user firm tool; no password reset surface to maintain |
| A-04 | Email: **Resend** | Locked | 2026-05-22 | Modern transactional email, good Next.js DX, generous free tier |
| A-05 | Scheduled jobs: **Vercel Cron** | Locked | 2026-05-22 | One batch job (1st of month); no continuous polling needed; no additional infra |
| A-06 | Secrets: **Supabase Vault + Vercel env vars** | Locked | 2026-05-22 | OAuth tokens encrypted in Vault; Intuit client ID/secret and API keys in Vercel project settings; never committed to repo |
| A-07 | Repo/deploys: **GitHub (`mrisenmay31/dynamic-billing`) → Vercel auto-deploy** | Locked | 2026-05-22 | Already in place from prototype |
| A-08 | **Railway rejected** for Phase 1 | Locked | 2026-05-22 | Not needed at single-firm scale; re-evaluate if bulk ops push past Vercel timeouts, webhook volume warrants queue infra, or a persistent worker is needed |
| A-09 | **QBO OAuth: Intuit Developer app with scope `com.intuit.quickbooks.accounting` only** | Locked | 2026-05-25 | Confirmed at M0: only `accounting` and `payment` scopes exist in the Intuit Developer portal. `payment` is Phase 2 -- not selected for Phase 1 app. |
| A-10 | **QB Time uses a completely separate API and auth flow from QBO** | Locked | 2026-05-25 | Confirmed at M0: QB Time (formerly TSheets) has its own REST API (`rest.tsheets.com`) with its own OAuth -- no shared scopes with the QBO Intuit Developer app. Two distinct connection flows are required. This validates the separate `qbo_connections` and `qb_time_connections` table design. QB Time OAuth credentials need their own env vars: `QB_TIME_CLIENT_ID`, `QB_TIME_CLIENT_SECRET`, `QB_TIME_REDIRECT_URI`. |

---

## Infrastructure (Provisioned M0)

| # | Decision | Status | Date | Rationale |
|---|---|---|---|---|
| P-01 | **Supabase project ref: `vvmfbtvxsjeyrmsqodon`**, region `us-east-1`, org: CTA Integrity | Locked | 2026-05-25 | Provisioned May 25, 2026 |
| P-02 | **Vercel project `dynamic-billing` already existed** from prototype, connected to `mrisenmay31/dynamic-billing` on `main` | Locked | 2026-05-25 | Confirmed at M0; auto-deploy active |
| P-03 | **Resend: using `onboarding@resend.dev` as sender through M6** -- switch to verified domain before M7 (Lea Ann UAT invite) | Locked | 2026-05-25 | `onboarding@resend.dev` can only send to the Resend account owner's email; sufficient for Matt-only testing through M6 |
| P-04 | **`supabase status` not used in this project** -- no local Docker stack. Workflow is: `migration new` → `db push` → `gen types typescript --linked` | Locked | 2026-05-25 | Confirmed by Claude Code at M0; working directly against remote Supabase project |

---

## Multi-tenancy

| # | Decision | Status | Date | Rationale |
|---|---|---|---|---|
| MT-01 | **Every domain table has a non-null `firm_id` foreign key** | Locked | 2026-05-22 | Supports future multi-firm expansion without schema rewrite |
| MT-02 | **Row Level Security enforces firm isolation on every domain table** | Locked | 2026-05-22 | Service role bypasses RLS for background jobs only |
| MT-03 | **No multi-firm onboarding UI, firm switcher, or multi-firm features in Phase 1** | Locked | 2026-05-22 | Data model supports it; no UI planned until there is a second firm |
| MT-04 | **P&L Business Services is firm `00000000-0000-0000-0000-000000000001`** | Locked | 2026-05-22 | Fixed UUID for the seed/dev environment |

---

## Auth & Users

| # | Decision | Status | Date | Rationale |
|---|---|---|---|---|
| U-01 | **Matt Risenmay is the sole active auth user through M6** | Locked | 2026-05-22 | No need for Lea Ann to log in until UAT |
| U-02 | **Lea Ann's auth user is NOT created until M7 (UAT)** | Locked | 2026-05-22 | Matt invites her via Supabase admin invite at start of UAT Pass 1 |
| U-03 | **Open sign-up disabled** in Supabase Auth settings | Locked | 2026-05-22 | Only invited users can authenticate |
| U-04 | **Password sign-in disabled** in Supabase Auth settings | Locked | 2026-05-22 | Magic link only |
| U-05 | UAT participants: Lea Ann only, or Lea Ann + Amber | **Open** | — | Resolve when Lea Ann responds to the May 22 access request email |

---

## QBO Write Safety

| # | Decision | Status | Date | Rationale |
|---|---|---|---|---|
| Q-01 | **`firms.qbo_write_enabled` defaults to `false`** | Locked | 2026-05-22 | Prevents accidental writes to Lea Ann's real QBO account during build and UAT Pass 1 |
| Q-02 | **Every QBO write operation checks `qbo_write_enabled` and throws if false** | Locked | 2026-05-22 | Guard built in M1 (`lib/qbo/write-guard.ts`), enforced in M6 |
| Q-03 | **QBO read operations do NOT check the write lock** | Locked | 2026-05-22 | Reads are always safe |
| Q-04 | **Flag is flipped to `true` only after UAT Pass 1 sign-off**, before UAT Pass 2 | Locked | 2026-05-22 | Two-pass UAT: read-only first, then controlled send |

---

## Billing Rules

| # | Decision | Status | Date | Rationale |
|---|---|---|---|---|
| B-01 | **Rounding: total billable hours per (firm, customer, billing_month) summed, then rounded UP to next 0.25 hour** | Locked | 2026-05-22 | Matches Lea Ann's current manual process |
| B-02 | **Rounding edge rule: time entries attributed by `started_at` date in Eastern Time** | Locked | 2026-05-22 | An entry starting 2026-04-30 23:50 ET belongs to April even if it ends after midnight |
| B-03 | **Cron pulls entries with `started_at` between first and last moment of the prior month in Eastern Time** | Locked | 2026-05-22 | June 1 cron pulls May 1 00:00 ET through May 31 23:59:59 ET |
| B-04 | **Default invoice product/service: "Hourly Accounting services"** | Locked | 2026-05-22 | Derived from sample invoices 5101, 5138, 5141 |
| B-05 | **Default invoice description: "Monthly Bookkeeping"** | Locked | 2026-05-22 | Derived from sample invoices |
| B-06 | **Default hourly rate: $125.00** | Locked | 2026-05-22 | Derived from sample invoices |
| B-07 | **Default payment terms: net 5 days** | Locked | 2026-05-22 | Derived from sample invoices |
| B-08 | **QB Time Approvals Add-On status** | **Open** | — | Determines whether approval status is filterable from QB Time API; resolve when Lea Ann responds to the May 22 email. Build supports both paths; launch with billable-only filter either way |

---

## Invoicing & Bulk Send

| # | Decision | Status | Date | Rationale |
|---|---|---|---|---|
| I-01 | **Invoices are created in QBO at approve/send time only** — not on import or billing run generation | Locked | 2026-05-22 | Prevents premature QBO drafts; Lea Ann reviews first |
| I-02 | **Bulk send uses queue-based fan-out** (Supabase queue table + Vercel function per invoice) | Locked | 2026-05-22 | Prevents UI freeze on 150-invoice sends |
| I-03 | **Each invoice draft has a unique `qbo_idempotency_key`** stored before the QBO API call | Locked | 2026-05-22 | Prevents duplicate invoices on retry |
| I-04 | **On QBO success, the returned QBO invoice ID is persisted immediately** | Locked | 2026-05-22 | Retry logic checks for existing QBO invoice ID before re-sending |
| I-05 | **Failed sends are marked `send_failed`** with error detail; user-initiated retry path available | Locked | 2026-05-22 | Bulk send continues processing remaining invoices on individual failure |

---

## Notifications

| # | Decision | Status | Date | Rationale |
|---|---|---|---|---|
| N-01 | **Resend is wired and tested in M1** | Locked | 2026-05-22 | Wire early so M4 and M6 can use it cleanly |
| N-02 | **Billing run completion email** sent to Lea Ann with: invoice count, exception count, deep link | Locked | 2026-05-22 | Lea Ann shouldn't have to remember to check the app on the 1st |
| N-03 | **QBO send failure email** sent to Lea Ann with failure reason and link | Locked | 2026-05-22 | Real-time failure visibility |
| N-04 | **Cron failure email** sent to Matt | Locked | 2026-05-22 | Operational monitoring for Phase 1 |
| N-05 | Additional notification recipients (e.g., cc Matt on billing run emails) | **Open** | — | Resolve before M4 |

---

## Phase Scope

| # | Decision | Status | Date | Rationale |
|---|---|---|---|---|
| S-01 | **Payment processing is Phase 2** — no processor-specific code in Phase 1 | Locked | 2026-05-22 | Per signed agreement; BillerGenie continues handling payments in Phase 1 |
| S-02 | **Phase 1 lays Phase 2 infrastructure** (placeholder tables, webhook handler skeleton, settings architecture) but no processor code | Locked | 2026-05-22 | Reduces Phase 2 rework without bleeding scope |
| S-03 | **Phase 2 SOW conversation deferred until after Phase 1 go-live is stable** | Locked | 2026-05-22 | Matt's stated preference |
| S-04 | **BillerGenie remains in place through Phase 1 go-live** | Locked | 2026-05-22 | UAT Pass 2 verifies BillerGenie still syncs QBO invoices correctly |

---

## Explicitly Out of Scope (Phase 1)

The following will not be built in Phase 1. Do not suggest or drift into these:

- Payment processing of any kind
- Customer-facing payment portal
- BillerGenie replacement
- Fee pass-through to customers
- ACH or credit card handling
- Reconciliation logic
- TaxDome replacement, client intake, or onboarding workflows
- Flat-rate client profitability analytics
- Data cleanup inside QuickBooks beyond what's directly required
- Custom mobile application
- Multi-firm onboarding flows or UI

---

## Working Norms

| # | Decision | Status | Date | Notes |
|---|---|---|---|---|
| W-01 | **No em-dashes in client-facing communications** | Locked | 2026-05-22 | Matt's stated preference |
| W-02 | **Client email tone: warm, direct, conversational — plain text, no marketing language** | Locked | 2026-05-22 | — |
| W-03 | **Claude Code receives narrow implementation briefs, not broad strategy prompts** | Locked | 2026-05-22 | PM (ChatGPT/Claude) defines goals; Claude Code implements only |
| W-04 | **Weekly 15-minute Friday demos with Lea Ann** throughout build | Locked | 2026-05-22 | Prototype demo on May 20 confirmed she responds well to seeing real data |
| W-05 | **Admin UI deferred to M5** — API routes only through M4 | Locked | 2026-05-22 | Matt tests endpoints via curl/Postman/Thunder Client in M1-M4 |

---

*Document version: 1.1 — May 25, 2026 (M0 provisioning complete; QB Time auth confirmed separate; infrastructure decisions added)*
*Maintained by: CTA Integrity, LLC (Matt Risenmay)*
*Pair with: `PROJECT_PLAN.md`, `CLAUDE_CODE_BRIEF_M0_M1.md`*
