# Lane A — Super-Admin Firm-Switcher UI

**Branch:** `claude/cta-super-admin-ui`
**Base:** `origin/claude/cta-integrity-onboarding-test-7tazih`
**Date:** 2026-06-29

## Files changed

- `src/app/invoices/page.tsx`
- `src/app/invoices/InvoicesClient.tsx`

No other files touched (firm.ts, routes, migrations untouched per lane ownership rules).

## What was implemented

### page.tsx
- Replaced inline `firm_users` adminClient query with `getFirmContext()` (single source of truth).
- Added local `FirmContextExtended` type that extends `FirmContext` with optional `isSuperAdmin?` and `isImpersonating?` fields — populated by Lane B; default `false` until that merge.
- If `isSuperAdmin`, fetches `select id, name from firms order by name` for the switcher dropdown.
- Passes four new props to `InvoicesClient`: `isSuperAdmin`, `isImpersonating`, `currentFirmId`, `firms`.
- `firmName` resolves to the active firm's name (correct whether or not impersonating, because `firmId` from `getFirmContext` is already the impersonated firm when active).

### InvoicesClient.tsx
- `InvoicesClientProps` extended with: `isSuperAdmin: boolean`, `isImpersonating: boolean`, `currentFirmId: string`, `firms: { id: string; name: string }[]`.
- **`canSend`** now: `!isImpersonating && (role === 'owner' || role === 'admin')` — sends blocked while impersonating (server also 403s; this is the UX gate).
- **`switchFirm(firmId: string | null)`**: POSTs `{ firmId }` to `/api/admin/switch-firm`, then `window.location.reload()` to re-resolve all server data for the new firm.
- **Firm switcher** (sidebar header, super-admin only): `<select>` listing all firms with the active one selected, plus a "— Return to my firm" option when impersonating. Non-super-admins see the plain firm name as before.
- **Impersonation banner** (top of layout, above sidebar+content): amber strip showing "Viewing as {firmName} — you can review and edit, but sending is disabled." with a "Return to my firm" button that calls `switchFirm(null)`. Only rendered when `isImpersonating`.
- **Send gate messages** updated: when `isImpersonating` and `!canSend`, shows "Sending is disabled while viewing another firm." instead of "Sending is restricted to the firm owner." — applies to both the per-card footer and the bulk "Send All" bar.
- `InvoiceQueueView` receives `isImpersonating` prop (used for the message branch only).
- Layout restructured: outer div is now `flex-col h-screen`; inner `flex flex-1 min-h-0` wraps the existing sidebar+content row.

## Verification checklist

- [x] `tsc --noEmit` exits 0 — no type errors.
- [ ] **Non-super-admin:** no firm-switcher visible, no banner, send buttons behave as before (blocked for assistant role, enabled for owner/admin).
- [ ] **Super-admin on own firm:** dropdown visible in sidebar, no impersonation banner, sends work normally.
- [ ] **Super-admin impersonating P&L:** amber banner shows with firm name, both send buttons hidden/disabled, mapping/edit/generate/sync remain enabled; "Return to my firm" in banner and dropdown restores own firm.
- [ ] Backend 403 gate on `/api/admin/switch-firm` and `/api/invoice-drafts/[id]/send` confirmed active when `isImpersonating` (Lane B concern).

## Integration notes

When Lane B merges into `claude/cta-integrity-onboarding-test-7tazih`:
1. `firm.ts` will export `isSuperAdmin` and `isImpersonating` on `FirmContext` — the `FirmContextExtended` local cast in `page.tsx` will align automatically.
2. `POST /api/admin/switch-firm` route will go live — `switchFirm()` in the client will start working.
3. No changes needed to these two files after that merge.
