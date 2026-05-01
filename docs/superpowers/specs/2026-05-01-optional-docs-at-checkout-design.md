---
title: Optional passport + photo before checkout (same UI flow)
date: 2026-05-01
status: Draft — pending product review
supersedes-in-part:
  - docs/superpowers/specs/2026-04-15-passport-ocr-documents-retention-design.md (payment + retention prerequisites §1)
---

## 1) Intent (locked from product discussion)

- **Same wizard UI, same screens, same order** as today. Users still enter the full applicant profile and use the same document steps.
- **Behavioral change only:** users may **proceed to checkout** even when **`passport_copy`** and/or **`personal_photo`** are **not** uploaded yet.
- **Pre-checkout validation (locked):** All **non-file** rules stay as today: every field in `SUBMISSION_REQUIRED_FIELDS` must be present and pass the same date/passport validity checks (`computeValidation` profile + validation failure semantics). **Only** the requirement that both required uploads exist before moving on is relaxed **for the payment gate**.
- **Post-payment:** Users complete uploads (and existing extract/review flows) when they attach files. **Fulfillment:** no mandatory system-enforced “ops cannot start” gate (manual-first posture); optional internal signals for ops are allowed but not in scope for UX copy here.
- **Money:** Webhooks remain the **source of truth** for `paymentStatus`. Checkout still **locks a `PriceQuote`** and passes standard metadata (`applicationId`, `serviceId`, `priceQuoteId`, `userId?`, `isGuest`).

## 2) Problem statement (current code)

- `lib/applications/evaluate-readiness.ts` calls `computeValidation` with `passportCopyPresent` / `personalPhotoPresent` derived from DB. `readiness === "ready"` requires **both** uploads (`lib/documents/validation-readiness.ts`, lines 210–215).
- Only when readiness is `ready` can the application move to `ready_for_payment`, which `/api/checkout` requires (`app/api/checkout/route.ts`).
- `lib/applications/retain-required-documents.ts` is **all-or-nothing** for the two types: if either is missing, it returns `MISSING_REQUIRED_DOCUMENT` / `BLOB_BYTES_MISSING` and **mutates nothing**. `applyPaymentWebhookEvent` already **does not roll back** `paid`; it flags `adminAttentionRequired` and writes `payment_paid_docs_retain_failed_flagged` when retain fails — which would fire on **every** paid application with no pre-paid docs until behavior changes.

## 3) Target behavior

### 3.1 Payment eligibility vs case completeness

Introduce a clear distinction (names are illustrative; implementation may use a single function returning both):

| Concept | Rule |
|--------|------|
| **Payment eligibility** | Same as today’s `computeValidation` **except** `passport_copy` and `personal_photo` presence are **not** required. Must still be `readiness !== "blocked_validation"` and no missing `SUBMISSION_REQUIRED_FIELDS`. |
| **Case completeness** (for later UX / ops tooling) | Today’s full rule: both uploads present **and** the same profile/validation rules. Used for “application fully ready for document-driven automation” messaging or internal dashboards — **not** for blocking payment. |

`evaluateApplicationReadiness` (or equivalent) should advance to `ready_for_payment` when **payment eligibility** is satisfied, not only when **case completeness** is satisfied.

### 3.2 Client and server

- Any **server** check that mirrors “can start checkout” must use **payment eligibility**.
- **UI:** Keep the same screens; enable the checkout path when **payment eligibility** is met. It is acceptable to show neutral progress copy (“You can pay now; you can still add passport and photo after payment”) only if product wants it — **not** required for MVP if the existing layout already implies optional uploads.

### 3.3 Retention on `paid` (webhook, same transaction as today)

- On first transition to `paid`, **retain each** of `passport_copy` and `personal_photo` **if** a latest `uploaded_temp` row with blob bytes exists — **partial retain is success**.
- If **neither** document exists yet: **no retention work**, **no** `adminAttentionRequired` solely for that reason, **no** `payment_paid_docs_retain_failed_flagged` audit for “missing both” (that audit is for genuine retain failures, e.g. blob bytes missing when a row exists).
- If **one** exists: retain that one only; do not fail the whole retain step because the other slot is empty.
- **Idempotency / retries:** unchanged expectations: dedupe provider events; if already `paid`, do not re-run destructive paths.

This supersedes the prior locked line: *“the user cannot reach `paymentStatus = paid` unless both required uploads exist”* — **paid is allowed without uploads**; retention runs only for blobs that actually exist at webhook time.

### 3.4 Checkout freeze (MVP)

- While checkout is **pending/in-flight**, rules that **block replace/delete** of required document types should **remain** (avoid checkout → user mutates temp docs → webhook retain confusion). If no rows exist yet, there is nothing to freeze; if partial rows exist, existing freeze semantics apply.

### 3.5 Draft continuation

- Unpaid drafts: unchanged resume/expiry policy (`draftExpiresAt`, guest token rules per existing specs).
- Post-pay: user returns to the same application to upload; no new product surface required beyond what the existing flow already provides once `paymentStatus = paid`.

## 4) Non-goals (YAGNI)

- Changing which profile fields are required before pay.
- New payment provider or abandoning `PriceQuote` locking.
- Per-service toggles for “docs optional before pay” unless product later requests it.
- Hard system enforcement of fulfillment gates.

## 5) Implementation touchpoints (for a follow-up plan)

- `lib/documents/validation-readiness.ts` — add **payment eligibility** (or extend return type) without breaking callers that need full **case completeness**.
- `lib/applications/evaluate-readiness.ts` — use payment eligibility for `ready_for_payment` transitions; define revert rules when profile becomes invalid while `ready_for_payment` (unchanged idea, still keyed off payment eligibility).
- `lib/applications/retain-required-documents.ts` — evolve to **partial retain** + clear success when nothing to retain; adjust JSDoc and tests.
- `lib/payments/apply-payment-webhook-event.ts` — align audit / `adminAttentionRequired` with partial retain (only flag on unexpected states, e.g. blob row without bytes).
- Client: `components/apply/application-draft-panel.tsx` (and any other checkout affordances) — gate on **payment eligibility**, not full upload readiness.
- Tests: `evaluate-readiness`, `validation-readiness`, upload route tests if any assume global invariant “paid ⇒ both retained”, webhook tests.

## 6) Acceptance criteria (measurable)

- With **full profile valid** and **no** `passport_copy` / `personal_photo` rows, the application can reach **`ready_for_payment`** and **`POST /api/checkout`** succeeds (subject to existing guest email / pricing / provider config).
- With the same profile but **invalid** passport expiry or DOB, checkout remains **blocked** (validation failures unchanged).
- With **missing** any `SUBMISSION_REQUIRED_FIELDS` profile field, checkout remains **blocked**.
- On webhook **first** `paid` with **no** docs: `paymentStatus = paid`, **no** retain failure audit solely for missing docs, **no** `adminAttentionRequired` for that reason alone.
- On webhook **first** `paid` with **one** doc in `uploaded_temp` with bytes: that doc becomes **`retained`**, the other slot unchanged.
- Checkout pending freeze behavior for existing temp required docs remains covered by existing tests or updated equivalents.

## 7) Spec self-review

- **Placeholders:** None intentional; implementation plan will name exact types/audit rows.
- **Consistency:** Payment webhook remains authoritative; retention is relaxed, not skipped when blobs exist.
- **Scope:** Single global policy; same UI; docs optional only for the **payment** gate.
- **Ambiguity:** “Case completeness” is internal/UX helper — must not be wired to checkout or webhook paid transition.

---

**Changelog**

- **2026-05-01:** Initial spec from brainstorming (optional docs before checkout; same UI; profile rules unchanged).
