# Lane B — Super-Admin Firm Switcher (Backend)

**Branch:** `claude/cta-super-admin`
**Date:** 2026-06-29
**Scope:** Backend only (firm.ts, migration, switch-firm route, send guard). UI is a separate lane.

## What was built

A super-admin (Matt only today) can impersonate any firm's context to view/verify/fix
what that firm sees. While impersonating: full read + write access EXCEPT invoice sends
are blocked at the route level.

## Files changed

| File | Change |
|---|---|
| `supabase/migrations/20260629000000_add_super_admins.sql` | New table + RLS + Matt seeded |
| `src/types/supabase.ts` | Regenerated — includes `super_admins` table types |
| `src/lib/auth/firm.ts` | Extended `FirmContext` + super-admin cookie path |
| `src/app/api/admin/switch-firm/route.ts` | New POST endpoint |
| `src/app/api/invoice-drafts/[id]/send/route.ts` | Added `isImpersonating` guard |

## Security design

**Cookie-only-after-verification:** `getFirmContext` checks `super_admins` first. The
`active_firm_id` cookie is only consulted if that check passes. A non-super-admin with a
forged cookie hits the normal `firm_users` path — the override is invisible to them.

**Route double-gate:** `switch-firm/route.ts` independently verifies `super_admins`
membership before setting or clearing the cookie. Cookie theft without a valid session
gives nothing.

**Send blocked while impersonating:** `send/route.ts` checks `isImpersonating` immediately
after the `isOwner` check. Even though `role = 'admin'` during impersonation, the send is
403'd with "Sending is disabled while viewing another firm."

**httpOnly cookie:** `active_firm_id` is httpOnly, sameSite=lax, secure in production,
maxAge=8h (a work session). Not accessible to client JS.

## Verification checklist

- [ ] Non-super-admin with forged `active_firm_id` cookie → still resolves their own
      firm from `firm_users` (override ignored — super_admins lookup fails first)
- [ ] Matt with `active_firm_id` = P&L firm ID (`00000000-0000-0000-0000-000000000001`)
      → `firmId = P&L`, `role = 'admin'`, `isImpersonating = true`
- [ ] Matt with no cookie → resolves CTA Integrity via `firm_users`, `isImpersonating = false`
- [ ] Send route returns 403 "Sending is disabled while viewing another firm." when
      `isImpersonating = true`, even with `role = 'admin'`
- [ ] POST `/api/admin/switch-firm` with `{ firmId: "..." }` → sets cookie, audit logged
- [ ] POST `/api/admin/switch-firm` with `{ firmId: null }` → clears cookie, audit logged
- [ ] POST `/api/admin/switch-firm` from non-super-admin → 403
- [ ] `tsc --noEmit` clean ✓
- [ ] Migration applied to prod project `vvmfbtvxsjeyrmsqodon` ✓

## DB changes (prod)

```sql
-- Applied via supabase db push 2026-06-29
create table public.super_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
-- RLS: users can only read their own row; service role manages writes
-- Seeded: Matt '29b3856e-8ce4-424b-a083-ceb14af7372d'
```
