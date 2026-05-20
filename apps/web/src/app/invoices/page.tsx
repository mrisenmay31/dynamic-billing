"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Clock,
  Settings2,
  Settings,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */
interface TimeEntry {
  date: string;
  staff: string;
  note: string;
  duration: string;
}

interface InvoiceTemplate {
  id: string;
  client: string;
  billTo?: string;
  invoiceNum: string;
  rawMinutes: number;
  defaultDescription: string;
  entries: TimeEntry[];
}

interface InvoiceState {
  hours: number;
  rate: number;
  description: string;
  internalNote: string;
  expanded: boolean;
  sent: boolean;
}

interface Toast {
  id: string;
  message: string;
}

type NavView = "billing-run" | "invoice-queue" | "time-entries" | "client-rules" | "settings";

/* ─── Utilities ──────────────────────────────────────────────── */
function ceilToQuarterHour(totalMinutes: number): number {
  return Math.ceil(totalMinutes / 15) * 0.25;
}

function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
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

/* ─── Hardcoded data (April 2026 — real client data) ─────────── */
const DEFAULT_RATE = 125;

const TEMPLATES: InvoiceTemplate[] = [
  {
    id: "knoxville-title",
    client: "Knoxville Title Agency LLC",
    billTo: "Chase Reno",
    invoiceNum: "INV-5141",
    rawMinutes: 1894,
    defaultDescription: "Monthly Bookkeeping",
    entries: [
      { date: "04/01", staff: "Lea A. Sanford", note: "Billing, positive pay", duration: "0:20" },
      { date: "04/02", staff: "Amy Snyder", note: "Payroll workbook, garnishment calculation", duration: "0:34" },
      { date: "04/02", staff: "Amy Snyder", note: "Looking up medical deduction for employee", duration: "0:16" },
      { date: "04/02", staff: "Amy Snyder", note: "Finish processing payroll", duration: "0:46" },
      { date: "04/02", staff: "Lea A. Sanford", note: "Positive pay and bill pay", duration: "0:15" },
      { date: "04/06", staff: "Lea A. Sanford", note: "March recon and draft financials", duration: "1:09" },
      { date: "04/07", staff: "Lea A. Sanford", note: "Positive pay, enter and paying bills", duration: "1:03" },
      { date: "04/08", staff: "Amy Snyder", note: "Looking at health insurance deductions", duration: "0:29" },
      { date: "04/08", staff: "Amy Snyder", note: "Payroll workbook, garnishment calculation", duration: "0:53" },
      { date: "04/08", staff: "Lea A. Sanford", note: "Pos pay, updating financials, reply to Chase's email, bill entering", duration: "2:01" },
      { date: "04/09", staff: "Amy Snyder", note: "Resend bonus payroll", duration: "0:22" },
      { date: "04/09", staff: "Lea A. Sanford", note: "Positive pay, entering ACH template", duration: "0:06" },
      { date: "04/09", staff: "Lea A. Sanford", note: "Payroll with Amy, setting up Jimmy's regular pay", duration: "0:15" },
      { date: "04/09", staff: "Amy Snyder", note: "Run payroll", duration: "1:14" },
      { date: "04/10", staff: "Amy Snyder", note: "JR ACH payment and GJ entry", duration: "0:22" },
      { date: "04/10", staff: "Lea A. Sanford", note: "Positive pay, email/research on return ACH", duration: "0:18" },
      { date: "04/13", staff: "Lea A. Sanford", note: "Positive pay, paid bills, email follow-ups", duration: "0:56" },
      { date: "04/15", staff: "Joseph Broome", note: "Classification", duration: "2:03" },
      { date: "04/15", staff: "Joseph Broome", note: "P&L classifying", duration: "0:15" },
      { date: "04/15", staff: "Lea A. Sanford", note: "Positive pay, bill.com, bank transactions", duration: "0:23" },
      { date: "04/16", staff: "Amy Snyder", note: "Payroll with bonus, emails with employee re: W4, process payroll", duration: "2:16" },
      { date: "04/16", staff: "Lea A. Sanford", note: "TPP Audit", duration: "0:09" },
      { date: "04/16", staff: "Lea A. Sanford", note: "Positive pay, bill pay", duration: "0:36" },
      { date: "04/19", staff: "Lea A. Sanford", note: "Q1 financials", duration: "2:08" },
      { date: "04/20", staff: "Amy Snyder", note: "Emailing about registered agent letter", duration: "0:14" },
      { date: "04/20", staff: "Lea A. Sanford", note: "Work meeting etc.", duration: "2:41" },
      { date: "04/21", staff: "Amy Snyder", note: "Processed payroll", duration: "1:12" },
      { date: "04/23", staff: "Amy Snyder", note: "ACH for payroll, new employee setup", duration: "1:28" },
      { date: "04/24", staff: "Amy Snyder", note: "Positive pay approvals, garnishment release, new employee", duration: "0:49" },
      { date: "04/27", staff: "Amy Snyder", note: "Positive pay, updated employee W4", duration: "0:17" },
      { date: "04/30", staff: "Amy Snyder", note: "Payroll workbook", duration: "0:25" },
      { date: "04/30", staff: "Lea A. Sanford", note: "ACH and positive pay", duration: "0:59" },
      { date: "04/30", staff: "Amy Snyder", note: "Process payroll, added PTO", duration: "1:00" },
    ],
  },
  {
    id: "baine",
    client: "Baine & Company",
    invoiceNum: "INV-5101",
    rawMinutes: 713,
    defaultDescription: "Monthly Bookkeeping Services-2026 recons caught up (1st Quarter)",
    entries: [
      { date: "04/10", staff: "Abby N. Townsend", note: "Reviewing bank accounts and statements to make sure they match each other", duration: "0:15" },
      { date: "04/17", staff: "Giovanni Sanchez", note: "2026 categorizing and recon", duration: "1:47" },
      { date: "04/20", staff: "Giovanni Sanchez", note: "Bank trans & recon", duration: "3:50" },
      { date: "04/22", staff: "Victoria Wyres", note: "Review", duration: "0:47" },
      { date: "04/22", staff: "Victoria Wyres", note: "Review, fixes, sending email with questions", duration: "0:50" },
      { date: "04/28", staff: "Victoria Wyres", note: "Fixing job costing", duration: "0:32" },
      { date: "04/28", staff: "Victoria Wyres", note: "Sending spreadsheet to Tyler, deleting bank rules", duration: "0:10" },
      { date: "04/28", staff: "Victoria Wyres", note: "Adding savings accounts 5124 and 5208, fixing transactions in limbo", duration: "1:46" },
      { date: "04/28", staff: "Victoria Wyres", note: "Clean up job costing", duration: "0:20" },
      { date: "04/28", staff: "Victoria Wyres", note: "Job costing", duration: "1:28" },
      { date: "04/29", staff: "Victoria Wyres", note: "Phone call with Tyler", duration: "0:08" },
    ],
  },
  {
    id: "knox-pt",
    client: "Knox Physical Therapy",
    invoiceNum: "INV-5138",
    rawMinutes: 708,
    defaultDescription: "Monthly Bookkeeping",
    entries: [
      { date: "04/01", staff: "Amy Snyder", note: "Payroll", duration: "1:04" },
      { date: "04/03", staff: "Amy Snyder", note: "Time entry adjustment, created new workbook for mileage", duration: "0:12" },
      { date: "04/07", staff: "Amy Snyder", note: "Updated vacation for employee, sent timesheets to Dr. E for approval", duration: "0:09" },
      { date: "04/07", staff: "Amy Snyder", note: "Pulling timesheet for Dr. E approval, sent email to employee re: PTO", duration: "0:24" },
      { date: "04/07", staff: "Joseph Broome", note: "PTO log", duration: "0:35" },
      { date: "04/08", staff: "Amy Snyder", note: "Entered workbook and time in QBO", duration: "0:45" },
      { date: "04/08", staff: "Amy Snyder", note: "Saved reimbursement, resent email to Dr. Easley with timesheets", duration: "0:20" },
      { date: "04/09", staff: "Amy Snyder", note: "Payroll", duration: "0:40" },
      { date: "04/10", staff: "Amy Snyder", note: "Added PTO for employee", duration: "0:05" },
      { date: "04/13", staff: "Amy Snyder", note: "Time entry update for employee", duration: "0:07" },
      { date: "04/14", staff: "Amy Snyder", note: "Sent timesheets to KS for approval, workbook", duration: "0:30" },
      { date: "04/15", staff: "Amy Snyder", note: "Payroll", duration: "0:55" },
      { date: "04/21", staff: "Joseph Broome", note: "PTO logs", duration: "0:20" },
      { date: "04/21", staff: "Amy Snyder", note: "Sent timesheets, quarterly multi-location report submitted", duration: "1:31" },
      { date: "04/22", staff: "Amy Snyder", note: "Payroll workbook", duration: "0:29" },
      { date: "04/22", staff: "Amy Snyder", note: "Checked hours in QBO, submitted, did bank transfer", duration: "0:40" },
      { date: "04/23", staff: "Amy Snyder", note: "Finished payroll reports", duration: "0:34" },
      { date: "04/30", staff: "Amy Snyder", note: "Finalize payroll, added employee time", duration: "0:44" },
    ],
  },
];

/* ─── Nav config ─────────────────────────────────────────────── */
const NAV_ITEMS: { view: NavView; label: string; Icon: React.ElementType }[] = [
  { view: "billing-run", label: "Billing Run", Icon: LayoutDashboard },
  { view: "invoice-queue", label: "Invoice Queue", Icon: FileText },
  { view: "time-entries", label: "All Time Entries", Icon: Clock },
  { view: "client-rules", label: "Client Rules", Icon: Settings2 },
  { view: "settings", label: "Settings", Icon: Settings },
];

/* ─── Sub-components ─────────────────────────────────────────── */
function StatusBadge({ sent }: { sent: boolean }) {
  if (sent) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-pale text-green-primary">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        SENT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-orange-50 text-brand-amber">
      DRAFT
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

function StatCard({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`mt-1.5 text-2xl font-medium text-gray-900 ${mono ? "font-mono" : "font-display"}`}>
        {value}
      </p>
    </div>
  );
}

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

/* ─── Billing Run Dashboard ──────────────────────────────────── */
function BillingRunDashboard() {
  const steps = [
    { label: "Imported QBO Time", state: "done" },
    { label: "Reviewed Time", state: "active" },
    { label: "Draft Invoices Prepared", state: "upcoming" },
    { label: "QBO Drafts Created", state: "upcoming" },
  ] as const;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 space-y-6 max-w-4xl">

        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl text-gray-900 leading-tight">May 2026 Billing Run</h1>
              <p className="text-sm mt-0.5 text-gray-500">April 2026 Time Entries</p>
              <p className="text-xs mt-1 text-gray-400">April's time is billed in May — this is standard practice.</p>
            </div>
            <span
              className="mt-1 shrink-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: "#FFF3E0", color: "#C2410C" }}
            >
              In Review
            </span>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Clients Ready for Review", value: "3", mono: false },
            { label: "Proposed Billing", value: "$6,968.75", mono: true },
            { label: "Rounded Billable Hours", value: "55.75 hrs", mono: true },
            { label: "Estimated Time Saved", value: "2.5+ hours", mono: false },
          ].map(({ label, value, mono }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider leading-tight">{label}</p>
              <p className={`mt-2 text-2xl font-medium text-gray-900 ${mono ? "font-mono" : "font-display"}`}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-5">Billing Run Progress</p>
          <div className="flex items-start">
            {steps.map((step, i) => (
              <div key={step.label} className="flex items-start flex-1 relative">
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div
                    className="absolute top-3.5 left-1/2 w-full h-px"
                    style={{
                      backgroundColor: step.state === "done" ? "#2D6A4F" : "#e5e7eb",
                      transform: "translateY(-50%)",
                    }}
                  />
                )}
                {/* Circle + label */}
                <div className="flex flex-col items-center flex-1 relative z-10">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor:
                        step.state === "done" ? "#2D6A4F" :
                        step.state === "active" ? "#52B788" :
                        "white",
                      border:
                        step.state === "upcoming" ? "2px solid #e5e7eb" : "none",
                    }}
                  >
                    {step.state === "done" && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {step.state === "active" && (
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                    )}
                  </div>
                  <p
                    className="mt-2 text-xs text-center leading-snug px-1"
                    style={{
                      color: step.state === "upcoming" ? "#9ca3af" : "#111827",
                      fontWeight: step.state === "active" ? 600 : 400,
                    }}
                  >
                    {step.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Billing totals breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Billing Totals — April 2026</p>
          <div className="divide-y divide-gray-100">
            {[
              { label: "Total raw time imported", value: "55:15" },
              { label: "Total raw amount (pre-rounding)", value: "$6,906.11" },
              { label: "Total rounded invoice hours", value: "55.75 hrs" },
              { label: "Total proposed billing", value: "$6,968.75" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-500">{label}</span>
                <span className="font-mono text-sm font-medium text-gray-900">{value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-500">Rounding / adjustment difference</span>
              <span
                className="font-mono text-sm font-semibold px-2 py-0.5 rounded"
                style={{ color: "#2D6A4F", backgroundColor: "#F0FDF4" }}
              >
                +$62.64
              </span>
            </div>
          </div>
        </div>

        {/* Review summary */}
        <div
          className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5 border-l-4"
          style={{ borderLeftColor: "#2D6A4F" }}
        >
          <p className="text-sm text-gray-700 leading-relaxed">
            May 2026 billing is ready for review. We found{" "}
            <span className="font-semibold text-gray-900">3 client invoices</span>,{" "}
            <span className="font-semibold text-gray-900">55.75 rounded billable hours</span>, and{" "}
            <span className="font-semibold text-gray-900">$6,968.75</span> in proposed billing.
            Instead of manually grouping time and rebuilding invoices, review the prepared drafts
            and create QuickBooks drafts when ready.
          </p>
          <div className="mt-4 flex items-center gap-4 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
              style={{ backgroundColor: "#D8F3DC", color: "#2D6A4F" }}
            >
              Estimated billing prep time: 5–10 minutes
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-500">
              Previous manual process: 2–3 hours
            </span>
          </div>
        </div>

        {/* Product fit callout */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-5">
          <p className="text-xs font-semibold text-gray-700 mb-1">How this fits your existing tools</p>
          <p className="text-xs text-gray-500 leading-relaxed mb-3">
            This dashboard does not replace TaxDome, QuickBooks, or BillerGenie. It sits between
            QBO Time and QuickBooks invoices to turn reviewed time into prepared invoice drafts.
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {["QBO Time", "Billing Review Dashboard", "QuickBooks Draft Invoice", "BillerGenie Payment Portal"].map(
              (item, i, arr) => (
                <span key={item} className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-gray-600 bg-white border border-gray-200 px-2 py-1 rounded">
                    {item}
                  </span>
                  {i < arr.length - 1 && (
                    <span className="font-mono text-xs text-gray-400">→</span>
                  )}
                </span>
              )
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ─── Invoice Queue view ─────────────────────────────────────── */
function InvoiceQueueView() {
  const [states, setStates] = useState<Record<string, InvoiceState>>(
    Object.fromEntries(
      TEMPLATES.map((t) => [
        t.id,
        {
          hours: ceilToQuarterHour(t.rawMinutes),
          rate: DEFAULT_RATE,
          description: t.defaultDescription,
          internalNote: "",
          expanded: false,
          sent: false,
        },
      ])
    )
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [generating, setGenerating] = useState(false);

  const allTotalHours = TEMPLATES.reduce((sum, t) => sum + states[t.id].hours, 0);
  const allTotalBilled = TEMPLATES.reduce(
    (sum, t) => sum + states[t.id].hours * states[t.id].rate,
    0
  );
  const unsentTemplates = TEMPLATES.filter((t) => !states[t.id].sent);
  const unsentTotal = unsentTemplates.reduce(
    (sum, t) => sum + states[t.id].hours * states[t.id].rate,
    0
  );

  function addToast(message: string) {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }

  function updateState(id: string, update: Partial<InvoiceState>) {
    setStates((prev) => ({ ...prev, [id]: { ...prev[id], ...update } }));
  }

  function approveInvoice(id: string) {
    const template = TEMPLATES.find((t) => t.id === id)!;
    updateState(id, { sent: true, expanded: false });
    addToast(`${template.client} — invoice sent to QuickBooks Online`);
  }

  function approveAll() {
    const targets = TEMPLATES.filter((t) => !states[t.id].sent);
    targets.forEach((t) => updateState(t.id, { sent: true, expanded: false }));
    if (targets.length === 1) {
      addToast(`${targets[0].client} — invoice sent to QuickBooks Online`);
    } else {
      addToast(`${targets.length} invoices approved and sent to QuickBooks Online`);
    }
  }

  function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      addToast("3 draft invoices generated for April 2026");
    }, 1400);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-gray-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl max-w-sm animate-in fade-in slide-in-from-top-2 duration-300"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-light shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {toast.message}
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <header style={{ backgroundColor: "#2D6A4F" }}>
        <div className="px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-white leading-tight">
              Invoice Queue
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "#D8F3DC" }}>
              April 2026 · Billing Period
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors disabled:opacity-60"
            style={{ borderColor: "rgba(216,243,220,0.5)", color: "white" }}
            onMouseEnter={(e) => {
              if (!generating) {
                e.currentTarget.style.backgroundColor = "white";
                e.currentTarget.style.color = "#2D6A4F";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "white";
            }}
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
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-28">
        <div className="px-8 py-6 space-y-4 max-w-4xl">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Drafts Ready" value={unsentTemplates.length.toString()} />
            <StatCard label="Total Hours" value={`${formatHours(allTotalHours)} hrs`} mono />
            <StatCard label="Total Billed" value={formatCurrency(allTotalBilled)} mono />
          </div>

          {/* Invoice cards */}
          {TEMPLATES.map((template) => {
            const state = states[template.id];
            const amount = state.hours * state.rate;
            const defaultRounded = ceilToQuarterHour(template.rawMinutes);

            return (
              <div
                key={template.id}
                className={`bg-white rounded-xl border transition-all duration-200 ${
                  state.sent ? "border-gray-100 opacity-60" : "border-gray-200 shadow-sm"
                }`}
              >
                <button
                  onClick={() =>
                    !state.sent && updateState(template.id, { expanded: !state.expanded })
                  }
                  className={`w-full text-left px-6 py-5 ${state.sent ? "cursor-default" : "cursor-pointer"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-display text-xl text-gray-900 leading-snug">
                        {template.client}
                      </h2>
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1">
                        <span className="font-mono text-xs text-gray-400">{template.invoiceNum}</span>
                        <span className="text-gray-200 text-xs">·</span>
                        <span className="text-xs text-gray-400">April 2026</span>
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
                        <div className="font-mono text-xl font-medium text-gray-900">
                          {formatCurrency(amount)}
                        </div>
                        <div className="font-mono text-xs text-gray-400 mt-0.5">
                          {formatHours(state.hours)} hrs @ ${state.rate}/hr
                        </div>
                      </div>
                      <StatusBadge sent={state.sent} />
                      {!state.sent && <ChevronIcon expanded={state.expanded} />}
                    </div>
                  </div>
                </button>

                {state.expanded && !state.sent && (
                  <div className="px-6 pb-6 border-t border-gray-100">
                    <div className="pt-5 space-y-5">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Time Entries</h3>
                          <span className="text-xs text-gray-400 italic">Not shown on invoice</span>
                        </div>
                        <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-100" style={{ scrollbarWidth: "thin" }}>
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                              <tr>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-500 w-14">Date</th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-500 w-40">Staff</th>
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
                        <div className="mt-2.5 flex items-center gap-1.5 text-sm">
                          <span className="font-mono text-gray-600">{formatMinutes(template.rawMinutes)}</span>
                          <span className="text-gray-400">raw</span>
                          <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="font-mono font-medium" style={{ color: "#40916C" }}>
                            {formatHours(defaultRounded)} hrs
                          </span>
                          <span className="text-gray-400">billed</span>
                          <span className="text-gray-300 text-xs ml-0.5">(rounded up to next 0.25)</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice Details</h3>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">Client-facing description</label>
                          <textarea
                            value={state.description}
                            onChange={(e) => updateState(template.id, { description: e.target.value })}
                            rows={2}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 resize-none focus:outline-none transition-shadow"
                            onFocus={(e) => {
                              e.currentTarget.style.borderColor = "#40916C";
                              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(45,106,79,0.1)";
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = "#e5e7eb";
                              e.currentTarget.style.boxShadow = "none";
                            }}
                          />
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">Hours billed</label>
                            <div className="relative">
                              <input
                                type="number"
                                value={state.hours}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val >= 0) updateState(template.id, { hours: val });
                                }}
                                step={0.25}
                                min={0}
                                className="w-full text-sm font-mono border border-gray-200 rounded-lg px-3 py-2.5 pr-10 text-gray-900 focus:outline-none transition-shadow"
                                onFocus={(e) => {
                                  e.currentTarget.style.borderColor = "#40916C";
                                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(45,106,79,0.1)";
                                }}
                                onBlur={(e) => {
                                  e.currentTarget.style.borderColor = "#e5e7eb";
                                  e.currentTarget.style.boxShadow = "none";
                                }}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">hrs</span>
                            </div>
                          </div>
                          <div className="w-36">
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
                                onFocus={(e) => {
                                  e.currentTarget.style.borderColor = "#40916C";
                                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(45,106,79,0.1)";
                                }}
                                onBlur={(e) => {
                                  e.currentTarget.style.borderColor = "#e5e7eb";
                                  e.currentTarget.style.boxShadow = "none";
                                }}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">/hr</span>
                            </div>
                          </div>
                        </div>
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
                            onFocus={(e) => {
                              e.currentTarget.style.borderColor = "#40916C";
                              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(45,106,79,0.1)";
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = "#e5e7eb";
                              e.currentTarget.style.boxShadow = "none";
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm text-gray-500">Invoice total</span>
                          <span className="font-mono text-2xl font-medium text-gray-900">{formatCurrency(amount)}</span>
                        </div>
                        <button
                          onClick={() => approveInvoice(template.id)}
                          className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg text-white transition-colors"
                          style={{ backgroundColor: "#2D6A4F" }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#40916C"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#2D6A4F"; }}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Approve &amp; send to QBO
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="border-t border-gray-200 bg-white shadow-lg z-40">
        <div className="px-8 py-4 flex items-center justify-between max-w-4xl">
          <div className="flex items-baseline gap-2">
            {unsentTemplates.length > 0 ? (
              <>
                <span className="text-sm text-gray-500">
                  {unsentTemplates.length} unsent draft{unsentTemplates.length !== 1 ? "s" : ""}
                </span>
                <span className="font-mono text-xl font-medium text-gray-900">{formatCurrency(unsentTotal)}</span>
                <span className="text-sm text-gray-400">remaining</span>
              </>
            ) : (
              <span className="text-sm font-medium" style={{ color: "#40916C" }}>
                All invoices sent — nothing left to review
              </span>
            )}
          </div>
          <button
            onClick={approveAll}
            disabled={unsentTemplates.length === 0}
            className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: unsentTemplates.length > 0 ? "#2D6A4F" : "#9ca3af" }}
            onMouseEnter={(e) => { if (unsentTemplates.length > 0) e.currentTarget.style.backgroundColor = "#40916C"; }}
            onMouseLeave={(e) => { if (unsentTemplates.length > 0) e.currentTarget.style.backgroundColor = "#2D6A4F"; }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Approve &amp; send all
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main page component ────────────────────────────────────── */
export default function InvoicesPage() {
  const [activeView, setActiveView] = useState<NavView>("billing-run");

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className="flex flex-col shrink-0 w-56"
        style={{ backgroundColor: "#2D6A4F" }}
      >
        {/* Firm name */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(216,243,220,0.2)" }}>
          <p className="font-display text-white text-base leading-snug">P&L Business Services</p>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ view, label, Icon }) => {
            const active = activeView === view;
            return (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors"
                style={{
                  backgroundColor: active ? "rgba(255,255,255,0.15)" : "transparent",
                  color: active ? "white" : "#D8F3DC",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = "transparent";
                }}
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
        {activeView === "invoice-queue" && <InvoiceQueueView />}
        {activeView === "billing-run" && <BillingRunDashboard />}
        {activeView === "time-entries" && <PlaceholderView title="All Time Entries" />}
        {activeView === "client-rules" && <PlaceholderView title="Client Rules" />}
        {activeView === "settings" && <PlaceholderView title="Settings" />}
      </div>
    </div>
  );
}
