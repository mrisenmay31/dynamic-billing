# Steps 5 & 6: Client Rules and Settings

## Context

The nav shell at `apps/web/src/app/invoices/page.tsx` has 5 nav items: Billing Run, Invoice
Queue, All Time Entries, Client Rules, and Settings. Steps 1 through 4 are complete. The
"Client Rules" and "Settings" nav items currently render placeholders.

This task replaces both placeholders with their real screens. These are the two lightest screens
in the app — they are reference and configuration views, not interactive workflow views. They
should feel complete and polished without being complex.

Do not touch the Billing Run dashboard, Invoice Queue, All Time Entries view, sidebar, bottom
action bar, or any utility functions. All changes are additive — replace only the two
placeholder components.

---

## Important: Shared State for High-Touch Flag

The Client Rules page includes a high-touch client toggle per client. This toggle must share
state with the high-touch toggle already built into the Invoice Queue expanded card (Step 3).

If the high-touch toggle is turned ON for Knoxville Title Agency LLC in Client Rules, opening
that client's expanded card in the Invoice Queue must also show it as ON — and vice versa.

Lift the high-touch flag state (one boolean per client) up to the shared parent component that
manages nav state, so both views read from and write to the same value. Do not create two
separate toggle states for the same client.

---

---

# SCREEN 1: Client Rules

---

## Purpose

Client Rules is a configuration reference screen. It shows the firm-wide billing defaults and
allows per-client overrides. Lea Ann will use this to confirm her rules are set correctly and
to flag high-touch clients without having to open individual invoice cards.

In this prototype, all fields are editable but changes persist only in React state — there is
no save action or backend call. The UI should feel intentional and real, not like a settings
dump.

---

## Section 1: Page Header

- **Primary heading:** `Client Rules`
- **Sub-label:** `Default billing rules apply to all clients unless overridden below`
- No status badge

---

## Section 2: Global Defaults

A single panel titled `Firm-Wide Defaults`.

Display these rules as an editable key-value table. Each row has a label on the left and an
editable input on the right.

| Rule | Default Value | Input type |
|---|---|---|
| Default hourly rate | $125.00 | Number input, step 1, min 0, prefix $ |
| Default product / service | Hourly Accounting services | Text input |
| Default invoice description | Monthly Bookkeeping | Text input |
| Rounding rule | Round total monthly time up to next 15 minutes | Read-only text — not editable in prototype |
| Invoice terms | Due on receipt | Text input |
| Due date offset | 5 days after invoice date | Number input, step 1, min 0, suffix "days after invoice date" |

Design:
- White background panel, same card style as the rest of the app
- Panel title in small uppercase tracking-wider muted text
- Two-column layout: label (DM Sans, muted gray, left) and input (right)
- Subtle horizontal dividers between rows
- The rounding rule row is display-only — render the value as muted text, not an input.
  Add a small note beneath it: `Ceiling rounding is applied at month-end across the full
  month, not per entry.`
- Inputs are styled consistently with the invoice card fields — no raw browser inputs

---

## Section 3: Per-Client Rules

A panel titled `Per-Client Overrides` with one row per client.

Display as a table with these columns:

| Column | Description |
|---|---|
| Client | Client name — not editable |
| Hourly Rate | Number input, defaults to $125, step 1 |
| Invoice Description | Text input — pre-populated with each client's default description |
| High-Touch Client | Toggle switch |
| Notes | Short text input — optional internal note, placeholder "Add a note..." |

**Pre-populated description values:**

| Client | Default description |
|---|---|
| Knoxville Title Agency LLC | Monthly Bookkeeping |
| Baine & Company | Monthly Bookkeeping Services-2026 recons caught up (1st Quarter) |
| Knox Physical Therapy | Monthly Bookkeeping |

**High-Touch Client toggle behavior:**

- Shares state with the Invoice Queue expanded card toggle (see shared state note above)
- All three clients default to OFF
- When toggled ON, the client row gets a subtle amber left border or row highlight to draw
  attention to it
- Toggling ON here has the same effect as toggling ON inside the Invoice Queue card — it
  surfaces the warning badge and quick-add buttons in that card

**Design:**
- Table rows with subtle alternating backgrounds
- The High-Touch column is center-aligned
- Toggle switch styled in the existing green palette — ON state uses `#2D6A4F`
- If a client has a non-default description (Baine & Company), visually distinguish its
  description cell with a subtle indicator — a small "custom" badge or light blue-gray tint —
  to make clear it has been overridden from the default

---

## Section 4: Rounding Logic Reference

A small read-only reference panel below the per-client table. Title: `How Rounding Works`.

Content:

> **Rule:** Total monthly hours per client are rounded up to the next quarter hour (0.25 hrs)
> at month-end. Rounding is applied once across the full month — not per individual entry.
>
> **Formula:** `ceil(totalDecimalHours / 0.25) * 0.25`
>
> **Example:**
> | Raw time | Decimal hours | Rounded |
> |---|---|---|
> | 11h 53m | 11.88 hrs | 12.00 hrs |
> | 11h 48m | 11.80 hrs | 12.00 hrs |
> | 31h 34m | 31.57 hrs | 31.75 hrs |

Design:
- Subdued gray info box — same style as the product fit callout on the Billing Run dashboard
- Monospaced font for the formula and table values
- This is a read-only reference — no inputs or interactive elements

---

## Section 5: High-Touch Client Reference

A small read-only callout panel below the rounding reference. Title: `High-Touch Client Buffer`.

Content:

> Approximately 5 clients receive a manual time adjustment at billing time to account for
> frequent calls and drop-in questions. These adjustments (typically 15–45 minutes, rarely
> more) are applied during invoice review — not logged as time entries in QuickBooks Time.
>
> Flag a client as High-Touch above to surface quick-add adjustment buttons in the Invoice
> Queue when reviewing that client's draft.

Design:
- Same subdued callout style as the rounding reference panel
- No inputs or interactive elements

---

## Client Rules: Layout

- Sections stack vertically with consistent gap
- Maximum content width matches the other views
- No horizontal scroll
- Page is scrollable if content exceeds viewport height

---

---

# SCREEN 2: Settings

---

## Purpose

Settings is the lightest screen in the app. It shows system configuration, integration status,
and a product positioning callout. In this prototype, all settings are display-only — no inputs,
no save action. The screen should feel complete and informative, not placeholder-like.

---

## Section 1: Page Header

- **Primary heading:** `Settings`
- **Sub-label:** `System configuration and integration status`

---

## Section 2: Integration Settings

A panel titled `Integrations & Data Sources`.

Display as a read-only key-value list:

| Setting | Value | Notes |
|---|---|---|
| QBO Time import source | Uploaded report | Future: QuickBooks Time API |
| Invoice destination | QuickBooks Online | Draft invoices only |
| Payment portal | BillerGenie | Auto-syncs from QBO via Premium plan |
| BillerGenie plan | Premium | $69.95/month + 0.50% per invoice collected |

Design:
- White card panel
- Two-column layout: label (muted) on left, value (dark) on right
- For "QBO Time import source," show the value as `Uploaded report` with a small muted
  sub-note on a second line: `Future: QuickBooks Time API`
- For "BillerGenie plan," show the plan name with the cost on a second line in muted text
- No inputs, no edit buttons — this is display only in the prototype
- Add a small green "Connected" or "Active" badge next to BillerGenie and QuickBooks Online
  entries to signal that these integrations are live in the real product
  (in the prototype these are cosmetic — they do not reflect real connection state)

---

## Section 3: Billing Behavior

A panel titled `Billing Behavior`.

Display as a read-only key-value list with toggle-style indicators:

| Setting | Value |
|---|---|
| Auto-send invoices | Off |
| Require owner approval before sending | On |
| Invoice date rule | 1st of the following month |
| Due date rule | 5 days after invoice date |
| Rounding method | Ceiling to next 0.25 hrs |

Design:
- "Auto-send invoices: Off" — render the value as a red/gray pill badge: `Off`
- "Require owner approval: On" — render as a green pill badge: `On`
- All other values are plain text
- Same card style as the Integration Settings panel
- These are display-only — no toggles, no inputs in this prototype

---

## Section 4: Product Fit Callout

A panel titled `How This Fits Your Existing Tools`.

Content block (use exact copy):

> This dashboard does not replace TaxDome, QuickBooks, or BillerGenie. It sits between
> QBO Time and QuickBooks invoices to automate the one step those tools don't handle:
> turning approved time entries into summarized draft invoices, ready for your review.

Below the paragraph, render the architecture flow as a visual pipeline:

```
QBO Time  →  Billing Review Dashboard  →  QuickBooks Draft Invoice  →  BillerGenie Payment Portal
```

Design:
- Render each node in the pipeline as a small pill or chip
- Arrows between chips — a simple `→` character or a lucide-react `ArrowRight` icon
- The "Billing Review Dashboard" chip should be visually highlighted — green background,
  white text (`#2D6A4F`) — to show where this product sits in the stack
- All other chips in light gray background, dark text
- The pipeline row should wrap gracefully on narrower viewports — do not let it overflow
  horizontally
- Panel has the same left accent border style as other callout panels in the app

---

## Section 5: About This Prototype

A small, visually quiet panel at the bottom of the Settings screen. Title: `About`.

Content:

> **Billing Review Dashboard** — Prototype
> Built for P&L Business Services · May 2026
> Pilot client: Lea Ann Sanford, Owner
>
> This prototype uses real April 2026 data from QuickBooks Time. No backend, no API
> connections, no live QuickBooks integration. All invoice actions simulate the real
> workflow — when the product is live, "Create QuickBooks Draft" will POST directly
> to the QBO Invoice API.
>
> Data: 3 clients · 55 time entries · $6,968.75 in proposed billing

Design:
- Subdued gray background panel — the quietest visual element on the screen
- Small text throughout — DM Sans, muted
- The data summary line (`3 clients · 55 time entries · $6,968.75`) in DM Mono
- No interactive elements

---

## Settings: Layout

- Sections stack vertically with consistent gap
- Maximum content width matches the other views
- Page is scrollable if content exceeds viewport height
- No sticky elements needed on this screen

---

---

# Shared Design Constraints (Both Screens)

- Use the existing brand palette:
  - Primary green: `#2D6A4F`
  - Mid green: `#40916C`
  - Light green: `#52B788`
  - Pale green: `#D8F3DC`
  - Amber: `#E76F51`
- `DM Serif Display` for page headings only
- `DM Sans` for all labels, body text, and UI copy
- `DM Mono` for all numbers, formulas, amounts, and the architecture pipeline
- White and `#f9fafb` card surfaces — match the existing app aesthetic
- `lucide-react` icons where helpful (toggle indicators, integration status, pipeline arrows)
- Do not introduce new dependencies, color variables, or font imports

---

# Hard Constraints

- TypeScript throughout — no `any` types
- High-touch flag state must be shared with the Invoice Queue — lift to parent if needed
- No new routes
- Client Rules description fields should update the corresponding description in the Invoice
  Queue card state — if Lea Ann changes Baine & Company's description in Client Rules, the
  Invoice Queue card should reflect it (use shared state, same pattern as high-touch flag)
- Must run with `next dev` with no additional setup
- Do not modify `globals.css`, `layout.tsx`, `next.config.ts`, or `package.json`
- Do not touch the Billing Run dashboard, Invoice Queue, All Time Entries view, sidebar,
  nav state, bottom action bar, or any existing utility functions
