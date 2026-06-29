-- Super-admin cross-firm READ access (for the firm-switcher / impersonation).
--
-- Every firm-scoped table has RLS that limits a user to their own firm (via
-- firm_users). Impersonation resolves getFirmContext to another firm, but page.tsx
-- and other read paths use the RLS-scoped client, so without these policies a
-- super-admin sees an empty workspace for any firm they aren't a member of.
--
-- These are PERMISSIVE SELECT policies: they OR with the existing own-firm policies.
-- For a non-super-admin the USING clause is false, so behavior is unchanged.
-- Writes are unaffected here — they go through the service-role adminClient, which
-- bypasses RLS — so only read access is granted.

create policy "super_admin_read_all" on public.firms
  for select to authenticated
  using (exists (select 1 from public.super_admins sa where sa.user_id = auth.uid()));

create policy "super_admin_read_all" on public.customers
  for select to authenticated
  using (exists (select 1 from public.super_admins sa where sa.user_id = auth.uid()));

create policy "super_admin_read_all" on public.billing_runs
  for select to authenticated
  using (exists (select 1 from public.super_admins sa where sa.user_id = auth.uid()));

create policy "super_admin_read_all" on public.invoice_drafts
  for select to authenticated
  using (exists (select 1 from public.super_admins sa where sa.user_id = auth.uid()));

create policy "super_admin_read_all" on public.time_entries
  for select to authenticated
  using (exists (select 1 from public.super_admins sa where sa.user_id = auth.uid()));

create policy "super_admin_read_all" on public.customer_mappings
  for select to authenticated
  using (exists (select 1 from public.super_admins sa where sa.user_id = auth.uid()));

create policy "super_admin_read_all" on public.qbo_connections
  for select to authenticated
  using (exists (select 1 from public.super_admins sa where sa.user_id = auth.uid()));

create policy "super_admin_read_all" on public.qb_time_connections
  for select to authenticated
  using (exists (select 1 from public.super_admins sa where sa.user_id = auth.uid()));
