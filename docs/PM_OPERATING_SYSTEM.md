# Dynamic Billing — PM Operating System

**Project:** Dynamic Billing — Phase 1  
**Client:** P&L Business Services / Lea Ann Sanford  
**Service Provider:** CTA Integrity, LLC  
**Primary PM Workspace:** ChatGPT project folder  
**Developer Workspace:** Claude Code + GitHub  
**Source of Truth for Build Artifacts:** GitHub repo `mrisenmay31/dynamic-billing`  
**Document version:** 1.0  
**Created:** May 22, 2026

---

## 1. Purpose

This document defines how Matt, ChatGPT, Claude Code, GitHub, and client communication will work together to deliver Dynamic Billing Phase 1.

The goal is to keep the project organized, prevent scope drift, and make sure Claude Code receives narrow, executable implementation briefs while ChatGPT acts as project manager, reviewer, strategist, and client-communication assistant.

Dynamic Billing Phase 1 is a custom billing automation tool for P&L Business Services. It pulls billable time entries from QuickBooks Time, applies P&L's grouping and rounding rules, generates a reviewable monthly billing run, and creates/sends approved invoices through QuickBooks Online. Phase 2 payment processing / BillerGenie replacement is intentionally out of scope unless activated later by separate SOW.

---

## 2. Operating Principles

### 2.1 ChatGPT is the project manager, not the developer

ChatGPT is responsible for:

- Maintaining project context
- Converting business goals into milestone plans
- Drafting Claude Code implementation briefs
- Reviewing Claude Code output
- Checking milestone acceptance criteria
- Identifying risks, blockers, and missing decisions
- Drafting client emails and demo agendas
- Preventing Phase 1 from drifting into Phase 2

ChatGPT should not be treated as the primary code-writing environment. Code changes should be made in Claude Code or directly in the repo.

### 2.2 Claude Code is the developer

Claude Code is responsible for:

- Implementing the scoped milestone brief
- Modifying the codebase
- Running local tests/builds where possible
- Producing a clear implementation summary
- Stopping and asking Matt when the brief says not to guess

Claude Code should not make strategic product decisions unless the current milestone brief explicitly gives it authority.

### 2.3 GitHub is the build source of truth

GitHub should hold:

- Code
- Docs
- Claude Code briefs
- Project plan
- PM operating system
- Technical decisions
- Issues / milestones
- PRs / implementation history

ChatGPT can reason from GitHub and project files, but final build artifacts belong in the repo.

### 2.4 The ChatGPT project folder is the PM command center

The ChatGPT project should be used for:

- Asking what to do next
- Reviewing Claude Code outputs
- Drafting new milestone briefs
- Reviewing PR summaries or diffs
- Preparing Lea Ann communication
- Turning client feedback into revised scope
- Maintaining strategic/project-level continuity

---

## 3. Roles and Responsibilities

| Role | Owner | Responsibilities |
|---|---|---|
| Project Owner | Matt | Final decisions, client relationship, access collection, commercial terms, go/no-go decisions |
| Project Manager | ChatGPT | Planning, milestone control, Claude brief creation, acceptance review, risk management, client communications |
| Developer | Claude Code | Code implementation, migrations, UI/backend work, local testing, implementation summaries |
| Client / Pilot User | Lea Ann | Provides access, duplicate lists, workflow feedback, UAT validation, acceptance |
| Optional Client Ops User | Amber | May assist with UAT or duplicate/client workflow feedback if invited later |

---

## 4. Tooling Map

| Tool | Purpose | Rule |
|---|---|---|
| ChatGPT project | PM workspace | Use for planning, review, strategy, client messaging |
| Claude Code | Development execution | Give it narrow briefs, not broad strategy prompts |
| GitHub | Source of truth | Store docs, code, issues, PRs, decisions |
| Vercel | App hosting / cron | Phase 1 hosting and scheduled job execution |
| Supabase | Database/auth/secrets | Multi-tenant data model, RLS, auth, token storage pattern |
| Resend | Email | Test email in M1; real notifications in later milestones |
| Intuit Developer / QB Time | Integrations | M2+ OAuth/API setup; not M1 implementation |

---

## 5. Project Artifacts

All durable project artifacts should live in `/docs` in GitHub.

### Required docs

| Document | Purpose |
|---|---|
| `PROJECT_PLAN.md` | Master Phase 1 project plan and milestone roadmap |
| `PM_OPERATING_SYSTEM.md` | This document; defines how the project is managed |
| `DECISIONS.md` | Running log of project decisions and rationale |
| `RISKS_AND_BLOCKERS.md` | Open blockers, risk register, mitigations |
| `CLIENT_COMMUNICATION_LOG.md` | Summary of important client emails/calls/asks |
| `UAT_PLAN.md` | UAT scripts, pass/fail criteria, test users, test windows |
| `ACCEPTANCE_CHECKLIST.md` | Final Phase 1 acceptance checklist tied to agreement scope |

### Claude Code briefs

Each milestone should have its own brief:

| Brief | Scope |
|---|---|
| `CLAUDE_CODE_BRIEF_M0_M1.md` | Pre-build setup context + M1 foundation implementation |
| `CLAUDE_CODE_BRIEF_M2.md` | OAuth + first real data pull |
| `CLAUDE_CODE_BRIEF_M3.md` | Customer mapping + billing rules |
| `CLAUDE_CODE_BRIEF_M4.md` | Billing run engine + cron |
| `CLAUDE_CODE_BRIEF_M5.md` | Review queue production workflow |
| `CLAUDE_CODE_BRIEF_M6.md` | QBO invoice creation/sending + bulk send |
| `CLAUDE_CODE_BRIEF_M7_M8.md` | UAT, go-live, handoff support |

---

## 6. Milestone Workflow

Each milestone should follow this loop.

### Step 1 — PM planning in ChatGPT

Matt asks ChatGPT to prepare or refine the next milestone plan.

ChatGPT produces:

- Objective
- Scope
- Out of scope
- Key implementation notes
- Files likely affected
- Acceptance criteria
- Stop-and-ask rules for Claude Code
- Demo/client communication plan if applicable

### Step 2 — Claude Code implementation brief

ChatGPT creates a Claude Code brief.

Matt pastes the brief into Claude Code.

The brief must include:

- Exact milestone scope
- What not to do
- Acceptance criteria
- Test expectations
- When Claude should stop and ask
- Any locked technology decisions

### Step 3 — Developer execution

Claude Code implements the brief.

Claude Code should produce an implementation summary including:

- Files changed
- What was implemented
- Tests/builds run
- Known issues
- Deviations from the brief
- Questions or blockers

### Step 4 — PM review in ChatGPT

Matt brings Claude's summary, PR, diff, screenshots, or error logs back to ChatGPT.

ChatGPT reviews against the milestone brief and returns:

- Pass/fail by acceptance criterion
- Bugs or risks
- Missing tests
- Follow-up prompt for Claude Code
- Client-facing summary if appropriate

### Step 5 — Commit/PR/merge discipline

For each milestone:

- Prefer a branch per milestone or sub-milestone
- Use PRs for review if practical
- Merge only after acceptance criteria are satisfied or explicitly deferred
- Update `DECISIONS.md`, `RISKS_AND_BLOCKERS.md`, and milestone docs as needed

---

## 7. Weekly Operating Cadence

### Monday — PM planning

Review:

- Current milestone
- Open blockers
- Client access needs
- Claude Code tasks
- Decisions needed from Matt

Output:

- Weekly priority list
- Claude Code prompt/brief if needed
- Client ask list if needed

### Midweek — Developer check-in

Matt brings ChatGPT:

- Claude progress summary
- Any errors
- Any architectural questions
- Any blockers

Output:

- Decision guidance
- Debugging strategy
- Follow-up Claude prompt

### Friday — Client demo prep

If a Lea Ann demo is scheduled, ChatGPT prepares:

- 15-minute agenda
- What to show
- What feedback to collect
- What not to discuss yet
- Follow-up email

### After client demo — PM debrief

Matt brings notes/transcript/client feedback.

ChatGPT updates:

- Next milestone priorities
- Risks/blockers
- Client communication summary
- Claude Code follow-up prompt

---

## 8. Claude Code Handoff Template

Use this structure whenever giving Claude Code a task.

```md
# Claude Code Task — [Milestone / Task Name]

## Context
[Brief project context and current state]

## Goal
[What should be true after this task]

## Scope
- [Task 1]
- [Task 2]
- [Task 3]

## Out of Scope
- [Explicit non-goals]

## Technical Requirements
- [Stack / patterns / files]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Tests / Validation
- [Commands to run]
- [Manual checks]

## Stop and Ask If
- [Condition 1]
- [Condition 2]

## Output Required
At the end, provide:
- Files changed
- Summary of implementation
- Tests/builds run
- Known issues
- Questions
```

---

## 9. What Matt Should Bring Back to ChatGPT After Each Claude Code Run

At minimum, paste:

1. Claude Code's final summary
2. Any errors or test failures
3. Any files Claude says it changed
4. Any questions Claude raised
5. Screenshots if UI changed
6. PR link or commit hash if available

ChatGPT can then review the work without guessing.

---

## 10. Project Decision Log Rules

Every meaningful decision should be recorded in `DECISIONS.md`.

Examples:

- Stack locked as Next.js + Vercel + Supabase + Supabase Auth + Resend + Vercel Cron
- No Railway in Phase 1 unless Vercel limits force reconsideration
- Magic link only; no password auth
- Matt is the only active auth user in M1
- Lea Ann auth user deferred to M7/UAT
- Multi-tenant database under the hood, no multi-firm UI
- Phase 2 payment processing deferred until after Phase 1 stability
- QBO write lock defaults false and blocks all writes until UAT Pass 2
- Billing month determined by started_at in Eastern Time
- Billable-only launch rule unless approval metadata is available and reliable

Decision log format:

```md
## YYYY-MM-DD — [Decision Title]

**Decision:**  
[What was decided]

**Rationale:**  
[Why]

**Impact:**  
[What this affects]

**Revisit if:**  
[Conditions that would reopen the decision]
```

---

## 11. Risk and Blocker Management

Track all meaningful risks in `RISKS_AND_BLOCKERS.md`.

Risk format:

```md
## [Risk / Blocker Title]

**Status:** Open / Watching / Resolved  
**Severity:** Low / Medium / High  
**Owner:** Matt / ChatGPT / Claude Code / Lea Ann / Vendor  
**Description:**  
[What is the issue]

**Impact:**  
[What happens if unresolved]

**Mitigation / Next Step:**  
[What we are doing]

**Due Date / Review Date:**  
[Date]
```

Current known risks to track:

- Lea Ann access delay delays the Phase 1 build clock
- QB Time API authorization mechanism must be verified
- QB Time Approvals Add-On status unknown
- Full 150–200 invoice bulk send may push serverless limits later
- RLS policies may block legitimate query paths if not tested thoroughly
- QBO write operations must remain disabled until UAT Pass 2

---

## 12. Client Communication Rules

ChatGPT should draft client-facing communication when:

- Asking Lea Ann for access
- Scheduling Friday demos
- Summarizing progress
- Requesting duplicate customer list
- Explaining UAT steps
- Notifying that Phase 1 is ready for acceptance testing
- Requesting the completion payment after acceptance

Tone:

- Friendly
- Clear
- Low-pressure but action-oriented
- Avoid overly technical language unless Lea Ann asks
- Always connect asks to project progress

Example structure for client asks:

```md
Subject: Dynamic Billing — Quick access items needed

Hi Lea Ann,

We’re ready to move into the live setup phase for Dynamic Billing. To keep the build moving, could you help with the following items?

1. QuickBooks Online admin access
2. QuickBooks Time admin/API access
3. Any known duplicate customer records you already know about
4. Whether your QuickBooks Time account has approvals enabled

Once we have those, we can begin testing against your real data instead of the sample prototype data.

Thanks,
Matt
```

---

## 13. Client Demo Format

Default demo length: 15 minutes.

### Demo agenda

1. What changed since last demo — 2 minutes
2. Show the working feature using Lea Ann's data — 8 minutes
3. Ask targeted feedback questions — 3 minutes
4. Confirm next step / next demo — 2 minutes

### Demo rules

- Show real P&L data whenever possible
- Keep demos focused on the current milestone
- Do not introduce Phase 2 unless explicitly relevant
- Avoid showing partially working features unless framed clearly
- Capture exact client wording when she reacts to workflow friction or confusion

### Good demo questions

- Does this match how you think about the billing process?
- What would slow you down here?
- Is anything missing that you would expect to see before approving invoices?
- Would Amber need to see or use this screen?
- Which part would you still feel nervous trusting?

---

## 14. Acceptance Review Process

Before any milestone is considered complete:

1. Compare implemented work against that milestone's acceptance criteria
2. Confirm build/tests pass
3. Confirm no explicit out-of-scope items were added
4. Confirm any decisions made during implementation are logged
5. Confirm any new risks are logged
6. Confirm client communication is prepared if needed

For Phase 1 final acceptance:

- Use `ACCEPTANCE_CHECKLIST.md`
- Confirm UAT Pass 1 read-only validation
- Confirm UAT Pass 2 controlled send
- Confirm no manual CSV upload is required
- Confirm all hourly clients are included or intentionally excluded
- Confirm invoices create/send through QBO
- Confirm Lea Ann can review/edit/skip/retry
- Send written acceptance notice consistent with the agreement

---

## 15. Scope Control Rules

### Phase 1 scope

Allowed:

- QB Time import
- Billable time filtering
- Customer mapping
- Duplicate consolidation
- Monthly billing runs
- Quarter-hour rounding
- Review queue
- Description/hour edits
- High-touch buffer
- QBO invoice creation/sending
- Status tracking
- Email notifications
- Audit/sync logging

### Phase 2 / out of scope

Not allowed in Phase 1:

- Payment processing
- Payment processor selection
- BillerGenie replacement
- Customer-facing payment portal
- Fee pass-through
- ACH or credit card handling
- Reconciliation logic
- TaxDome replacement
- Client intake/onboarding workflows
- Flat-rate profitability analytics
- Multi-firm onboarding UI

If Lea Ann asks about Phase 2, record the request and defer to a separate Phase 2 SOW discussion.

---

## 16. Recommended Next Actions

1. Create or update `DECISIONS.md` with decisions already made.
2. Create `RISKS_AND_BLOCKERS.md` with current known blockers.
3. Create GitHub issues for M0 and M1 tasks.
4. Complete M0 access/setup items.
5. Give Claude Code the M0/M1 brief once Supabase credentials are ready.
6. Bring Claude Code's implementation summary back to ChatGPT for M1 acceptance review.

---

## 17. PM Review Prompts for Matt

Use these prompts in the ChatGPT project:

### To plan the next milestone

> Act as PM for Dynamic Billing. Based on the current project plan, prepare the Claude Code implementation brief for Milestone [X].

### To review Claude Code output

> Act as PM and technical reviewer for Dynamic Billing. Review this Claude Code implementation summary against the Milestone [X] acceptance criteria. Identify gaps, risks, and the exact follow-up prompt I should give Claude Code.

### To prep a client demo

> Prepare a 15-minute Lea Ann demo agenda for the current milestone. Include what to show, what to avoid discussing, and the feedback questions I should ask.

### To update scope after feedback

> Here is Lea Ann's feedback from the demo. Update the project plan impact, identify whether anything is in or out of Phase 1 scope, and draft the next Claude Code follow-up prompt.

---

## 18. Definition of Done for PM Process

The PM process is working if:

- Claude Code always receives narrow, executable briefs
- Matt knows the next action at each stage
- Risks and decisions are logged instead of remembered informally
- Lea Ann gets regular, focused progress updates
- Phase 1 does not drift into payment processing or unrelated features
- Each milestone has clear acceptance criteria before implementation starts
- Every Claude Code run is reviewed before the project moves forward
