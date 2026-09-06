# Phase A manual QA (Grok)

Use this against a running app (`pnpm dev` on localhost, or the Next apply app URL you were given).  
Stay on the **tourist apply** flow only. Do not test WordPress, ads, party/family checkout, or resume email.

**Pass Phase A** if every numbered step below is PASS.  
If a step FAILs, stop, write the step number, what you saw, and a screenshot description.

---

## Setup

1. App is loaded. Home shows a nationality picker, or you can open `/apply/start?nationality=XX`.
2. Catalog has at least:
   - **India (IN)** — a **30-day tourist** (or similar non-transit) product
   - **France (FR)** — a **30-day tourist** product
   - Any nationality — a **transit** product (name contains “Transit”)
3. Have three dummy files ready (under 8MB):
   - passport photo or scan (JPEG/PNG or 1-page PDF)
   - personal photo (JPEG/PNG)
   - bank statement (JPEG/PNG or PDF)
4. Use a **guest** email you can type again later (e.g. `qa.phasea+<time>@example.com`). Do not use a real customer’s email.

**How to start a draft**

1. Pick nationality (or open `/apply/start?nationality=IN`).
2. Pick USD or AED (either is fine).
3. Tap a visa **card** (read the title — do not guess from price).
4. Enter email → submit.
5. You land on `/apply/applications/<id>` (documents + applicant details).

---

## 1. India 30-day tourist — three slots

1. Start a draft as **India**, choose a **non-transit** 30-day tourist card (not Transit).
2. On the documents page, count upload cards.

**PASS if** you see **three** required slots:

- Passport (bio page)
- Personal photo
- Last 6 months bank account statement

**FAIL if** bank statement is missing, or you see more than those three required cards, or slots are still a hard-coded “passport + photo” only.

---

## 2. France 30-day tourist — two slots

1. Start a **new** draft as **France**.
2. Choose a **non-transit** 30-day tourist card.

**PASS if** you see **exactly two** required slots: Passport and Personal photo.  
**FAIL if** a bank-statement slot appears.

---

## 3. Transit — two slots (any Africa/Asia nationality)

1. Start a draft as **India** (or Nigeria / Egypt — any Africa or Asia code).
2. Choose a card whose name contains **Transit**.

**PASS if** you see **exactly two** slots: Passport and Personal photo (no bank statement).  
**FAIL if** bank statement appears on a transit product.

---

## 4. Upload UI hides internals

On any documents page (India draft is fine):

1. Before upload, each empty slot says **Not uploaded yet** (or equivalent short customer text).
2. Upload the passport file.
3. After upload, the slot shows **Uploaded** and a **Preview** link. Button becomes **Replace**.

**PASS if** you never see:

- original filename
- file size in KB / MB
- raw status words like `uploaded_temp`, `retained`, `deleted`
- OCR attempt counts or the string `needs_manual` on the **upload cards**

**FAIL if** any of those internals appear on the upload cards.

---

## 5. Pay is not blocked by empty docs

1. On the India draft, **do not** upload bank statement (leave it empty).
2. Applicant details: you may leave most fields empty. Email was already collected.
3. Use **Next** / **Continue to payment**.

**PASS if** you can open the payment step while documents or fields are still missing. Pay is allowed.  
**FAIL if** Pay is disabled or you are forced to upload bank / fill every field first.

---

## 6. Nationality field shows a country name

On the India draft applicant form:

1. Find the **Nationality** text field (not the step-1 picker).

**PASS if** it is prefilled with a **human name** such as `India` (not `IN`) when the field was empty.  
**FAIL if** it shows only the ISO code `IN` or a UUID.

---

## 7. Track page shows product + country names

1. Note the guest email used on the India draft.
2. Open `/apply/track`.
3. Enter that email → **Show applications**.
4. Find the draft you just created.

**PASS if** the line under the reference looks like:

`30 Days Tourist · India`  
(or the real catalog names — words, not IDs)

**FAIL if** you see `Service <uuid>` or `Nationality IN` (raw ISO / UUID).

---

## 8. Signed-in track (if you have a test account)

1. Sign in (`/sign-in`) with a test account that owns or can see the same draft (or create a new draft while signed in).
2. Open `/portal/track`.

**PASS if** the same style of line appears: **product name · country name**.  
**FAIL if** UUID or raw ISO is shown.  
If you have no test login, mark this step **SKIP** (do not fail Phase A for skip).

---

## Do not fail Phase A for these (known leftovers)

These were **not** shipped in Phase A. Record them as notes only:

- Payment card may still say the application is **complete** even when slots are empty.
- Applicant details may still show raw OCR status / attempt counts (not on the upload cards).
- Family / party checkout, resume banner, and guided visa chooser are Phase B/C.

---

## Report back

Write:

```
Phase A QA: PASS / FAIL
Failed steps: (numbers or none)
Skipped: (e.g. 8)
Notes: (one or two sentences)
```
