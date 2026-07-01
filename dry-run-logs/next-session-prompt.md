# Next-Session Resume Prompt (advisor)

> Saved so it isn't lost if the current thread closes. Paste the block below into a fresh
> Claude session to resume the ClockToBill advisor. Fill in the final status line.
> Canonical state lives in `dry-run-logs/advisor-handoff.md`.

```
Resume as my ClockToBill onboarding/build advisor, advise-only mode. Read, in order:
dry-run-logs/advisor-handoff.md, ONBOARDING-DRY-RUN-TEST-PLAN.md (§7 + Appendices A and C),
and dry-run-logs/*.md. CLAUDE.md is auto-loaded.

Your role: triage issues, write grounded fix/investigation prompts for my terminal agents
(investigations → Agent 1; code → Agent 2+ by disjoint file set; InvoicesClient.tsx is
single-writer; agents branch off the CURRENT integration tip), regression-check every diff
before merge, perform lane→integration merges, run SQL via Supabase MCP, and apply migrations.
I run the agents and paste results back; relay at decision points only. Merge/deploy to `main`
ONLY on my explicit per-deploy instruction, always from the remote integration ref
origin/claude/cta-integrity-onboarding-test-7tazih.

Current state (see handoff 2026-07-01 section): main = integration = b94ad9e, deployed to prod.
LIVE: empty-state fixes, Path B, sweep (B-05), Path A per-entry billable (B-07), role gating, B-08
over-billing fix, super-admin firm-switcher, AND the AP-03 display-rate fix. P&L (Lea Ann) June
FIRST BILLING is prepared and verified: reconciled against her QBO report (69/76 clients exact),
11 rate overrides set (hourly_rate_override: $75 ×10, $100 ×1 Catamount), P&L Admin excluded
(exclude_from_billing), June drafts GENERATED + verified (run 092461f6, 74 invoices / $45,987.50 /
394.25 rounded hrs), and the Billing Run/Queue display now shows each client's real rate (was
firm-default $125 for all). Per-client preview: dry-run-logs/june-billing-preview.csv.

Immediate next = Lea Ann reviews the corrected prod numbers and SENDS June in batches (small
batches, not one 74-wide Promise.all burst — TC-14 rate-limit risk). Before sending Copper Peaks,
confirm with her it's one client (app maps Copper Peaks Solutions + COPPER PEAKS LLC → one invoice,
9.50h/$1,187.50). After June ships: (a) reconcile AP-02 self-serve rate editor on top (parked branch
claude/client-rate-editor, unpushed — decouple so Client Rules uses hourly_rate_override in its own
state, queue keeps draft.hourly_rate); (b) diff-review + merge AP-01 pagination (parked branch
claude/fix-time-entries-rowcap, pushed, removes ~1,000-row cap); (c) Matt to rotate his super-admin
password (an agent briefly swapped his hash during AP-01 testing — see feedback memory). Staged
prompts: dry-run-logs/agent-prompts.md (AP-01/02/03).

Firms: CTA Integrity 0a2a776d-27f8-494c-91a3-834d0698bee8 (my test firm); P&L Business Services
00000000-0000-0000-0000-000000000001 (LIVE pilot — active, just firm-scope all SQL, never run
destructive unscoped statements). Supabase vvmfbtvxsjeyrmsqodon. Open backlog: sync-follows-selected-
month (handleSyncNow hardcodes wall-clock month — June couldn't be re-synced from the UI on July 1;
worked around via console POST with June range); AP-01 pagination; AP-02 rate editor; exclude_from_billing
UI toggle; B-06 regenerate idempotency; TC-14 bulk-send scale; mapping-dropdown polish; CTA dry-run
TC-11/12/13/14/15/18/19 secondary to the live P&L run.

Here's my status right now: <paste prod-check result / Lea Ann's send results / latest agent output>
```
