# Agent Prompts

Grounded fix/investigation prompts staged by the advisor for Matt's terminal agents.
Copy the fenced block for the relevant task and paste it to the agent. Newest at top.

---

## AP-03 — URGENT: Billing Run + Queue display uses firm-default $125, ignoring per-client rate
- **Owner:** Agent 2 (code) — **touches `InvoicesClient.tsx` (single-writer): no other InvoicesClient work concurrently**
- **Status:** ✅ SHIPPED 2026-07-01 — branch `claude/fix-display-rate` (`d124957` + `b94ad9e`), merged to integration + `main` = **`b94ad9e`**, deployed to prod. Advisor diff-reviewed (2 files, no engine/send/migration drift; rawAmount also fixed). Dashboard now shows $45,987.50.
- **Files:** `apps/web/src/app/invoices/page.tsx`, `apps/web/src/app/invoices/InvoicesClient.tsx`
- **Branch:** off current integration tip (`origin/claude/cta-integrity-onboarding-test-7tazih`); deploy to PREVIEW for advisor verify, then main on Matt's say-so
- **DECISION (2026-07-01):** rate source = **`draft.hourly_rate`** (NOT `customer.hourly_rate_override`) — must match what `send/route.ts` bills. Build AP-03 **standalone + minimal off the integration tip** (do NOT build on AP-02's branch). **AP-02 is PARKED** — reconcile it on top after June ships. AP-03 is the only pre-send blocker.
- **Reconciliation design (for later, when AP-02 comes back):** decouple the two surfaces — the Invoice Queue/Billing Run display rate is per-draft (`draft.hourly_rate`); the Client Rules editor manages `customer.hourly_rate_override` in its OWN state and must NOT be the source of the queue's displayed billed amount. Editing an override affects FUTURE generations (regenerate), never the display of an already-generated draft.

```
Task: fix the Billing Run dashboard + Invoice Queue so displayed dollar amounts use each draft's real
per-client rate, not the firm default. Branch off current integration tip
(git fetch origin && git checkout -b claude/fix-display-rate origin/claude/cta-integrity-onboarding-test-7tazih).

Bug (confirmed against live P&L June): the DB drafts and the send path are CORRECT — send/route.ts uses
draft.hourly_rate (verified: $75/$100 clients have the right rate + total_amount stored). But the UI recomputes
displayed dollars as hours × invoiceStates.rate, and that rate is seeded from the firm default ($125) for every
client (InvoicesClient.tsx ~line 2695 sharedClientRates init = defaultRate). So the Billing Run "Proposed Billing"
shows $49,281.25 (394.25h × $125) when the real total is $45,987.50 — the 11 clients on $75/$100 overrides are
rendered as $125. Purely a display defect; do NOT change engine, send, drafts, or rates.

Root: the per-client rate (draft.hourly_rate) is never plumbed into the UI; the display falls back to firm default.

Fix:
1. apps/web/src/app/invoices/page.tsx:
   - The `templates` map (~line 128-150) is built from drafts (draft.hourly_rate is available via the select at
     ~line 101). Add `rate: draft.hourly_rate` to each template object (~line 134).
   - `allEntries` (~line 152-164) hardcodes rate: defaultRate / amount via durationToAmount(..., defaultRate).
     Use the owning client's real rate instead so the "Total raw amount (pre-rounding)" card is per-client-correct
     (each allEntries row is derived from a template t → use t.rate).
   - Add `rate: number` to the templates prop type.
2. apps/web/src/app/invoices/InvoicesClient.tsx (SINGLE-WRITER):
   - Seed sharedClientRates from each template's rate (t.rate) instead of defaultRate (~line 2695).
   - invoiceStates[].rate (~line 2732) already reads sharedClientRates[t.id] — it will become correct once the
     seed is fixed. Confirm the derived values recompute: liveTotalBilling (~565), allTotalBilled (~745),
     per-card amount (~896).
   - Leave the send calls untouched (they send rounded_hours + description only — correct as-is).

Verify on PREVIEW against live P&L June (log in with PASSWORD, not magic link):
- Billing Run "Proposed Billing" reads $45,987.50 (not $49,281.25); Rounded hours still 394.25; Clients 74.
- Catamount shows $100/hr; the ten $75 clients show $75/hr and correct amounts (e.g. United Way $1,556.25,
  Oak Ridge Chamber $1,275.00).
- npx tsc --noEmit clean. Do NOT touch engine/send/migrations.

Report: branch name, diff summary, and the on-screen Proposed Billing figure after the fix.
```

---

## AP-02 — Self-serve per-client rates (Client Rules → persist `hourly_rate_override`)
- **Owner:** Agent 2 (code) — **touches `InvoicesClient.tsx` (single-writer): no other InvoicesClient work may run concurrently**
- **Status:** BUILT (branch `claude/client-rate-editor` @ `25a0c71`, in worktree, UNPUSHED) — **PARKED, do not merge.** Reconcile on top of AP-03 after June ships, applying the decoupling in AP-03's "Reconciliation design" note (Client Rules editor must use its own state sourced from `customer.hourly_rate_override`, NOT the queue's `draft.hourly_rate` seed).
- **Files:** `apps/web/src/app/api/customers/[id]/route.ts` (Lane B), `apps/web/src/app/invoices/page.tsx` + `apps/web/src/app/invoices/InvoicesClient.tsx` (Lane A)
- **Branch:** off the current integration tip (`origin/claude/cta-integrity-onboarding-test-7tazih`); normal flow → advisor regression-checks before merge

```
Task: make per-client billing rates self-serve in the Client Rules screen (load + persist
customers.hourly_rate_override). Branch off the current integration tip
(git fetch origin && git checkout -b claude/client-rate-editor origin/claude/cta-integrity-onboarding-test-7tazih).

Why: customers.hourly_rate_override is the authoritative per-client rate the billing engine already uses
(engine.ts:61 → rate = customer?.hourly_rate_override ?? firmDefaultRate). Today it can only be set by SQL.
The Client Rules rate box is cosmetic and BUGGY: it seeds from the firm default (not the saved override) and
setClientRate only mutates local React state — edits silently vanish on reload, and nothing is ever
persisted. Make it real so the firm owner manages rates herself.

Three changes (keep everything else unchanged — this is additive; do not alter rounding/gating/aggregation):

1. API (apps/web/src/app/api/customers/[id]/route.ts): extend the PATCH body to accept
   hourly_rate_override?: number | null.
   - Validate: must be null OR a finite number > 0 (reject <=0 / NaN with 400).
   - null means "inherit firm default" — write NULL to the column.
   - Add it to the `patch` object alongside the existing qbo_customer_id / exclude_from_billing handling.
   - Keep the firm-scoped .eq('firm_id', firmId) guard.

2. Server plumbing (apps/web/src/app/invoices/page.tsx): the drafts join already selects
   customers(... hourly_rate_override ...) (~line 101) and it's destructured (~line 129). Pass it through on
   each `templates` item (e.g. add `rateOverride: customer.hourly_rate_override` to the object at ~line 134)
   so the client can seed from the real saved value. Also ensure the firm default rate is already available
   to the client (defaultRate is passed today) — leave that as-is.

3. Client (apps/web/src/app/invoices/InvoicesClient.tsx — SINGLE-WRITER, you are the only editor):
   - Seed sharedClientRates from each template's rateOverride ?? defaultRate (NOT unconditionally defaultRate;
     current init is at ~line 2695).
   - In setClientRate (~line 2723), after updating local state, persist via a DEBOUNCED PATCH to
     /api/customers/{id} with { hourly_rate_override: value } (mirror the existing debounced invoice-drafts
     PATCH pattern already in this file ~line 753). A blank/cleared field should send null (inherit default).
   - Surface a lightweight saved/failed indicator so the owner knows it stuck (reuse existing toast/inline
     pattern; don't invent a new system).
   - The Client Rules rate input is ~line 1853 (value={sharedClientRates[t.id]} / onChange → setClientRate).

Verify before committing:
- npx tsc --noEmit clean.
- Manually: set a client's rate in Client Rules, reload → it persists; clear it → reverts to firm default
  (column NULL); regenerating drafts uses the new rate. Confirm the customers PATCH is firm-scoped (can't
  write another firm's customer).
- Do NOT touch the billing engine, the send route, or migrations.

Report back: branch name, diff summary, and confirmation that a set-reload-regenerate cycle reflects the
new rate.
```

---

## AP-01 — Paginate all `time_entries` reads (remove ~1,000-row cap) — PARKED BRANCH
- **Owner:** Agent 1 (code)
- **Status:** BUILT + pushed (branch `claude/fix-time-entries-rowcap`, off integration, NOT merged — parked as intended). Verified live: 1,245 total rows returned vs old 1,000 cap; engine still 626. Advisor diff-review pending before any merge. ⚠ **Incident:** the agent swapped Matt's live super-admin password hash for a test credential then self-reverted — see [[feedback-agent-testing-guardrail]]; Matt to rotate password.
- **Files:** `apps/web/src/lib/billing/engine.ts`, `apps/web/src/app/invoices/page.tsx`, new `apps/web/src/lib/supabase/paginate.ts`
- **Branch:** `claude/fix-time-entries-rowcap` off `origin/claude/cta-integrity-onboarding-test-7tazih` — **do NOT merge** (parked for review; must not touch today's live P&L billing run)

```
Task: paginate all time_entries reads to remove the ~1,000-row PostgREST cap (parked branch, do not merge)

Branch: git fetch origin && git checkout -b claude/fix-time-entries-rowcap origin/claude/cta-integrity-onboarding-test-7tazih
Commit here and push the branch. Do NOT merge into the integration branch or main — this is parked for
review; today's live billing run must not be touched.

Background (why): This Supabase project enforces a PostgREST max-rows cap of ~1,000. Every read from
time_entries that can return >1,000 rows silently truncates with no error. Confirmed live: P&L June has
1,222 entries but the "All Time Entries" screen shows exactly 1,000. The billing engine currently escapes
this only by luck — its filtered set is 626 rows this month — but it will silently UNDER-BILL the day any
firm's monthly billable+mapped count crosses ~1,000. This is a correctness landmine; fix all three read
sites so completeness never depends on the server cap.

Three unpaginated read sites (all in apps/web/src):
1. lib/billing/engine.ts:24 — billable+mapped month query (.select('customer_id, duration_seconds')…).
   MOST CRITICAL — feeds the invoice math.
2. app/invoices/page.tsx:116 — `entries`: run-scoped
   .select('*').in('customer_id', customerIds).gte/lt(month).order('started_at').
3. app/invoices/page.tsx:184 — `rawTimeEntries`: firm-wide, ALL months, unfiltered (the worst offender;
   grows unbounded — this is the one the screenshot hit).

Fix: Add a small reusable pagination helper (e.g. lib/supabase/paginate.ts) that loops
.range(offset, offset + PAGE - 1) with PAGE = 1000, accumulating until a page returns < PAGE rows, and
returns the full array. Apply it to all three sites, preserving each query's exact .select(...) columns,
filters, and .order(...). Do not change any billing/rounding/gating semantics — this is purely a
completeness fix. (If you prefer, site #1 may instead use a DB-side aggregate RPC returning one row per
customer, but that requires a migration — default to the pagination helper to keep this branch
migration-free.)

Do not touch InvoicesClient.tsx (single-writer, owned elsewhere) — only page.tsx's server-side queries and
engine.ts + the new helper. The header stats (Total Entries / Raw Time / Amount / Clients) are derived
downstream from these arrays and will self-correct once the arrays are complete.

Verify before committing:
- npx tsc --noEmit clean.
- Add a temporary check confirming site #3 returns >1,000 rows for P&L (firm
  00000000-0000-0000-0000-000000000001) and site #1 returns exactly 626 for June 2026 (unchanged) — then
  remove any temp logging.
- Commit message noting it fixes the silent >1,000-row truncation in engine + All Time Entries.

Report back the branch name, the diff summary, and the row counts you observed.
```
