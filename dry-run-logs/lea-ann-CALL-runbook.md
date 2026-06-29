# Lea Ann Onboarding — On-Call Runbook

**Firm:** P&L Business Services, LLC (`00000000-0000-0000-0000-000000000001`)
**Her login:** leaann@pandlbusinessservices.com · role **owner** · UUID `65959628-78c6-47c7-807e-9ed5175763b8`
**App:** app.clocktobill.com (prod). Date: 2026-06-29.

## 🟢 GOLDEN RULES
- **Do NOT send a real invoice to her clients today.** Validate drafts only; sending is the last step, after the numbers check out.
- **Verify before trusting:** the non-billable filter (Path A) reads a QB Time custom field by NAME — confirm it resolves on *her* account before any send.
- **Ping Claude** at the ⭐ checkpoints to verify data behind the scenes.

---

## ✅ ALREADY DONE (pre-call)
- [x] **A — P&L firm defaults set** (`qbo_write_enabled=true`, rate $125, description "Monthly Bookkeeping").
- [x] **B — Her account created + assigned to P&L as owner** (verified: one `firm_users` row, firm = P&L, role = owner, not CTA).

---

## STEP 1 — She logs in
- [ ] She goes to **app.clocktobill.com/login** → magic link (or temp password) → lands on `/invoices`.
- [ ] ✅ Confirm: lands on **P&L's empty workspace** (no customers/entries yet), and **owner controls are visible** (Connect + Send buttons present). No "not linked to a firm" error.

## STEP 2 — Connect QBO (Settings → Connect)
- [ ] She authorizes **her real QBO company** → returns `?connected=qbo`, shows **Connected** (green).
- [ ] Confirm it's her **production** company (not sandbox).
- [ ] 🔴 **In her QBO: "Custom transaction numbers" must be OFF** (Account & Settings → Sales → form content). If ON → invoices send with no number ("Invoice undefined"), and it's permanent. **Check this.**
- [ ] Spot-check her customers have an **email** in QBO (sends fail 422 without one).
- [ ] "Hourly Accounting services" product/service — auto-creates on first send; confirm if easy.
- [ ] ⭐ **Ping Claude:** verify `qbo_connections` row exists for P&L with her realm_id.

## STEP 3 — Connect QB Time (Settings → Connect QB Time)
- [ ] She clicks Connect → **logs into HER QB Time account and grants access** → returns `?connected=qb_time`, **Connected**.
  - *(No client ID/secret needed from her — the app uses its own shared credential; she just authorizes.)*
- [ ] ⭐⭐ **Ping Claude (MOST IMPORTANT):** after a first June sync, Claude inspects her synced data to confirm (a) `qb_time_connections` row exists, and (b) **her "Billable?" custom field resolves** so non-billable time is correctly flagged. If it doesn't resolve, STOP before any send — non-billable would bill.

## STEP 4 — Sync + map clients (Client Mapping)
- [ ] Panel B → **Sync jobcodes**. Panel A → **Sync from QuickBooks Online** (auto-match).
- [ ] Map each jobcode → QBO customer.
- [ ] **Duplicate profiles:** if a client exists twice, map **both** jobcodes to the **same** QBO customer (→ one merged invoice). **Get her known-duplicate list.**
- [ ] **Flat-rate / monthly / tax clients** (entirely non-billable): **don't map them** (no exclude-from-billing toggle yet — mapping is the gate). Mixed clients are fine — Path A drops their non-billable entries.
- [ ] ⭐ **Ping Claude:** confirm every billable jobcode is mapped (an unmapped billable jobcode = silently dropped revenue).

## STEP 5 — Validate June (NO real send)
**Sequencing matters — approve first so the app and her report match:**
- [ ] She **approves ALL of June** in QB Time.
- [ ] In the app → **Sync Now** (June).
- [ ] She **exports her full June QB Time timesheet report** (CSV, June 1–30) with columns: jobcode (client), hours, **billable**, notes, approved_status, employee. (Same export format as the CTA test.)
- [ ] ⭐⭐ **Send the CSV to Claude + say "June synced".** Claude reconciles:
  1. Per-client billable-only totals: report vs the app's drafts (rounding + amount).
  2. **Billable-flag match** per entry (app `is_billable` vs report `billable`) — confirms Path A read the right field.
  3. Mapping completeness + duplicate merges.
- [ ] In the app → **Generate Drafts** (June). Spot-check 2–3 clients: one line item each, ceiling-rounded to 0.25, non-billable excluded, $125/hr, dated 1st of next month / due +5 days.
- [ ] ✅ **Only after the reconciliation is clean** is she cleared to send. (Even then, today = validation; real send can wait for her real month-end run.)

## STEP 6 — First billing run + expectations
- [ ] Walk her through the monthly flow: **Generate Drafts → review queue → bump high-touch buffers → Approve & Send**.
- [ ] Set scope: **this is billing automation; she keeps BillerGenie** (invoices flow there from QBO automatically). No payment portal in this phase.
- [ ] Don't over-promise AI descriptions — default "Monthly Bookkeeping", editable.

---

## 🔴 GOTCHAS
- **Path A field-name match** — the one real unknown on her account. Verify (Step 3 ⭐⭐) before trusting non-billable exclusion.
- **No flat-rate exclude UI** — use mapping discipline (don't map all-non-billable clients).
- **Regenerate after changing data** — "Generate Drafts" won't recompute an existing run; Claude clears the run first via SQL. Fine for her first (fresh) run.
- **Bulk "Send All" at her volume (164–187 invoices/mo)** isn't load-tested — for the first real send, do smaller batches and watch for rate-limit / partial failures.
- **QB Time 3-account cap** — CTA + P&L = 2 of ~3; fine now, needs Intuit partner expansion past ~3 firms (roadmap note).

## WHEN TO PING CLAUDE (he verifies via SQL behind the scenes)
1. After QBO connect → confirm `qbo_connections` row.
2. ⭐⭐ After QB Time connect + first June sync → **confirm Billable? custom field resolved** (the key check).
3. After mapping → confirm all billable jobcodes mapped.
4. ⭐⭐ After June sync + her CSV → **full per-client reconciliation before any send**.
