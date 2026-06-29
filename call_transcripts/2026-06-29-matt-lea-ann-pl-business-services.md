# Matt & Lea Ann (P&L Business Services) — June 29, 2026 (live onboarding)

**Recording:** https://fathom.video/share/wcKU1_zVPwuiejj83e9FZtT493cB8eGC (25 min)
**Attendees:** Matt Risenmay (CTA Integrity), Lea Ann Sanford (P&L Business Services)
**Purpose:** First live onboarding — get Lea Ann logged in, connect QBO + QB Time, confirm data syncs.

## Outcome
- ✅ Logged in (temp password `password123`; told to reset).
- ✅ **QBO + QB Time connected and synced** (~1,115 June entries pulled).
- Lea Ann will **map all clients herself** (duplicates only on older clients — James White, Adams Roofing; none in last ~3 years).
- **Amber login deferred** — "not right this minute… she doesn't do any of my billing, but I need someone with access in case I get hit by a bus" (break-glass backup, not billing prep).
- She **bills on the 1st** → first real run = Wed July 1 for June.

## Action items
1. **Lea Ann:** map all QB Time clients → QBO customers in Clock2Bill.
2. **Lea Ann:** approve all June time, then send Matt the full June QB Time report.
3. **Matt:** validate Clock2Bill billing against her report before she sends any invoices.
4. **Matt:** follow up on the two open data questions (rates, blank-billable).
5. **Later:** create Amber login (deferred by Lea Ann).

## Key clarifications / decisions
- **QB Time is the standard of truth** — adjust time in QB Time and re-sync; don't edit in the app (our sweep enforces this: deletions/edits propagate on re-sync).
- **Approval gating:** her staff clock in TSheets/QB Time; time flows to QBO only after approval. (Note: our app syncs from QB Time directly and does NOT filter on approval — she must approve June fully before billing.)
- **Intuit "time tracking moving into QBO" banner:** Lea Ann raised concern; Matt confirmed the data interface we use is unchanged (verified during build).
- **Multiple rates surfaced indirectly** ("$100… $125") — to be confirmed (see open items; data shows $125/$100/$75 in a rate custom field).
- **BillerGenie stays** for now; replacing it is "phase two."
- Lea Ann very positive — last month's manual billing took her 3h45m.

---

## Transcript

**[0:00] Lea Ann:** Can you hear me? … Sorry, I got a new laptop a couple weeks ago.
**[0:26] Matt:** Did P&L go on a company trip recently?
**[0:35] Lea Ann:** Wasn't a company trip. Amber — my executive assistant — is actually my sister… We spent 8–9 days in Puerto Rico (Aguadilla) doing it local style. Opened my computer one time.
**[1:45] Matt:** Quick update on the app we're building for you. We took the prototype I showed you and made it run real code. Goal: when you send monthly invoices, everything's laid out — rounding done — just click, click, click. Today I want to (1) get you logged in, (2) verify QBO + QB Time sync and pull data. Then, once the month's time is all in, send me your complete time report so we can verify the billing math.
**[4:15] Lea Ann:** One thing — I have a notification across the top of my time screen: "over the coming weeks, time tracking will be moving into QuickBooks Online." I called in but they couldn't give me info. I'm concerned about you guys doing all this work and then it changing.
**[5:07] Matt:** Appreciate the concern. Intuit's migrating the old T-sheets/QB Time classic interface to a new one, but the way the data comes over hasn't changed. We actually created time entries in both QBO and QB Time to verify everything pulls correctly — it does. Their developer docs are clear on what they're doing.
**[6:27] Lea Ann:** My staff clocks in/out through the old school… address says tsheets.intuit.com. But once it's approved in there, that's the point it comes over to QuickBooks Online. Until time is approved, it doesn't come into QBO.
**[7:00] Matt:** Right — Intuit could change things and we'd adjust, but their docs are clear. (Banter: "explain it to me like I'm 12… then like I'm 8.")
**[8:00] Matt:** I'll put app.clocktobill.com/login in the chat. Share your screen and I'll walk you through login.
**[8:30] Matt:** Type your email, then "sign in with magic link" → send login link → check your email.
**[9:30] Lea Ann:** I don't see it — my IT quarantines emails with links. Not in junk either.
**[9:58] Matt:** OK, put in your email and type the temp password (`password123`, lowercase). You can reset it later.
**[10:26] Matt:** This is your billing portal. Go to Settings → under QuickBooks Online click Connect → "For my firm" → Next → Connect. (App registered with Intuit as "Dynamic Billing.")
**[11:14] Lea Ann:** Shows Connected.
**[11:25] Matt:** Now Connect QB Time → Allow. → Back to Settings → Sync Now for QB Time.
**[11:50] Lea Ann:** It's not really letting me go…
**[11:57] Matt:** Give it a second — lots of data to pull. The fact that it says Connected is a great sign; that was what I was most concerned about today. (Intuit's not easy to work with.)
**[12:34] Matt:** Go to All Time Entries. Actually re-sync QB Time (top-right button). Once it's done you may need to refresh — that's something we're still working on (no-refresh).
**[13:47] Matt:** So all your entries are here. We can filter out the non-billable stuff. Now go to Client Mapping — this pulls in all your QBO customers; first time we sync we map them.
**[14:25] Lea Ann:** Adams has two right there.
**[14:37] Matt:** Click the dropdown to select the QBO customer… (dropdown not responding) — we'll fix that. Try syncing again.
**[15:11] Lea Ann:** There we go. If I go to Adams Roofing I can map these both to the same one… (Save.)
**[15:35] Lea Ann:** How about you let me map these myself, so if anything's janky… I spent time cleaning up duplicate/weird clients, even had Intuit help. This mapping makes me feel better.
**[16:30] Matt:** Yes — that's why we built it; duplicate customers consolidate to one invoice. One-time setup; new unmapped clients show up in the mapping section.
**[17:11] Lea Ann:** We haven't had duplicate-customer problems in ~3 years — it's my older customers (like James White, a 5–6–7-year client). This is phenomenal. Last month billing took me 3 hours 45 minutes.
**[18:04] Matt:** Once everything's mapped, you go to Billing Run → select the run → Generate Drafts → it creates a draft per invoice with consolidated time, takes out non-billable, rounds up (quarter hour per your settings), shows the proposed amount. You review and click to send. Still goes through BillerGenie for now; phase two we replace BillerGenie.
**[20:07] Matt:** Go through and map everything; we'll make sure it looks right. Today's the 29th, you bill the 1st (Wednesday). Before you send invoices, send me your full June time report and I'll run it against the app to make sure everything mapped and the billing math is correct.
**[21:35] Matt:** QuickBooks Time is always the standard of truth — if a time entry needs adjusting, adjust it in QB Time and sync over; we don't want something adjusted here that isn't reflected in QB Time.
**[22:01] Lea Ann:** I've got two hourly people — I double-check their time closely for payroll. In general, time is my Bible for billing but that's about it.
**[22:41] Matt:** As you use it, tell us anything clunky or confusing — don't worry about hurting our feelings.
**[23:26] Lea Ann:** This would be great. I don't think I have clients that use time to bill, but lots of people do.
**[23:48] Matt:** Think about what your time is worth — $125/hr — and the opportunity cost; an extra 4 hours/month to drum up business.
**[24:24] Matt:** Do you want Amber to have a separate login?
**[24:30] Lea Ann:** Not right this minute — let's get it rolling. Then I'll have her get a login; she doesn't do my billing, but I need someone with access in case I get hit by a bus.
**[24:43] Matt:** Sounds good. Message me — now that we're synced and seeing data, I'll have some questions as we analyze it. That was the big thing for today.
**[25:00] Lea Ann:** Sounds great. Thank you!
