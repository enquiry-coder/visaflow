# VisaFlow — App Description & User Manual

**Product:** VisaFlow
**Brand in client communications:** Grandtag Insurance Broker (by Trust)
**Purpose:** End-to-end management of client identity-verification interviews for visa / insurance applications — from outreach, to document collection, to a live (Zoom) face-to-face review, to timestamped proof-of-work and a printable verification report.

---

## 1. What VisaFlow does

VisaFlow gives a small team of staff, supervisors and an administrator a single pipeline for verifying client identities before processing an application. The whole lifecycle is covered:

1. **Outreach** — send a WhatsApp invitation (or reminder) with the client's personal portal link.
2. **Client self-service** — the client opens the link, picks a preferred Zoom time and uploads their Passport copy & Address Proof (no login or app download).
3. **Staff confirmation** — staff review the documents, confirm the exact meeting time, and send the Zoom link + a one-tap calendar invite.
4. **Live verification** — during the Zoom call, staff capture the client's live face, explicitly confirm it matches the passport photo, and stamp the evidence with the time.
5. **Proof-of-work** — a timestamped, printable report assembles the passport, address proof, stamped capture and the completed-steps checklist.

Everything is audit-ready: every action records **who** did it and **when** (in Hong Kong time).

---

## 2. Roles & permissions

| Role | What they can see / do |
|---|---|
| **Staff** | See and work **only their own assigned cases**. Send invitations/reminders, confirm times, run live verification, print reports. |
| **Supervisor** | See **all** cases plus staff management in "Team & cases". |
| **Admin** | Full visibility, plus create/disable staff accounts, reset passwords, and change roles. |

The **admin account** is `terence@probizn.com`. (Staff test accounts exist for onboarding: `staff1@probizn.com` → Hazel, `staff2@probizn.com` → Iris, `staff3@probizn.com` → Sarah Mitchell.)

---

## 3. The pipeline stages (how a case is categorized)

Every active case sits in exactly one of four stages, shown as cards with live counters:

| Stage | Meaning |
|---|---|
| **Not Processed** | No invitation sent yet. |
| **Invited-Not Responded** | Invitation sent; client has not answered (a reminder can be sent separately — this records its own timestamp). |
| **Responded-To Confirm** | Client replied (uploaded docs + picked a time); staff must now confirm the exact time. |
| **Completed** | Interview verified and case closed. |

There is also a **Paused/Suspended** state (see §5). The board **auto-refreshes every ~20 seconds** (and on tab focus), so a client's submission appears on the staff board without needing to sign out/in.

---

## 4. Home (Pipeline) — day-to-day board

The **Pipeline** tab is the main working screen:

- **Stat cards** at the top show counts for Not Processed, Invited-Not Responded, Responded-To Confirm, and Completed.
- **Stage filter** chips let you focus on one category (or "All").
- Each **client card** shows name, application (serial) no., handling staff, preferred/confirmed time, stage badge, and the last WhatsApp action (with HK timestamp).
- **Pull-to-refresh** re-fetches immediately.

### Sending an invitation / reminder
1. Tap the WhatsApp button on a **Not Processed** card → sends the **invitation** (salutation + full name + "Grandtag Insurance Broker (by Trust)" + portal link). The client moves to **Invited-Not Responded**.
2. For an **Invited-Not Responded** client who hasn't replied, tap **Reminder** → sends the follow-up and records a separate **Last Reminder At** time (the original invite time is preserved).

### Pausing / reinstating a case
- Tap **Suspend/Pause** to move a case out of the active pipeline (it sits in the "Paused" list).
- Tap **Reinstate** to bring it back.

### Exporting
- Use **Download / Export CSV** to export the currently selected stage (or all active cases), with Invited At / Last Reminder At / Responded At / Completed At columns.

---

## 5. Client detail — the working record

Tap any client card to open the **Client Detail** screen. This is where the full verification happens. Sections:

- **Client Profile** — salutation (Mr / Ms / Mrs), nationality.
- **Proposed Interview** — the client's preferred slot and the confirmed exact time.
- **Live Verification (during the Zoom meeting)** — the core interview workflow (below).
- **Staff actions** — confirm the exact time + Zoom link.

### The interview procedure (do these in order, ① → ⑤)

A **"Complete in order"** checklist at the top of the Live Verification section tracks progress and turns each number into a green ✓ as it's done.

1. **① Review documents** — confirm the Passport Copy and Address Proof thumbnails show the real images.
2. **② Verify clarity** — mark each document **"✓ Clear"** (or "✕ Unclear" + re-upload link if blurry). Both must be Clear to proceed.
3. **③ Capture the live face** — with Zoom open in another window:
   - `Win+Shift+S` → drag to select the client's face in Zoom.
   - Click once on the VisaFlow page to focus it.
   - `Ctrl+V` (or tap **Paste**/**Upload**) → the capture uploads into the live-capture box.
4. **④ Confirm the face matches the passport photo** — tap **"✓ Yes"** (or "✕ No"). This records the result + timestamp as proof-of-work.
5. **⑤ Matched — save as evidence** — burns the **timestamp + "✓ MATCHED" badge + staff name + client name** into the image permanently.

> **Time format:** all appointment times use **24-hour time** (e.g. `13:00` = 1:00 PM, `00:00` = midnight). This removes any AM/PM ambiguity.

### Confirming the exact time + sending the Zoom link
1. In **Staff actions**, type the exact time (24-hour, e.g. `13:00`).
2. Paste/enter the **Zoom meeting link** (must be a valid `https://…` URL).
3. Tap **"Send Exact Time + Zoom Link"** → WhatsApp opens with a pre-filled confirmation message.

The message contains, in order:
- A thank-you using **salutation + full name** (e.g. "Thanks Mr. TERENCE SMITH!").
- The confirmed **date + 24-hour time** (Hong Kong time, UTC+8).
- The **Zoom meeting link**.
- An **"Add to your calendar"** link — a standards-compliant **.ics** invite that opens natively on iPhone, Android and Outlook, and automatically shows the appointment in the **client's own local time** (one tap to save).

---

## 6. The printable verification report

When **all five steps are complete** (documents clear + face match = Yes + live capture + matched), a **"Print verification report"** button appears.

The single A4 report contains:

1. **Header** — "ID Verification Report", client full name, serial no., nationality, and a green **"✓ ALL STEPS COMPLETED"** badge.
2. **Live Face Capture** — full width (the timestamped/stamped evidence).
3. **Left column** — Passport Copy stacked above Address Proof (small thumbnails).
4. **Right column (bottom)** — **"Live Verification — Steps Completed"** list (①–⑤), each with a ✓, timestamp and the staff member who performed it.
5. **Footer** — generation timestamp + "Grandtag Insurance Broker".

> Note: the report images are **compact** (intended to group all work on one page). The full-size, standard-page Passport/Address Proof images remain available separately in the portal/storage for the insurance policy application itself.

---

## 7. Import — adding cases in bulk

The **Import** tab lets you paste rows (or type) in the order:

```
Mr/Ms, First name, Last name, Phone, Nationality, Handling Staff
```

Example:

```
Mr, John, Smith, +1 555 0100, USA, Sarah Mitchell
Ms, Alice, Doe, +1 555 0101, UK, Sarah Mitchell
```

- Use the **Salutation** picker (Mr / Ms / Mrs).
- Review the generated list, then **Import** to create the cases.
- Newly imported cases appear in **Not Processed**.

---

## 8. Team & cases — staff administration (Supervisor/Admin only)

The **Team & cases** tab (top-level "admin" screen) allows supervisors/admins to:

- **Add staff** — create accounts (email + password), assign a role.
- **Suspend / Restore** accounts.
- **Reset passwords** (with 6–8 character, letters/numbers-only rule).
- **Change email** and **change role**.
- **Link cases to staff** via one-click backfill.

---

## 9. Client portal — what the client experiences

The client receives a WhatsApp link to a personal **portal page** (no login/app):

1. Sees a greeting with their **salutation + full name** and application details.
2. Picks a **preferred Zoom date** and a **24-hour time slot**.
3. Uploads their **Passport Copy** and **Address Proof**.
4. Submits — and sees a thank-you message using **salutation + full name**.
5. Once staff confirm, the portal shows the **confirmed date + time**, plus an **"Add to calendar"** button (`.ics`, auto-adjusts to their local time).

---

## 10. Time zones (important)

- **All scheduling is in Hong Kong time (UTC+8, no daylight saving).** Staff enter times in HK time.
- **Calendar invites are stored as absolute UTC instants**, so the client's device automatically renders the appointment in **their own local time** — a Tokyo client sees a different wall-clock time than a London client, but the same actual moment.
- Timestamps shown in the app are rendered in Hong Kong time for consistency.

---

## 11. Quick reference — the interview checklist

| # | Action | Where |
|---|---|---|
| ① | Review passport + address proof | Live Verification (left column) |
| ② | Mark both documents "✓ Clear" | Live Verification |
| ③ | Capture live face (`Win+Shift+S` then `Ctrl+V`) | Live Verification |
| ④ | Confirm face matches passport photo ("✓ Yes") | Live Verification |
| ⑤ | "Matched — save as evidence" (burns timestamp) | Live Verification |
| — | Confirm exact time + send Zoom link (+ calendar invite) | Staff actions |
| — | **Print verification report** (when all done) | Live Verification (unlocks) |

---

## 12. Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| Category counts don't update until sign-out/in | Older builds only. Now the board **auto-refreshes** (~20s / on tab focus). |
| Zoom link shows junk (e.g. "git push") | A stray value was saved in the Zoom link field. Re-enter a real `https://…` link (input now validates URLs). |
| Calendar invite shows wrong time | Confirm the time was entered in **24-hour** format. Saved legacy "2:30 PM"-style values may need a one-time cleanup. |
| "Print verification report" button missing | One of the 5 steps is still incomplete — check the "Complete in order" checklist. |

---

*End of manual.*
