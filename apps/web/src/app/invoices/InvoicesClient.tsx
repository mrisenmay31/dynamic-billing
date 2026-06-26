"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Clock,
  Settings2,
  Settings,
  ArrowRight,
  Search,
  X,
  ChevronDown,
  ArrowUpDown,
  Link2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Lock,
  Menu,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */
type InvoiceStatus = "in_review" | "sent";

interface TimeEntry {
  date: string;
  staff: string;
  note: string;
  duration: string;
}

interface InvoiceTemplate {
  id: string;
  draftId: string;
  client: string;
  billTo?: string;
  invoiceNum: string;
  rawMinutes: number;
  defaultDescription: string;
  sent: boolean;
  entries: TimeEntry[];
}

interface InvoiceState {
  hours: number;
  rate: number;
  internalNote: string;
  expanded: boolean;
  status: InvoiceStatus;
  adjustmentReason: string;
}

interface FlatEntry {
  client: string;
  date: string;
  employee: string;
  productService: string;
  description: string;
  duration: string;
  rate: number;
  billable: string;
  amount: number;
}

// Raw time-entry row for the All Time Entries view. Sourced directly from the
// time_entries table (not from billing-run drafts), so it reflects everything
// synced from QB Time regardless of whether a billing run exists.
export interface TimeEntryRow extends FlatEntry {
  month: string; // 'YYYY-MM' — drives the month selector
  isMapped: boolean; // false when the jobcode isn't linked to a customer yet
}

interface Toast {
  id: string;
  message: string;
}

type NavView = "billing-run" | "invoice-queue" | "time-entries" | "client-rules" | "client-mapping" | "settings";

/* ─── Utilities ──────────────────────────────────────────────── */
function ceilToQuarterHour(totalMinutes: number): number {
  return Math.ceil(totalMinutes / 15) * 0.25;
}

function formatHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatHours(hours: number): string {
  return hours.toFixed(2);
}

function sumDurations(durations: string[]): string {
  const totalMinutes = durations.reduce((sum, d) => {
    const [h, m] = d.split(":").map(Number);
    return sum + h * 60 + m;
  }, 0);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function durationToAmount(duration: string, rate: number): number {
  const [h, m] = duration.split(":").map(Number);
  const decimalHours = h + m / 60;
  return Math.round(decimalHours * rate * 100) / 100;
}

/* ─── Billing month helpers (pure string math — no new Date() for display) ── */
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

function parseBillingMonth(bm: string): { year: number; month: number } {
  const [year, month] = bm.split("-").map(Number);
  return { year, month };
}

function addMonths(year: number, month: number, n: number): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + n;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

// Work/entries month. '2026-04-01' -> 'April 2026'
function entriesMonthLabel(bm: string): string {
  const { year, month } = parseBillingMonth(bm);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// Work/entries month name only. '2026-04-01' -> 'April'
function entriesMonthName(bm: string): string {
  return MONTH_NAMES[parseBillingMonth(bm).month - 1];
}

// Run/invoice month (= work + 1). '2026-04-01' -> 'May 2026'
function runMonthLabel(bm: string): string {
  const { year, month } = parseBillingMonth(bm);
  const r = addMonths(year, month, 1);
  return `${MONTH_NAMES[r.month - 1]} ${r.year}`;
}

// Run/invoice month name only. '2026-04-01' -> 'May'
function runMonthName(bm: string): string {
  const { year, month } = parseBillingMonth(bm);
  return MONTH_NAMES[addMonths(year, month, 1).month - 1];
}

// Invoice date = 1st of run month. '2026-04-01' -> '05/01/2026'
function invoiceDateFromBillingMonth(bm: string): string {
  const { year, month } = parseBillingMonth(bm);
  const r = addMonths(year, month, 1);
  return `${pad2(r.month)}/01/${r.year}`;
}

// Due date = invoice date + offsetDays. Invoice date is always the 1st.
// '2026-04-01' -> '05/06/2026'
function invoiceDueDateFromBillingMonth(bm: string, offsetDays = 5): string {
  const { year, month } = parseBillingMonth(bm);
  const r = addMonths(year, month, 1);
  return `${pad2(r.month)}/${pad2(1 + offsetDays)}/${r.year}`;
}

// Dropdown option label. '2026-04-01' -> 'May 2026 (April entries)'
function dropdownLabel(bm: string): string {
  return `${runMonthLabel(bm)} (${entriesMonthName(bm)} entries)`;
}

function parseHmmToSeconds(hmm: string): number {
  const [h, m] = hmm.split(":").map(Number);
  return (h || 0) * 3600 + (m || 0) * 60;
}

function formatSecondsToHmm(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}:${pad2(m)}`;
}

function computeRawStats(allEntries: { duration: string; amount: number }[]): {
  totalRawTime: string;
  totalRawAmount: number;
} {
  const totalSeconds = allEntries.reduce((s, e) => s + parseHmmToSeconds(e.duration), 0);
  // TODO: if per-client rate overrides diverge from the firm default, compute raw amount per-customer so the rounding delta stays honest.
  const totalRawAmount = Math.round(allEntries.reduce((s, e) => s + e.amount, 0) * 100) / 100;
  return { totalRawTime: formatSecondsToHmm(totalSeconds), totalRawAmount };
}

function runDisplayStatus(
  templates: { sent: boolean }[]
): { label: string; bg: string; color: string } {
  const sent = templates.filter(t => t.sent).length;
  if (templates.length === 0 || sent === 0)
    return { label: "In Review", bg: "#FFF3E0", color: "#C2410C" };
  if (sent === templates.length)
    return { label: "Sent", bg: "#F0FDF4", color: "#2D6A4F" };
  return { label: "Partially Sent", bg: "#FEF9C3", color: "#A16207" };
}

/* ─── Client props (data comes from server component via page.tsx) ─── */
export interface DbCustomer {
  id: string;
  displayName: string;
  qboCustomerId: string | null;
}

export interface QboCustomer {
  id: string;
  displayName: string;
}

export interface InvoicesClientProps {
  templates: InvoiceTemplate[];
  allEntries: FlatEntry[];
  timeEntries: TimeEntryRow[];
  defaultRate: number;
  qboConnected: boolean;
  qbTimeConnected: boolean;
  qbTimeConnectedAt: string | null;
  customers: DbCustomer[];
  firmName: string;
  role: string;
  currentRun: { billingMonth: string; status: string } | null;
  availableRuns: { billingMonth: string; status: string }[];
  defaultGenerateMonth: string;
}

// Kept for reference during type-checking; real data comes from props.
const TEMPLATES: InvoiceTemplate[] = [
  {
    id: "knoxville-title",
    draftId: "",
    client: "Knoxville Title Agency LLC",
    billTo: "Chase Reno",
    invoiceNum: "5141",
    rawMinutes: 1894,
    defaultDescription: "Monthly Bookkeeping",
    sent: false,
    entries: [
      { date: "04/01", staff: "Lea A. Sanford", note: "billing", duration: "0:10" },
      { date: "04/01", staff: "Lea A. Sanford", note: "pos pay", duration: "0:10" },
      { date: "04/02", staff: "Amy Snyder", note: "Payroll workbook and calculated garnishment-still have a Q before finalizing", duration: "0:34" },
      { date: "04/02", staff: "Amy Snyder", note: "Looking up medical deduction/contribution for employee and making changes", duration: "0:16" },
      { date: "04/02", staff: "Amy Snyder", note: "Finish processing payroll", duration: "0:46" },
      { date: "04/02", staff: "Lea A. Sanford", note: "pos pay and bill pay", duration: "0:15" },
      { date: "04/03", staff: "Lea A. Sanford", note: "pos pay", duration: "0:04" },
      { date: "04/06", staff: "Lea A. Sanford", note: "March recon and draft financials", duration: "1:09" },
      { date: "04/06", staff: "Amy Snyder", note: "Setting up this weeks workbook so that I could add CR reimbursement to it.", duration: "0:20" },
      { date: "04/07", staff: "Lea A. Sanford", note: "POS PAY, ENTER AND PAYING BILLS", duration: "1:03" },
      { date: "04/07", staff: "Amy Snyder", note: "Checking to see if I had to file qtrly returns-but they are set up on auto", duration: "0:12" },
      { date: "04/08", staff: "Amy Snyder", note: "looking at the health insurance deductions", duration: "0:29" },
      { date: "04/08", staff: "Amy Snyder", note: "Payroll workbook-have a deduction question before finishing. Garnishment calculation", duration: "0:53" },
      { date: "04/08", staff: "Lea A. Sanford", note: "pos pay, updating financials and replying to chase's email, phone call, bill entering", duration: "2:01" },
      { date: "04/09", staff: "Amy Snyder", note: "Resend the bonus payroll", duration: "0:22" },
      { date: "04/09", staff: "Lea A. Sanford", note: "pos pay and entering reginique to his ACH template", duration: "0:06" },
      { date: "04/09", staff: "Lea A. Sanford", note: "payroll with amy, setting up jimmy's regular pay", duration: "0:15" },
      { date: "04/09", staff: "Amy Snyder", note: "Run payroll", duration: "1:14" },
      { date: "04/09", staff: "Amy Snyder", note: "Looking at the time for KP and giving my explanation on the pay. Bonus payroll", duration: "0:37" },
      { date: "04/10", staff: "Amy Snyder", note: "JR ACH payment and GJ entry to go with it", duration: "0:22" },
      { date: "04/10", staff: "Lea A. Sanford", note: "pos pay, email/research on return ach", duration: "0:18" },
      { date: "04/13", staff: "Lea A. Sanford", note: "pos pay, paid bills, email follow ups", duration: "0:56" },
      { date: "04/14", staff: "Lea A. Sanford", note: "pos pay", duration: "0:02" },
      { date: "04/15", staff: "Joseph Broome", note: "classification", duration: "2:03" },
      { date: "04/15", staff: "Joseph Broome", note: "p&L classifying", duration: "0:15" },
      { date: "04/15", staff: "Lea A. Sanford", note: "pos pay, bill.com, bank transactions,", duration: "0:23" },
      { date: "04/16", staff: "Amy Snyder", note: "Talked to BP on the phone, back and forth emails with BP about employee info and KP about w4 adjustments. needed to confirm a bonus. Process payroll", duration: "2:16" },
      { date: "04/16", staff: "Lea A. Sanford", note: "TPP Audit", duration: "0:09" },
      { date: "04/16", staff: "Lea A. Sanford", note: "pos pay, bill pay", duration: "0:36" },
      { date: "04/17", staff: "Amy Snyder", note: "Positive pay", duration: "0:10" },
      { date: "04/17", staff: "Amy Snyder", note: "ACH payment and entered into QBO", duration: "0:26" },
      { date: "04/17", staff: "Amy Snyder", note: "AS said a positive pay had come via email-checked the bank account and nothing there. Reminder from earlier today?", duration: "0:12" },
      { date: "04/19", staff: "Lea A. Sanford", note: "Q1 financials", duration: "2:08" },
      { date: "04/20", staff: "Amber L. Sanchez", note: "emailing about registered agent letter.", duration: "0:14" },
      { date: "04/20", staff: "Amy Snyder", note: "added CR reimbursement to the workbook", duration: "0:07" },
      { date: "04/20", staff: "Lea A. Sanford", note: "work meeting etc", duration: "2:41" },
      { date: "04/21", staff: "Amy Snyder", note: "Processed the payroll-but did not do the ACH yet-waiting till late tomorrow in case of changes", duration: "1:12" },
      { date: "04/21", staff: "Amy Snyder", note: "more emails came about positive pay, checked bank account but nothing is showing", duration: "0:02" },
      { date: "04/21", staff: "Amy Snyder", note: "Looking into the positive pay and why they are not showing up", duration: "0:21" },
      { date: "04/23", staff: "Amy Snyder", note: "ACH for payroll, look up a few items for CR, pulled new employee info and entered new employee", duration: "1:28" },
      { date: "04/24", staff: "Amy Snyder", note: "Logged in to make sure that no positive pays needed to be approved, looked at employee's adjusted W4-have questions as I do not think it is completed correctly. I sent her an email", duration: "0:21" },
      { date: "04/24", staff: "Amy Snyder", note: "Positive pay approvals, saved a copy of garnishment release and sent to CR & BP then mailed original to the employee per CR request, changed new employees email and resent invite,", duration: "0:49" },
      { date: "04/25", staff: "Amy Snyder", note: "helping employee update their W4", duration: "0:06" },
      { date: "04/27", staff: "Amy Snyder", note: "check for positive pay as an email came through-none there. Updated employee W4 withholding", duration: "0:07" },
      { date: "04/27", staff: "Amy Snyder", note: "Positive pay, large amount asked CR for approval", duration: "0:10" },
      { date: "04/27", staff: "Amy Snyder", note: "Checked to see if any positive pays needed approval-none", duration: "0:02" },
      { date: "04/28", staff: "Amy Snyder", note: "checking for positive pay-none", duration: "0:04" },
      { date: "04/29", staff: "Amy Snyder", note: "check for any positive pay", duration: "0:03" },
      { date: "04/29", staff: "Amy Snyder", note: "Checking for any positive pays that need approved, added a couple of expenses to be reimbursed to the workbook", duration: "0:11" },
      { date: "04/30", staff: "Amy Snyder", note: "payroll workbook", duration: "0:25" },
      { date: "04/30", staff: "Lea A. Sanford", note: "ACH and pos pay", duration: "0:59" },
      { date: "04/30", staff: "Amy Snyder", note: "Process payroll, added PTO to everyone", duration: "1:00" },
    ],
  },
  {
    id: "baine",
    draftId: "",
    client: "Baine & Company",
    invoiceNum: "5101",
    rawMinutes: 713,
    defaultDescription: "Monthly Bookkeeping Services-2026 recons caught up (1st Quarter)",
    sent: false,
    entries: [
      { date: "04/10", staff: "Abby N. Townsend", note: "reviewing bank accounts and statements to make sure they match each other", duration: "0:15" },
      { date: "04/17", staff: "Giovanni Sanchez", note: "2026 categorizing and recon.", duration: "1:47" },
      { date: "04/20", staff: "Giovanni Sanchez", note: "bank trans & recon", duration: "3:50" },
      { date: "04/22", staff: "Victoria Wyres", note: "review", duration: "0:47" },
      { date: "04/22", staff: "Victoria Wyres", note: "review, fixes, sending email with questions", duration: "0:50" },
      { date: "04/28", staff: "Victoria Wyres", note: "fixing job costing", duration: "0:32" },
      { date: "04/28", staff: "Victoria Wyres", note: "sending spreadsheet to tyler. deleting bank rules", duration: "0:10" },
      { date: "04/28", staff: "Victoria Wyres", note: "ADDING SAVINGS 5124 AND JAN - MAR, ADDING SAVINGS 5208 RECON MAR. FIXING TRANSACTIONS THAT WERE IN LIMBO WAITING ON THESE ACCOUNTS TO BE ADDED. fixing ask my acc", duration: "1:46" },
      { date: "04/28", staff: "Victoria Wyres", note: "clean up job costing", duration: "0:20" },
      { date: "04/28", staff: "Victoria Wyres", note: "job costing", duration: "1:28" },
      { date: "04/29", staff: "Victoria Wyres", note: "phone call with tyler", duration: "0:08" },
    ],
  },
  {
    id: "knox-pt",
    draftId: "",
    client: "Knox Physical Therapy",
    invoiceNum: "5138",
    rawMinutes: 708,
    defaultDescription: "Monthly Bookkeeping",
    sent: false,
    entries: [
      { date: "04/01", staff: "Amy Snyder", note: "Payroll", duration: "1:04" },
      { date: "04/03", staff: "Amy Snyder", note: "Time entry adjustment, created new workbook for next week to add in mileage so I dont forget", duration: "0:12" },
      { date: "04/07", staff: "Amy Snyder", note: "Updated the vacation for employee, sent timesheets to Dr. E for approval", duration: "0:09" },
      { date: "04/07", staff: "Amy Snyder", note: "Was pulling timesheet for Dr. E approval but (1) was missing. Sent email to employee & Dr. E to see if he was on vacation last week and need to use his PTO. Worked on workbook", duration: "0:24" },
      { date: "04/07", staff: "Joseph Broome", note: "pto log", duration: "0:35" },
      { date: "04/08", staff: "Amy Snyder", note: "Entered work book and the time in QBO-still need approval on (2) reimbursements before finishing", duration: "0:45" },
      { date: "04/08", staff: "Amy Snyder", note: "Saved reimbursement and resent email to Dr. Easley with timesheets & reimbursement. Time entry adjustment", duration: "0:20" },
      { date: "04/09", staff: "Amy Snyder", note: "Payroll", duration: "0:40" },
      { date: "04/10", staff: "Amy Snyder", note: "Added PTO for employee", duration: "0:05" },
      { date: "04/10", staff: "Amy Snyder", note: "Time entry change for an employee", duration: "0:05" },
      { date: "04/13", staff: "Amy Snyder", note: "Time entry update for an employee", duration: "0:07" },
      { date: "04/14", staff: "Amy Snyder", note: "Sent timesheets to KS for approval, workbook", duration: "0:30" },
      { date: "04/15", staff: "Amy Snyder", note: "Payroll", duration: "0:55" },
      { date: "04/21", staff: "Joseph Broome", note: "pto logs", duration: "0:20" },
      { date: "04/21", staff: "Amy Snyder", note: "Sent Dr. E timesheets for approval, qtrly muti location report submitted, checked some of the PTO hours", duration: "1:31" },
      { date: "04/22", staff: "Amy Snyder", note: "Time entry changes", duration: "0:11" },
      { date: "04/22", staff: "Amy Snyder", note: "Payroll workbook", duration: "0:29" },
      { date: "04/22", staff: "Amy Snyder", note: "Checked the hours in QBO & submitted, did bank transfer", duration: "0:40" },
      { date: "04/23", staff: "Amy Snyder", note: "Finished payroll reports", duration: "0:34" },
      { date: "04/24", staff: "Amy Snyder", note: "Clocked in employee and removed the incorrect notes from her timesheets", duration: "0:07" },
      { date: "04/27", staff: "Amy Snyder", note: "Pulled timesheets for Dr. E to approve and sent to him", duration: "0:15" },
      { date: "04/28", staff: "Amy Snyder", note: "Update pay amounts per LE email", duration: "0:11" },
      { date: "04/28", staff: "Amy Snyder", note: "Time entry adjustment for employee, created workbook for this weeks payroll", duration: "0:25" },
      { date: "04/29", staff: "Amy Snyder", note: "Entered times into QBO-still need 1 approval before finalizing", duration: "0:30" },
      { date: "04/30", staff: "Amy Snyder", note: "Finalize payroll, added employee time", duration: "0:44" },
    ],
  },
];

const DEFAULT_RATE = 125;

const ALL_ENTRIES: FlatEntry[] = TEMPLATES.flatMap((t) =>
  t.entries.map((e) => ({
    client: t.client,
    date: `${e.date}/2026`,
    employee: e.staff,
    productService: "Hourly Accounting services",
    description: e.note,
    duration: e.duration,
    rate: DEFAULT_RATE,
    billable: "Yes",
    amount: durationToAmount(e.duration, DEFAULT_RATE),
  }))
);

/* ─── Nav config ─────────────────────────────────────────────── */
const NAV_ITEMS: { view: NavView; label: string; Icon: React.ElementType }[] = [
  { view: "billing-run", label: "Billing Run", Icon: LayoutDashboard },
  { view: "invoice-queue", label: "Invoice Queue", Icon: FileText },
  { view: "time-entries", label: "All Time Entries", Icon: Clock },
  { view: "client-rules", label: "Client Rules", Icon: Settings2 },
  { view: "client-mapping", label: "Client Mapping", Icon: Link2 },
  { view: "settings", label: "Settings", Icon: Settings },
];

/* ─── Status config ──────────────────────────────────────────── */
const STATUS_CONFIG: Record<InvoiceStatus, { label: string; bg: string; color: string }> = {
  in_review: { label: "In Review", bg: "#FFF3E0", color: "#C2410C" },
  sent: { label: "Sent", bg: "#D8F3DC", color: "#2D6A4F" },
};

/* ─── Sub-components ─────────────────────────────────────────── */
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
      style={{ backgroundColor: checked ? "#2D6A4F" : "#e5e7eb" }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? "translateX(17px)" : "translateX(2px)" }}
      />
    </button>
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function StatCard({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`mt-1.5 text-2xl font-medium text-gray-900 ${mono ? "font-mono" : "font-display"}`}>
        {value}
      </p>
    </div>
  );
}

function MonthSelectorDropdown({
  availableRuns,
  billingMonth,
}: {
  availableRuns: { billingMonth: string; status: string }[];
  billingMonth: string | null;
}) {
  const router = useRouter();
  if (availableRuns.length < 1) return null;
  return (
    <div className="relative shrink-0">
      <select
        aria-label="Select billing run"
        value={billingMonth ?? ""}
        onChange={(e) => router.push(`/invoices?month=${e.target.value}`)}
        className="appearance-none text-sm font-medium border border-gray-200 rounded-lg pl-3 pr-8 py-2 sm:py-1.5 bg-white text-gray-700 focus:outline-none focus:border-[#40916C] cursor-pointer"
      >
        {availableRuns.map((run) => (
          <option key={run.billingMonth} value={run.billingMonth}>
            {dropdownLabel(run.billingMonth)}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
    </div>
  );
}

// Controlled dropdown for picking which billing period to generate drafts for.
// Options are YYYY-MM-01 strings (newest first), built from synced time entries.
function GenerateMonthDropdown({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  if (options.length === 0) return null;
  return (
    <div className="relative shrink-0">
      <select
        aria-label="Select billing period to generate"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="appearance-none text-sm font-medium border border-gray-200 rounded-lg pl-3 pr-8 py-2 sm:py-1.5 bg-white text-gray-700 focus:outline-none focus:border-[#40916C] cursor-pointer disabled:opacity-60"
      >
        {options.map((m) => (
          <option key={m} value={m}>{dropdownLabel(m)}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
    </div>
  );
}

function inputFocusHandlers() {
  return {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      e.currentTarget.style.borderColor = "#40916C";
      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(45,106,79,0.1)";
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      e.currentTarget.style.borderColor = "#e5e7eb";
      e.currentTarget.style.boxShadow = "none";
    },
  };
}

/* ─── Billing Run Dashboard ──────────────────────────────────── */
function BillingRunDashboard({
  invoiceStates,
  templates,
  billingMonth,
  availableRuns,
  allEntries,
  onGenerate,
  generateMonth,
  generateMonthOptions,
  onGenerateMonthChange,
  generating,
}: {
  invoiceStates: Record<string, InvoiceState>;
  templates: InvoiceTemplate[];
  billingMonth: string | null;
  availableRuns: { billingMonth: string; status: string }[];
  allEntries: FlatEntry[];
  onGenerate: () => Promise<void>;
  generateMonth: string;
  generateMonthOptions: string[];
  onGenerateMonthChange: (v: string) => void;
  generating: boolean;
}) {
  const liveRoundedHours = templates.reduce((sum, t) => sum + invoiceStates[t.id].hours, 0);
  const liveTotalBilling = templates.reduce((sum, t) => sum + invoiceStates[t.id].hours * invoiceStates[t.id].rate, 0);

  if (!billingMonth) {
    const hasSyncedEntries = generateMonthOptions.length > 0;
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <h2 className="font-display text-2xl text-gray-800 mb-2">No Billing Run Yet</h2>
          <p className="text-sm text-gray-400 mb-6">
            Generate your first billing run to get started. Pick the billing period below — it covers approved time entries from QuickBooks Time for that month.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <GenerateMonthDropdown
              value={generateMonth}
              options={generateMonthOptions}
              onChange={onGenerateMonthChange}
              disabled={generating}
            />
            <button
              onClick={onGenerate}
              disabled={generating || !hasSyncedEntries}
              className="flex items-center justify-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg text-white disabled:opacity-60"
              style={{ backgroundColor: "#2D6A4F" }}
            >
              {generating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating…
                </>
              ) : (
                "Generate Drafts"
              )}
            </button>
          </div>
          {!hasSyncedEntries && (
            <p className="text-xs text-gray-400 mt-4">Sync time entries from QuickBooks Time first (Settings → Sync Now).</p>
          )}
        </div>
      </div>
    );
  }

  const rawStats = computeRawStats(allEntries);
  const roundingDiff = Math.round((liveTotalBilling - rawStats.totalRawAmount) * 100) / 100;
  const roundingDiffSign = roundingDiff >= 0 ? "+" : "";
  const badge = runDisplayStatus(templates);
  const sentCount = templates.filter((t) => t.sent).length;
  const sendPct = templates.length === 0 ? 0 : Math.round((sentCount / templates.length) * 100);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 md:px-8 py-6 space-y-6 max-w-4xl">
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <h1 className="font-display text-2xl text-gray-900 leading-tight">{runMonthLabel(billingMonth)} Billing Run</h1>
              <p className="text-sm mt-0.5 text-gray-500">{entriesMonthLabel(billingMonth)} Time Entries</p>
            </div>
            <div className="flex items-center gap-3 shrink-0 mt-1">
              <MonthSelectorDropdown availableRuns={availableRuns} billingMonth={billingMonth} />
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: badge.bg, color: badge.color }}>
                {badge.label}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Clients Ready for Review", value: templates.length.toString(), mono: false },
            { label: "Proposed Billing", value: formatCurrency(liveTotalBilling), mono: true },
            { label: "Rounded Billable Hours", value: `${formatHours(liveRoundedHours)} hrs`, mono: true },
          ].map(({ label, value, mono }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider leading-tight">{label}</p>
              <p className={`mt-2 text-2xl font-medium text-gray-900 ${mono ? "font-mono" : "font-display"}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Send Progress</p>
            <p className="text-xs font-medium text-gray-700"><span className="font-mono">{sentCount}</span> of <span className="font-mono">{templates.length}</span> invoices sent</p>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full transition-all duration-300" style={{ width: `${sendPct}%`, backgroundColor: badge.color }} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Billing Totals — {entriesMonthLabel(billingMonth)}</p>
          <div className="divide-y divide-gray-100">
            {[
              { label: "Total raw time imported", value: rawStats.totalRawTime },
              { label: "Total raw amount (pre-rounding)", value: formatCurrency(rawStats.totalRawAmount) },
              { label: "Total rounded invoice hours", value: `${formatHours(liveRoundedHours)} hrs` },
              { label: "Total proposed billing", value: formatCurrency(liveTotalBilling) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-500">{label}</span>
                <span className="font-mono text-sm font-medium text-gray-900">{value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-500">Rounding / adjustment difference</span>
              <span className="font-mono text-sm font-semibold px-2 py-0.5 rounded" style={{ color: "#2D6A4F", backgroundColor: "#F0FDF4" }}>{roundingDiffSign}{formatCurrency(Math.abs(roundingDiff))}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5 border-l-4" style={{ borderLeftColor: "#2D6A4F" }}>
          <p className="text-sm text-gray-700 leading-relaxed">
            {runMonthLabel(billingMonth)} billing is ready for review. We found{" "}
            <span className="font-semibold text-gray-900">{templates.length} client invoices</span>,{" "}
            <span className="font-semibold text-gray-900">{formatHours(liveRoundedHours)} rounded billable hours</span>, and{" "}
            <span className="font-semibold text-gray-900">{formatCurrency(liveTotalBilling)}</span> in proposed billing.
            Instead of manually grouping time and rebuilding invoices, review the prepared drafts and create QuickBooks drafts when ready.
          </p>
        </div>

      </div>
    </div>
  );
}

/* ─── Invoice Queue view ─────────────────────────────────────── */
function InvoiceQueueView({
  sharedHighTouch,
  setHighTouch,
  sharedDescriptions,
  setDescription,
  firmDefaultRate,
  sharedClientRates: _sharedClientRates,
  invoiceStates: states,
  updateInvoiceState: updateState,
  templates,
  onGenerate,
  firmName,
  billingMonth,
  runBillingMonth,
  addToast,
  generateMonth,
  generateMonthOptions,
  onGenerateMonthChange,
  generating,
  canSend,
}: {
  sharedHighTouch: Record<string, boolean>;
  setHighTouch: (id: string, val: boolean) => void;
  sharedDescriptions: Record<string, string>;
  setDescription: (id: string, val: string) => void;
  firmDefaultRate: number;
  sharedClientRates: Record<string, number>;
  invoiceStates: Record<string, InvoiceState>;
  updateInvoiceState: (id: string, update: Partial<InvoiceState>) => void;
  templates: InvoiceTemplate[];
  onGenerate: () => Promise<void>;
  firmName: string;
  billingMonth: string;
  runBillingMonth: string | null;
  addToast: (message: string) => void;
  generateMonth: string;
  generateMonthOptions: string[];
  onGenerateMonthChange: (v: string) => void;
  generating: boolean;
  canSend: boolean;
}) {
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [sendingAll, setSendingAll] = useState(false);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const isDone = (id: string) => states[id].status === "sent";

  const allTotalHours = templates.reduce((sum, t) => sum + states[t.id].hours, 0);
  const allTotalBilled = templates.reduce((sum, t) => sum + states[t.id].hours * states[t.id].rate, 0);
  const pendingTemplates = templates.filter((t) => !isDone(t.id));
  const pendingTotal = pendingTemplates.reduce((sum, t) => sum + states[t.id].hours * states[t.id].rate, 0);

  function debouncedPatch(draftId: string, body: { rounded_hours?: number; description?: string }) {
    clearTimeout(debounceTimers.current[draftId]);
    debounceTimers.current[draftId] = setTimeout(() => {
      fetch(`/api/invoice-drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch((err) => console.error("[invoice-drafts] debounced PATCH failed", err));
    }, 700);
  }

  async function createDraft(id: string) {
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    clearTimeout(debounceTimers.current[template.draftId]);
    setSavingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/invoice-drafts/${template.draftId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rounded_hours: states[id].hours,
          description: sharedDescriptions[id],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "Failed to send invoice");
      }
      if ((data as { alreadySent?: boolean }).alreadySent) {
        updateState(id, { status: "sent", expanded: false });
        addToast("Invoice was already sent.");
        return;
      }
      updateState(id, { status: "sent", expanded: false });
      addToast("Invoice sent. BillerGenie will sync the payment portal automatically.");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to send invoice");
    } finally {
      setSavingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  async function createAllDrafts() {
    const targets = templates.filter((t) => !isDone(t.id));
    if (targets.length === 0) return;
    targets.forEach((t) => clearTimeout(debounceTimers.current[t.draftId]));
    setSendingAll(true);
    try {
      const ids = await Promise.all(
        targets.map(async (t) => {
          const res = await fetch(`/api/invoice-drafts/${t.draftId}/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rounded_hours: states[t.id].hours,
              description: sharedDescriptions[t.id],
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error((err as { error?: string }).error ?? `Failed for ${t.client}`);
          }
          return t.id;
        })
      );
      ids.forEach((id) => updateState(id, { status: "sent", expanded: false }));
      if (targets.length === 1) {
        addToast("Invoice sent. BillerGenie will sync the payment portal automatically.");
      } else {
        addToast(`${targets.length} invoices sent to clients.`);
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to send invoices");
    } finally {
      setSendingAll(false);
    }
  }

  const focusHandlers = inputFocusHandlers();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <header style={{ backgroundColor: "#2D6A4F" }}>
        <div className="px-4 md:px-8 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl text-white leading-tight">Invoice Queue</h1>
            <p className="text-sm mt-0.5" style={{ color: "#D8F3DC" }}>
              {runBillingMonth
                ? `${runMonthLabel(runBillingMonth)} · Billing Period`
                : "No billing run yet — sync time entries, then Generate Drafts."}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 w-full sm:w-auto">
            <GenerateMonthDropdown
              value={generateMonth}
              options={generateMonthOptions}
              onChange={onGenerateMonthChange}
              disabled={generating}
            />
            <button
              onClick={onGenerate}
              disabled={generating || generateMonthOptions.length === 0}
              className="flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors disabled:opacity-60 w-full sm:w-auto"
              style={{ borderColor: "rgba(216,243,220,0.5)", color: "white" }}
              onMouseEnter={(e) => { if (!generating) { e.currentTarget.style.backgroundColor = "white"; e.currentTarget.style.color = "#2D6A4F"; } }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "white"; }}
            >
              {generating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Drafts
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-4 md:px-8 py-6 space-y-4 max-w-4xl">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Drafts Ready" value={pendingTemplates.length.toString()} />
            <StatCard label="Total Hours" value={`${formatHours(allTotalHours)} hrs`} mono />
            <StatCard label="Total Billed" value={formatCurrency(allTotalBilled)} mono />
          </div>

          {/* Invoice cards */}
          {templates.map((template) => {
            const state = states[template.id];
            const done = isDone(template.id);
            const roundedHours = ceilToQuarterHour(template.rawMinutes);
            const manualAdj = parseFloat((state.hours - roundedHours).toFixed(2));
            const finalQty = state.hours;
            const amount = finalQty * state.rate;
            const rawAmount = (template.rawMinutes / 60) * firmDefaultRate;
            const isHighTouch = sharedHighTouch[template.id];
            const description = sharedDescriptions[template.id];

            return (
              <div
                key={template.id}
                className={`bg-white rounded-xl border transition-all duration-200 ${done ? "border-gray-100 opacity-60" : "border-gray-200 shadow-sm"}`}
              >
                {/* Card header */}
                <button
                  onClick={() => !done && updateState(template.id, { expanded: !state.expanded })}
                  className={`w-full text-left px-6 py-5 ${done ? "cursor-default" : "cursor-pointer"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-display text-xl text-gray-900 leading-snug">{template.client}</h2>
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1">
                        <span className="font-mono text-xs text-gray-400">{template.invoiceNum}</span>
                        <span className="text-gray-200 text-xs">·</span>
                        <span className="text-xs text-gray-400">{entriesMonthLabel(billingMonth)}</span>
                        {template.billTo && (
                          <>
                            <span className="text-gray-200 text-xs">·</span>
                            <span className="text-xs text-gray-400">Bill to: {template.billTo}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="font-mono text-xl font-medium text-gray-900">{formatCurrency(amount)}</div>
                        <div className="font-mono text-xs text-gray-400 mt-0.5">{formatHours(finalQty)} hrs @ ${state.rate}/hr</div>
                      </div>
                      <StatusBadge status={state.status} />
                      {!done && <ChevronIcon expanded={state.expanded} />}
                    </div>
                  </div>
                </button>

                {/* Expanded content */}
                {state.expanded && !done && (
                  <div className="px-6 pb-6 border-t border-gray-100">
                    <div className="pt-5 space-y-5">

                      {/* 1. Billing Math Summary */}
                      <div className="rounded-lg p-4" style={{ backgroundColor: "#f0fdf4" }}>
                        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">How this invoice was calculated</h3>
                        <div className="space-y-0">
                          {[
                            { label: "Raw QBO Time", value: formatHHMM(template.rawMinutes) },
                            { label: "Decimal hours", value: `${(template.rawMinutes / 60).toFixed(2)} hrs` },
                            { label: "Rounded to next 0.25 hr", value: `${formatHours(roundedHours)} hrs` },
                            { label: "Rate", value: `$${state.rate.toFixed(2)}` },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex items-center justify-between py-1.5 border-b border-green-100">
                              <span className="text-xs text-gray-500">{label}</span>
                              <span className="font-mono text-xs text-gray-700">{value}</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between py-1.5 border-b border-green-100 mt-1 pt-2.5">
                            <span className="text-xs text-gray-500">Manual adjustment</span>
                            <span className={`font-mono text-xs ${manualAdj !== 0 ? "font-semibold" : "text-gray-400"}`} style={{ color: manualAdj !== 0 ? "#2D6A4F" : undefined }}>
                              {manualAdj >= 0 ? "+" : ""}{manualAdj.toFixed(2)} hrs
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-1.5 border-b border-green-100">
                            <span className="text-xs text-gray-500">Final invoice quantity</span>
                            <span className="font-mono text-xs font-medium text-gray-800">{formatHours(finalQty)} hrs</span>
                          </div>
                          <div className="flex items-center justify-between pt-3 pb-1 mt-1">
                            <span className="text-sm font-semibold text-gray-700">Invoice total</span>
                            <span className="font-mono text-base font-bold" style={{ color: "#2D6A4F" }}>{formatCurrency(amount)}</span>
                          </div>
                        </div>
                      </div>

                      {/* 2. Invoice Preview */}
                      <div>
                        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Client-Facing Invoice Preview</h3>
                        <p className="text-xs text-gray-400 italic mb-3">This is what your client sees. Individual time entries and staff notes are not included.</p>
                        <div className="rounded-lg border border-gray-200 shadow-sm bg-white overflow-hidden">
                          <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{firmName}</p>
                              <div className="mt-2">
                                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Bill to</p>
                                {template.billTo ? (
                                  <>
                                    <p className="text-xs text-gray-800 mt-0.5">{template.billTo}</p>
                                    <p className="text-xs text-gray-600">{template.client}</p>
                                  </>
                                ) : (
                                  <p className="text-xs text-gray-800 mt-0.5">{template.client}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs uppercase tracking-widest text-gray-300 font-medium">Invoice Preview</span>
                              <div className="mt-2 space-y-0.5">
                                <p className="text-xs text-gray-500">Date: <span className="font-mono text-gray-700">{invoiceDateFromBillingMonth(billingMonth)}</span></p>
                                <p className="text-xs text-gray-500">Due: <span className="font-mono text-gray-700">{invoiceDueDateFromBillingMonth(billingMonth)}</span></p>
                                <p className="text-xs text-gray-500">Terms: <span className="text-gray-700">Due on receipt</span></p>
                              </div>
                            </div>
                          </div>
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left px-4 py-2 font-medium text-gray-500">Product / Service</th>
                                <th className="text-left px-4 py-2 font-medium text-gray-500">Description</th>
                                <th className="text-right px-4 py-2 font-medium text-gray-500 w-12">Qty</th>
                                <th className="text-right px-4 py-2 font-medium text-gray-500 w-20">Rate</th>
                                <th className="text-right px-4 py-2 font-medium text-gray-500 w-24">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-t border-gray-100">
                                <td className="px-4 py-3 text-gray-700">Hourly Accounting services</td>
                                <td className="px-4 py-3 text-gray-600 italic">{description}</td>
                                <td className="px-4 py-3 text-right font-mono text-gray-700">{formatHours(finalQty)}</td>
                                <td className="px-4 py-3 text-right font-mono text-gray-700">${state.rate.toFixed(2)}</td>
                                <td className="px-4 py-3 text-right font-mono text-gray-800 font-medium">{formatCurrency(amount)}</td>
                              </tr>
                            </tbody>
                          </table>
                          <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
                            <div className="text-right">
                              <span className="text-xs text-gray-500 mr-4">Total</span>
                              <span className="font-mono text-base font-bold text-gray-900">{formatCurrency(amount)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 3. Time Entries */}
                      <div>
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Raw QBO Time Entries — Internal Review Only</h3>
                          <span className="text-xs text-gray-400 italic text-right shrink-0">These entries and staff notes are used to review billing accuracy. They are not included on the client-facing invoice.</span>
                        </div>
                        <div className="rounded-lg border border-gray-100 overflow-hidden" style={{ scrollbarWidth: "thin" }}>
                          <div className="max-h-52 overflow-y-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                  <th className="text-left px-3 py-2.5 font-medium text-gray-500 w-14">Date</th>
                                  <th className="text-left px-3 py-2.5 font-medium text-gray-500 w-36">Staff</th>
                                  <th className="text-left px-3 py-2.5 font-medium text-gray-500">Notes</th>
                                  <th className="text-right px-3 py-2.5 font-medium text-gray-500 w-12">Time</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {template.entries.map((entry, i) => (
                                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-3 py-2 font-mono text-gray-500">{entry.date}</td>
                                    <td className="px-3 py-2 text-gray-700">{entry.staff}</td>
                                    <td className="px-3 py-2 text-gray-500">{entry.note}</td>
                                    <td className="px-3 py-2 text-right font-mono text-gray-500">{entry.duration}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="bg-gray-50 border-t border-gray-200 px-3 py-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span><span className="font-medium text-gray-700">{template.entries.length}</span> entries</span>
                              <span>Raw total: <span className="font-mono font-medium text-gray-700">{formatHHMM(template.rawMinutes)}</span></span>
                            </div>
                            <span className="text-xs text-gray-500">Pre-rounding: <span className="font-mono font-medium text-gray-700">{formatCurrency(rawAmount)}</span></span>
                          </div>
                        </div>
                      </div>

                      {/* 4. Adjustment Controls */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Adjustment Controls</h3>

                        {/* High-touch toggle */}
                        <div>
                          <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <ToggleSwitch
                              checked={isHighTouch}
                              onChange={(val) => setHighTouch(template.id, val)}
                            />
                            <span className="text-sm text-gray-700">High-touch client — review possible adjustment</span>
                          </label>

                          {isHighTouch && (
                            <div className="mt-2 space-y-2">
                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium" style={{ backgroundColor: "#FFF3E0", color: "#C2410C" }}>
                                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                High-touch client — consider adding 15–45 min for calls and drop-ins
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  { label: "+0.25 hr", delta: 0.25 },
                                  { label: "+0.50 hr", delta: 0.50 },
                                  { label: "+0.75 hr", delta: 0.75 },
                                ].map(({ label, delta }) => (
                                  <button
                                    key={label}
                                    type="button"
                                    onClick={() => {
                                      const newHours = parseFloat((state.hours + delta).toFixed(2));
                                      updateState(template.id, { hours: newHours });
                                      debouncedPatch(template.draftId, { rounded_hours: newHours });
                                    }}
                                    className="text-xs font-medium px-3 py-2 sm:py-1.5 rounded-lg border transition-colors"
                                    style={{ borderColor: "#d1fae5", color: "#374151" }}
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#2D6A4F"; e.currentTarget.style.color = "#2D6A4F"; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#d1fae5"; e.currentTarget.style.color = "#374151"; }}
                                  >
                                    {label}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => document.getElementById(`hours-input-${template.id}`)?.focus()}
                                  className="text-xs font-medium px-3 py-2 sm:py-1.5 rounded-lg border transition-colors"
                                  style={{ borderColor: "#d1fae5", color: "#374151" }}
                                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#2D6A4F"; e.currentTarget.style.color = "#2D6A4F"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#d1fae5"; e.currentTarget.style.color = "#374151"; }}
                                >
                                  Custom
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">Client-facing description</label>
                          <textarea
                            value={description}
                            onChange={(e) => {
                              setDescription(template.id, e.target.value);
                              debouncedPatch(template.draftId, { description: e.target.value });
                            }}
                            rows={2}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 resize-none focus:outline-none transition-shadow"
                            {...focusHandlers}
                          />
                        </div>

                        {/* Final qty + Manual adj + Rate */}
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">Final invoice quantity (hrs)</label>
                            <div className="relative">
                              <input
                                id={`hours-input-${template.id}`}
                                type="number"
                                value={state.hours}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val >= 0) {
                                    updateState(template.id, { hours: val });
                                    debouncedPatch(template.draftId, { rounded_hours: val });
                                  }
                                }}
                                step={0.25}
                                min={0}
                                className="w-full text-sm font-mono border border-gray-200 rounded-lg px-3 py-2.5 pr-10 text-gray-900 focus:outline-none transition-shadow"
                                {...focusHandlers}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">hrs</span>
                            </div>
                          </div>
                          <div className="w-36">
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">Manual adjustment (hrs)</label>
                            <div className="relative">
                              <input
                                type="number"
                                value={manualAdj}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val)) {
                                    const newHours = parseFloat((roundedHours + val).toFixed(2));
                                    updateState(template.id, { hours: newHours });
                                    debouncedPatch(template.draftId, { rounded_hours: newHours });
                                  }
                                }}
                                step={0.25}
                                className="w-full text-sm font-mono border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 focus:outline-none transition-shadow"
                                {...focusHandlers}
                              />
                            </div>
                            <p className="mt-1 text-xs text-gray-400">Added to rounded hours.</p>
                          </div>
                          <div className="w-28">
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">Rate</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">$</span>
                              <input
                                type="number"
                                value={state.rate}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val >= 0) updateState(template.id, { rate: val });
                                }}
                                step={1}
                                min={0}
                                className="w-full text-sm font-mono border border-gray-200 rounded-lg pl-6 pr-3 py-2.5 text-gray-900 focus:outline-none transition-shadow"
                                {...focusHandlers}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Adjustment reason */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">Adjustment reason</label>
                          <input
                            type="text"
                            value={state.adjustmentReason}
                            onChange={(e) => updateState(template.id, { adjustmentReason: e.target.value })}
                            placeholder="e.g. Frequent calls and drop-ins this month"
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 focus:outline-none transition-shadow placeholder-gray-300"
                            {...focusHandlers}
                          />
                          <p className="mt-1 text-xs text-gray-400">Internal only — not shown on the client invoice</p>
                        </div>

                        {/* Internal note */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">
                            Internal note <span className="font-normal text-gray-400">(not shown on invoice)</span>
                          </label>
                          <input
                            type="text"
                            value={state.internalNote}
                            onChange={(e) => updateState(template.id, { internalNote: e.target.value })}
                            placeholder="Add a note for your records…"
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 focus:outline-none transition-shadow placeholder-gray-300"
                            {...focusHandlers}
                          />
                        </div>
                      </div>

                      {/* 5. Card footer */}
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-gray-100">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm text-gray-500">Invoice total</span>
                          <span className="font-mono text-2xl font-medium text-gray-900">{formatCurrency(amount)}</span>
                        </div>
                        {canSend ? (
                          <button
                            onClick={() => createDraft(template.id)}
                            disabled={savingIds.has(template.id)}
                            className="flex items-center justify-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto"
                            style={{ backgroundColor: "#2D6A4F" }}
                            onMouseEnter={(e) => { if (!savingIds.has(template.id)) e.currentTarget.style.backgroundColor = "#40916C"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#2D6A4F"; }}
                          >
                            {savingIds.has(template.id) ? (
                              <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Saving…
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Approve &amp; Send Invoice
                              </>
                            )}
                          </button>
                        ) : (
                          <p className="text-xs text-gray-400 italic">Sending is restricted to the firm owner.</p>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom action bar — only shown when a billing run exists */}
      {runBillingMonth && <div className="border-t border-gray-200 bg-white shadow-lg z-40">
        <div className="px-4 md:px-8 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between max-w-4xl">
          <div className="flex items-baseline gap-2 flex-wrap">
            {pendingTemplates.length > 0 ? (
              <>
                <span className="text-sm text-gray-500">
                  {pendingTemplates.length} pending draft{pendingTemplates.length !== 1 ? "s" : ""}
                </span>
                <span className="font-mono text-xl font-medium text-gray-900">{formatCurrency(pendingTotal)}</span>
                <span className="text-sm text-gray-400">remaining</span>
              </>
            ) : (
              <span className="text-sm font-medium" style={{ color: "#40916C" }}>
                All drafts created — nothing left to review
              </span>
            )}
          </div>
          {canSend ? (
            <button
              onClick={createAllDrafts}
              disabled={pendingTemplates.length === 0 || sendingAll}
              className="flex items-center justify-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto"
              style={{ backgroundColor: pendingTemplates.length > 0 ? "#2D6A4F" : "#9ca3af" }}
              onMouseEnter={(e) => { if (pendingTemplates.length > 0 && !sendingAll) e.currentTarget.style.backgroundColor = "#40916C"; }}
              onMouseLeave={(e) => { if (pendingTemplates.length > 0) e.currentTarget.style.backgroundColor = "#2D6A4F"; }}
            >
              {sendingAll ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Sending…</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="flex flex-col items-start">
                    <span>Send All Approved Invoices</span>
                    <span className="text-xs opacity-60 font-normal">Creates and sends via QuickBooks Online</span>
                  </span>
                </>
              )}
            </button>
          ) : (
            <p className="text-xs text-gray-400 italic">Sending is restricted to the firm owner.</p>
          )}
        </div>
      </div>}
    </div>
  );
}

/* ─── All Time Entries view ──────────────────────────────────── */
function AllTimeEntriesView({ timeEntries, onSyncNow, qbTimeConnected }: {
  timeEntries: TimeEntryRow[]
  onSyncNow: () => Promise<void>
  qbTimeConnected: boolean
}) {
  // Months that actually have synced entries, newest first.
  const months = Array.from(new Set(timeEntries.map((e) => e.month))).sort().reverse();

  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState<string>(months[0] ?? ""); // "" = all months; default = latest
  const [clientFilter, setClientFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [billableFilter, setBillableFilter] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  const uniqueEmployees = Array.from(new Set(timeEntries.map((e) => e.employee).filter(Boolean))).sort();
  const uniqueClients = Array.from(new Set(timeEntries.map((e) => e.client))).sort();

  // Month is a primary selector (like the Billing Run dropdown), not a "clearable" filter.
  const hasActiveFilters =
    search !== "" || clientFilter !== "" || employeeFilter !== "" || billableFilter !== "" || !sortAsc;

  const monthLabel = monthFilter ? entriesMonthLabel(`${monthFilter}-01`) : "All months";

  const filtered = timeEntries.filter((e) => {
    if (monthFilter && e.month !== monthFilter) return false;
    if (search && !e.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (clientFilter && e.client !== clientFilter) return false;
    if (employeeFilter && e.employee !== employeeFilter) return false;
    if (billableFilter === "Billable" && e.billable !== "Yes") return false;
    if (billableFilter === "Non-Billable" && e.billable === "Yes") return false;
    return true;
  }).sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return sortAsc ? da - db : db - da;
  });

  const filteredDuration = sumDurations(filtered.map((e) => e.duration));
  const filteredAmount = filtered.reduce((sum, e) => sum + e.amount, 0);
  const filteredClientCount = new Set(filtered.map((e) => e.client)).size;

  async function handleSync() {
    setIsSyncing(true);
    await onSyncNow();
    setIsSyncing(false);
    router.refresh();
  }

  function clearFilters() {
    setSearch("");
    setClientFilter("");
    setEmployeeFilter("");
    setBillableFilter("");
    setSortAsc(true);
  }

  const selectCls =
    "appearance-none text-sm border border-gray-200 rounded-lg pl-3 pr-7 py-2.5 sm:py-2 text-gray-700 bg-white focus:outline-none focus:border-[#40916C] cursor-pointer";

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Page header */}
      <div className="px-4 md:px-8 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl text-gray-900 leading-tight">All Time Entries</h1>
            <p className="text-sm text-gray-500 mt-0.5">QuickBooks Time import · {monthLabel}</p>
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing || !qbTimeConnected}
            className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#2D6A4F" }}
          >
            <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "Syncing…" : "Sync QB Time"}
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-1 mt-3 flex-wrap">
          {[
            { label: "Total Entries", value: filtered.length.toString() },
            { label: "Total Raw Time", value: filteredDuration },
            { label: "Total Raw Amount", value: formatCurrency(filteredAmount) },
            { label: "Clients", value: filteredClientCount.toString() },
          ].map(({ label, value }, i, arr) => (
            <span key={label} className="flex items-center gap-1">
              <span className="flex items-baseline gap-1.5 px-2">
                <span className="text-xs text-gray-400">{label}</span>
                <span className="font-mono text-sm font-semibold text-gray-700">{value}</span>
              </span>
              {i < arr.length - 1 && <span className="text-gray-300 text-xs">·</span>}
            </span>
          ))}
        </div>

        {/* Contextual note */}
        <div
          className="mt-4 pl-4 py-2.5 pr-3 rounded-r-lg"
          style={{ borderLeft: "3px solid #2D6A4F", backgroundColor: "#f9fafb" }}
        >
          <p className="text-xs font-medium text-gray-700">
            These are your raw QuickBooks Time entries{monthFilter ? ` for ${monthLabel}` : " across all synced months"}.
          </p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            Invoice totals in the queue are calculated directly from this data —
            grouped by client, rounded to the next quarter hour.
          </p>
        </div>

        {/* Unmapped warning — entries whose jobcode isn't linked to a client */}
        {filtered.some((e) => !e.isMapped) && (
          <div
            className="mt-2 pl-4 py-2.5 pr-3 rounded-r-lg"
            style={{ borderLeft: "3px solid #B45309", backgroundColor: "#FFFBEB" }}
          >
            <p className="text-xs font-medium" style={{ color: "#92400E" }}>
              Some entries aren&apos;t mapped to a billing client yet.
            </p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#B45309" }}>
              Unmapped time won&apos;t appear on an invoice until its QB Time jobcode is linked to a
              client in Client Mapping.
            </p>
          </div>
        )}
      </div>

      {/* Sticky filter bar */}
      <div
        className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 md:px-8 py-3"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by staff note or description..."
              className="w-full text-sm border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-gray-900 focus:outline-none focus:border-[#40916C] placeholder-gray-300"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1.5"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Month filter */}
          <div className="relative shrink-0">
            <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className={selectCls}>
              <option value="">All months</option>
              {months.map((m) => (
                <option key={m} value={m}>{entriesMonthLabel(`${m}-01`)}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>

          {/* Client filter */}
          <div className="relative shrink-0">
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className={selectCls}>
              <option value="">All Clients</option>
              {uniqueClients.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>

          {/* Employee filter */}
          <div className="relative shrink-0">
            <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className={selectCls}>
              <option value="">All Employees</option>
              {uniqueEmployees.map((emp) => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>

          {/* Billable filter */}
          <div className="relative shrink-0">
            <select value={billableFilter} onChange={(e) => setBillableFilter(e.target.value)} className={selectCls}>
              <option value="">All</option>
              <option value="Billable">Billable</option>
              <option value="Non-Billable">Non-Billable</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>

          {/* Sort toggle */}
          <button
            onClick={() => setSortAsc((prev) => !prev)}
            className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 hover:border-gray-300 transition-colors shrink-0 whitespace-nowrap"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
            Date: {sortAsc ? "Oldest First" : "Newest First"}
          </button>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors shrink-0 whitespace-nowrap underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="px-4 md:px-8 pb-10 pt-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {timeEntries.length === 0 ? (
              <>
                <Search className="w-8 h-8 text-gray-300 mb-3" />
                <h3 className="text-base font-medium text-gray-600">No time entries yet</h3>
                <p className="text-sm text-gray-400 mt-1">Connect QuickBooks Time in Settings and Sync to import your entries.</p>
              </>
            ) : (
              <>
                <Search className="w-8 h-8 text-gray-300 mb-3" />
                <h3 className="text-base font-medium text-gray-600">No entries match your filters</h3>
                <p className="text-sm text-gray-400 mt-1">Try adjusting your search or clearing the filters</p>
                <button
                  onClick={clearFilters}
                  className="mt-4 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300 transition-colors"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Date</th>
                <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-44">Client</th>
                <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Employee</th>
                <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-44">Product / Service</th>
                <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Note</th>
                <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Duration</th>
                <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-14">Rate</th>
                <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Billable</th>
                <th className="py-3 px-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <tr
                  key={i}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                >
                  <td className="py-2.5 px-3 font-mono text-xs text-gray-500 whitespace-nowrap">{entry.date}</td>
                  <td className="py-2.5 px-3 text-xs text-gray-700">
                    {entry.client}
                    {!entry.isMapped && (
                      <span
                        className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium align-middle"
                        style={{ backgroundColor: "#FEF3C7", color: "#B45309" }}
                      >
                        Unmapped
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-gray-700">{entry.employee}</td>
                  <td className="py-2.5 px-3 text-xs text-gray-500">{entry.productService}</td>
                  <td className="py-2.5 px-3 text-xs text-gray-700 leading-relaxed">{entry.description}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-gray-500 whitespace-nowrap">{entry.duration}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-gray-500">${entry.rate}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium"
                      style={entry.billable === "Yes"
                        ? { backgroundColor: "#D8F3DC", color: "#2D6A4F" }
                        : { backgroundColor: "#F3D8D8", color: "#6A2D2D" }}
                    >
                      {entry.billable}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs text-gray-700">
                    {formatCurrency(entry.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: "#f3f4f6" }} className="border-t-2 border-gray-200">
                <td className="py-3 px-3" />
                <td className="py-3 px-3" />
                <td className="py-3 px-3 text-xs font-semibold text-gray-700">{filtered.length} entries</td>
                <td className="py-3 px-3" />
                <td className="py-3 px-3" />
                <td className="py-3 px-3 font-mono text-xs font-semibold text-gray-700">{filteredDuration}</td>
                <td className="py-3 px-3" />
                <td className="py-3 px-3" />
                <td className="py-3 px-3 text-right font-mono text-xs font-semibold text-gray-700">
                  {formatCurrency(filteredAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Client Rules view ──────────────────────────────────────── */
function ClientRulesView({
  sharedHighTouch,
  setHighTouch,
  sharedDescriptions,
  setDescription,
  firmDefaultRate,
  setFirmDefaultRate,
  sharedClientRates,
  setClientRate,
  templates,
}: {
  sharedHighTouch: Record<string, boolean>;
  setHighTouch: (id: string, val: boolean) => void;
  sharedDescriptions: Record<string, string>;
  setDescription: (id: string, val: string) => void;
  firmDefaultRate: number;
  setFirmDefaultRate: (val: number) => void;
  sharedClientRates: Record<string, number>;
  setClientRate: (id: string, val: number) => void;
  templates: InvoiceTemplate[];
}) {
  const [defaults, setDefaults] = useState({
    productService: "Hourly Accounting services",
    invoiceDescription: "Monthly Bookkeeping",
    invoiceTerms: "Due on receipt",
    dueDateOffset: 5,
  });
  const [clientNotes, setClientNotes] = useState<Record<string, string>>(
    Object.fromEntries(templates.map((t) => [t.id, ""]))
  );
  const focusHandlers = inputFocusHandlers();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 md:px-8 py-6 space-y-6 max-w-4xl">

        {/* Page header */}
        <div>
          <h1 className="font-display text-2xl text-gray-900">Client Rules</h1>
          <p className="text-sm text-gray-500 mt-1">Default billing rules apply to all clients unless overridden below</p>
        </div>

        {/* Firm-Wide Defaults */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Firm-Wide Defaults</p>
          </div>
          <div className="divide-y divide-gray-100">

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-6 py-3.5 sm:gap-6">
              <span className="text-sm text-gray-500 shrink-0">Default hourly rate</span>
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">$</span>
                <input
                  type="number"
                  step={1}
                  min={0}
                  value={firmDefaultRate}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) setFirmDefaultRate(v); }}
                  className="w-full text-sm font-mono border border-gray-200 rounded-lg pl-6 pr-3 py-2 text-gray-900 focus:outline-none transition-shadow"
                  {...focusHandlers}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-6 py-3.5 sm:gap-6">
              <span className="text-sm text-gray-500 shrink-0">Default product / service</span>
              <input
                type="text"
                value={defaults.productService}
                onChange={(e) => setDefaults((d) => ({ ...d, productService: e.target.value }))}
                className="w-full sm:w-72 text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none transition-shadow"
                {...focusHandlers}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-6 py-3.5 sm:gap-6">
              <span className="text-sm text-gray-500 shrink-0">Default invoice description</span>
              <input
                type="text"
                value={defaults.invoiceDescription}
                onChange={(e) => setDefaults((d) => ({ ...d, invoiceDescription: e.target.value }))}
                className="w-full sm:w-72 text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none transition-shadow"
                {...focusHandlers}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between px-6 py-3.5 sm:gap-6">
              <span className="text-sm text-gray-500 shrink-0">Rounding rule</span>
              <div className="sm:text-right">
                <p className="text-sm text-gray-400">Round total monthly time up to next 15 minutes</p>
                <p className="text-xs text-gray-400 mt-1 italic">Ceiling rounding is applied at month-end across the full month, not per entry.</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-6 py-3.5 sm:gap-6">
              <span className="text-sm text-gray-500 shrink-0">Invoice terms</span>
              <input
                type="text"
                value={defaults.invoiceTerms}
                onChange={(e) => setDefaults((d) => ({ ...d, invoiceTerms: e.target.value }))}
                className="w-full sm:w-72 text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none transition-shadow"
                {...focusHandlers}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-6 py-3.5 sm:gap-6">
              <span className="text-sm text-gray-500 shrink-0">Due date offset</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step={1}
                  min={0}
                  value={defaults.dueDateOffset}
                  onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 0) setDefaults((d) => ({ ...d, dueDateOffset: v })); }}
                  className="w-16 text-sm font-mono border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none transition-shadow text-center"
                  {...focusHandlers}
                />
                <span className="text-sm text-gray-400 whitespace-nowrap">days after invoice date</span>
              </div>
            </div>

          </div>
        </div>

        {/* Per-Client Overrides */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Per-Client Overrides</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-32">Hourly Rate</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Invoice Description</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 w-28">High-Touch</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-44">Notes</th>
                </tr>
              </thead>
              <tbody>
                {templates.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-sm text-gray-400 text-center">
                      No clients yet — map jobcodes to customers in Client Mapping to manage per-client rules.
                    </td>
                  </tr>
                )}
                {templates.map((t, i) => {
                  const isHT = sharedHighTouch[t.id];
                  const desc = sharedDescriptions[t.id];
                  const isCustomDesc = desc !== defaults.invoiceDescription;
                  const rowBg = isHT ? "#FFF8F5" : i % 2 === 0 ? "#ffffff" : "rgba(249,250,251,0.6)";
                  return (
                    <tr key={t.id} style={{ backgroundColor: rowBg }}>
                      <td
                        className="px-5 py-3.5"
                        style={{ borderLeft: isHT ? "3px solid #E76F51" : "3px solid transparent" }}
                      >
                        <span className="text-sm font-medium text-gray-800">{t.client}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="relative w-24">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">$</span>
                          <input
                            type="number"
                            step={1}
                            min={0}
                            value={sharedClientRates[t.id]}
                            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) setClientRate(t.id, v); }}
                            className="w-full text-sm font-mono border border-gray-200 rounded-lg pl-6 pr-2 py-2 text-gray-900 focus:outline-none transition-shadow"
                            {...focusHandlers}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="relative">
                          <input
                            type="text"
                            value={desc}
                            onChange={(e) => setDescription(t.id, e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none transition-shadow"
                            {...focusHandlers}
                          />
                          {isCustomDesc && (
                            <span
                              className="absolute -top-2 -right-1 font-medium px-1.5 py-0.5 rounded"
                              style={{ fontSize: "10px", lineHeight: "1.4", backgroundColor: "#EFF6FF", color: "#3B82F6" }}
                            >
                              custom
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <ToggleSwitch
                          checked={isHT}
                          onChange={(val) => setHighTouch(t.id, val)}
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <input
                          type="text"
                          value={clientNotes[t.id]}
                          onChange={(e) => setClientNotes((n) => ({ ...n, [t.id]: e.target.value }))}
                          placeholder="Add a note..."
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none transition-shadow placeholder-gray-300"
                          {...focusHandlers}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* How Rounding Works */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-5">
          <p className="text-xs font-semibold text-gray-700 mb-3">How Rounding Works</p>
          <div className="space-y-2 text-sm text-gray-600 leading-relaxed">
            <p>
              <span className="font-medium text-gray-700">Rule:</span> Total monthly hours per client are rounded up to the next quarter hour (0.25 hrs) at month-end. Rounding is applied once across the full month — not per individual entry.
            </p>
            <p>
              <span className="font-medium text-gray-700">Formula:</span>{" "}
              <code className="font-mono text-xs bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-700">
                ceil(totalDecimalHours / 0.25) * 0.25
              </code>
            </p>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="text-xs font-mono">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left pr-10 py-1 font-medium">Raw time</th>
                  <th className="text-left pr-10 py-1 font-medium">Decimal hours</th>
                  <th className="text-left py-1 font-medium">Rounded</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["11h 53m", "11.88 hrs", "12.00 hrs"],
                  ["11h 48m", "11.80 hrs", "12.00 hrs"],
                  ["31h 34m", "31.57 hrs", "31.75 hrs"],
                ].map(([raw, dec, rounded]) => (
                  <tr key={raw} className="text-gray-700 border-t border-gray-200">
                    <td className="pr-10 py-1.5">{raw}</td>
                    <td className="pr-10 py-1.5">{dec}</td>
                    <td className="py-1.5">{rounded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* High-Touch Client Buffer */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-5">
          <p className="text-xs font-semibold text-gray-700 mb-2">High-Touch Client Buffer</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Approximately 5 clients receive a manual time adjustment at billing time to account for frequent calls and drop-in questions. These adjustments (typically 15–45 minutes, rarely more) are applied during invoice review — not logged as time entries in QuickBooks Time.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mt-2">
            Flag a client as High-Touch above to surface quick-add adjustment buttons in the Invoice Queue when reviewing that client&apos;s draft.
          </p>
        </div>

      </div>
    </div>
  );
}

/* ─── Client Mapping view ────────────────────────────────────── */
interface JobcodeRow {
  jobcodeId: string;
  jobcodeName: string;
  entryCount: number;
  customerId: string | null;
  customerName: string | null;
  qboCustomerId: string | null;
}

function ClientMappingView({
  initialCustomers,
  qboConnected,
  qbTimeConnected,
  onNavigateToSettings,
}: {
  initialCustomers: DbCustomer[];
  qboConnected: boolean;
  qbTimeConnected: boolean;
  onNavigateToSettings: () => void;
}) {
  const [customers, setCustomers] = useState<DbCustomer[]>(initialCustomers);
  const [qboCustomers, setQboCustomers] = useState<QboCustomer[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pendingSelections, setPendingSelections] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // QB Time jobcode mapping (Panel B)
  const [jobcodes, setJobcodes] = useState<JobcodeRow[]>([]);
  const [jobcodePending, setJobcodePending] = useState<Record<string, string>>({});
  const [jobcodeSaving, setJobcodeSaving] = useState<string | null>(null);
  const [jobcodeMessage, setJobcodeMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function loadJobcodes() {
    try {
      const res = await fetch("/api/qb-time/jobcodes");
      if (!res.ok) return;
      const json = await res.json();
      setJobcodes((json.jobcodes as JobcodeRow[]) ?? []);
    } catch {
      // Non-fatal — panel just shows no jobcodes.
    }
  }

  useEffect(() => {
    if (qbTimeConnected) loadJobcodes();
  }, [qbTimeConnected]);

  async function handleAssignJobcode(jc: JobcodeRow) {
    const qboId = jobcodePending[jc.jobcodeId];
    if (!qboId) return;
    const qboName = qboCustomers.find((q) => q.id === qboId)?.displayName ?? "";
    setJobcodeSaving(jc.jobcodeId);
    setJobcodeMessage(null);
    try {
      const res = await fetch("/api/qb-time/jobcodes/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobcodeId: jc.jobcodeId,
          jobcodeName: jc.jobcodeName,
          qboCustomerId: qboId,
          qboCustomerName: qboName,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json.error as string) ?? "Mapping failed");

      // Reflect the new/linked customer in Panel A, then refresh jobcode statuses.
      setCustomers((prev) =>
        prev.some((c) => c.qboCustomerId === qboId)
          ? prev
          : [...prev, { id: json.customerId as string, displayName: qboName, qboCustomerId: qboId }]
      );
      setJobcodePending((prev) => {
        const next = { ...prev };
        delete next[jc.jobcodeId];
        return next;
      });
      await loadJobcodes();
      setJobcodeMessage({ text: `Mapped “${jc.jobcodeName}” → ${qboName}.`, ok: true });
    } catch (err) {
      setJobcodeMessage({ text: (err as Error).message, ok: false });
    } finally {
      setJobcodeSaving(null);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/customers/sync-qbo", { method: "POST" });
      const text = await res.text();
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(text.slice(0, 200) || `Server error ${res.status}`);
      }
      if (!res.ok) throw new Error((json.error as string) ?? "Sync failed");
      const fetchedQboCustomers = (json.qboCustomers as QboCustomer[]) ?? [];
      const fetchedCustomers = (json.customers as { id: string; display_name: string; qbo_customer_id: string | null }[]) ?? [];
      const matched = (json.autoMatched as number) ?? 0;
      setQboCustomers(fetchedQboCustomers);
      setCustomers(
        fetchedCustomers.map((c) => ({
          id: c.id,
          displayName: c.display_name,
          qboCustomerId: c.qbo_customer_id ?? null,
        }))
      );
      setSyncMessage({
        text: matched > 0
          ? `Synced ${fetchedQboCustomers.length} QBO customers — ${matched} auto-matched by name.`
          : `Synced ${fetchedQboCustomers.length} QBO customers. Review matches below.`,
        ok: true,
      });
    } catch (err) {
      setSyncMessage({ text: (err as Error).message, ok: false });
    } finally {
      setSyncing(false);
    }
  }

  async function handleSave(customerId: string) {
    const qboId = pendingSelections[customerId];
    if (!qboId) return;
    setSavingId(customerId);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qbo_customer_id: qboId }),
      });
      if (!res.ok) throw new Error("Save failed");
      setCustomers((prev) =>
        prev.map((c) => (c.id === customerId ? { ...c, qboCustomerId: qboId } : c))
      );
      setPendingSelections((prev) => {
        const next = { ...prev };
        delete next[customerId];
        return next;
      });
    } finally {
      setSavingId(null);
    }
  }

  const qboMap = Object.fromEntries(qboCustomers.map((q) => [q.id, q.displayName]));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 md:px-8 py-6 space-y-6 max-w-4xl">

        {/* Header */}
        <div>
          <h1 className="font-display text-2xl text-gray-900">Client Mapping</h1>
          <p className="text-sm text-gray-500 mt-1">
            Link your billing clients to QuickBooks Online customers and QB Time jobcodes.
          </p>
        </div>

        {/* Panel A: QBO Customer Links */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">QuickBooks Online — Customer Links</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Each billing client must be linked to a QBO customer so invoices are created in the right account.
              </p>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing || !qboConnected}
              className="shrink-0 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              style={{ backgroundColor: "#2D6A4F", color: "white" }}
            >
              <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing…" : "Sync from QuickBooks Online"}
            </button>
          </div>

          {!qboConnected && (
            <div className="flex items-start gap-3 px-6 py-4 bg-amber-50 border-b border-amber-100">
              <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700">
                QuickBooks Online is not connected. Connect it in{" "}
                <button
                  className="underline font-medium"
                  onClick={onNavigateToSettings}
                >
                  Settings
                </button>{" "}
                to sync customers.
              </p>
            </div>
          )}

          {syncMessage && (
            <div
              className="flex items-start gap-3 px-6 py-3 border-b text-sm"
              style={{
                backgroundColor: syncMessage.ok ? "#F0FDF4" : "#FEF2F2",
                borderColor: syncMessage.ok ? "#BBF7D0" : "#FECACA",
                color: syncMessage.ok ? "#166534" : "#991B1B",
              }}
            >
              {syncMessage.ok
                ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
              {syncMessage.text}
            </div>
          )}

          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">QBO Customer</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((customer) => {
                const linked = customer.qboCustomerId;
                const pending = pendingSelections[customer.id];
                const hasPending = pending !== undefined && pending !== (customer.qboCustomerId ?? "");

                return (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3.5 font-medium text-gray-900">{customer.displayName}</td>
                    <td className="px-6 py-3.5">
                      {qboCustomers.length > 0 ? (
                        <select
                          value={pending ?? customer.qboCustomerId ?? ""}
                          onChange={(e) =>
                            setPendingSelections((prev) => ({ ...prev, [customer.id]: e.target.value }))
                          }
                          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 w-full max-w-xs"
                        >
                          <option value="">— select QBO customer —</option>
                          {qboCustomers.map((q) => (
                            <option key={q.id} value={q.id}>{q.displayName}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-400 text-sm">
                          {linked ? qboMap[linked] ?? linked : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {linked ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: "#D8F3DC", color: "#2D6A4F" }}
                        >
                          <CheckCircle2 size={11} />
                          Linked
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: "#FFF3E0", color: "#C2410C" }}
                        >
                          <AlertCircle size={11} />
                          Unlinked
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {hasPending && (
                        <button
                          onClick={() => handleSave(customer.id)}
                          disabled={savingId === customer.id}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          style={{ backgroundColor: "#2D6A4F", color: "white" }}
                        >
                          {savingId === customer.id ? "Saving…" : "Save"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          {qboCustomers.length === 0 && (
            <div className="px-6 py-4 text-xs text-gray-400 border-t border-gray-100">
              Click &quot;Sync from QuickBooks Online&quot; to load customers and enable dropdown matching.
            </div>
          )}
        </div>

        {/* Panel B: QB Time Jobcodes */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">QB Time — Jobcode Mapping</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Map each QB Time jobcode to the QuickBooks Online customer it bills to. We&apos;ll create the
              client record and route its time entries automatically.
            </p>
          </div>

          {!qbTimeConnected ? (
            <div className="flex items-start gap-3 px-6 py-4 bg-slate-50 border-b border-slate-100">
              <Lock size={15} className="text-slate-400 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-500">
                QB Time is not connected yet. Connect it in{" "}
                <button className="underline font-medium" onClick={onNavigateToSettings}>
                  Settings
                </button>
                , then sync to import jobcodes here.
              </p>
            </div>
          ) : jobcodes.length === 0 ? (
            <div className="px-6 py-4 text-xs text-gray-400 border-b border-gray-100">
              No jobcodes imported yet. Sync QB Time (Settings → Sync Now) to pull in time entries, then
              they&apos;ll appear here for mapping.
            </div>
          ) : (
            <>
              {qboCustomers.length === 0 && (
                <div className="flex items-start gap-3 px-6 py-3 bg-amber-50 border-b border-amber-100 text-sm text-amber-700">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>
                    Click &quot;Sync from QuickBooks Online&quot; above to load your QBO customers, then
                    choose one for each jobcode.
                  </span>
                </div>
              )}

              {jobcodeMessage && (
                <div
                  className="flex items-start gap-3 px-6 py-3 border-b text-sm"
                  style={{
                    backgroundColor: jobcodeMessage.ok ? "#F0FDF4" : "#FEF2F2",
                    borderColor: jobcodeMessage.ok ? "#BBF7D0" : "#FECACA",
                    color: jobcodeMessage.ok ? "#166534" : "#991B1B",
                  }}
                >
                  {jobcodeMessage.ok
                    ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                    : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
                  {jobcodeMessage.text}
                </div>
              )}

              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">QB Time Jobcode</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Maps To (QBO Customer)</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {jobcodes.map((jc) => {
                    const pending = jobcodePending[jc.jobcodeId];
                    const currentValue = pending ?? jc.qboCustomerId ?? "";
                    const hasPending = pending !== undefined && pending !== (jc.qboCustomerId ?? "");
                    return (
                      <tr key={jc.jobcodeId} className="hover:bg-gray-50">
                        <td className="px-6 py-3.5">
                          <div className="font-medium text-gray-900">{jc.jobcodeName}</div>
                          <div className="text-xs text-gray-400">
                            {jc.entryCount} {jc.entryCount === 1 ? "entry" : "entries"}
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <select
                            value={currentValue}
                            disabled={qboCustomers.length === 0}
                            onChange={(e) =>
                              setJobcodePending((prev) => ({ ...prev, [jc.jobcodeId]: e.target.value }))
                            }
                            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 w-full max-w-xs disabled:bg-gray-50 disabled:text-gray-400"
                          >
                            <option value="">— select QBO customer —</option>
                            {qboCustomers.map((q) => (
                              <option key={q.id} value={q.id}>{q.displayName}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-3.5">
                          {jc.customerId ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: "#D8F3DC", color: "#2D6A4F" }}
                            >
                              <CheckCircle2 size={11} />
                              Mapped
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: "#FFF3E0", color: "#C2410C" }}
                            >
                              <AlertCircle size={11} />
                              Unmapped
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          {hasPending && (
                            <button
                              onClick={() => handleAssignJobcode(jc)}
                              disabled={jobcodeSaving === jc.jobcodeId}
                              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                              style={{ backgroundColor: "#2D6A4F", color: "white" }}
                            >
                              {jobcodeSaving === jc.jobcodeId ? "Saving…" : "Save"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

/* ─── Settings view ──────────────────────────────────────────── */
function SettingsView({ qboConnected, qbTimeConnected, qbTimeConnectedAt, onSyncNow, firmName, templates, allEntries, liveTotalBilling, canConnect }: {
  qboConnected: boolean
  qbTimeConnected: boolean
  qbTimeConnectedAt: string | null
  onSyncNow: () => void
  firmName: string
  templates: InvoiceTemplate[]
  allEntries: FlatEntry[]
  liveTotalBilling: number
  canConnect: boolean
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 md:px-8 py-6 space-y-6 max-w-4xl">

        {/* Page header */}
        <div>
          <h1 className="font-display text-2xl text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">System configuration and integration status</p>
        </div>

        {/* Integrations & Data Sources */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Integrations &amp; Data Sources</p>
          </div>
          <div className="divide-y divide-gray-100">

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-6 py-4 sm:gap-6">
              <span className="text-sm text-gray-500 shrink-0">Time import source</span>
              <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                <span className="text-sm text-gray-800">QuickBooks Time</span>
                {qbTimeConnected ? (
                  <>
                    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "#DCFCE7", color: "#166534" }}>
                      Connected
                    </span>
                    {qbTimeConnectedAt && (
                      <span className="text-xs text-gray-400">
                        since {new Date(qbTimeConnectedAt).toLocaleDateString()}
                      </span>
                    )}
                    <button
                      onClick={onSyncNow}
                      className="inline-flex items-center text-xs font-medium px-3 py-1.5 rounded-md text-white"
                      style={{ backgroundColor: "#2D6A4F" }}
                    >
                      Sync Now
                    </button>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "#F1F5F9", color: "#475569" }}>
                      Not Connected
                    </span>
                    {canConnect && (
                      <a
                        href="/api/auth/qb-time/connect"
                        className="inline-flex items-center text-xs font-medium px-3 py-1.5 rounded-md text-white"
                        style={{ backgroundColor: "#2D6A4F" }}
                      >
                        Connect QB Time
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-6 py-4 sm:gap-6">
              <span className="text-sm text-gray-500 shrink-0">Invoice destination</span>
              <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                <span className="text-sm text-gray-800">QuickBooks Online</span>
                {qboConnected ? (
                  <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "#DCFCE7", color: "#166534" }}>
                    Connected
                  </span>
                ) : (
                  <>
                    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "#F1F5F9", color: "#475569" }}>
                      Not Connected
                    </span>
                    {canConnect && (
                      <a
                        href="/api/auth/qbo/connect"
                        className="inline-flex items-center text-xs font-medium px-3 py-1.5 rounded-md text-white"
                        style={{ backgroundColor: "#2D6A4F" }}
                      >
                        Connect
                      </a>
                    )}
                  </>
                )}
                <span className="text-xs text-gray-400">Draft invoices only</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-6 py-4 sm:gap-6">
              <span className="text-sm text-gray-500 shrink-0">Payment portal</span>
              <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                <span className="text-sm text-gray-800">BillerGenie</span>
                <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "#F1F5F9", color: "#475569" }}>
                  Syncs via Premium Plan
                </span>
                <span className="text-xs text-gray-400">Auto-syncs from QBO via Premium plan</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between px-6 py-4 sm:gap-6">
              <span className="text-sm text-gray-500 shrink-0">BillerGenie plan</span>
              <div className="sm:text-right">
                <p className="text-sm text-gray-800">Premium</p>
                <p className="font-mono text-xs text-gray-400 mt-0.5">$69.95/month + 0.50% per invoice collected</p>
              </div>
            </div>

          </div>
        </div>

        {/* Billing Behavior */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Billing Behavior</p>
          </div>
          <div className="divide-y divide-gray-100">

            <div className="flex items-center justify-between px-6 py-3.5">
              <span className="text-sm text-gray-500">Auto-send invoices</span>
              <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                Off
              </span>
            </div>

            <div className="flex items-center justify-between px-6 py-3.5">
              <span className="text-sm text-gray-500">Require owner approval before sending</span>
              <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#D8F3DC", color: "#2D6A4F" }}>
                On
              </span>
            </div>

            <div className="flex items-center justify-between px-6 py-3.5">
              <span className="text-sm text-gray-500">Invoice date rule</span>
              <span className="text-sm text-gray-700">1st of the following month</span>
            </div>

            <div className="flex items-center justify-between px-6 py-3.5">
              <span className="text-sm text-gray-500">Due date rule</span>
              <span className="text-sm text-gray-700">5 days after invoice date</span>
            </div>

            <div className="flex items-center justify-between px-6 py-3.5">
              <span className="text-sm text-gray-500">Rounding method</span>
              <span className="font-mono text-sm text-gray-700">Ceiling to next 0.25 hrs</span>
            </div>

          </div>
        </div>

        {/* Product Fit Callout */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-5 border-l-4" style={{ borderLeftColor: "#2D6A4F" }}>
          <p className="text-xs font-semibold text-gray-700 mb-2">How This Fits Your Existing Tools</p>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            This dashboard does not replace TaxDome, QuickBooks, or BillerGenie. It sits between QBO Time and QuickBooks invoices to automate the one step those tools don&apos;t handle: turning approved time entries into summarized draft invoices, ready for your review.
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { label: "QBO Time", highlight: false },
              { label: "Billing Review Dashboard", highlight: true },
              { label: "QuickBooks Draft Invoice", highlight: false },
              { label: "BillerGenie Payment Portal", highlight: false },
            ].map((item, i, arr) => (
              <span key={item.label} className="flex items-center gap-1.5">
                <span
                  className="font-mono text-xs px-2.5 py-1.5 rounded border"
                  style={
                    item.highlight
                      ? { backgroundColor: "#2D6A4F", color: "white", borderColor: "#2D6A4F" }
                      : { backgroundColor: "white", color: "#374151", borderColor: "#e5e7eb" }
                  }
                >
                  {item.label}
                </span>
                {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />}
              </span>
            ))}
          </div>
        </div>

        {/* About */}
        <div className="rounded-xl bg-gray-100 px-6 py-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">About</p>
          <div className="space-y-1 text-sm text-gray-500">
            <p className="font-semibold text-gray-600">ClockToBill — Billing Review Dashboard</p>
            <p>{firmName}</p>
            <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
              <p className="text-sm text-gray-500 leading-relaxed">
                Automates monthly invoice generation by pulling approved time entries from QuickBooks Time, aggregating and rounding hours per client, and sending invoices through QuickBooks Online after firm owner review.
              </p>
              <p className="font-mono text-xs text-gray-500">
                {templates.length} clients · {allEntries.length} time entries · {formatCurrency(liveTotalBilling)} in proposed billing
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-2">
          Need help? Contact us at{' '}
          <a href="mailto:support@ctaintegrity.com" className="underline hover:text-gray-600">
            support@ctaintegrity.com
          </a>
        </p>

        {/* Account */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Account</p>
          </div>
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">Change your password</p>
              <p className="text-xs text-gray-400 mt-0.5">We&apos;ll send a reset link to your email</p>
            </div>
            <a
              href="/forgot-password"
              className="text-sm font-medium text-[#2D6A4F] hover:text-[#235a42] transition-colors"
            >
              Reset password
            </a>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-700">Sign out of ClockToBill</p>
            <SignOutButton />
          </div>
        </div>

      </div>
    </div>
  );
}

/* ─── Sign out ───────────────────────────────────────────────── */
function SignOutButton() {
  const [loading, setLoading] = useState(false);
  async function handleSignOut() {
    setLoading(true);
    const { createClient } = await import('@/lib/supabase/client');
    await createClient().auth.signOut();
    window.location.href = '/login';
  }
  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}

/* ─── Placeholder ────────────────────────────────────────────── */
function PlaceholderView({ title }: { title: string }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-0">
      <div className="text-center px-6">
        <h2 className="font-display text-2xl text-gray-800 mb-2">{title}</h2>
        <p className="text-sm text-gray-400">This section is coming soon.</p>
      </div>
    </div>
  );
}

/* ─── Main page component ────────────────────────────────────── */
export default function InvoicesClient({ templates, allEntries, timeEntries, defaultRate, qboConnected, qbTimeConnected, qbTimeConnectedAt, customers, firmName, role, currentRun, availableRuns, defaultGenerateMonth }: InvoicesClientProps) {
  const canSend = role === 'owner' || role === 'admin'
  const canConnect = role === 'owner' || role === 'admin'
  const router = useRouter();
  const billingMonth = currentRun?.billingMonth ?? null;
  const [activeView, setActiveView] = useState<NavView>("billing-run");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeNavLabel = NAV_ITEMS.find((n) => n.view === activeView)?.label ?? "";
  const [sharedHighTouch, setSharedHighTouch] = useState<Record<string, boolean>>(
    Object.fromEntries(templates.map((t) => [t.id, false]))
  );
  const [sharedDescriptions, setSharedDescriptions] = useState<Record<string, string>>(
    Object.fromEntries(templates.map((t) => [t.id, t.defaultDescription]))
  );
  const [firmDefaultRate, setFirmDefaultRate] = useState<number>(defaultRate);
  const [sharedClientRates, setSharedClientRates] = useState<Record<string, number>>(
    Object.fromEntries(templates.map((t) => [t.id, defaultRate]))
  );

  async function handleSyncNow() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
    try {
      const res = await fetch('/api/qb-time/sync-timesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: start, end_date: end }),
      })
      const data = await res.json() as { upserted?: number; error?: string }
      if (!res.ok) alert(`Sync failed: ${data.error ?? 'Unknown error'}`)
      else alert(`Sync complete — ${data.upserted ?? 0} entries imported.`)
    } catch {
      alert('Sync request failed. Check console for details.')
    }
  }

  function setHighTouch(id: string, val: boolean) {
    setSharedHighTouch((prev) => ({ ...prev, [id]: val }));
  }
  function setDescription(id: string, val: string) {
    setSharedDescriptions((prev) => ({ ...prev, [id]: val }));
  }
  function setClientRate(id: string, val: number) {
    setSharedClientRates((prev) => ({ ...prev, [id]: val }));
  }
  const [invoiceStates, setInvoiceStates] = useState<Record<string, InvoiceState>>(
    Object.fromEntries(
      templates.map((t) => [
        t.id,
        {
          hours: ceilToQuarterHour(t.rawMinutes),
          rate: sharedClientRates[t.id],
          internalNote: "",
          expanded: false,
          status: "in_review" as InvoiceStatus,
          adjustmentReason: "",
        },
      ])
    )
  );
  function updateInvoiceState(id: string, update: Partial<InvoiceState>) {
    setInvoiceStates((prev) => ({ ...prev, [id]: { ...prev[id], ...update } }));
  }

  // Months that actually have synced time entries, formatted YYYY-MM-01, newest first.
  // Same pattern AllTimeEntriesView uses; converted to YYYY-MM-01 to feed the API + label helpers.
  const generateMonthOptions = useMemo(
    () => Array.from(new Set(timeEntries.map((e) => e.month))).sort().reverse().map((m) => `${m}-01`),
    [timeEntries]
  );
  const [generateMonth, setGenerateMonth] = useState<string>(generateMonthOptions[0] ?? defaultGenerateMonth);
  const [generating, setGenerating] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function addToast(message: string) {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }

  async function handleGenerate() {
    if (generating) return;
    const month = generateMonth;
    setGenerating(true);
    try {
      const res = await fetch('/api/billing-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingMonth: month }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to generate drafts');
      }
      addToast('Billing drafts generated. Review invoices below.');
      // Hard navigation to bust Next.js router cache after mutation (same pattern as original M4 fix)
      window.location.href = `/invoices?month=${month}`;
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to generate drafts');
      setGenerating(false);
    }
  }

  const liveTotalBilling = templates.reduce((sum, t) => sum + invoiceStates[t.id].hours * invoiceStates[t.id].rate, 0);
  const activeBillingMonth = billingMonth ?? defaultGenerateMonth;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Toasts (lifted to parent so both BillingRunDashboard and InvoiceQueueView can use them) */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="bg-gray-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl max-w-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20" style={{ color: "#52B788" }}>
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {toast.message}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile drawer backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — static on desktop, off-canvas drawer on mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col transform transition-transform duration-200 md:static md:w-56 md:shrink-0 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: "#2D6A4F" }}
      >
        <div className="px-5 py-5 border-b flex items-center justify-between" style={{ borderColor: "rgba(216,243,220,0.2)" }}>
          <p className="font-display text-white text-base leading-snug">{firmName}</p>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-white/80 hover:text-white p-2 -mr-2"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ view, label, Icon }) => {
            const active = activeView === view;
            return (
              <button
                key={view}
                onClick={() => { setActiveView(view); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors"
                style={{ backgroundColor: active ? "rgba(255,255,255,0.15)" : "transparent", color: active ? "white" : "#D8F3DC" }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                {label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 h-14 shrink-0 border-b border-gray-200 bg-white">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-700 p-2 -ml-2"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <span className="font-display text-gray-900 text-lg truncate">{activeNavLabel}</span>
        </header>

        {activeView === "invoice-queue" && (
          <InvoiceQueueView
            sharedHighTouch={sharedHighTouch}
            setHighTouch={setHighTouch}
            sharedDescriptions={sharedDescriptions}
            setDescription={setDescription}
            firmDefaultRate={firmDefaultRate}
            sharedClientRates={sharedClientRates}
            invoiceStates={invoiceStates}
            updateInvoiceState={updateInvoiceState}
            templates={templates}
            onGenerate={handleGenerate}
            firmName={firmName}
            billingMonth={activeBillingMonth}
            runBillingMonth={billingMonth}
            addToast={addToast}
            generateMonth={generateMonth}
            generateMonthOptions={generateMonthOptions}
            onGenerateMonthChange={setGenerateMonth}
            generating={generating}
            canSend={canSend}
          />
        )}
        {activeView === "billing-run" && (
          <BillingRunDashboard
            invoiceStates={invoiceStates}
            templates={templates}
            billingMonth={billingMonth}
            availableRuns={availableRuns}
            allEntries={allEntries}
            onGenerate={handleGenerate}
            generateMonth={generateMonth}
            generateMonthOptions={generateMonthOptions}
            onGenerateMonthChange={setGenerateMonth}
            generating={generating}
          />
        )}
        {activeView === "time-entries" && <AllTimeEntriesView timeEntries={timeEntries} onSyncNow={handleSyncNow} qbTimeConnected={qbTimeConnected} />}
        {activeView === "client-rules" && (
          <ClientRulesView
            sharedHighTouch={sharedHighTouch}
            setHighTouch={setHighTouch}
            sharedDescriptions={sharedDescriptions}
            setDescription={setDescription}
            firmDefaultRate={firmDefaultRate}
            setFirmDefaultRate={setFirmDefaultRate}
            sharedClientRates={sharedClientRates}
            setClientRate={setClientRate}
            templates={templates}
          />
        )}
        {activeView === "client-mapping" && (
          <ClientMappingView initialCustomers={customers} qboConnected={qboConnected} qbTimeConnected={qbTimeConnected} onNavigateToSettings={() => setActiveView("settings")} />
        )}
        {activeView === "settings" && (
          <SettingsView
            qboConnected={qboConnected}
            qbTimeConnected={qbTimeConnected}
            qbTimeConnectedAt={qbTimeConnectedAt}
            onSyncNow={handleSyncNow}
            firmName={firmName}
            templates={templates}
            allEntries={allEntries}
            liveTotalBilling={liveTotalBilling}
            canConnect={canConnect}
          />
        )}
      </div>
    </div>
  );
}
