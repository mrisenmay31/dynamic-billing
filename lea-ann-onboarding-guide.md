# Lea Ann Onboarding — Step-by-Step Guide

Goal: get Lea Ann (P&L Business Services) from zero to **sending her first month of real invoices via ClockToBill**.

This is written **for Matt** to follow. It assumes a single live screen-share/call with Lea Ann (~60 min), with prep work done beforehand and a short follow-up afterward.

The P&L firm row already exists in the DB (`firms.id = 00000000-0000-0000-0000-000000000001`).

---

## Phase 0 — Before the call (Matt, alone, ~30 min)

Do all of this in advance so the live call is just Lea Ann clicking buttons.

### 0.1 — Confirm the app is healthy
- [ ] `https://app.clocktobill.com/login` loads cleanly (no Safe Browsing warning in Chrome).
- [ ] Latest Vercel deploy is green and matches `main`.
- [ ] Confirm `QBO_ITEM_NAME` is still absent from Vercel env vars (was removed 2026-06-23). If it reappeared, delete it again — the dry run proved this overrides the line item name silently.

### 0.2 — Create Lea Ann's auth user + link her to P&L firm
Two equivalent paths; pick one.

**Path A (recommended) — Supabase Studio:**
1. Supabase project `vvmfbtvxsjeyrmsqodon` → Authentication → Users → **Add user → Send invitation**.
2. Email: Lea Ann's. She'll get a sign-in link from Supabase.
3. Once the row exists, grab her `auth.users.id` (UUID).
4. Insert `firm_users` row linking her to P&L:
   ```sql
   insert into firm_users (user_id, firm_id, role)
   values ('<lea-ann-auth-user-uuid>', '00000000-0000-0000-0000-000000000001', 'admin');
   ```
5. **Verify** by hitting `/api/auth/callback` flow as her — she should land on `/invoices` and not redirect-loop.

**Path B — magic link script:**
1. From `apps/web/`: `node --env-file=.env.local scripts/get-magic-link.mjs` (edit script for Lea Ann's email if needed).
2. Same `firm_users` insert as above — without it, `getFirmContext` will throw and her first session will error.

### 0.3 — Pre-flight her data (ask her in advance, by email or text)
Send Lea Ann this short message before the call so she has the answers ready:

> Quick prep before our setup call:
> 1. You'll need to be signed into **QuickBooks Online** (P&L Business Services) as Admin in the browser we're using.
> 2. You'll need to be signed into **QuickBooks Time** as Admin.
> 3. Please send me the list of **duplicate customers** you mentioned — I want to know which QBO record is the "real one" for each so we map jobcodes correctly.
> 4. Have your most recent month's billing in your head (which clients, roughly which hours). We'll do that month live.
> 5. I'll need to confirm a couple of small QBO settings on your account — takes about 30 seconds, no risk.

### 0.4 — Pre-flight checks on her QBO (do these together at the start of the call — they cannot be done before she connects, but flag them in your head now)
- Settings → Account and Settings → Sales → Sales form content → **"Custom transaction numbers" must be OFF**. If it's ON, QBO won't generate invoice numbers and ClockToBill saves `null`. (Discovered during CTA dry run.)
- Open Products and Services → check for an item named **`Hourly Accounting services`** (exact spelling). If absent, ClockToBill auto-creates it on first send — that's fine, but confirm she's OK with that.
- Spot check **3–5 of her real billing customers** for a `PrimaryEmailAddr` value. If missing, the send call 422s for that customer and marks the draft `error`.

### 0.5 — Pre-flight checks on her QB Time
- Confirm the **TSheets / QB Time API Add-On** is enabled. Account → Feature Add-ons → API. Without this, the OAuth registration doesn't exist and the Connect button will fail.
- Confirm whether the **Approvals Add-On** is enabled (open question in CLAUDE.md). If yes, we can filter by `approved_to` date. If no, we fall back to a simple date-range filter — likely fine because her EA approves weekly and billing happens after month-end.

---

## Phase 1 — Live call: connect her accounts (10 min)

She drives, you watch and narrate.

### 1.1 — First sign-in
- [ ] Lea Ann clicks the magic link / invitation email → lands on `/invoices`.
- [ ] **Expected empty state:** no billing runs yet. Settings tab visible.

### 1.2 — Connect QBO
- [ ] Settings → **Connect QBO** → redirects to Intuit OAuth.
- [ ] She picks **P&L Business Services** from the company list (the real one — not any sandbox).
- [ ] Authorize → lands back on `/invoices?connected=qbo`.
- [ ] Settings page now shows QBO row as **Connected** with today's date.

### 1.3 — Connect QB Time
- [ ] Settings → **Connect QB Time** → redirects to QB Time OAuth.
- [ ] Authorize → lands back on `/invoices?connected=qb_time`.
- [ ] Settings page now shows QB Time row as **Connected**.

**If either OAuth fails:** check the env vars (`INTUIT_CLIENT_ID`, `INTUIT_REDIRECT_URI`, `QB_TIME_CLIENT_ID`, `QB_TIME_REDIRECT_URI`) and that the redirect URI in the Intuit / QB Time developer console matches `https://app.clocktobill.com/api/auth/{qbo,qb-time}/callback` exactly.

### 1.4 — Verify her QBO settings (the 30-second checks)
With QBO open in another tab:
- [ ] Settings → Account and Settings → Sales → Sales form content → **toggle "Custom transaction numbers" OFF** → Save. (This must happen before any send, not after — DocNumber is immutable on an existing invoice.)
- [ ] Spot check one customer record for a `PrimaryEmailAddr`. If empty, this is a sign she has gaps; we'll catch the rest during draft review.

---

## Phase 2 — Map her clients (15–20 min — this is the slowest part)

### 2.1 — Sync jobcodes from QB Time
- [ ] Settings → **Sync QB Time** (or whatever the jobcode-sync trigger is on Settings).
- [ ] Wait for success toast.
- [ ] Client Mapping tab → **Panel B (Jobcodes)** populates with her QB Time jobcodes + their current mapping status (likely all "Unmapped").

### 2.2 — Sync her QBO customers
- [ ] Client Mapping tab → **Sync QBO Customers** in Panel A.
- [ ] All her QBO customers populate as a searchable list.
- [ ] Auto-match by name happens server-side — most will already be linked.

### 2.3 — Map jobcodes → QBO customers (Panel B)
For each jobcode in Panel B:
- [ ] Pick the correct QBO customer from the dropdown → **Save**.
- [ ] On save, the API:
  - Finds-or-creates a `customers` row from the chosen QBO customer.
  - Inserts the `customer_mappings` row (jobcode → customer).
  - **Backfills `customer_id` onto existing `time_entries` for that jobcode** (no re-sync needed).

**Duplicate customer handling:** when Lea Ann has duplicates in QBO (the list she sent in 0.3), pick the canonical one she wants invoices to go against. The duplicates can remain in QBO untouched.

**Don't map flat-rate clients yet** (open question in CLAUDE.md — if they appear as jobcodes, leave them unmapped for now; they'll be skipped by the billing engine). Confirm with Lea Ann which clients are flat-rate before mapping any she's unsure about.

### 2.4 — Set per-client rules (if any)
- [ ] Client Rules tab.
- [ ] Default rate: confirm **$125/hr**.
- [ ] Default invoice description: confirm **"Monthly Bookkeeping"**.
- [ ] If any client has a different rate, set the override here.
- [ ] If any client always gets a custom invoice description (the "2026 recons caught up" style), set the override here. Otherwise leave default — she can edit per-draft at review time.
- [ ] Flag the ~5 **high-touch clients** if you've built a flag (currently no system flag — Lea Ann adds the 15–45 min buffer manually at review time using the hours-edit on the draft card).

---

## Phase 3 — Run her first real billing month (15 min)

### 3.1 — Sync timesheets for the billing month
- [ ] Settings → **Sync Now** (or whatever the timesheet-sync trigger is — defaults to current calendar month). If she wants to bill the prior month (most likely), confirm whether the date range picker covers prior months, or if "Sync Now" already pulls the right window.
- [ ] All Time Entries tab → confirm entries imported. Switch the **month selector** to the target billing month.
- [ ] Confirm zero entries show the **"Unmapped"** badge. If any do, return to Panel B and map them.

### 3.2 — Generate drafts
- [ ] Invoice Queue tab.
- [ ] **GenerateMonthDropdown** → pick the target billing month → **Generate Drafts**.
- [ ] One card appears per mapped customer with: total hours (ceiling-rounded to 0.25), rate, line total, description, and the underlying time entries expanded.

### 3.3 — Review each draft with Lea Ann
For each card:
- [ ] Verify the **hours** match her expectation (within rounding).
- [ ] Verify the **rate** is correct ($125 default unless overridden).
- [ ] Verify the **description** — default "Monthly Bookkeeping" or override.
- [ ] For **high-touch clients**: she bumps the hours up by 0.25–0.75 using the +0.25/+0.50/+0.75 buttons or the direct hours input. Total recalculates.
- [ ] Edits autosave via debounced PATCH (700ms). No save button.

### 3.4 — Send a test invoice first (recommended)
For the first send, do one to herself before sending to real customers:
- [ ] Pick one customer. In QBO, temporarily change that customer's `PrimaryEmailAddr` to Lea Ann's own email (write the original down).
- [ ] In ClockToBill: click **Approve & Send Invoice** on that card.
- [ ] Watch for toast: *"Invoice sent. BillerGenie will sync the payment portal automatically."*
- [ ] Status badge flips to **Sent** (green); card collapses.
- [ ] Verify the email arrives in Lea Ann's inbox; she clicks **View and Pay** → loads the QBO/BillerGenie payment portal.
- [ ] Verify the QBO invoice exists with a real invoice number (not "undefined") and line item = "Hourly Accounting services".
- [ ] Put the original customer email back in QBO. Note: that invoice still went to Lea Ann's inbox, not the customer's — fine for a test, but don't re-send.

### 3.5 — Send the rest
- [ ] Either: **Approve & Send Invoice** on each remaining card one at a time (safer if you want to watch each), or
- [ ] **Send All Approved Invoices** in the header (parallel, faster — good once she trusts it).
- [ ] All status badges should flip to **Sent**; Send Progress bar fills to 100%.
- [ ] Any card that errors: status badge stays, `last_error` populated in DB. Most common causes: missing customer email in QBO, or QBO API hiccup (retry; intuit_tid is captured for support).

### 3.6 — Verify in QBO + BillerGenie
- [ ] Open her QBO → Sales → Invoices → confirm all the new invoices are there, sent.
- [ ] BillerGenie should auto-sync within a few minutes (no integration on our side — it polls QBO).
- [ ] Confirm at least one invoice appears in BillerGenie's portal.

---

## Phase 4 — Hand-off (5 min)

- [ ] Show her the **Sign out** / **Reset password** controls in Settings → Account.
- [ ] Show her the support email: **support@ctaintegrity.com**.
- [ ] Tell her the monthly cadence: she runs it once per month, end-of-month after her EA approves time.
- [ ] Encourage her to message you the first month she runs it solo so you can be on standby.

---

## Phase 5 — Post-call follow-up (Matt, same day)

- [ ] Verify in Supabase: 1 `billing_runs` row, N `invoice_drafts` rows (all `status = sent`, all with `qbo_invoice_number` populated, all with `last_error = null`).
- [ ] Check `audit_logs` for N `invoice_sent` entries with `create_intuit_tid` + `send_intuit_tid` captured.
- [ ] Update CLAUDE.md: mark M7 as ✅ Complete with the date.
- [ ] Update memory: project context → M7 done.
- [ ] Note any open questions answered during the call (especially the Approvals Add-On status and flat-rate client handling).

---

## Issues to watch for, and how to resolve them live

| Symptom | Cause | Fix |
|---|---|---|
| She lands on `/invoices` and gets a server error | `firm_users` row missing | Insert the `firm_users` row linking her auth user to the P&L firm |
| Connect QBO redirect fails or shows "invalid client" | Production credentials mismatch | Check `INTUIT_CLIENT_ID` / `INTUIT_CLIENT_SECRET` / `INTUIT_REDIRECT_URI` in Vercel; confirm `INTUIT_ENVIRONMENT=production` |
| Connect QB Time redirect fails | API Add-On not enabled in her QB Time account | She enables Feature Add-ons → API in QB Time, then retry |
| Sync timesheets returns 0 entries | Jobcode mapping not done yet; or wrong date range | Map jobcodes first; confirm date range covers the right month |
| Generate Drafts produces 0 cards | All entries unmapped, or wrong month picked | Check All Time Entries view for Unmapped badges; verify month selector |
| Approve & Send fails 422 — "No email address" | Customer's `PrimaryEmailAddr` empty in QBO | She adds the email in QBO, then retry the send |
| Approve & Send fails 403 — "QBO write not enabled" | `firms.qbo_write_enabled = false` | Flip to `true` in Supabase for the P&L firm (`00000000-…0001`) |
| Sent invoice in QBO shows "Invoice undefined" | "Custom transaction numbers" toggle is ON in QBO | She toggles OFF in QBO settings — but the already-sent invoice can't be backfilled; next sends will be numbered correctly |
| Line item shows wrong name (not "Hourly Accounting services") | `QBO_ITEM_NAME` env var resurfaced in Vercel | Delete from Vercel, redeploy |
| Customers with duplicate QBO records | Multiple QBO customers with the same name | Use her duplicate list from prep step 0.3; pick canonical record in Panel B |
| Flat-rate client appears as a jobcode | Open question — confirmed during call | Leave jobcode unmapped for now; the billing engine will skip it |

---

## Useful references for the call

- **App URL:** `https://app.clocktobill.com`
- **P&L firm ID:** `00000000-0000-0000-0000-000000000001`
- **Production realm ID:** Lea Ann's real QBO realm (will be visible in `qbo_connections.realm_id` after she connects)
- **Support:** `support@ctaintegrity.com`
- **Supabase project:** `vvmfbtvxsjeyrmsqodon`
- **Useful debug endpoint:** `https://app.clocktobill.com/api/qbo/items` (lists all items in the connected firm's QBO — sanity-check the `Hourly Accounting services` item appears after a send)
- **Pricing for the pilot:** $125/hr default, "Monthly Bookkeeping" default description
- **Invoice date logic:** billing_month + 1 month = TxnDate (e.g., June billing → 07/01 invoice date); DueDate = TxnDate + 5 days
- **Rounding:** `ceil(total_seconds / 900) * 0.25` per customer per month, applied at the aggregate level
