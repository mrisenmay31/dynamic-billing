-- M1 Initial Schema: Dynamic Billing
-- Multi-tenant foundation for P&L Business Services pilot
-- All domain tables have firm_id; RLS enforces firm isolation.

-- ─── Core tenancy ────────────────────────────────────────────────────────────

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

-- ─── Integration connections ─────────────────────────────────────────────────

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

-- ─── Customers + mapping ─────────────────────────────────────────────────────

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

-- ─── Time entries ────────────────────────────────────────────────────────────

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

-- ─── Billing runs + invoice drafts ──────────────────────────────────────────

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

-- ─── Audit + sync logs ───────────────────────────────────────────────────────

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

-- ─── Phase 2 placeholder tables ──────────────────────────────────────────────

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

-- ─── Row Level Security ──────────────────────────────────────────────────────

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

-- firms: users can read their own firm
create policy "users can read their firm"
on firms for select
using (id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can update their firm"
on firms for update
using (id in (select firm_id from firm_users where user_id = auth.uid()))
with check (id in (select firm_id from firm_users where user_id = auth.uid()));

-- firm_users: users can read memberships for their own firm
create policy "users can read their firm_users"
on firm_users for select
using (firm_id in (select firm_id from firm_users fu2 where fu2.user_id = auth.uid()));

-- Standard read/write policy for all domain tables (firm_id scoped)
create policy "users can read their firm's customers"
on customers for select
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can write their firm's customers"
on customers for all
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()))
with check (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can read their firm's customer_mappings"
on customer_mappings for select
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can write their firm's customer_mappings"
on customer_mappings for all
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()))
with check (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can read their firm's time_entries"
on time_entries for select
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can write their firm's time_entries"
on time_entries for all
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()))
with check (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can read their firm's billing_runs"
on billing_runs for select
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can write their firm's billing_runs"
on billing_runs for all
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()))
with check (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can read their firm's invoice_drafts"
on invoice_drafts for select
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can write their firm's invoice_drafts"
on invoice_drafts for all
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()))
with check (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can read their firm's audit_logs"
on audit_logs for select
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can read their firm's integration_sync_logs"
on integration_sync_logs for select
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can read their firm's qbo_connections"
on qbo_connections for select
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can write their firm's qbo_connections"
on qbo_connections for all
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()))
with check (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can read their firm's qb_time_connections"
on qb_time_connections for select
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can write their firm's qb_time_connections"
on qb_time_connections for all
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()))
with check (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can read their firm's payment_methods"
on payment_methods for select
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can write their firm's payment_methods"
on payment_methods for all
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()))
with check (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can read their firm's payments"
on payments for select
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can write their firm's payments"
on payments for all
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()))
with check (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can read their firm's processor_transactions"
on processor_transactions for select
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can write their firm's processor_transactions"
on processor_transactions for all
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()))
with check (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can read their firm's webhook_events"
on webhook_events for select
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()));

create policy "users can write their firm's webhook_events"
on webhook_events for all
using (firm_id in (select firm_id from firm_users where user_id = auth.uid()))
with check (firm_id in (select firm_id from firm_users where user_id = auth.uid()));
