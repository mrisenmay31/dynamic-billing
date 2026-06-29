# Lea Ann Onboarding Checklist — P&L Business Services

**Goal:** logged in → QBO + QB Time connected → clients mapped → validated on her real data →
ready to **Generate Drafts on July 1 for June work**.
**⚠️ Do NOT send a real invoice to her actual clients during this call.**
Firm: P&L Business Services `00000000-0000-0000-0000-000000000001`. Date: 2026-06-29.

---
## ✅ POST-CALL STATUS (2026-06-29 — call done)
- ✅ A — firm defaults set · ✅ B — account created + owner · ✅ Login · ✅ QBO connected
  (realm `9130349883156876`) · ✅ QB Time connected · ✅ ~1,115 June entries synced ·
  ✅ Path A resolved her billable field `1701272`.
- ⏳ Mapping — Lea Ann doing it herself (~4/1,115 mapped so far). Nothing bills until mapped.
- ⏸ Amber login — **deferred** by Lea Ann (break-glass backup; revisit role = owner vs assistant).
- 🔴 **Open before July 1 billing (see follow-up email draft):**
  1. Multiple rates ($125/$100/$75, field `1933334`) → need per-client rate overrides.
  2. Blank billable (104 entries) → confirm convention (currently treated non-billable).
- ⏭ Next: she maps + approves June → sends full June QB Time report → advisor reconciles
  per-client before any send. She bills **July 1**.
---

---

## A. Before/at the call — Matt, via SQL (2 min)
- [ ] Set P&L firm defaults:
```sql
update firms set qbo_write_enabled=true, default_hourly_rate=125,
  default_invoice_description='Monthly Bookkeeping'
where id='00000000-0000-0000-0000-000000000001';
```
(`qbo_write_enabled=true` is mandatory or every send 403s.)

## B. Get her logged in
- [ ] Send Lea Ann a **magic-link invite** (creates her auth user).
- [ ] She clicks it → lands on `/invoices`. Confirm **no "not linked to a firm"** error.
- [ ] Grab her new `auth user id`, set role = **owner** on P&L (Amber too if present):
```sql
insert into firm_users (firm_id, user_id, role)
values ('00000000-0000-0000-0000-000000000001','<lea-ann-user-id>','owner')
on conflict (firm_id,user_id) do update set role='owner';
-- Amber, if onboarding too:
-- insert ... '<amber-user-id>','assistant' ... do update set role='assistant';
```
- [ ] Confirm she's on **P&L**, not CTA.

## C. Connect QBO (Settings → Connect QBO)
- [ ] She authorizes **her real QBO company** → returns `?connected=qbo`, shows **Connected** (green).
- [ ] Confirm it's her **production** realm (not sandbox).
- [ ] 🔴 **Verify "Custom transaction numbers" is OFF** (Account & Settings → Sales → form content).
      If ON → sends save a null invoice number → "Invoice undefined", and DocNumber is **immutable**.
      Single most important external setting.
- [ ] "Hourly Accounting services" item — auto-creates on first send; confirm if easy.
- [ ] Spot-check her customers have an **email** in QBO (`PrimaryEmailAddr`) — sends 422 without one.

## D. Connect QB Time (Settings → Connect QB Time)
- [ ] She authorizes → **Connected**.
- [ ] 🔴 **CRITICAL — verify her per-entry "Billable?" custom field.** Path A finds a QB Time
      custom field by NAME; hers will differ from CTA's. After the first sync (E), advisor checks
      her synced `source_payload.customfields` to confirm (a) she has a per-entry billable field
      and (b) Path A resolved it. **If the name doesn't match what Path A looks up, non-billable
      time will silently bill.** #1 thing to validate on her real data before any real send.

## E. Sync + map clients (Client Mapping)
- [ ] Panel B → **Sync jobcodes**; Panel A → **Sync from QuickBooks Online** (auto-match).
- [ ] Map each jobcode → QBO customer.
- [ ] **Duplicate profiles:** if a client exists twice, map **both** jobcodes to the **same** QBO
      customer → one merged invoice. Get her **known-duplicate list** on the call.
- [ ] **Flat-rate / monthly / tax clients:** the per-client "exclude from billing" UI toggle is
      **not built yet** — for clients whose time is *entirely* non-billable, **don't map them**
      (mapping is the billing gate). For *mixed* clients, Path A handles non-billable entries
      automatically (pending the field check in D).

## F. Validate on her real data (NO real send)
- [ ] **Sync timesheets** for June.
- [ ] **All Time Entries** → confirm billable/non-billable split looks right (advisor verifies the
      Path A field resolved via SQL).
- [ ] **Generate Drafts** for June → spot-check 2–3 clients: one line item each, ceiling rounding,
      **non-billable excluded**, $125/hr. Advisor hand-reconciles against the DB.
- [ ] Confirm date = 1st of following month, due +5 days.

## G. First billing-run readiness + expectations
- [ ] Walk her through: month-end → **Generate Drafts** → review queue → bump **high-touch
      buffers** → **Approve & Send**.
- [ ] Scope: **billing automation only; she keeps BillerGenie** (invoices flow there from QBO).
      No payment portal in this phase.
- [ ] Don't over-promise AI descriptions — default "Monthly Bookkeeping", editable.

## 🔴 Gotchas (from dry-run testing)
- **Path A field-name match** (D/F) — the one real unknown on her account. Verify before trusting
  non-billable exclusion.
- **No flat-rate exclude UI** — use mapping discipline (don't map all-non-billable clients).
- **Regenerate after changing data** (B-06) — "Generate Drafts" won't recompute an existing run;
  advisor deletes the run first via SQL. Fine for her first run (fresh).
- **Bulk "Send All" at her volume (164–187)** isn't load-tested — for the first real send, consider
  smaller batches; watch for rate-limit / partial failures.

---

## Advisor (Claude) standby during the call
Ping to: (1) verify her `firm_users`/role + firm settings landed; (2) **check her Billable? custom
field resolved after the first sync** (the key one); (3) reconcile her first Generate Drafts.
What's validated & live in prod (`main`=`20d526e`): empty states, Path B exclude column, sweep
(deletions propagate — verified), Path A per-entry billable (verified end-to-end), role gating,
B-08 over-billing UI/send fix (verified — non-billable present-but-excluded).
