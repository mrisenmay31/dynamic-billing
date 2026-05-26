# Dynamic Billing — Context Handoff

*Use this document to brief a fresh Claude session on the state of the Dynamic Billing project. Pair with `PROJECT_PLAN.md`, `CLAUDE_CODE_BRIEF_M0_M1.md`, and `DECISIONS.md` in the project files for complete context.*

---

## Project at a glance

**What:** A custom billing automation tool ("Dynamic Billing") that replaces P&L Business Services' manual monthly invoicing process. Pulls billable time entries from QuickBooks Time, applies P&L's rounding and grouping rules, generates a reviewable monthly billing run, and creates/sends approved invoices through QuickBooks Online.

**Who:**
- **Matt Risenmay** — President, CTA Integrity, LLC. Building the software solo with Claude Code. Uses Claude (this chat) as PM workspace and ChatGPT as a secondary PM/cross-validation tool.
- **Lea Ann Sanford** — Owner, P&L Business Services, Oak Ridge TN. The end user. ~300 bookkeeping clients; monthly hourly billing currently takes 2-3 hours and is the workflow being automated.
- **Amber** — Lea Ann's team member, mentioned for potential UAT participation (TBD).

**Strategic posture:** Built multi-tenant under the hood, P&L-specific in the UI. No active plan to onboard other firms, but the data model supports it without rewrite.

---

## Where things stand (as of May 25, 2026)

### Commercial
- Agreement signed May 21, 2026
- $1,250 initial setup payment received
- Remaining: $1,250 on Phase 1 acceptance + $399/month maintenance starting the first full calendar month after go-live
- Phase 2 (payment processing / BillerGenie replacement) is signed but optional; no separate setup fee; activated by future SOW

### M0 Status: COMPLETE (May 25, 2026)
All M0 provisioning tasks are done:

| Item | Status | Detail |
|---|---|---|
| Supabase project | Provisioned | Ref: `vvmfbtvxsjeyrmsqodon`, region: `us-east-1`, org: CTA Integrity |
| Supabase auth | Configured | Magic link on, password off, open sign-up off, confirm email on, OTP expiry 3600s |
| Supabase CLI | Linked | `supabase link --project-ref vvmfbtvxsjeyrmsqodon` confirmed |
| Resend | Configured | API key in hand; using `onboarding@resend.dev` sender through M6 |
| Vercel | Confirmed | `dynamic-billing` project pre-existed; auto-deploy from `main` active; URL: `https://dynamic-billing.vercel.app` |
| Env vars | Complete | All six vars in `.env.local` and Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_URL` |
| Intuit Developer | Confirmed | Sandbox app created; scopes confirmed: `com.intuit.quickbooks.accounting` only (Phase 1) |
| QB Time auth | Confirmed | **Separate API from QBO** -- QB Time uses its own REST API (`rest.tsheets.com`) with its own OAuth. Two distinct connection flows needed in M2. Separate env var placeholders added: `QB_TIME_CLIENT_ID`, `QB_TIME_CLIENT_SECRET`, `QB_TIME_REDIRECT_URI` |

### M1 Status: COMPLETE -- AUTH CONFIRMED (May 25, 2026)
All 10 steps executed by Claude Code. Auth confirmed working end-to-end on Vercel.

Steps completed:
- Step 0: Repo setup, commit brief, `.env.local.example`
- Step 1: Install dependencies (`@supabase/supabase-js`, `@supabase/ssr`, `resend`)
- Step 2: Database migration (`20260525232144_remote_schema.sql`) -- full schema + RLS on all 15 tables
- Step 3: Seed data -- P&L firm + 3 customers + 88 time entries + 1 billing run + 3 invoice drafts
- Step 4: Supabase client setup (browser / server / admin)
- Step 5: Generate TypeScript types (`src/types/supabase.ts`)
- Step 6: Auth middleware + magic link login page + Matt self-invite (manual step completed)
- Step 7: Helper libraries (crypto stubs, audit log, QBO write guard, Resend wrapper)
- Step 8: Test email API route
- Step 9: Wire prototype to database (InvoicesClient.tsx extraction, page.tsx server component)
- Step 10: Final build check + commit

**M1 acceptance criterion met:** Matt can log in via magic link and reach `/invoices` with real database data.

### Pending from Lea Ann (blocking M2, not M1)
Access request email sent May 22. No response yet as of May 25.
- QuickBooks Online admin/accountant access
- QuickBooks Time admin access
- Known-duplicate customer list
- QB Time Approvals Add-On status confirmation
- UAT participants confirmation (Lea Ann only vs. Lea Ann + Amber)

---

## Auth flow -- confirmed working (documented May 25, 2026)

This section documents the exact auth architecture as confirmed through end-to-end testing. Reference this before touching any auth-related code.

### The working flow (production login)

1. User goes to `/login`, enters email, clicks "Send login link"
2. Supabase sends a magic link email using **PKCE flow**
3. Email link redirects to `https://dynamic-billing.vercel.app/api/auth/callback?code=XXX`
4. The server route handler (`src/app/api/auth/callback/route.ts`) calls `exchangeCodeForSession(code)`, which sets session cookies **directly on the redirect response object**
5. User is redirected to `/invoices` with session cookies attached
6. Middleware confirms session and allows access

### Two auth callback paths -- do not confuse them

| Path | File | Flow | Used by |
|---|---|---|---|
| `/api/auth/callback` | `src/app/api/auth/callback/route.ts` | PKCE (`?code=`) | Login form email links -- the production path |
| `/auth/callback` | `src/app/auth/callback/page.tsx` | Implicit (`#access_token=`) | Admin-generated links only -- dev/testing only |

### The admin script (`scripts/get-magic-link.mjs`) -- limitations

The admin script generates links using Supabase's `admin.generateLink()` API, which uses **implicit flow** (sends `#access_token=` in the URL hash). This is a different flow from the login form. Limitations:

- Admin-generated OTPs have their own expiry that is **not** controlled by the dashboard OTP expiry setting. They expire quickly and are one-time use.
- Every click on a link (even a failed one) consumes the token.
- The script's `redirectTo` must point to `/auth/callback` (the client component), NOT `/api/auth/callback` (the server route). The server never sees hash fragments.
- **Do not use the admin script to validate the production auth flow.** It uses a different code path.

The script is useful for generating a session token in development without waiting for email, but the login form + actual email is the reliable test of the real auth path.

### Key bugs fixed during M1 auth debugging

1. **Middleware blocking `/auth/callback`:** Middleware was intercepting `/auth/callback` before the client component could load. Fixed by adding `/auth/callback` to the middleware pass-through list.

2. **Cookie not attached to redirect response:** In `src/app/api/auth/callback/route.ts`, session cookies were being set on a throwaway `supabaseResponse` object inside the `setAll` callback instead of on `redirectResponse` (the object actually returned to the browser). Fixed by setting cookies directly on `redirectResponse`.

3. **Race condition in client callback component:** In `src/app/auth/callback/page.tsx`, `onAuthStateChange` was registered inside the `else` block after `getSession()` returned null. If the `SIGNED_IN` event fired during the async gap, it was missed and the 3-second fallback redirected to `/login`. Fixed by registering the listener first, then checking `getSession()`, and listening for both `SIGNED_IN` and `INITIAL_SESSION` events.

### Supabase allowed redirect URLs (must include both)

- `https://dynamic-billing.vercel.app/api/auth/callback` -- production login form path
- `https://dynamic-billing.vercel.app/auth/callback` -- admin script / implicit flow path

---

## Locked architecture decisions (summary)

| Layer | Choice |
|---|---|
| Frontend / app | Next.js (App Router) on Vercel |
| Database | Supabase Postgres (`vvmfbtvxsjeyrmsqodon`) |
| Auth | Supabase Auth -- magic link only, no password, no open sign-up |
| Email | Resend (`onboarding@resend.dev` through M6; real domain before M7) |
| Scheduled jobs | Vercel Cron |
| QBO integration | Intuit Developer app -- `com.intuit.quickbooks.accounting` scope only |
| QB Time integration | Separate TSheets REST API (`rest.tsheets.com`) -- distinct OAuth flow from QBO |
| Secrets | Supabase Vault + Vercel env vars |
| Repo | `mrisenmay31/dynamic-billing` → Vercel auto-deploy |

**Multi-tenant rule:** Every domain table has `firm_id`. RLS enforces firm isolation. P&L firm UUID: `00000000-0000-0000-0000-000000000001`.

**QBO write lock:** `firms.qbo_write_enabled` defaults to false. All QBO write operations check this flag. Flipped to true only between UAT Pass 1 and Pass 2.

**supabase status not used:** No local Docker stack. Remote-only workflow. Commands are: `migration new` → `db push` → `gen types typescript --linked`.

**Full decisions log:** See `DECISIONS.md` (v1.1, May 25, 2026) -- 30+ locked decisions across architecture, infrastructure, auth, billing rules, invoicing, notifications, phase scope, and working norms.

---

## Milestone roadmap (M0-M8)

| Milestone | Goal | Status |
|---|---|---|
| M0 | Access + environment setup | **COMPLETE** (May 25, 2026) |
| M1 | Foundation + multi-tenant data model | **COMPLETE** (May 25, 2026) |
| M2 | OAuth + first real data pull | Pending Lea Ann access |
| M3 | Customer mapping + billing rules | -- |
| M4 | Billing run engine + email notifications | -- |
| M5 | Review queue UI wired to real data | -- |
| M6 | QBO invoice creation/send (bulk send + idempotency) | -- |
| M7 | UAT (two passes: read-only, then controlled send) | Lea Ann invited via magic link here |
| M8 | Go-live + completion payment | -- |

**Target timeline:** ~5 weeks of build once Lea Ann's access is received. Weekly 15-minute Friday demos throughout.

---

## Four critical safeguards

1. **Email notifications** -- Resend wired in M1; billing run completion in M4; send failure alerts in M6
2. **Rounding edge rule** -- Time entries attributed by start date in Eastern Time; implemented in M4
3. **QBO write lock** -- Flag built in M1, enforced in M6, flipped to true between UAT Pass 1 and Pass 2
4. **Bulk send idempotency** -- Queue-based fan-out, unique `qbo_idempotency_key` per draft, retry logic; M6

---

## What's NOT being built (do not suggest)

- Payment processing of any kind (Phase 2)
- BillerGenie replacement (Phase 2)
- Customer-facing payment portal (Phase 2)
- TaxDome replacement, intake, or onboarding flows (out of scope)
- Multi-firm onboarding UI (data model supports it, no UI planned)
- Custom mobile app (out of scope)
- Admin UI before M5 (API routes only through M4)
- Lea Ann's auth user before M7 (Matt is sole user through M6)
- QB Time Approvals filtering until Lea Ann confirms Add-On status (build supports both paths)

---

## Working norms

- **No em-dashes** in client-facing communications (Matt's stated preference)
- **Client email tone:** Warm, direct, conversational. Plain text, no marketing language.
- **PM workflow:** Claude (this chat) = PM workspace. ChatGPT = secondary PM / cross-validation. Claude Code = developer. Matt sometimes brings ChatGPT outputs for evaluation -- evaluate honestly, agree where right, push back with specific reasoning.
- **Claude Code handoff pattern:** PM defines brief → Claude Code plans → Matt reviews plan with PM → approved plan executes → Claude Code output comes back to PM for acceptance criteria review.
- **Document versioning:** Bump version and date on material changes.

---

## M2 development strategy -- sandbox + free trial approach

M2 does not need to wait for Lea Ann. The full build through M6 can proceed against sandbox and dummy data. When Lea Ann's credentials arrive, it becomes a credential swap + real data validation, not a build dependency.

### Decision tree at the start of the next session

**If Lea Ann has responded and provided QBO + QB Time access:**
- Skip the free trial setup entirely
- Verify QBO accountant invite works and test QB Time access
- Log the duplicate customer list she provides
- Confirm QB Time Approvals Add-On status
- Begin M2 against her real credentials

**If Lea Ann has NOT yet responded:**
- Proceed with sandbox + free trial approach as described below
- Follow up with Lea Ann around May 28 if still no response

### Sandbox + free trial build plan (if Lea Ann has not responded)

**QBO (sandbox -- already ready):**
The Intuit Developer sandbox company is already provisioned from M0. Before starting M2, open the sandbox QBO UI and create a service item named exactly `Hourly Accounting services` -- or verify one already exists -- and note its internal QBO Item ID. This ID is required for the invoice line item `ItemRef` lookup in M6.

**QB Time (free trial -- needs setup):**
QB Time has no developer sandbox. Sign up for a QB Time free trial account. Once inside:
1. Create 3 jobcodes named exactly: `Knoxville Title Agency LLC`, `Baine & Company`, `Knox Physical Therapy` (matching the seeded customers in the database)
2. Add at least one test employee
3. Log some time entries against each jobcode
4. Enable the QB Time API Add-On (Feature Add-ons → API → Add a new application) and note the OAuth credentials

This gives a real QB Time account with real API responses to build and test against, without waiting for Lea Ann.

**Build order from M2 onward:**

| Step | What | Data source |
|---|---|---|
| M2a | QBO OAuth flow + token storage + refresh logic | Intuit Developer sandbox |
| M2b | QB Time OAuth flow + polling + timesheet pull | QB Time free trial |
| M3 | Customer mapping UI + jobcode-to-customer table | Free trial jobcodes + seeded customers |
| M4 | Billing run engine + cron scaffold | Seeded DB data |
| M5 | Review queue DB wiring + approval actions | Seeded DB data |
| M6 | QBO invoice creation + bulk send + idempotency | Sandbox QBO |
| -- | Swap to Lea Ann's real credentials | Lea Ann's access |
| M7 | UAT | Lea Ann's real data |

**One open question to resolve before M2 starts:** Confirm in the Intuit Developer portal whether the QBO sandbox app and the QB Time free trial app can share one set of OAuth credentials, or whether they require separate app registrations. This affects token storage structure. Check this before Claude Code begins M2.

---

## Immediate next actions (in priority order)

1. **Commit updated CONTEXT_HANDOFF.md to repo** -- copy this file into `/docs` in `mrisenmay31/dynamic-billing`.
2. **At the start of the next session:** Check whether Lea Ann has responded with QBO + QB Time access. Follow the decision tree in the M2 development strategy section above.
3. **Follow up with Lea Ann** if no response by ~May 28 -- access request email sent May 22.
4. **Before M7:** Switch Resend sender from `onboarding@resend.dev` to a verified domain so emails reach Lea Ann.

---

## Open decisions (resolve as info arrives)

| Decision | Trigger |
|---|---|
| QB Time Approvals Add-On status | Lea Ann's response |
| UAT participants (Lea Ann only vs. + Amber) | Lea Ann's response |
| Email notification recipients beyond Lea Ann (e.g., cc Matt on cron failures) | Before M4 |
| Phase 2 SOW timing | After Phase 1 go-live is stable |

---

*Generated May 25, 2026 -- updated May 25, 2026. M0 complete. M1 complete. Auth confirmed. M2 can proceed against sandbox + QB Time free trial if Lea Ann access has not yet arrived -- see decision tree above.*
*Maintained by: CTA Integrity, LLC (Matt Risenmay)*
