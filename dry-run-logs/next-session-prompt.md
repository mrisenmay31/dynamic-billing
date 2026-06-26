# Next-Session Resume Prompt (advisor)

> Saved so it isn't lost if the current thread closes. Paste the block below into a fresh
> Claude session to resume the ClockToBill dry-run advisor. Fill in the final status line.
> Canonical state lives in `dry-run-logs/advisor-handoff.md`.

```
Resume as my ClockToBill onboarding dry-run advisor, advise-only mode. Read, in order:
dry-run-logs/advisor-handoff.md, ONBOARDING-DRY-RUN-TEST-PLAN.md (§7 + Appendices A and C),
and dry-run-logs/*.md. CLAUDE.md is auto-loaded.

Your role: triage dry-run issues, write grounded fix/investigation prompts for my terminal
agents (investigations → Agent 1; code → Agent 2+ by disjoint file set), regression-check
their diffs, perform lane→integration merges, and run read-only / CTA-scoped SQL via Supabase
MCP to verify. You may merge/deploy to main ONLY on my explicit per-deploy instruction. I run
the agents and paste results back; relay at decision points only.

Current state (see handoff): the full fix bundle is DEPLOYED and LIVE — main = integration =
494e1bd (empty states, Path B, Path A, role gating, sweep, badge color, settings fix). Path A
is verified live at the time_entries level (95 Yes / 4 No, 0 mismatches). June invoice_drafts
are STALE (generated under old code, still over-billed) and need a regenerate. (Note: docs may
be 1+ commits ahead of main on the integration branch — markdown only, no app impact.)

Immediate next task: the SWEEP DELETE-TEST (B-05 live verification) — prove QB Time is the
master of truth. Recommended zero-impact method: delete one non-billable "No" entry in CTA's
QB Time, Sync Now (June), then verify via SQL + integration_sync_logs that the orphan is gone
and the sync log shows swept:1 / protected:0. Start by pulling that entry's qb_time_entry_id
so I know which one to delete.

After the sweep test: regenerate June drafts (you run the CTA-scoped run+draft cleanup; I click
Generate Drafts) and confirm billable-only targets — Greenleaf 3.00/$375, Ironclad 2.50/$312.50,
Mesa Verde 2.50/$312.50; P&L unchanged (Baine 12.00, Knox PT 12.00, Knoxville Title 31.75).
Then continue TC-11, TC-12 (real send), TC-13/14/15, TC-18, TC-19.

Test firm CTA Integrity 0a2a776d-27f8-494c-91a3-834d0698bee8; Supabase vvmfbtvxsjeyrmsqodon;
do NOT touch P&L 00000000-0000-0000-0000-000000000001.

Here's my status right now: <fill in — e.g. "ready to start the sweep test" or paste results>
```
