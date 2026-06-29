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

Current state (see handoff): main = integration = 7304ff6, fully deployed to prod. LIVE:
empty-state fixes, Path B, sweep (B-05), Path A per-entry billable (B-07), role gating, B-08
over-billing fix, and the super-admin firm-switcher (backend + UI + cross-firm read RLS
policies). P&L (Lea Ann) is onboarded live — QBO + QB Time connected, ~1,115 June entries
synced, her billable custom field 1701272 resolved by Path A. She bills July 1.

Immediate next = P&L first-billing validation. I'm waiting on Lea Ann's reply to the follow-up
email (dry-run-logs/lea-ann-followup-email.md) on two open questions: (1) which clients bill at
non-$125 rates (data shows $75/$100 clients in custom field 1933334), and (2) how to treat ~104
blank-billable entries (mixed PTO/internal vs real client work). Once she replies and sends her
full June QB Time report: run the per-client reconciliation (billable-only totals, billable-flag
match, rounding, mapping completeness, duplicate merges), set per-client hourly_rate_override for
the non-$125 clients, regenerate June drafts, confirm — all before she sends a single invoice.

Firms: CTA Integrity 0a2a776d-27f8-494c-91a3-834d0698bee8 (my test firm); P&L Business Services
00000000-0000-0000-0000-000000000001 (LIVE pilot — active, just firm-scope all SQL, never run
destructive unscoped statements). Supabase vvmfbtvxsjeyrmsqodon. Open backlog: exclude_from_billing
UI toggle, B-06 regenerate idempotency, TC-14 bulk-send scale, mapping-dropdown polish; CTA
dry-run TC-11/12/13/14/15/18/19 secondary to the live P&L run.

Here's my status right now: <paste Lea Ann's reply / her June report / latest agent output>
```
