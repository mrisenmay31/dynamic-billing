-- Dynamic Billing — Seed Data (April 2026 Sample)
-- P&L Business Services pilot data matching the prototype's TEMPLATES constant.
--
-- ⚠️  WARNING: DO NOT run `supabase db reset --linked` against the remote project.
--    That command drops and recreates the entire remote database, wiping all data.
--    To apply this seed to remote, use (from apps/web/):
--      supabase db query --linked -f supabase/seed.sql
--
-- Fixed UUIDs used for predictable references in dev/test:
--   Firm:        00000000-0000-0000-0000-000000000001
--   KTA:         00000000-0000-0000-0000-000000000010
--   Baine:       00000000-0000-0000-0000-000000000011
--   Knox PT:     00000000-0000-0000-0000-000000000012
--   Billing run: 00000000-0000-0000-0000-000000000020

-- ─── Firm ────────────────────────────────────────────────────────────────────

insert into firms (id, name, qbo_write_enabled, timezone, default_hourly_rate,
                   default_invoice_description, default_invoice_product_service,
                   default_due_days_after_invoice)
values (
  '00000000-0000-0000-0000-000000000001',
  'P&L Business Services, LLC',
  false,
  'America/New_York',
  125.00,
  'Monthly Bookkeeping',
  'Hourly Accounting services',
  5
)
on conflict (id) do nothing;

-- ─── Customers ───────────────────────────────────────────────────────────────

insert into customers (id, firm_id, display_name, invoice_description_override, is_high_touch)
values
  ('00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000001',
   'Knoxville Title Agency LLC', null, false),
  ('00000000-0000-0000-0000-000000000011',
   '00000000-0000-0000-0000-000000000001',
   'Baine & Company',
   'Monthly Bookkeeping Services-2026 recons caught up (1st Quarter)', false),
  ('00000000-0000-0000-0000-000000000012',
   '00000000-0000-0000-0000-000000000001',
   'Knox Physical Therapy', null, false)
on conflict (id) do nothing;

-- ─── Time Entries — Knoxville Title Agency LLC (52 entries, 1894 raw minutes) ─

insert into time_entries
  (firm_id, customer_id, qb_time_entry_id, staff_name, started_at, duration_seconds, is_billable, notes, rate_used)
values
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-001','Lea A. Sanford','2026-04-01 09:00:00-04',600,true,'billing',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-002','Lea A. Sanford','2026-04-01 09:30:00-04',600,true,'pos pay',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-003','Amy Snyder','2026-04-02 09:00:00-04',2040,true,'Payroll workbook and calculated garnishment-still have a Q before finalizing',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-004','Amy Snyder','2026-04-02 09:45:00-04',960,true,'Looking up medical deduction/contribution for employee and making changes',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-005','Amy Snyder','2026-04-02 10:15:00-04',2760,true,'Finish processing payroll',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-006','Lea A. Sanford','2026-04-02 09:00:00-04',900,true,'pos pay and bill pay',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-007','Lea A. Sanford','2026-04-03 09:00:00-04',240,true,'pos pay',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-008','Lea A. Sanford','2026-04-06 09:00:00-04',4140,true,'March recon and draft financials',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-009','Amy Snyder','2026-04-06 09:00:00-04',1200,true,'Setting up this weeks workbook so that I could add CR reimbursement to it.',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-010','Lea A. Sanford','2026-04-07 09:00:00-04',3780,true,'POS PAY, ENTER AND PAYING BILLS',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-011','Amy Snyder','2026-04-07 09:00:00-04',720,true,'Checking to see if I had to file qtrly returns-but they are set up on auto',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-012','Amy Snyder','2026-04-08 09:00:00-04',1740,true,'looking at the health insurance deductions',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-013','Amy Snyder','2026-04-08 09:30:00-04',3180,true,'Payroll workbook-have a deduction question before finishing. Garnishment calculation',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-014','Lea A. Sanford','2026-04-08 09:00:00-04',7260,true,'pos pay, updating financials and replying to chase''s email, phone call, bill entering',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-015','Amy Snyder','2026-04-09 09:00:00-04',1320,true,'Resend the bonus payroll',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-016','Lea A. Sanford','2026-04-09 09:00:00-04',360,true,'pos pay and entering reginique to his ACH template',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-017','Lea A. Sanford','2026-04-09 09:10:00-04',900,true,'payroll with amy, setting up jimmy''s regular pay',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-018','Amy Snyder','2026-04-09 09:30:00-04',4440,true,'Run payroll',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-019','Amy Snyder','2026-04-09 11:00:00-04',2220,true,'Looking at the time for KP and giving my explanation on the pay. Bonus payroll',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-020','Amy Snyder','2026-04-10 09:00:00-04',1320,true,'JR ACH payment and GJ entry to go with it',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-021','Lea A. Sanford','2026-04-10 09:00:00-04',1080,true,'pos pay, email/research on return ach',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-022','Lea A. Sanford','2026-04-13 09:00:00-04',3360,true,'pos pay, paid bills, email follow ups',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-023','Lea A. Sanford','2026-04-14 09:00:00-04',120,true,'pos pay',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-024','Joseph Broome','2026-04-15 09:00:00-04',7380,true,'classification',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-025','Joseph Broome','2026-04-15 11:15:00-04',900,true,'p&L classifying',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-026','Lea A. Sanford','2026-04-15 09:00:00-04',1380,true,'pos pay, bill.com, bank transactions,',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-027','Amy Snyder','2026-04-16 09:00:00-04',8160,true,'Talked to BP on the phone, back and forth emails with BP about employee info and KP about w4 adjustments. needed to confirm a bonus. Process payroll',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-028','Lea A. Sanford','2026-04-16 09:00:00-04',540,true,'TPP Audit',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-029','Lea A. Sanford','2026-04-16 09:15:00-04',2160,true,'pos pay, bill pay',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-030','Amy Snyder','2026-04-17 09:00:00-04',600,true,'Positive pay',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-031','Amy Snyder','2026-04-17 09:15:00-04',1560,true,'ACH payment and entered into QBO',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-032','Amy Snyder','2026-04-17 09:45:00-04',720,true,'AS said a positive pay had come via email-checked the bank account and nothing there. Reminder from earlier today?',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-033','Lea A. Sanford','2026-04-19 09:00:00-04',7680,true,'Q1 financials',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-034','Amber L. Sanchez','2026-04-20 09:00:00-04',840,true,'emailing about registered agent letter.',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-035','Amy Snyder','2026-04-20 09:00:00-04',420,true,'added CR reimbursement to the workbook',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-036','Lea A. Sanford','2026-04-20 09:00:00-04',9660,true,'work meeting etc',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-037','Amy Snyder','2026-04-21 09:00:00-04',4320,true,'Processed the payroll-but did not do the ACH yet-waiting till late tomorrow in case of changes',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-038','Amy Snyder','2026-04-21 10:15:00-04',120,true,'more emails came about positive pay, checked bank account but nothing is showing',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-039','Amy Snyder','2026-04-21 10:20:00-04',1260,true,'Looking into the positive pay and why they are not showing up',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-040','Amy Snyder','2026-04-23 09:00:00-04',5280,true,'ACH for payroll, look up a few items for CR, pulled new employee info and entered new employee',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-041','Amy Snyder','2026-04-24 09:00:00-04',1260,true,'Logged in to make sure that no positive pays needed to be approved, looked at employee''s adjusted W4-have questions as I do not think it is completed correctly. I sent her an email',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-042','Amy Snyder','2026-04-24 09:30:00-04',2940,true,'Positive pay approvals, saved a copy of garnishment release and sent to CR & BP then mailed original to the employee per CR request, changed new employees email and resent invite,',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-043','Amy Snyder','2026-04-25 09:00:00-04',360,true,'helping employee update their W4',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-044','Amy Snyder','2026-04-27 09:00:00-04',420,true,'check for positive pay as an email came through-none there. Updated employee W4 withholding',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-045','Amy Snyder','2026-04-27 09:10:00-04',600,true,'Positive pay, large amount asked CR for approval',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-046','Amy Snyder','2026-04-27 09:25:00-04',120,true,'Checked to see if any positive pays needed approval-none',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-047','Amy Snyder','2026-04-28 09:00:00-04',240,true,'checking for positive pay-none',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-048','Amy Snyder','2026-04-29 09:00:00-04',180,true,'check for any positive pay',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-049','Amy Snyder','2026-04-29 09:05:00-04',660,true,'Checking for any positive pays that need approved, added a couple of expenses to be reimbursed to the workbook',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-050','Amy Snyder','2026-04-30 09:00:00-04',1500,true,'payroll workbook',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-051','Lea A. Sanford','2026-04-30 09:00:00-04',3540,true,'ACH and pos pay',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','seed-kta-052','Amy Snyder','2026-04-30 09:30:00-04',3600,true,'Process payroll, added PTO to everyone',125);

-- ─── Time Entries — Baine & Company (11 entries, 713 raw minutes) ─────────────

insert into time_entries
  (firm_id, customer_id, qb_time_entry_id, staff_name, started_at, duration_seconds, is_billable, notes, rate_used)
values
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','seed-baine-001','Abby N. Townsend','2026-04-10 09:00:00-04',900,true,'reviewing bank accounts and statements to make sure they match each other',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','seed-baine-002','Giovanni Sanchez','2026-04-17 09:00:00-04',6420,true,'2026 categorizing and recon.',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','seed-baine-003','Giovanni Sanchez','2026-04-20 09:00:00-04',13800,true,'bank trans & recon',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','seed-baine-004','Victoria Wyres','2026-04-22 09:00:00-04',2820,true,'review',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','seed-baine-005','Victoria Wyres','2026-04-22 09:50:00-04',3000,true,'review, fixes, sending email with questions',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','seed-baine-006','Victoria Wyres','2026-04-28 09:00:00-04',1920,true,'fixing job costing',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','seed-baine-007','Victoria Wyres','2026-04-28 09:35:00-04',600,true,'sending spreadsheet to tyler. deleting bank rules',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','seed-baine-008','Victoria Wyres','2026-04-28 09:50:00-04',6360,true,'ADDING SAVINGS 5124 AND JAN - MAR, ADDING SAVINGS 5208 RECON MAR. FIXING TRANSACTIONS THAT WERE IN LIMBO WAITING ON THESE ACCOUNTS TO BE ADDED. fixing ask my acc',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','seed-baine-009','Victoria Wyres','2026-04-28 12:00:00-04',1200,true,'clean up job costing',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','seed-baine-010','Victoria Wyres','2026-04-28 12:25:00-04',5280,true,'job costing',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','seed-baine-011','Victoria Wyres','2026-04-29 09:00:00-04',480,true,'phone call with tyler',125);

-- ─── Time Entries — Knox Physical Therapy (25 entries, 708 raw minutes) ────────

insert into time_entries
  (firm_id, customer_id, qb_time_entry_id, staff_name, started_at, duration_seconds, is_billable, notes, rate_used)
values
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-001','Amy Snyder','2026-04-01 09:00:00-04',3840,true,'Payroll',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-002','Amy Snyder','2026-04-03 09:00:00-04',720,true,'Time entry adjustment, created new workbook for next week to add in mileage so I dont forget',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-003','Amy Snyder','2026-04-07 09:00:00-04',540,true,'Updated the vacation for employee, sent timesheets to Dr. E for approval',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-004','Amy Snyder','2026-04-07 09:15:00-04',1440,true,'Was pulling timesheet for Dr. E approval but (1) was missing. Sent email to employee & Dr. E to see if he was on vacation last week and need to use his PTO. Worked on workbook',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-005','Joseph Broome','2026-04-07 09:00:00-04',2100,true,'pto log',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-006','Amy Snyder','2026-04-08 09:00:00-04',2700,true,'Entered work book and the time in QBO-still need approval on (2) reimbursements before finishing',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-007','Amy Snyder','2026-04-08 09:45:00-04',1200,true,'Saved reimbursement and resent email to Dr. Easley with timesheets & reimbursement. Time entry adjustment',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-008','Amy Snyder','2026-04-09 09:00:00-04',2400,true,'Payroll',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-009','Amy Snyder','2026-04-10 09:00:00-04',300,true,'Added PTO for employee',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-010','Amy Snyder','2026-04-10 09:10:00-04',300,true,'Time entry change for an employee',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-011','Amy Snyder','2026-04-13 09:00:00-04',420,true,'Time entry update for an employee',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-012','Amy Snyder','2026-04-14 09:00:00-04',1800,true,'Sent timesheets to KS for approval, workbook',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-013','Amy Snyder','2026-04-15 09:00:00-04',3300,true,'Payroll',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-014','Joseph Broome','2026-04-21 09:00:00-04',1200,true,'pto logs',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-015','Amy Snyder','2026-04-21 09:00:00-04',5460,true,'Sent Dr. E timesheets for approval, qtrly muti location report submitted, checked some of the PTO hours',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-016','Amy Snyder','2026-04-22 09:00:00-04',660,true,'Time entry changes',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-017','Amy Snyder','2026-04-22 09:15:00-04',1740,true,'Payroll workbook',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-018','Amy Snyder','2026-04-22 09:45:00-04',2400,true,'Checked the hours in QBO & submitted, did bank transfer',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-019','Amy Snyder','2026-04-23 09:00:00-04',2040,true,'Finished payroll reports',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-020','Amy Snyder','2026-04-24 09:00:00-04',420,true,'Clocked in employee and removed the incorrect notes from her timesheets',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-021','Amy Snyder','2026-04-27 09:00:00-04',900,true,'Pulled timesheets for Dr. E to approve and sent to him',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-022','Amy Snyder','2026-04-28 09:00:00-04',660,true,'Update pay amounts per LE email',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-023','Amy Snyder','2026-04-28 09:15:00-04',1500,true,'Time entry adjustment for employee, created workbook for this weeks payroll',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-024','Amy Snyder','2026-04-29 09:00:00-04',1800,true,'Entered times into QBO-still need 1 approval before finalizing',125),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','seed-kpt-025','Amy Snyder','2026-04-30 09:00:00-04',2640,true,'Finalize payroll, added employee time',125);

-- ─── Billing Run ─────────────────────────────────────────────────────────────

insert into billing_runs
  (id, firm_id, billing_month, status, trigger, generated_at, invoice_count, total_amount)
values (
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000001',
  '2026-04-01',
  'ready_for_review',
  'manual',
  now(),
  3,
  6968.75
)
on conflict (id) do nothing;

-- ─── Invoice Drafts ───────────────────────────────────────────────────────────

insert into invoice_drafts
  (firm_id, billing_run_id, customer_id, status,
   raw_hours, rounded_hours, hourly_rate, total_amount,
   description, qbo_invoice_number, qbo_idempotency_key)
values
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000010',
    'needs_review',
    31.5667, 31.75, 125.00, 3968.75,
    'Monthly Bookkeeping',
    '5141',
    'seed-idempotency-kta-apr-2026'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000011',
    'needs_review',
    11.8833, 12.00, 125.00, 1500.00,
    'Monthly Bookkeeping Services-2026 recons caught up (1st Quarter)',
    '5101',
    'seed-idempotency-baine-apr-2026'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000012',
    'needs_review',
    11.8000, 12.00, 125.00, 1500.00,
    'Monthly Bookkeeping',
    '5138',
    'seed-idempotency-kpt-apr-2026'
  );
