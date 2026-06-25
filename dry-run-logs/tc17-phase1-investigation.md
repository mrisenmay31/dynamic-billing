## 2026-06-25 — TC-17 Phase 1 investigation (read-only)

- **Branch / worktree:** claude/cta-tc17-phase1 (../db-tc17-investigate)
- **Code changed:** NONE

---

### Code path map: where billable could come from (file:line)

**Sync path (where `is_billable` is set):**
- `apps/web/src/app/api/qb-time/sync-timesheets/route.ts:8–19` — `QbTimesheet` interface has NO `billable` field. Fields captured: `id, user_id, jobcode_id, start, end, duration, date, on_the_clock, notes, type`.
- `apps/web/src/app/api/qb-time/sync-timesheets/route.ts:27–31` — `QbJobcode` interface DOES have `billable: boolean`. This is available via `supplemental_data.jobcodes` in every paginated response.
- `apps/web/src/app/api/qb-time/sync-timesheets/route.ts:38–42` — `TimesheetPage` captures `supplemental_data.jobcodes` as `Record<string, QbJobcode>`, so the data arrives in each page.
- `apps/web/src/app/api/qb-time/sync-timesheets/route.ts:79–86` — `allJobcodes` is accumulated across pages and returned alongside timesheets.
- `apps/web/src/app/api/qb-time/sync-timesheets/route.ts:140` — At upsert time, `jc` (the jobcode object) is already resolved: `const jc = jobcodes[String(ts.jobcode_id)]`. `jc.billable` is therefore available here — it is just never used.
- `apps/web/src/app/api/qb-time/sync-timesheets/route.ts:167` — **THE BUG:** `is_billable: true` is hardcoded for every entry, regardless of `jc?.billable`.

**Billing engine path (where `is_billable` is consumed):**
- `apps/web/src/lib/billing/engine.ts:28` — `engine.ts` filters `.eq('is_billable', true)` when fetching entries for a billing run.
- Since every synced entry has `is_billable: true` (hardcoded), this filter is a **no-op** — it never excludes anything.

**DB schema:**
- `apps/web/supabase/migrations/20260525232144_remote_schema.sql:97` — `time_entries.is_billable boolean not null` — the column exists and is correctly typed; the problem is entirely in the sync route hardcoding its value.
- `apps/web/src/types/supabase.ts:697` — TypeScript confirms `is_billable: boolean` in the `time_entries` Row/Insert/Update types.
- **No `exclude_from_billing` column exists** on the `customers` table in the current schema — this is purely a future option, not yet built.

**Summary of the broken pipeline:**
```
QB Time API → timesheets (no billable) + supplemental jobcodes (has billable)
  → sync-timesheets/route.ts:167 hardcodes is_billable: true  ← BUG HERE
  → time_entries.is_billable = true for ALL entries
  → engine.ts:28 filters is_billable = true  ← no-op; never excludes anything
  → flat-rate client time (if jobcode is mapped) generates an invoice draft
```

---

### API doc findings

**QB Time (TSheets) API — timesheet object:**
Fetched `https://tsheetsteam.github.io/api_docs/#timesheets`. The timesheet object fields are: `id, user_id, jobcode_id, start, end, duration, date, tz, tz_str, type, location, active, locked, notes, customfields, last_modified`. **There is NO `billable` field directly on the timesheet object.** Billing status is not carried per-entry.

**QB Time (TSheets) API — jobcode object (supplemental_data):**
Fetched `https://tsheetsteam.github.io/api_docs/#the-jobcode-object`. The `billable` field exists on jobcode objects in `supplemental_data`. Example from the docs:
```json
"jobcodes": {
  "2624351": {
    "id": 2624351,
    "parent_id": 0,
    "assigned_to_all": true,
    "billable": false,
    "active": true,
    "type": "pto",
    ...
  }
}
```
`billable` is a **boolean** on the jobcode, not on individual timesheet entries.

**Critical caveat from CLAUDE.md:**
> "Jobcode `billable` flag is always `false` — it's a firm-level setting that defaults `false` regardless of the UI."

This means: even though the `billable` field exists on jobcodes and the API does return it, for Lea Ann's firm (and likely most QB Time accounts) **every jobcode returns `billable: false`**. This is a QB Time platform behavior — the field is not reliable as a billing gate.

**However:** Lea Ann's workflow (confirmed in the 5-20 call) is that she explicitly marks time entries as billable/non-billable in QB Time's UI. The call transcript at ~[29:43] says: *"If it says hourly and billable, like if you look at the time entries, it tells you if it's billable or not."* and *"I don't want to see anything that comes over here that says no. That's non-billable."* This suggests QB Time's UI **does** show a per-entry or per-jobcode billable flag that is meaningful to Lea Ann — but the API may not reliably surface it (or it may only be visible at the jobcode level, which is firm-defaulted to false).

**The open empirical question:** Does Lea Ann's real QB Time data return any jobcodes with `billable: true`? Or are all her jobcode `billable` values `false`, making the jobcode flag useless as a filter? This can only be confirmed by inspecting `time_entries.source_payload` after a real sync (TC-4/TC-8 with her live connection).

---

### Reliability assessment

| Signal | Reliability | Notes |
|---|---|---|
| Per-entry `billable` field on timesheet object | **Does not exist** | QB Time API has no per-entry billing flag |
| `QbJobcode.billable` (from supplemental_data) | **Unreliable / likely always false** | Firm-level QB Time setting defaults to `false` for all jobcodes; UI toggle may not propagate to API value |
| Customer mapping (jobcode → customer_id) | **Reliable as a positive gate** | If a jobcode is mapped to a customer, the time is *intended* to be billable; the mapping is the intended billability gate |
| `customers.exclude_from_billing` | **Does not exist yet** | Proposed Path B safeguard — not built |

The `QbJobcode.billable` value **is already in the app's data flow** — `jc` is resolved at `sync-timesheets/route.ts:140` and `jc?.billable` could be written to `is_billable` right now with a one-line fix. But whether that value is meaningful in practice for Lea Ann's firm requires live data verification.

---

### Recommended path: **Both A + B (belt-and-suspenders)**

**Path A — Capture the real jobcode billable flag instead of hardcoding:**
- Change `sync-timesheets/route.ts:167` from `is_billable: true` to `is_billable: jc?.billable ?? false`.
- This is a **one-line change** with no schema migration needed.
- If `billable` is `true` for her hourly jobcodes, it correctly gates billing at the entry level and `engine.ts:28` becomes a real filter.
- If `billable` is `false` for all her jobcodes (the likely case per CLAUDE.md), then all entries become `is_billable: false` and **nothing bills** — that breaks hourly clients too. This is why live data must be verified before shipping Path A alone.
- **Risk:** If CLAUDE.md is correct and all jobcodes return `false`, Path A alone would zero out all billing. Do NOT ship Path A without first verifying at least one hourly jobcode returns `billable: true` in her real data.

**Path B — Add `customers.exclude_from_billing` column (recommended as default, safe to ship regardless):**
- Add `customers.exclude_from_billing boolean not null default false` via a new Supabase migration.
- `engine.ts`: skip customers where `exclude_from_billing = true` when building drafts.
- UI (Client Rules / Client Mapping): add a "Flat-rate / exclude from billing" toggle per customer.
- At onboarding, Lea Ann explicitly marks her flat-rate/monthly/tax clients as excluded.
- **This is safe to ship without live data verification** — it doesn't break existing hourly billing (all customers default to `exclude_from_billing = false`), and it provides an explicit safety valve even if Path A is unavailable or unreliable.
- Path B also guards against auto-match (`sync-jobcodes` / `sync-qbo`) silently routing a flat-rate client into billing.

**Recommended ship order:**
1. Ship Path B first (schema migration + engine change + UI toggle) — safe, no data dependency.
2. After TC-4/TC-8 with Lea Ann's real connection, inspect `source_payload` and jobcode `billable` values.
3. If any hourly jobcodes show `billable: true`, also ship Path A (one-line fix in sync route).
4. If all jobcodes show `billable: false` (as CLAUDE.md expects), skip Path A — mapping discipline + Path B toggle is the full solution.

---

### Must confirm with live data after TC-4/TC-8

- **Does any jobcode in Lea Ann's real QB Time data return `billable: true`?** If yes, Path A is viable and adds a per-entry filter. Check `time_entries.source_payload` for raw timesheet payloads and also inspect `supplemental_data.jobcodes` from the sync response.
- **Does QB Time return any per-entry signal at all?** The `source_payload` stores the raw `QbTimesheet` object — inspect it for any undocumented field (e.g. `billable`, `type`, or a custom field) that varies between her hourly and flat-rate entries.
- **Which jobcode names correspond to flat-rate / monthly / tax clients?** Get this list from Lea Ann at onboarding so Path B excludes can be pre-populated.
- **Does auto-match (sync-jobcodes + sync-qbo name matching) silently map any flat-rate client by name?** Test by running both syncs and checking `customer_mappings` for flat-rate client names that shouldn't be mapped.
- **Verify the fix doesn't break CTA seed data:** After shipping Path B, re-run TC-10 against the seeded P&L data to confirm KTA, Baine, Knox PT still generate correct drafts (all three are hourly clients in the seed).
