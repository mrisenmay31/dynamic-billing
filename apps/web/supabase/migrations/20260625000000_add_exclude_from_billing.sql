alter table public.customers
  add column if not exists exclude_from_billing boolean not null default false;
