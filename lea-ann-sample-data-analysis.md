# Sample Data Analysis — Lea Ann Sanford / P&L Business Services
**Prepared by:** CTA Integrity / Matt Risenmay
**Date:** May 14, 2026
**Source materials:** Email from leaann@pandlbusinessservices.com, May 13, 2026 (thread: "Re: Billing Workflow Info"); attachments: P&L Client Time Entires.xlsx, Invoice 5101.pdf, Invoice 5138.pdf, Invoice 5141.pdf

---

## 1. Email Summary

Lea Ann responded same-day with all requested materials and added two important pieces of context unprompted:

> *"As far as logic, 99% of the time it's rounding to the next quarter of an hour. I have about 5 clients that call ALL the time and will come by frequently 'quick questions', I usually round them based on the time they spent here, I don't usually add more than 15-45 minutes, with 45 minutes being a rarity."*

> *"Because I should already know this...I pulled the BillerGenie amount I pay (see snip below). I pay for the premium plan so it will sync to QBO so I don't have to monkey around with that."*

She did not redact client names: *"I didn't redact, I trust you won't share this."*

---

## 2. Time Report Structure

**Report type:** Time Activities by Client Detail — April 2026
**Source:** QuickBooks Time (QBO Timekeeping)
**Export format:** Excel (.xlsx)

### Column structure
| Column | API equivalent | Notes |
|---|---|---|
| Activity date | `timesheet.date` | Entry date, not week-end date |
| Employee | `supplemental_data.users[user_id].name` | Multiple staff per client |
| Product/Service full name | `jobcode` product type | Always "Hourly Accounting services" |
| Description | `timesheet.notes` | Free-text staff notes — internal only, NOT put on invoice |
| Rates | Hourly rate | Always $125 |
| Duration | `timesheet.duration` (converted from seconds) | Displayed as HH:MM |
| Billable (Y/N) | `timesheet.billable` | All entries in this report: Yes |
| Amount | Computed (rate × raw decimal hours) | Pre-rounding, non-integer |

### April 2026 data — three clients

**Baine & Company**
- 11 time entries | 3 staff (Abby Townsend, Giovanni Sanchez, Victoria Wyres)
- Raw total: 11h 53m | System-computed pre-rounding amount: $1,485.43
- Entry types: bank account reviews, categorizing, recon, job costing, client communication

**Knox Physical Therapy**
- 22 time entries | 2 staff (Amy Snyder, Joseph Broome)
- Raw total: 11h 48m | System-computed pre-rounding amount: $1,475.00
- Entry types: payroll processing, timesheet management, PTO, workbooks — high-frequency, small-duration entries

**Knoxville Title Agency LLC**
- 44 time entries | 4 staff (Lea Sanford, Amy Snyder, Joseph Broome, Amber Sanchez)
- Raw total: 31h 34m | System-computed pre-rounding amount: $3,945.68
- Entry types: pos pay, bill pay, payroll, ACH, recon, financials, meeting — Lea Ann personally logged time on this client

---

## 3. Invoice Structure Confirmed

All three invoices follow the same structure:

| Field | Value | Notes |
|---|---|---|
| Invoice date | 05/01/2026 | 1st of the month following the billing period |
| Due date | 05/06/2026 | 5 days after invoice date |
| Product/Service | Hourly Accounting services | Same item name across all clients |
| Description | "Monthly Bookkeeping" (or custom) | Short, human-readable; no raw notes |
| Qty | Ceiling-rounded hours | See Section 4 |
| Rate | $125.00 | Uniform across all clients |
| Amount | Qty × Rate | Exact match required |
| Terms | Due on receipt | Standard |

### Description pattern
- Default: **"Monthly Bookkeeping"** — used as-is for 2 of 3 sample invoices
- Custom: **"Monthly Bookkeeping Services-2026 recons caught up (1st Quarter)"** — used for Baine & Company, a client with catch-up work in April
- The description does NOT reference the month by name or include the invoice date; the invoice date itself establishes the billing period

### QBO item name
`Hourly Accounting services` — this is the exact string that must match the `ItemRef` lookup in QBO when creating invoices via API.

---

## 4. Rounding: Confirmed CEILING (corrects briefing)

**The briefing doc said "nearest quarter hour" — this is incorrect.**

Lea Ann's email is explicit: *"rounding to the next quarter of an hour."*  
The invoice data proves it:

| Client | Raw hours | Nearest 0.25 | Ceiling 0.25 | Invoiced |
|---|---|---|---|---|
| Baine & Company | 11h 53m = 11.883 hrs | **11.75** | **12.00** | **12.00** ✓ |
| Knox Physical Therapy | 11h 48m = 11.800 hrs | **11.75** | **12.00** | **12.00** ✓ |
| Knoxville Title Agency | 31h 34m = 31.567 hrs | **31.50** | **31.75** | **31.75** ✓ |

All three confirm ceiling rounding. The nearest-quarter formula would have produced different results for the first two clients.

**Implementation formula:** `ceil(total_seconds / 900) * 0.25` where 900 = 15 minutes in seconds.

---

## 5. High-Maintenance Client Buffer

Lea Ann manually adds 15–45 minutes (rarely more) to ~5 clients who call frequently and drop by with "quick questions." This time is not logged in QB Time — it is added during her manual review of the invoices.

**Key constraints:**
- No system flag or tag identifies these clients in QBO or QB Time — she knows them by name only
- The buffer is applied at billing time, not logged as a time entry
- It is intentionally off the books from a tracking perspective — she doesn't want to formalize it

**Design implication:** The review queue must expose an editable hours field per client draft. The pre-populated default is the ceiling-rounded total from QB Time. Lea Ann bumps the number up during review for these clients. The system recalculates amount = edited_hours × $125 before she approves.

---

## 6. BillerGenie: No API Integration Needed

Lea Ann pays for the **BillerGenie Premium plan**, which includes automatic QBO sync. Any invoice created in QBO is automatically mirrored in BillerGenie. Her clients pay via the BillerGenie portal; auto-pays hit on the 6th of the month.

**This eliminates BillerGenie as an integration concern.** The Dynamic Billing system only needs to interact with QBO — BillerGenie picks up the invoices on its own once they exist in QBO.

---

## 7. Feasibility Verdict

**High confidence — no technical blockers identified.**

| Requirement | Feasibility | Notes |
|---|---|---|
| Pull time data from QB Time | ✓ Confirmed | REST API available; `GET /timesheets` with `supplemental_data=yes` |
| Aggregate by client across multiple staff | ✓ Confirmed | Simple group-by on `jobcode_id`; sum `duration` in seconds |
| Ceiling-round to 0.25 hrs | ✓ Confirmed | Single arithmetic operation |
| Map QB Time jobcodes → QBO customer IDs | ⚠ Requires setup | Name-matching + manual confirmation at onboarding |
| Create draft invoice in QBO | ✓ Confirmed | `POST /invoice` with `EmailStatus: "NotSet"`; hold in DB until approved |
| Single line item with custom description | ✓ Confirmed | `SalesItemLineDetail` with short description field |
| Editable review queue before send | ✓ Confirmed | UI layer; standard CRUD on draft invoice records |
| Manual buffer time for VIP clients | ✓ Confirmed | Editable hours field in review queue |
| BillerGenie sync | ✓ Handled automatically | Premium plan syncs from QBO; no separate API needed |

The only non-trivial setup step is the jobcode-to-customer mapping at onboarding, which is a one-time configuration task per firm.

---

## 8. Open Questions for May 20 Call

These must be confirmed with Lea Ann before building:

1. **Invoice date logic** — the three sample invoices are all dated 05/01/2026. Is the invoice date always the 1st of the following month, or does she set it manually? This determines whether the system auto-populates the date.

2. **Billing trigger** — does she want to click "generate drafts" manually when she's ready, or would she want drafts automatically prepared on the 1st of each month?

3. **QB Time Approvals Add-On** — does her account have it enabled and does her team use the approval workflow? This is required for the approval-filter logic (`timesheet.date ≤ user.approved_to`). If not enabled, we need a fallback (user-specified cutoff date).

4. **QBO item lookup** — the invoices show "Hourly Accounting services" as the line item. We need to confirm the exact QBO Item ID for this item during onboarding. Does she have multiple service items, or is this the only one used for bookkeeping?

5. **Flat-rate clients** — she mentioned "a small handful" on flat rate. Do these clients appear in the QB Time export with time entries logged, or are they billed a fixed amount regardless? If they appear in QB Time, the system needs to know to skip them or handle them differently.

6. **Multiple billing rates** — all three sample invoices show $125/hr uniformly. Is $125 the single rate for all hourly clients, or do some clients have different rates?

---

## 9. Recommended Prototype Scope for May 20 Demo

Given confirmed feasibility, a working prototype for the May 20 call should demonstrate:

1. Load the April 2026 time report (or a simulated QB Time API response)
2. Aggregate total seconds per client across all staff
3. Apply ceiling rounding to 0.25 hrs
4. Generate a draft invoice card per client showing: client name, hours, amount, editable description
5. Allow editing the hours field (simulating the VIP buffer adjustment)
6. Show the final QBO invoice JSON payload that would be submitted

This doesn't require live API connections yet — a static demo using Lea Ann's actual data is enough to validate the concept on May 20.
