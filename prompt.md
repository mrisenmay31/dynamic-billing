# Fix: Settings Integration Badge Language

## Context

In `apps/web/src/app/invoices/page.tsx`, the `SettingsView` component currently shows
"Connected" and "Active" badges next to QuickBooks Online and BillerGenie. For a prototype
with no live API connections, these labels could mislead Lea Ann into thinking the system is
already integrated with her accounts.

---

## What to change

In `SettingsView`, find the **Integrations & Data Sources** panel rows and update as follows:

### QBO Time import source row
- Value: keep `Uploaded report` (already correct)
- Sub-note: keep `Future: QuickBooks Time API` (already correct)
- No badge on this row — no change needed

### Invoice destination row (QuickBooks Online)
- Remove the green `"Connected"` badge
- Replace with a gray/neutral badge that reads `"Ready to Connect"`
- Badge style: `backgroundColor: '#F1F5F9', color: '#475569'` (slate tones, not green)
- Keep the `"Draft invoices only"` sub-note

### Payment portal row (BillerGenie)
- Remove the green `"Active"` badge
- Replace with a neutral badge that reads `"Syncs via Premium Plan"`
- Badge style: same slate tones as above — `backgroundColor: '#F1F5F9', color: '#475569'`
- Keep the `"Auto-syncs from QBO via Premium plan"` sub-note

### BillerGenie plan row
- No badge on this row — no change needed

---

## Also update the "How This Fits Your Existing Tools" callout

In the same `SettingsView`, the product fit callout has a pipeline of chips. Find the chip
for `"QBO Time"` and update its sub-note text (if any) to be consistent — no "Connected"
or "Active" language anywhere in Settings.

---

## What NOT to change

- Do not change any badge styling in the Invoice Queue, Billing Run, or Client Rules views.
- Do not touch the green `"Draft Created in QBO"` status badge in the Invoice Queue — that
  is a workflow status indicator, not an integration status indicator, and is correct as-is.
- Do not change the About panel text.
- Do not touch any other component, utility function, data constant, or CSS.
- TypeScript throughout — no `any` types.