# Claude Code Implementation Brief — Milestones 0 & 1

**Repo:** `dynamic_billing`
**Project plan reference:** `/docs/PROJECT_PLAN.md`
**Scope of this brief:** Pre-build setup (M0) + Foundation/multi-tenant data model (M1)
**Out of scope for this brief:** OAuth, real data pulls, billing engine, QBO sending — those are M2 onward.

---

## 1. Context

Dynamic Billing is a custom billing automation tool being built for P&L Business Services. The signed agreement (May 21, 2026) commits to delivering Phase 1 within ~30 days of receiving payment + access. Initial $1,250 setup payment is in; QBO access is pending.

A clickable React front-end prototype already exists in this repo. It uses static sample data, has five nav screens (Billing Run, Invoice Queue, All Time Entries, Client Rules, Settings), and deploys to Vercel. M1 converts that prototype into a real database-backed app — no integrations yet, no real data flow.

**The product is multi-tenant under the hood, P&L-specific in the UI.** Every domain table has a `firm_id` from day one. There is one firm (P&L) and one user (Lea Ann) initially. Do not build firm switching, onboarding flows, or any multi-firm UI. Just architect the data correctly.

---

## 2. Stack (Locked — Do Not Substitute)

| Layer | Choice |
|---|---|
| App framework | Next.js (App Router, current version) |
| Hosting | Vercel |
| Database | Supabase Postgres |
| Auth | Supabase Auth |
| Email | Resend |
| Scheduled jobs | Vercel Cron |
| Secrets | Supabase Vault + Vercel env vars |

No Railway. No alternative database. No custom auth.

---

## 3. Milestone 0 — Tasks NOT for Claude Code

These are Matt's tasks. Claude Code should not attempt them but should know they're prerequisites for M1+:

- Provision Intuit Developer account + create sandbox app(s) for QuickBooks Online + QuickBooks Time. Exact configuration — whether one app covers both with shared OAuth scopes, or whether QB Time requires a separate app/authorization flow — is something to determine inside the Developer portal at M0 or M2. Don't assume; verify.
- Obtain QBO admin access from Lea Ann
- Obtain QB Time admin access from Lea Ann
- Obtain known-duplicate customer list from Lea Ann
- Provision Supabase project (Matt creates; provides URL + anon/service keys to Claude Code via env vars)
- Provision Resend account (Matt creates; provides API key)
- Confirm QB Time Approvals Add-On status in Lea Ann's account

**Claude Code can begin M1 work as soon as the Supabase project is provisioned and credentials are in `.env.local`.** Intuit credentials are not needed for M1.

---

## 4. Milestone 1 — Tasks for Claude Code

The end state of M1 is: a Next.js app that authenticates Lea Ann, reads from a properly-structured Supabase database with multi-tenant isolation, has audit logging in place, can send a test email via Resend, and renders the existing prototype screens against seeded sample data instead of hardcoded constants.

### 4.1 Repository setup

- Verify the existing Next.js app builds cleanly on `main`
- Create a `/docs` directory if it doesn't exist; ensure `PROJECT_PLAN.md` and this brief are committed there
- Add a `.env.local.example` documenting all required env vars (without values)

### 4.2 Environment variables

Required by end of M1:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
APP_URL=
```

Not required yet (but document as placeholders for M2):
```
INTUIT_CLIENT_ID=
INTUIT_CLIENT_SECRET=
INTUIT_REDIRECT_URI=
INTUIT_ENVIRONMENT=
```

### 4.3 Supabase client setup

- Install `@supabase/supabase-js` and `@supabase/ssr`
- Create `lib/supabase/server.ts` and `lib/supabase/client.ts` per current Next.js + Supabase SSR patterns
- Service role client (server-only) in `lib/supabase/admin.ts` for jobs and admin operations
- Never expose the service role key to the client
- **Generate TypeScript types** via `supabase gen types typescript --linked > src/types/supabase.ts` and commit to the repo. Re-run after every migration. Import as `import type { Database } from '@/types/supabase'` and parameterize all Supabase clients with this type for full type coverage across the codebase.

### 4.4 Database schema

Create a single migration `supabase/migrations/0001_initial_schema.sql` containing all of the following. Use `gen_random_uuid()` for all primary keys. All `created_at` and `updated_at` columns default to `now()`. Add appropriate indexes on `firm_id`, foreign keys, and any column used in scheduled queries.

#### Core tenancy

```sql
create table firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  qbo_write_enabled boolean not null default false,
  timezone text not null default 'America/New_York',
  default_hourly_rate numeric(10,2) not null default 125.00,
  default_invoice_description text not null default 'Monthly Bookkeeping',
  default_invoice_product_service text not null default 'Hourly Accounting services',
  default_due_days_after_invoice int not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table firm_users (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  unique (firm_id, user_id)
);
```

#### Integration connections (tokens stored encrypted; see Section 4.7)

```sql
create table qbo_connections (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  realm_id text not null,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  connected_at timestamptz,
  last_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id)
);

create table qb_time_connections (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  connected_at timestamptz,
  last_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id)
);
```

#### Customers + mapping

```sql
create table customers (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  display_name text not null,
  qbo_customer_id text,
  hourly_rate_override numeric(10,2),
  is_high_touch boolean not null default false,
  high_touch_buffer_minutes int not null default 0,
  invoice_description_override text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table customer_mappings (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  qb_time_source_type text not null,
  qb_time_source_id text not null,
  qb_time_source_name text,
  created_at timestamptz not null default now(),
  unique (firm_id, qb_time_source_type, qb_time_source_id)
);
```

#### Time entries

```sql
create table time_entries (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  qb_time_entry_id text not null,
  qb_time_jobcode_id text,
  qb_time_jobcode_name text,
  staff_name text,
  started_at timestamptz not null,
  duration_seconds int not null,
  is_billable boolean not null,
  notes text,
  rate_used numeric(10,2),
  imported_at timestamptz not null default now(),
  source_payload jsonb,
  unique (firm_id, qb_time_entry_id)
);

create index idx_time_entries_firm_started on time_entries (firm_id, started_at);
create index idx_time_entries_customer on time_entries (customer_id);
```

#### Billing runs + invoice drafts

```sql
create table billing_runs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  billing_month date not null,
  status text not null default 'pending',
  trigger text not null,
  generated_at timestamptz,
  generated_by uuid references auth.users(id),
  exception_count int not null default 0,
  invoice_count int not null default 0,
  total_amount numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table invoice_drafts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  billing_run_id uuid not null references billing_runs(id) on delete cascade,
  customer_id uuid not null references customers(id),
  status text not null default 'imported',
  raw_hours numeric(10,4),
  rounded_hours numeric(10,4),
  high_touch_buffer_minutes int not null default 0,
  hourly_rate numeric(10,2) not null,
  total_amount numeric(12,2),
  description text,
  exception_reason text,
  skip_reason text,
  qbo_invoice_id text,
  qbo_invoice_number text,
  qbo_idempotency_key text unique,
  sent_at timestamptz,
  send_attempt_count int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (billing_run_id, customer_id)
);

create index idx_invoice_drafts_firm_status on invoice_drafts (firm_id, status);
create index idx_invoice_drafts_run on invoice_drafts (billing_run_id);
```

Valid `status` values for `invoice_drafts`:
- `imported`
- `needs_review`
- `ready_for_approval`
- `approved`
- `sent_to_qbo`
- `send_failed`
- `skipped`

Valid `status` values for `billing_runs`:
- `pending`
- `generating`
- `ready_for_review`
- `partially_sent`
- `completed`
- `failed`

#### Audit logs and sync logs

```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_firm_created on audit_logs (firm_id, created_at desc);
create index idx_audit_logs_entity on audit_logs (entity_type, entity_id);

create table integration_sync_logs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  integration text not null,
  operation text not null,
  status text not null,
  records_processed int,
  records_created int,
  records_updated int,
  records_skipped int,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,
  error_details jsonb
);

create index idx_sync_logs_firm_started on integration_sync_logs (firm_id, started_at desc);
```

#### Phase 2 placeholder tables (defined now, unused until Phase 2 SOW)

```sql
create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  type text,
  processor text,
  processor_payment_method_id text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  invoice_draft_id uuid references invoice_drafts(id),
  amount numeric(12,2),
  status text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table processor_transactions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  payment_id uuid references payments(id) on delete cascade,
  processor text,
  transaction_id text,
  amount numeric(12,2),
  fee_amount numeric(12,2),
  status text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id) on delete cascade,
  source text not null,
  event_type text not null,
  payload jsonb,
  processed boolean not null default false,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);
```

### 4.5 Row Level Security

Enable RLS on every domain table and add policies that require `firm_id` membership via `firm_users`.

```sql
alter table firms enable row level security;
alter table firm_users enable row level security;
alter table customers enable row level security;
alter table customer_mappings enable row level security;
alter table time_entries enable row level security;
alter table billing_runs enable row level security;
alter table invoice_drafts enable row level security;
alter table audit_logs enable row level security;
alter table integration_sync_logs enable row level security;
alter table qbo_connections enable row level security;
alter table qb_time_connections enable row level security;
alter table payment_methods enable row level security;
alter table payments enable row level security;
alter table processor_transactions enable row level security;
alter table webhook_events enable row level security;
```

Standard policy pattern for each domain table (example for `customers`):

```sql
create policy "users can read their firm's customers"
on customers for select
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can write their firm's customers"
on customers for all
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()))
with check (firm_id in (select firm_id from firm_users where user_id = auth.uid()));
```

Apply equivalent policies to every table above. Service role bypasses RLS for background jobs.

### 4.6 Auth setup

- **Magic link only — no password auth.** In the Supabase dashboard: Authentication → Providers → Email → enable "Email" provider with magic link, disable password sign-in, require email confirmation.
- **Disable open sign-up.** Authentication → Settings → disable "Enable sign ups". Only invited users can authenticate.
- **M1 creates Matt as the sole active auth user.** Use the Supabase admin invite flow (`supabase.auth.admin.inviteUserByEmail()` via the service role client, or the dashboard invite UI) to create Matt's `auth.users` record. Then insert a `firm_users` row linking him to the P&L firm with `role = 'admin'`.
- **Do NOT create an auth user for Lea Ann in M1.** Her `auth.users` row and `firm_users` membership are created in M7 (UAT) when Matt invites her via magic link at the start of UAT Pass 1. The data model already supports her — there's just no user record until then.
- Middleware (`middleware.ts`) redirects unauthenticated users to `/login`, which contains a single email input that triggers `supabase.auth.signInWithOtp()` and shows a "check your email" confirmation state.
- Server components and API routes use `lib/supabase/server.ts` to verify session.
- **Local development convenience:** Supabase logs the magic link URL directly to the local Supabase logs when running `supabase start` — Matt does not need to wait for actual email delivery during dev iteration. Document this in the README's dev setup section.

### 4.7 OAuth token encryption helpers

OAuth access/refresh tokens go in `*_encrypted` columns. Use Supabase Vault, or pgsodium with a server-side encryption key stored as a Supabase secret.

Helper functions (server-only) in `lib/crypto/tokens.ts`:

```typescript
export async function encryptToken(plaintext: string): Promise<string>
export async function decryptToken(ciphertext: string): Promise<string>
```

These are stubs for M1 (no real tokens to store yet). Real OAuth happens in M2. But the helpers must exist and be tested with round-trip encryption of a dummy string.

### 4.8 Audit logging helper

Create `lib/audit/log.ts`:

```typescript
export async function logAudit(params: {
  firmId: string
  userId: string | null
  action: string  // e.g., 'invoice.approved', 'customer.created'
  entityType: string  // e.g., 'invoice_draft', 'customer'
  entityId: string | null
  details?: Record<string, unknown>
}): Promise<void>
```

Implementation writes to `audit_logs` using the service role client. Call sites in M1 are minimal (firm/user creation, settings change) but the helper must work.

### 4.9 Email infrastructure

- Install `resend`
- Create `lib/email/client.ts` exposing a typed `sendEmail()` function
- Create `lib/email/templates/test.ts` — a simple "Dynamic Billing test email" body
- Create an admin-only API route `POST /api/admin/test-email` that sends a test email to the requesting user's address and returns success/failure
- Verify the test email lands in Matt's inbox before M1 closes
- **Do not build any admin UI page for testing in M1.** API routes only. Matt will hit them with `curl`, Postman, or Thunder Client. An admin/settings UI surface for internal actions can be added in M5 alongside other settings work — building one in M1 is out of scope and bloats the milestone.

Real notification templates (billing run ready, send failed) are built in M4 and M6. For M1, just prove the wire works.

### 4.10 QBO write lock helper

Create `lib/qbo/write-guard.ts`:

```typescript
export async function assertQboWriteEnabled(firmId: string): Promise<void> {
  const firm = await getFirm(firmId)
  if (!firm.qbo_write_enabled) {
    throw new Error(`QBO write operations are disabled for firm ${firmId}`)
  }
}
```

This is called inside every QBO write operation in M6. For M1, just write the helper and a test that confirms it throws when `qbo_write_enabled = false`. No QBO write operations exist yet.

### 4.11 Wire prototype to database

The existing prototype uses hardcoded `TEMPLATES` data. In M1, replace the hardcoded reads with database reads, **but seed the database with the same sample data** so the UI looks unchanged.

- Seed script: `supabase/seed.sql` creates the P&L firm, the canonical customers from the existing prototype, and sample time entries / invoice drafts matching the current static data
- **Port the complete `TEMPLATES` dataset verbatim.** Whatever the current prototype contains (~88 time entries across the 3 sample clients for April 2026) must be inserted into `time_entries` in full. Do not summarize, truncate, or "represent" the data — the All Time Entries screen depends on the full dataset to validate the read path. If `TEMPLATES` has 88 entries, `seed.sql` inserts 88 entries.
- Replace front-end constants with server-component data fetches or React Query / SWR calls
- All five screens (Billing Run, Invoice Queue, All Time Entries, Client Rules, Settings) must render against database data
- No new UI features in M1 — just the wiring swap

### 4.12 Initial seed data

The seed migration creates:

```sql
-- P&L firm
insert into firms (id, name, qbo_write_enabled)
values ('00000000-0000-0000-0000-000000000001', 'P&L Business Services, LLC', false);

-- Canonical customers (matching the prototype's sample data)
insert into customers (firm_id, display_name) values
  ('00000000-0000-0000-0000-000000000001', 'Baine & Company'),
  ('00000000-0000-0000-0000-000000000001', 'Knox Physical Therapy'),
  ('00000000-0000-0000-0000-000000000001', 'Knoxville Title Agency LLC');
```

Additional seed time entries and billing run / invoice drafts mirroring the prototype's April 2026 sample data.

---

## 5. Acceptance Criteria for M1

M1 is done when **all** of these are true:

- [ ] Migration `0001_initial_schema.sql` applies cleanly to a fresh Supabase project
- [ ] All tables exist with correct columns, foreign keys, and indexes
- [ ] RLS is enabled on every domain table with working policies
- [ ] `firms` row for P&L exists
- [ ] Matt's `auth.users` row + `firm_users` membership (`role = 'admin'`) exist
- [ ] No auth user exists for Lea Ann (deferred to M7)
- [ ] Magic link auth flow tested end-to-end (Matt can log in via magic link successfully)
- [ ] Password sign-in is disabled in Supabase Auth settings
- [ ] Open sign-up is disabled in Supabase Auth settings
- [ ] `qbo_write_enabled` defaults to false on the P&L firm
- [ ] Audit log helper writes successfully to `audit_logs`
- [ ] Token encryption helpers round-trip a test string correctly
- [ ] Resend test email arrives in Matt's inbox via the test endpoint
- [ ] QBO write lock helper throws when flag is false; passes when flag is true
- [ ] Full `TEMPLATES` dataset (~88 entries) is seeded into `time_entries`
- [ ] All five prototype screens render database data instead of hardcoded constants
- [ ] Supabase types generated and committed at `src/types/supabase.ts`
- [ ] App builds and deploys to Vercel without errors
- [ ] No console errors in the browser when navigating the app
- [ ] `.env.local.example` documents all required environment variables

---

## 6. Things NOT to do in M1

- Do not start QBO or QB Time OAuth implementation — that's M2
- Do not pull real data from QuickBooks — that's M2
- Do not build the billing engine — that's M4
- Do not implement bulk send — that's M6
- Do not implement the 1st-of-month cron — that's M4
- Do not write any QBO write operations — there's a guard but no callers until M6
- Do not pick a payment processor — that's Phase 2
- Do not build multi-firm UI, firm switcher, or onboarding flow
- Do not modify the prototype's visual design — only swap data sources

---

## 7. Reference Patterns

When in doubt:
- Use current Next.js App Router conventions (server components, server actions, route handlers in `app/api/`)
- Use `@supabase/ssr` for cookie-based session handling
- Type everything with TypeScript; generate Supabase types via `supabase gen types typescript`
- Keep server-only code in `lib/server/`, never importable from client components
- All DB writes that aren't user-initiated should go through the service role client

---

## 8. When to Stop and Ask

Stop and surface the question to Matt rather than guessing if:

- A schema decision would be hard to reverse (e.g., changing a primary key column type, dropping a foreign key)
- The prototype's existing UI would need structural changes to fit the data model
- A library choice deviates from this brief (no substituting Resend for SendGrid, no substituting NextAuth for Supabase Auth, etc.)
- The `TEMPLATES` dataset has unexpected structure that doesn't cleanly map to the schema
- A row level security policy might block a legitimate query path you're trying to build

---

*Document version: 1.1 — May 22, 2026*
*Next brief: M2 (OAuth + first real data pull) — will be issued once M1 acceptance criteria are met.*
