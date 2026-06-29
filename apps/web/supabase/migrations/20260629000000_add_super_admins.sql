create table public.super_admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Only super-admins can read this table; service role manages writes.
alter table public.super_admins enable row level security;

create policy "super_admins: own row only"
  on public.super_admins
  for select
  using (auth.uid() = user_id);

-- Matt (CTA Integrity)
insert into public.super_admins (user_id)
values ('29b3856e-8ce4-424b-a083-ceb14af7372d');
