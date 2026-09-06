# Phase A manual QA findings

**Date:** 5 Sep 2026 (Asia/Dubai)  
**Target:** https://delois-preartistic-quincy.ngrok-free.dev/visa-processing (local npm run dev via ngrok)  
**Script:** docs/superpowers/plans/2026-09-05-tourist-journey-phase-a-manual-qa.md  
**Tester:** Staff Software Engineering Bot (browser)  
**Guest email:** qa.phasea+ngrok0905@example.com

---

## Verdict

```
Phase A QA: FAIL
Failed steps: 1, 6, 7
Skipped: 4, 5, 8
Notes: India showed only Passport + Personal photo (no bank slot). Nationality applicant field blank. Track showed raw service id + Nationality IN. Upload/payment blocked by loading skeleton after file chooser. No payment completed.
```

**Phase A does not pass** on this build. The dynamic bank-statement slot and display-name work from the Phase A plan are either not shipped yet or not active on this ngrok session.

---

## Results by step

| Step | Result | Evidence |
|---|---|---|
| 1. India 30-day tourist — three slots | **FAIL** | Documents page shows only Passport (bio page) and Personal photo. No Last 6 months bank account statement slot. |
| 2. France 30-day tourist — two slots | **PASS** | Exactly Passport + Personal photo; no bank statement. |
| 3. Transit — two slots (India/Asia) | **PASS** | Exactly Passport + Personal photo; no bank on transit. |
| 4. Upload UI hides internals | **SKIP** | After opening the file chooser, the documents UI hung on a loading skeleton; upload could not be verified. |
| 5. Pay not blocked by empty docs | **SKIP** | Could not reach payment — same loading blocker after upload attempt. |
| 6. Nationality field shows country name | **FAIL** | Applicant Nationality field was blank (placeholder e.g. Egyptian), not prefilled with India. |
| 7. Track shows product + country names | **FAIL** | Track line: Service eoqbjqjrhuinco6fh954xom · Nationality IN — raw service id + ISO, not catalog names. |
| 8. Signed-in portal track | **SKIP** | No test account (script allows skip). |

---

## Failed steps (detail)

### Step 1 — India missing bank statement slot

- Path: India → non-transit 30-day tourist → documents.
- Expected (Phase A): three required slots including Last 6 months bank account statement.
- Actual: two slots only (passport + photo).
- Screenshot: step1_india_documents.png

### Step 6 — Nationality not prefilled with country name

- On the India draft applicant form, Nationality was empty with placeholder text.
- Expected: prefilled human name such as India (not IN).

### Step 7 — Track still shows IDs

- /apply/track with guest email listed reference 5db28e26.
- Line under reference: Service eoqbjqjrhuinco6fh954xom · Nationality IN.
- Expected: e.g. 30 Days Tourist · India.
- Screenshot: step7_track.png

---

## Skipped / blocked

### Steps 4–5 — upload / payment

- Opening the OS file chooser for passport upload left the page on a persistent loading skeleton.
- Could not confirm customer-safe upload copy or pay-first Continue.
- Screenshots: step4_upload_blocked.png, step5_payment_blocked.png.
- Note: May be an automation/file-picker limitation rather than a product bug. Re-test uploads manually in Chrome on the Mac before treating as a product FAIL.

---

## Notes (do not fail Phase A per script)

- Payment complete copy when docs empty — not re-tested (payment unreachable).
- Family/party checkout, resume banner, guided visa chooser — Phase B/C; card wall + Khaleej bar still present (expected).

---

## Screenshots

All under /workspace/visatop_qa_phase_a_shots/

| File | Step |
|---|---|
| step1_india_documents.png | 1 FAIL |
| step2_france_documents.png | 2 PASS |
| step3_transit_documents.png | 3 PASS |
| step4_upload_blocked.png | 4 SKIP |
| step5_payment_blocked.png | 5 SKIP |
| step7_track.png | 7 FAIL |

---

## Recommended next actions

1. Confirm whether Phase A code (document resolver + bank_statement_6m + display names) is on the branch serving npm run dev. If not, ship/merge Phase A before re-QA.
2. After Phase A is on that process: restart npm run dev, refresh ngrok, re-run steps 1, 6, 7 first.
3. Manually re-check steps 4–5 in local Chrome (file picker) — treat agent SKIP as inconclusive.
4. Do not start Phase B until Phase A QA is green (hard gate in the README).
