# Step 4: All Time Entries

## Context

The nav shell at `apps/web/src/app/invoices/page.tsx` has 5 nav items: Billing Run, Invoice
Queue, All Time Entries, Client Rules, and Settings. Billing Run (Step 2) and Invoice Queue
upgrades (Step 3) are complete. The "All Time Entries" nav item currently renders a placeholder.

This task replaces that placeholder with a fully functional time entries view showing the
complete April 2026 QBO Time export across all 3 clients — all 55 rows — with search, filtering,
sorting, and summary totals.

Do not touch the Billing Run dashboard, the Invoice Queue, the sidebar, the bottom action bar,
or any utility functions. All changes are additive — replace only the All Time Entries
placeholder component.

---

## Purpose of This Screen

This is the trust-builder screen. Lea Ann needs to see that the system has correctly read,
imported, and grouped every individual time entry from the QBO export — not just the summarized
invoice totals. Seeing all 55 rows confirms the system is working on real data, not
approximations.

The screen should communicate:
> "We imported your full QBO Time report. Every entry is here. The invoice totals you see in
> the queue are calculated directly from this data."

---

## Data Source

**Do not duplicate the time entry data.** The complete dataset was added to the file in Step 3
as part of the `TEMPLATES` array (or equivalent data structure). The All Time Entries view must
read from that same source — one source of truth.

If the data is currently structured per-client (nested under each template/client object), flatten
it into a single array for this view by mapping each entry to include its parent client name.
Do not create a second hardcoded dataset.

Each flattened entry should have these fields:
- `client` — string (from the parent template)
- `date` — string (e.g. `04/01/2026`)
- `employee` — string
- `productService` — string (always `Hourly Accounting services`)
- `description` — string (the staff note)
- `duration` — string (e.g. `01:04`)
- `rate` — number (always 125)
- `billable` — string (always `Yes`)
- `amount` — number (rate x decimal hours for that entry)

The `amount` per entry should be calculated from the raw duration string:
`amount = (hours + minutes/60) * rate`, rounded to 2 decimal places for display only.

---

## Grand Total Reference

These are the correct totals for the full 55-row dataset. Use them to validate the
implementation:

| Metric | Value |
|---|---|
| Total entries | 55 |
| Total raw duration | 55:15 |
| Total raw amount | $6,906.11 |
| Clients | 3 |
| Unique employees | 7 (Amy Snyder, Lea A. Sanford, Victoria Wyres, Giovanni Sanchez, Joseph Broome, Abby N. Townsend, Amber L. Sanchez) |

---

## Page Header

Display at the top of the All Time Entries content area:

- **Primary heading:** `All Time Entries`
- **Sub-label:** `April 2026 Import — QuickBooks Time`

**Stats bar** — a single row of 4 inline stats directly below the heading:

| Label | Value |
|---|---|
| Total Entries | 55 |
| Total Raw Time | 55:15 |
| Total Raw Amount | $6,906.11 |
| Clients | 3 |

These stats must update dynamically when filters are applied — they should always reflect
the currently visible (filtered) rows, not the full dataset.

Design:
- Stats displayed as a horizontal row of small labeled values
- DM Mono for the numeric values, DM Sans for labels
- Muted styling — these are reference numbers, not hero stats
- Separated by a subtle divider or dot character

---

## Contextual Note Panel

Below the stats bar and above the filter bar, include a quiet informational panel:

> **These are your raw QBO Time entries for April 2026.**
> Invoice totals in the queue are calculated directly from this data —
> grouped by client, rounded to the next quarter hour.

Design:
- Left accent border in `#2D6A4F`, light gray or white background
- Same style as the Review Summary Panel on the Billing Run dashboard
- Small text, DM Sans, muted — should not compete with the table for attention

---

## Filter and Search Controls

Render a filter bar directly below the contextual note panel, above the table.

### Search

- Text input
- Placeholder: `Search by staff note or description...`
- Searches the `description` field only (staff notes)
- Case-insensitive, matches partial strings
- Shows an X clear button when text is present

### Filter: Client

- Dropdown / select
- Options: `All Clients` (default), `Baine & Company`, `Knox Physical Therapy`,
  `Knoxville Title Agency LLC`

### Filter: Employee

- Dropdown / select
- Options: `All Employees` (default), then each unique employee name derived dynamically
  from the data — do not hardcode the employee list separately

### Filter: Billable Status

- Dropdown / select
- Options: `All`, `Billable`, `Non-Billable`
- All current entries are billable but the filter must be functional for future use

### Sort: Date

- A toggle button or control: `Date: Oldest First` / `Date: Newest First`
- Default: ascending (oldest first)
- Sorts the visible post-filter rows

### Clear Filters

- A `Clear filters` text button that resets all filters and search to defaults
- Only visible when at least one filter is active or search text is present

### Filter Bar Behavior

- The filter bar should be sticky — remains visible as the user scrolls through the table
- All controls render in a single row on standard desktop/laptop widths (1280px+)
- Style controls to match the existing input field aesthetic — no raw unstyled browser selects

---

## Time Entries Table

### Columns

| Column | Field | Notes |
|---|---|---|
| Date | `date` | Format: MM/DD/YYYY |
| Client | `client` | Full client name |
| Employee | `employee` | Full name |
| Product / Service | `productService` | Can abbreviate to "Hourly Accounting services" |
| Staff Note | `description` | Full text, allow wrapping — do not truncate |
| Duration | `duration` | Format: HH:MM |
| Rate | `rate` | Format: $125 |
| Billable | `billable` | Render as small green pill badge |
| Amount | `amount` | Format: $XX.XX, right-aligned, DM Mono |

### Column Design Notes

- **Staff Note** is the most important column — it is why Lea Ann reviews time entries.
  Give it the most horizontal space. Allow cell text to wrap naturally.
- **Date** and **Duration** are narrow fixed-width columns
- **Amount** is right-aligned, DM Mono font
- **Billable** renders as a small pill badge: green background, "Yes" text

### Row Design

- Subtle alternating row backgrounds (`white` and `#f9fafb`) or a hover highlight
- Clean horizontal dividers between rows
- No vertical cell borders — open table style
- Row height accommodates multi-line staff notes naturally

### Empty State

When no rows match the active filters:

- Icon from `lucide-react` (clock or search)
- Heading: `No entries match your filters`
- Sub-text: `Try adjusting your search or clearing the filters`
- A `Clear filters` button

### Table Footer: Summary Row

A summary row pinned inside the table below the last data row.

Shows totals for currently visible (filtered) rows:

| Column | Value |
|---|---|
| Employee column | `[N] entries` — count of visible rows |
| Duration column | Sum of visible durations in HH:MM |
| Amount column | Sum of visible amounts in $X,XXX.XX |
| All other columns | Empty |

Design:
- Slightly darker background (`#f3f4f6`) and bold text
- Visually distinct from data rows — this is a totals row, not a data row

---

## Duration Summation Logic

Sum durations in total minutes, then convert back to HH:MM. Do not parse as floats.

```typescript
function sumDurations(durations: string[]): string {
  const totalMinutes = durations.reduce((sum, d) => {
    const [h, m] = d.split(':').map(Number);
    return sum + h * 60 + m;
  }, 0);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}
```

The full unfiltered dataset must produce exactly `55:15`. If it does not, there is a data
entry error — fix the data, not the math.

---

## Amount Calculation Per Entry

Calculate each entry's amount from its duration string, not hardcoded.

```typescript
function durationToAmount(duration: string, rate: number): number {
  const [h, m] = duration.split(':').map(Number);
  const decimalHours = h + m / 60;
  return Math.round(decimalHours * rate * 100) / 100;
}
```

The sum of all 55 entry amounts must display as `$6,906.11`.

---

## Layout

- Maximum content width matches the other views for consistency
- The table uses the full available width — not constrained to a narrow column
- The page scrolls normally — no inner scroll container on the table itself
- Filter bar is sticky; page header is not

---

## Design Constraints

- Use the existing brand palette:
  - Primary green: `#2D6A4F`
  - Mid green: `#40916C`
  - Light green: `#52B788`
  - Pale green: `#D8F3DC`
  - Amber: `#E76F51`
- `DM Serif Display` for the page heading only
- `DM Sans` for all labels, filter controls, and table text
- `DM Mono` for all durations, amounts, and numeric values in the table
- White and `#f9fafb` surfaces — match the existing app aesthetic
- `lucide-react` icons for search clear, sort toggle, and empty state
- Do not introduce new dependencies, color variables, or font imports

---

## Hard Constraints

- TypeScript throughout — no `any` types
- Read from the existing data structure — do not create a second hardcoded dataset
- No new routes
- Must run with `next dev` with no additional setup
- Do not modify `globals.css`, `layout.tsx`, `next.config.ts`, or `package.json`
- Do not touch the Billing Run dashboard, Invoice Queue, sidebar, nav state, bottom action
  bar, or any existing utility functions