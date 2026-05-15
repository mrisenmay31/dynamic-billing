Here's the prompt:

---

**Dynamic Billing — Prototype Build**

**Context**

We are building a prototype called Dynamic Billing for a demo with a real client (Lea Ann Sanford, P\&L Business Services) on May 20, 2026\. The product automates the creation of draft invoices from QuickBooks Time entries. Lea Ann currently spends 2–3 hours per month manually pulling time reports, applying rounding logic, and building invoices one by one in QuickBooks Online. This prototype demonstrates what that process looks like when automated — she opens the app, sees pre-built draft invoices based on her team's time entries, edits anything that needs it, and approves them to send.

**No backend, no API connections, no authentication.** This is a fully hardcoded UI prototype using real April 2026 data that the client already provided. The goal is to make it feel real and production-grade, not to wire up live systems. We will connect to QuickBooks Time and QuickBooks Online APIs after the demo.

---

**Stack**

Use the existing `apps/web/` Next.js 15 app with TypeScript and Tailwind. Build everything as a single route at `/invoices`. No database calls. No API routes. All data is hardcoded in the component or a local data file.

---

**Real Client Data — Hardcode This Exactly**

The following is Lea Ann's actual April 2026 time report for three clients. This is the raw input the system would eventually pull from QuickBooks Time.

**Client 1: Baine & Company** Rate: $125/hr Raw total: 11 hours 53 minutes Rounded total: 12.00 hours (next quarter hour) Invoiced amount: $1,500.00 Default description: `Monthly Bookkeeping Services-2026 recons caught up (1st Quarter)` Time entries:

* 04/10 | Abby N. Townsend | Reviewing bank accounts and statements to make sure they match each other | 0:15  
* 04/17 | Giovanni Sanchez | 2026 categorizing and recon | 1:47  
* 04/20 | Giovanni Sanchez | Bank trans & recon | 3:50  
* 04/22 | Victoria Wyres | Review | 0:47  
* 04/22 | Victoria Wyres | Review, fixes, sending email with questions | 0:50  
* 04/28 | Victoria Wyres | Fixing job costing | 0:32  
* 04/28 | Victoria Wyres | Sending spreadsheet to Tyler, deleting bank rules | 0:10  
* 04/28 | Victoria Wyres | Adding savings accounts 5124 and 5208, fixing transactions in limbo | 1:46  
* 04/28 | Victoria Wyres | Clean up job costing | 0:20  
* 04/28 | Victoria Wyres | Job costing | 1:28  
* 04/29 | Victoria Wyres | Phone call with Tyler | 0:08

**Client 2: Knox Physical Therapy** Rate: $125/hr Raw total: 11 hours 48 minutes Rounded total: 12.00 hours (next quarter hour) Invoiced amount: $1,500.00 Default description: `Monthly Bookkeeping` Time entries:

* 04/01 | Amy Snyder | Payroll | 1:04  
* 04/03 | Amy Snyder | Time entry adjustment, created new workbook for mileage | 0:12  
* 04/07 | Amy Snyder | Updated vacation for employee, sent timesheets to Dr. E for approval | 0:09  
* 04/07 | Amy Snyder | Pulling timesheet for Dr. E approval, sent email to employee re: PTO | 0:24  
* 04/07 | Joseph Broome | PTO log | 0:35  
* 04/08 | Amy Snyder | Entered workbook and time in QBO | 0:45  
* 04/08 | Amy Snyder | Saved reimbursement, resent email to Dr. Easley with timesheets | 0:20  
* 04/09 | Amy Snyder | Payroll | 0:40  
* 04/10 | Amy Snyder | Added PTO for employee | 0:05  
* 04/13 | Amy Snyder | Time entry update for employee | 0:07  
* 04/14 | Amy Snyder | Sent timesheets to KS for approval, workbook | 0:30  
* 04/15 | Amy Snyder | Payroll | 0:55  
* 04/21 | Joseph Broome | PTO logs | 0:20  
* 04/21 | Amy Snyder | Sent timesheets, quarterly multi-location report submitted | 1:31  
* 04/22 | Amy Snyder | Payroll workbook | 0:29  
* 04/22 | Amy Snyder | Checked hours in QBO, submitted, did bank transfer | 0:40  
* 04/23 | Amy Snyder | Finished payroll reports | 0:34  
* 04/30 | Amy Snyder | Finalize payroll, added employee time | 0:44

**Client 3: Knoxville Title Agency LLC** Bill to contact: Chase Reno Rate: $125/hr Raw total: 31 hours 34 minutes Rounded total: 31.75 hours (next quarter hour) Invoiced amount: $3,968.75 Default description: `Monthly Bookkeeping` Time entries:

* 04/01 | Lea A. Sanford | Billing, positive pay | 0:20  
* 04/02 | Amy Snyder | Payroll workbook, garnishment calculation | 0:34  
* 04/02 | Amy Snyder | Looking up medical deduction for employee | 0:16  
* 04/02 | Amy Snyder | Finish processing payroll | 0:46  
* 04/02 | Lea A. Sanford | Positive pay and bill pay | 0:15  
* 04/06 | Lea A. Sanford | March recon and draft financials | 1:09  
* 04/07 | Lea A. Sanford | Positive pay, enter and paying bills | 1:03  
* 04/08 | Amy Snyder | Looking at health insurance deductions | 0:29  
* 04/08 | Amy Snyder | Payroll workbook, garnishment calculation | 0:53  
* 04/08 | Lea A. Sanford | Pos pay, updating financials, reply to Chase's email, bill entering | 2:01  
* 04/09 | Amy Snyder | Resend bonus payroll | 0:22  
* 04/09 | Lea A. Sanford | Positive pay, entering ACH template | 0:06  
* 04/09 | Lea A. Sanford | Payroll with Amy, setting up Jimmy's regular pay | 0:15  
* 04/09 | Amy Snyder | Run payroll | 1:14  
* 04/10 | Amy Snyder | JR ACH payment and GJ entry | 0:22  
* 04/10 | Lea A. Sanford | Positive pay, email/research on return ACH | 0:18  
* 04/13 | Lea A. Sanford | Positive pay, paid bills, email follow-ups | 0:56  
* 04/15 | Joseph Broome | Classification | 2:03  
* 04/15 | Joseph Broome | P\&L classifying | 0:15  
* 04/15 | Lea A. Sanford | Positive pay, bill.com, bank transactions | 0:23  
* 04/16 | Amy Snyder | Payroll with bonus, emails with employee re: W4, process payroll | 2:16  
* 04/16 | Lea A. Sanford | TPP Audit | 0:09  
* 04/16 | Lea A. Sanford | Positive pay, bill pay | 0:36  
* 04/19 | Lea A. Sanford | Q1 financials | 2:08  
* 04/20 | Amy Snyder | Emailing about registered agent letter | 0:14  
* 04/20 | Lea A. Sanford | Work meeting etc. | 2:41  
* 04/21 | Amy Snyder | Processed payroll | 1:12  
* 04/23 | Amy Snyder | ACH for payroll, new employee setup | 1:28  
* 04/24 | Amy Snyder | Positive pay approvals, garnishment release, new employee | 0:49  
* 04/27 | Amy Snyder | Positive pay, updated employee W4 | 0:17  
* 04/30 | Amy Snyder | Payroll workbook | 0:25  
* 04/30 | Lea A. Sanford | ACH and positive pay | 0:59  
* 04/30 | Amy Snyder | Process payroll, added PTO | 1:00

---

**Rounding Logic**

Implement this as a pure utility function `ceilToQuarterHour(totalMinutes: number): number`. Sum all raw entry minutes for a client, then round up to the next quarter hour (0.25 increment). Never round down. If the total is already exactly on a quarter hour, leave it as-is — do not round up unnecessarily.

Verify: 713 minutes (11h 53m) → 12.00 hrs. 708 minutes (11h 48m) → 12.00 hrs. 1894 minutes (31h 34m) → 31.75 hrs.

Amount is always `roundedHours * rate`. Store and calculate as floats for display only — this is a prototype, not a production system handling financial transactions.

---

**What to Build**

A single page at `/invoices` with the following sections:

**1\. Header bar** P\&L Business Services branding. Period label showing "April 2026". A "Generate Drafts" button (non-functional in this prototype — drafts are already shown on load, button just triggers a subtle animation or toast to simulate the generation step). This is a placeholder for what will eventually be the trigger mechanism.

**2\. Summary stats row** Three stat cards: Drafts Ready (count of unsent invoices), Total Hours (sum of all rounded hours across clients), Total Billed (sum of all invoice amounts, updates live as user edits).

**3\. Draft invoice queue** One card per client, ordered by invoice amount descending. Each card has two states: collapsed and expanded.

Collapsed state shows: client name, invoice number, rounded hours \+ rate summary, calculated amount, status badge (DRAFT or SENT).

Expanded state reveals:

* Internal time entries table: date, staff name, note, duration. Clearly labeled as internal — "Not shown on invoice." Scrollable if entries are long.  
* A rounding summary line showing raw total vs. rounded total (e.g. "11h 53m raw → 12.00 hrs billed")  
* Editable fields: client-facing description (textarea, defaults to the standard description for that client), hours billed (number input, step 0.25), hourly rate (number input). Amount recalculates live as hours or rate changes.  
* A note field for internal use (optional, not shown on invoice)  
* "Approve & send to QBO" button per card. When clicked, marks that invoice as sent, changes badge to SENT, disables the button, and shows a toast notification.

**4\. Bottom action bar** Shows the running total of unsent invoices and an "Approve & send all" button that approves all remaining drafts at once.

---

**Design Direction**

Match the visual style already established in the prototype mockup: clean and professional with P\&L's green brand color as the primary accent (`#2D6A4F` primary green, `#40916C` mid green, `#52B788` light green, `#D8F3DC` pale green). Use `DM Serif Display` for client names and headings, `DM Sans` for body and UI, `DM Mono` for all numbers, hours, and amounts. Load these from Google Fonts. Neutral grays for borders and surfaces. Amber (`#E76F51`) for the DRAFT badge only. This should look like something a real accounting SaaS would ship — not a demo.

---

**Behavior Requirements**

* Editing hours or rate on any card recalculates that card's amount and updates the running total in the stats row and bottom bar simultaneously  
* Approving an individual invoice decrements the "Drafts Ready" count and removes that card's amount from the running total  
* "Approve & send all" processes all remaining drafts  
* A toast notification confirms each approval action  
* Collapsed cards are the default state. Clicking the card header toggles expanded/collapsed  
* The time entries section inside each expanded card is scrollable — do not let it push the page layout  
* All editable fields should feel responsive and intentional — not like raw HTML inputs. Style them to match the overall design

---

**What Not to Build**

Do not build authentication, API routes, database queries, or any connection to QuickBooks Time or QuickBooks Online. Do not build the settings page, history page, or worker process. Do not build a mapping UI. This prototype is scoped to the invoice review queue only. Everything else comes after the May 20 demo.

---

**Deliverable**

A working `/invoices` page in `apps/web/src/app/invoices/page.tsx` (and any supporting component files) that a non-technical client can use in a browser during a live demo call without anything breaking. It should run with `next dev` with no additional setup beyond what's already in the repo.

