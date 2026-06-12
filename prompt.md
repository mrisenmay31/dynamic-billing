# Spec: Dynamic Billing Run page — dynamic month labels + month selector

**For:** Claude Code
**Scope:** De-hardcode all month/date/stat strings on the `/invoices` Billing Run page, scope the page's data to a selected billing run, and add a month selector to switch between runs.
**Files:**
- `apps/web/src/app/invoices/page.tsx` (server component, data fetching)
- `apps/web/src/app/invoices/InvoicesClient.tsx` (~2307 lines, all UI)
- `apps/web/src/app/api/billing-runs/route.ts` — **no changes** (already accepts `billingMonth` in body; idempotent on `(firm_id, billing_month)`)

---

## 0. The one rule that governs every helper: `billing_month` is the WORK month

Confirmed in code, do not re-derive:

- **Engine** (`src/lib/billing/engine.ts`) pulls `time_entries` with `started_at` in `[billing_month, nextMonth)`. So `billing_month = '2026-04-01'` means **April work**.
- **Send route** (`src/app/api/invoice-drafts/[id]/send/route.ts`, ~line 77-79) computes `txnDate = billing_month + 1 month`, `dueDate = txnDate + 5 days`. So April work invoices are dated **05/01**, due **05/06**.
- The current UI already shows **"May 2026 Billing Run / April 2026 Time Entries"** for the run stored as `'2026-04-01'`.

Therefore the display offsets are:

| Concept | Relationship to `billing_month` | Example for `'2026-04-01'` |
|---|---|---|
| **Run / invoice month** ("… Billing Run", invoice date) | `billing_month + 1 month` | May 2026, 05/01/2026 |
| **Entries / work month** ("… Time Entries", "Billing Totals — …") | `billing_month` as-is | April 2026 |

This preserves today's labels. It is **not** a relabel. Do not flip these.

---

## 1. Helper functions (add to the Utilities section of `InvoicesClient.tsx`)

All use **pure string math** on the `'YYYY-MM-01'` value. **Do not** pass `billing_month` into `new Date()` for display — `new Date('2026-05-01')` is UTC midnight and renders as the prior day/month in Eastern.

```ts
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

// '2026-04-01' -> { year: 2026, month: 4 }  (month is 1-12)
function parseBillingMonth(bm: string): { year: number; month: number } {
  const [year, month] = bm.split('-').map(Number);
  return { year, month };
}

// add N calendar months, handling year rollover (e.g. Dec + 1 -> next Jan)
function addMonths(year: number, month: number, n: number): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + n;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

// Work/entries month, as stored.  '2026-04-01' -> 'April 2026'
function entriesMonthLabel(bm: string): string {
  const { year, month } = parseBillingMonth(bm);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// Work/entries month name only.  '2026-04-01' -> 'April'
function entriesMonthName(bm: string): string {
  return MONTH_NAMES[parseBillingMonth(bm).month - 1];
}

// Run / invoice month (= work + 1).  '2026-04-01' -> 'May 2026'
function runMonthLabel(bm: string): string {
  const { year, month } = parseBillingMonth(bm);
  const r = addMonths(year, month, 1);
  return `${MONTH_NAMES[r.month - 1]} ${r.year}`;
}

// Run / invoice month name only.  '2026-04-01' -> 'May'
function runMonthName(bm: string): string {
  const { year, month } = parseBillingMonth(bm);
  return MONTH_NAMES[addMonths(year, month, 1).month - 1];
}

// Invoice date = 1st of run month.  '2026-04-01' -> '05/01/2026'
function invoiceDateFromBillingMonth(bm: string): string {
  const { year, month } = parseBillingMonth(bm);
  const r = addMonths(year, month, 1);
  return `${pad2(r.month)}/01/${r.year}`;
}

// Due date = invoice date + offsetDays. Invoice date is ALWAYS the 1st,
// so due is the (1 + offset)th of the same run month (1 + 5 = 6, never crosses month).
// '2026-04-01' -> '05/06/2026'
function invoiceDueDateFromBillingMonth(bm: string, offsetDays = 5): string {
  const { year, month } = parseBillingMonth(bm);
  const r = addMonths(year, month, 1);
  return `${pad2(r.month)}/${pad2(1 + offsetDays)}/${r.year}`;
}

// Dropdown option label.  '2026-04-01' -> 'May 2026 (April entries)'
function dropdownLabel(bm: string): string {
  return `${runMonthLabel(bm)} (${entriesMonthName(bm)} entries)`;
}
```

### Raw-stats helper (for the "Billing Totals" block)

`allEntries` items carry `duration` as `'H:MM'` and a numeric `amount`.

```ts
function parseHmmToSeconds(hmm: string): number {
  const [h, m] = hmm.split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60;
}

function formatSecondsToHmm(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}:${pad2(m)}`;
}

function computeRawStats(allEntries: { duration: string; amount: number }[]): {
  totalRawTime: string;   // 'H:MM'
  totalRawAmount: number;  // pre-rounding dollars
} {
  const totalSeconds = allEntries.reduce((s, e) => s + parseHmmToSeconds(e.duration), 0);
  const totalRawAmount = Math.round(allEntries.reduce((s, e) => s + e.amount, 0) * 100) / 100;
  return { totalRawTime: formatSecondsToHmm(totalSeconds), totalRawAmount };
}
```

> **Assumption (documented):** `allEntries` carries a flat `rate` (firm default $125), so `totalRawAmount` uses the uniform rate. This is correct for P&L (uniform $125). The "Rounding / adjustment difference" = `liveTotalBilling - totalRawAmount` is therefore a pure rounding delta today. Add this TODO comment in code: `// TODO: if per-client rate overrides diverge from the firm default, compute raw amount per-customer so the rounding delta stays honest.`

---

## 2. `page.tsx` changes

### 2.1 Accept and await `searchParams` (Next.js 15)
```ts
export default async function InvoicesPage(
  { searchParams }: { searchParams: Promise<{ month?: string }> }
) {
  const { month } = await searchParams;
  // ...
}
```

### 2.2 Select run by month, default to latest billing period
Replace the current `billingRun` query (selects only `id`):
```ts
const runQuery = supabase
  .from('billing_runs')
  .select('id, billing_month, status')
  .eq('firm_id', FIRM_ID);

const { data: billingRun } = month
  ? await runQuery.eq('billing_month', month).maybeSingle()
  : await runQuery.order('billing_month', { ascending: false }).limit(1).maybeSingle();
```
> Default ordering is `billing_month` desc ("latest billing period"), confirmed. Do not use `created_at` desc.

> A hand-entered `?month=` with no matching run yields `billingRun = null` -> the page renders the empty state (2.7). Good.

### 2.3 Add the runs list for the dropdown
```ts
const { data: allRuns } = await supabase
  .from('billing_runs')
  .select('billing_month, status')
  .eq('firm_id', FIRM_ID)
  .order('billing_month', { ascending: false });
```

### 2.4 Scope the entries query to the selected month  ← **critical, not in the original plan**
Today the entries query (current lines ~61-65) filters only by `customer_id`, so it returns **every month's** entries for those customers. Add the same date window the engine uses:
```ts
const bm = billingRun?.billing_month ?? null;
const [by, bmo] = bm ? bm.split('-').map(Number) : [0, 0];
const nextMonth = bm
  ? (bmo === 12 ? `${by + 1}-01-01` : `${by}-${String(bmo + 1).padStart(2, '0')}-01`)
  : null;

const { data: entries } = bm
  ? await supabase
      .from('time_entries')
      .select('*')
      .in('customer_id', customerIds)
      .gte('started_at', bm)
      .lt('started_at', nextMonth!)
      .order('started_at', { ascending: true })
  : { data: [] as TimeEntryRow[] };
```
This makes the All Time Entries view, `computeRawStats`, and the totals correct when more than one month exists.

### 2.5 Fix the hardcoded entry-date year (current line ~91)
Because entries are now scoped to the run's work month, the year is deterministic: it is `billing_month`'s year. Replace `` `${e.date}/2026` `` with:
```ts
const workYear = billingRun?.billing_month?.slice(0, 4) ?? '';
// ...
date: `${e.date}/${workYear}`,
```
> Out of scope (note only): `formatEntryDate` derives MM/DD in UTC. For a clock-in/out entry punched late in the evening Eastern, the displayed MM/DD can roll to the next UTC day. Leave as-is this task; flag for a later Eastern-display pass if Lea Ann reports off-by-one dates.

### 2.5b Pass draft status into `templates` (for the status badge, Section 4)
The `invoice_drafts` query already selects `*`, so `draft.status` is available. Add a `sent` boolean to each template object in the existing `templates` mapping (the send route sets `status = 'sent'` on success):
```ts
sent: draft.status === 'sent',
```

### 2.6 `defaultGenerateMonth` (Eastern-based previous calendar month)
Add at the top of the file. Eastern, not UTC, so a generate near a month boundary can't pick the wrong work month:
```ts
function getPreviousMonthISO(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: 'numeric',
  }).formatToParts(new Date());
  const y = Number(parts.find(p => p.type === 'year')!.value);
  const m = Number(parts.find(p => p.type === 'month')!.value);
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  return `${prev.y}-${String(prev.m).padStart(2, '0')}-01`;
}
const defaultGenerateMonth = getPreviousMonthISO();
```

### 2.7 Pass new props to `<InvoicesClient />`
```ts
currentRun={billingRun ? { billingMonth: billingRun.billing_month, status: billingRun.status } : null}
availableRuns={(allRuns ?? []).map(r => ({ billingMonth: r.billing_month, status: r.status }))}
defaultGenerateMonth={defaultGenerateMonth}
```

---

## 3. `InvoicesClient.tsx` changes

### 3.1 Props interface + signature
Add `sent: boolean` to the `templates` item type in `InvoicesClientProps` (populated in 2.5b). Add to `InvoicesClientProps`:
```ts
currentRun: { billingMonth: string; status: string } | null;
availableRuns: { billingMonth: string; status: string }[];
defaultGenerateMonth: string;
```
Destructure all three. Derive at the top of the component body:
```ts
const billingMonth = currentRun?.billingMonth ?? null;
const runStatus = currentRun?.status ?? 'pending';
```
Add `import { useRouter } from 'next/navigation';` and `const router = useRouter();`.

### 3.2 `handleGenerate` (current ~lines 2228-2238)
- Body: `billingMonth: defaultGenerateMonth` (was `'2026-04-01'`).
- **Keep hard navigation, with the month param** — do **not** switch to `router.push` here:
  ```ts
  window.location.href = `/invoices?month=${defaultGenerateMonth}`;
  ```
  > Rationale: the original `window.location.href` cache-bust was deliberate (CLAUDE.md M4: Next.js router cache was showing stale data after a mutation). A bare `router.push` to a freshly mutated route risks reintroducing that staleness. Hard nav with the month param preserves the fix and lands on the new run.

### 3.3 `MonthSelectorDropdown` sub-component
Plain `<select>` (no new packages). Render it in the `BillingRunDashboard` header next to the status badge. Render only when `availableRuns.length >= 1`.
```tsx
function MonthSelectorDropdown({ availableRuns, billingMonth }: {
  availableRuns: { billingMonth: string; status: string }[];
  billingMonth: string | null;
}) {
  const router = useRouter();
  if (availableRuns.length < 1) return null;
  return (
    <select
      aria-label="Select billing run"
      value={billingMonth ?? ''}
      onChange={(e) => router.push(`/invoices?month=${e.target.value}`)}
      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700"
    >
      {availableRuns.map((run) => (
        <option key={run.billingMonth} value={run.billingMonth}>
          {dropdownLabel(run.billingMonth)}
        </option>
      ))}
    </select>
  );
}
```
> Switching months is a read navigation to a different URL, so `router.push` is fine here (the RSC refetches). The cache concern only applies to the post-mutation case in 3.2.

### 3.4 `BillingRunDashboard` — string replacements
Pass `billingMonth: string | null`, `runStatus: string`, `availableRuns`, `allEntries`, `templates`, plus existing `liveTotalBilling` / `liveRoundedHours`.

| Line (approx) | Current | Replace with |
|---|---|---|
| 406 | `May 2026 Billing Run` | `` `${runMonthLabel(billingMonth)} Billing Run` `` |
| 407 | `April 2026 Time Entries` | `` `${entriesMonthLabel(billingMonth)} Time Entries` `` |
| 408 | `April's time is billed in May — this is standard practice.` | `` `${entriesMonthName(billingMonth)}'s time is billed in ${runMonthName(billingMonth)}, this is standard practice.` `` |
| 411-413 | static `In Review` badge | `runDisplayStatus(templates)` label + color (Section 4) |
| 419 | stat value `"3"` (Clients Ready for Review) | `templates.length.toString()` |
| 456 | `Billing Totals — April 2026` | `` `Billing Totals — ${entriesMonthLabel(billingMonth)}` `` |
| 459 | raw time `"55:15"` | `computeRawStats(allEntries).totalRawTime` |
| 460 | raw amount `"$6,906.25"` | `formatCurrency(computeRawStats(allEntries).totalRawAmount)` |
| 471 | rounding diff `+$62.64` | computed (see below) |
| 478 | `May 2026 billing is ready for review.` | `` `${runMonthLabel(billingMonth)} billing is ready for review.` `` |
| 479 | `3 client invoices` | `` `${templates.length} client invoices` `` |

Compute `computeRawStats` once near the top of the component render, not inline four times:
```ts
const rawStats = computeRawStats(allEntries);
const roundingDiff = Math.round((liveTotalBilling - rawStats.totalRawAmount) * 100) / 100;
// display: `${roundingDiff >= 0 ? '+' : '-'}${formatCurrency(Math.abs(roundingDiff))}`
```
> Note (em-dash): line 408 currently uses `—`. Matt's house style avoids em-dashes in user-facing text; the replacement above uses a comma. Keep that.

### 3.5 Empty state (when `billingMonth` is null)
When `billingMonth === null`, render a centered card instead of the dashboard: short copy ("No billing run yet for this period.") and a **"Generate Drafts"** button wired to `handleGenerate` (bills `defaultGenerateMonth`). This also covers a `?month=` that matches no run.

### 3.6 `InvoiceQueueView` — add prop `billingMonth: string`
| Line (approx) | Current | Replace with |
|---|---|---|
| 674 | `April 2026 · Billing Period` | `` `${entriesMonthLabel(billingMonth)} · Billing Period` `` |
| 742 | `April 2026` | `entriesMonthLabel(billingMonth)` |
| 825 | `05/01/2026` | `invoiceDateFromBillingMonth(billingMonth)` |
| 826 | `05/06/2026` | `invoiceDueDateFromBillingMonth(billingMonth)` |

### 3.7 `AllTimeEntriesView` — add prop `billingMonth: string`
| Line (approx) | Current | Replace with |
|---|---|---|
| 1208 | `April 2026 Import — QuickBooks Time` | `` `${entriesMonthLabel(billingMonth)} Import — QuickBooks Time` `` |
| 1234 | `…raw QBO Time entries for April 2026.` | `` `…raw QBO Time entries for ${entriesMonthLabel(billingMonth)}.` `` |

The client `<option>` filter values already derive from `allEntries` — leave as-is.

### 3.8 `SettingsView` — replace the hardcoded stat line (current ~line 2138)
`3 clients · 88 time entries · $6,968.75 in proposed billing` -> computed from the **selected run's** live data:
```ts
`${templates.length} clients · ${allEntries.length} time entries · ${formatCurrency(liveTotalBilling)} in proposed billing`
```
Pass `templates`, `allEntries`, `liveTotalBilling` to `SettingsView`.
> **Assumption:** this line reflects the currently selected run, not firm-wide totals.

### 3.9 Wire props at all call sites
Pass `billingMonth`, `runStatus`, `availableRuns`, `allEntries`, `templates`, `liveTotalBilling`, `liveRoundedHours`, `onGenerate` to `BillingRunDashboard`; `billingMonth` to `InvoiceQueueView` and `AllTimeEntriesView`; the stat inputs to `SettingsView`.

---

## 4. Status badge — computed from drafts (REQUIRED)

`billing_runs.status` is inserted once as `'pending'` and **never updated** anywhere in the codebase, so it cannot drive a truthful badge. Compute the badge from the drafts instead, so a fully-sent past month reads "Sent" when Lea Ann looks back.

1. `page.tsx` passes `sent: draft.status === 'sent'` into each template (done in 2.5b); `templates` type carries `sent: boolean` (3.1).
2. Add this helper to the Utilities section of `InvoicesClient.tsx`:
   ```ts
   function runDisplayStatus(
     templates: { sent: boolean }[]
   ): { label: 'In Review' | 'Partially Sent' | 'Sent'; bg: string; color: string } {
     const sent = templates.filter(t => t.sent).length;
     if (templates.length === 0 || sent === 0)
       return { label: 'In Review', bg: '#FFF3E0', color: '#C2410C' };       // amber (current style)
     if (sent === templates.length)
       return { label: 'Sent', bg: '#F0FDF4', color: '#2D6A4F' };            // green (matches brand)
     return { label: 'Partially Sent', bg: '#FEF9C3', color: '#A16207' };    // yellow
   }
   ```
3. In `BillingRunDashboard`, replace the static badge (lines ~411-413) with the computed label and inline `style={{ backgroundColor: bg, color }}`. Keep the existing pill classes.

`runStatus` derived in 3.1 is now unused for the badge; leave it available or drop it.

---

## 5. Verification

1. `npx tsc --noEmit` passes clean.
2. `npm run dev` from `apps/web/`; log in at `localhost:3000/login` (`matt@ctaintegrity.com` / `devpassword123`).
3. Billing Run page shows **"May 2026 Billing Run" / "April 2026 Time Entries"**, derived from DB (confirm by temporarily editing the seeded run's `billing_month` and seeing labels move together).
4. Month dropdown appears in the header showing **"May 2026 (April entries)"**.
5. **Multi-month scope test (covers the critical fix):** insert a second `billing_runs` row with `billing_month = '2026-05-01'` **and** at least one `time_entries` row with `started_at` in May **and** a matching `invoice_drafts` row. Switch to `?month=2026-05-01`. Confirm:
   - header reads **"June 2026 Billing Run / May 2026 Time Entries"**, invoice preview dates **06/01/2026 / 06/06/2026**;
   - the All Time Entries view and Billing Totals show **only May** entries (no April bleed-through) — this is what proves 2.4 works.
6. The status badge reflects the drafts: a run with no sent drafts reads **"In Review"** (amber); mark all of a run's drafts `sent` and it reads **"Sent"** (green); a mix reads **"Partially Sent"**.
7. All date labels update consistently across Billing Run, Invoice Queue, All Time Entries, and Settings.
8. "Generate Drafts" posts `billingMonth = ` the previous calendar month (Eastern), not `'2026-04-01'`, and lands on `/invoices?month=<that month>`.
9. Year-rollover sanity: temporarily set a run's `billing_month` to `'2026-12-01'` and confirm "January 2027 Billing Run", invoice **01/01/2027 / 01/06/2027**.

---

## 6. Out of scope (note only, do not implement)
- Refactor of the ~2307-line `InvoicesClient.tsx` (tech-debt note for later).
- Eastern-correct `formatEntryDate` MM/DD (only the year is fixed here).
- Per-client rate basis for the raw-amount delta (TODO comment added; fine while rate is uniform).