# Phase A manual QA findings (r2 — correct branch)

**Date:** 5 Sep 2026 (Asia/Dubai)  
**Target:** `https://delois-preartistic-quincy.ngrok-free.dev/visa-processing`  
**Branch:** correct Phase A branch (prior run was wrong branch / FAIL)  
**Script:** `docs/superpowers/plans/2026-09-05-tourist-journey-phase-a-manual-qa.md`  
**Guest email:** `qa.phasea+r2-0905@example.com`

---

## Verdict

```
Phase A QA (r2 correct branch): PASS
Failed steps: none
Skipped: 4, 8
Notes: India shows three slots including bank; France/transit two slots; nationality India; track shows product · country; pay reachable with empty docs. Upload UI not verified (file chooser hung). Payment still says application is complete when empty (known leftover).
```

---

## Results by step

| Step | Result | Evidence |
|---|---|---|
| 1. India 30-day — three slots | **PASS** | Passport, Personal photo, Last 6 months bank account statement |
| 2. France 30-day — two slots | **PASS** | Passport + Personal photo only |
| 3. Transit — two slots | **PASS** | Passport + Personal photo; no bank |
| 4. Upload UI hides internals | **SKIP** | File chooser hung twice; skeleton state — inconclusive |
| 5. Pay not blocked by empty docs | **PASS** | Reached Secure payment without uploads |
| 6. Nationality country name | **PASS** | Field showed `India` |
| 7. Track product + country | **PASS** | e.g. `30 Days - Single Entry · India` |
| 8. Signed-in track | **SKIP** | No test account |

---

## Screenshots

`/workspace/visatop_qa_phase_a_shots_r2/`

| File | Step |
|---|---|
| `step1_india_documents.png` | 1 PASS |
| `step2_france_documents.png` | 2 PASS |
| `step3_transit_documents.png` | 3 PASS |
| `step4_after_upload.png` | 4 SKIP |
| `step5_payment.png` | 5 PASS |
| `step6_nationality.png` | 6 PASS |
| `step7_track.png` | 7 PASS |

---

## Notes (do not fail Phase A)

- Payment still uses “application is complete…” with empty docs.
- Re-check step 4 manually in Chrome (upload passport → Uploaded / Replace, no filename/KB/`uploaded_temp`).
