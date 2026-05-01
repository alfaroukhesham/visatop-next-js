# Optional passport + photo before checkout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users keep the **same apply UI and flow** while **allowing checkout** when the **applicant profile** is complete and valid, **without** requiring `passport_copy` or `personal_photo` uploads first; align **server readiness**, **webhook document retention**, and **checkout** with [`docs/superpowers/specs/2026-05-01-optional-docs-at-checkout-design.md`](../specs/2026-05-01-optional-docs-at-checkout-design.md).

**Architecture:** Extend `computeValidation` in `lib/documents/validation-readiness.ts` to return both **case readiness** (`readiness`, unchanged semantics for profile + uploads) and **payment readiness** (`paymentReadiness`, same `Readiness` union but **ignores upload booleans**). `evaluateApplicationReadiness` promotes to `ready_for_payment` from `paymentReadiness === "ready"`. Replace all-or-nothing `retainRequiredDocuments` with **per-type retain**: succeed with **zero** updates when no temp blobs exist; **partial** retain when one exists; **flag admin** only on **integrity** failures (e.g. `uploaded_temp` row present but blob bytes missing). Client (`application-draft-panel.tsx`) gates the **payment** section and **journey step** on `paymentReadiness`, not `readiness`.

**Tech Stack:** TypeScript, Vitest, Drizzle/Neon patterns unchanged, `jsonOk`/`jsonError`, `export const runtime = "nodejs"` untouched on existing routes.

**Product source:** [spec](../specs/2026-05-01-optional-docs-at-checkout-design.md) §1–§6.

---

## File map

| Area | Modify |
|------|--------|
| Validation | `lib/documents/validation-readiness.ts`, `lib/documents/validation-readiness.test.ts` |
| Readiness promotion | `lib/applications/evaluate-readiness.ts` (+ new `lib/applications/evaluate-readiness.test.ts` recommended) |
| Retention | `lib/applications/retain-required-documents.ts`, `lib/applications/retain-required-documents.test.ts` |
| Webhook | `lib/payments/apply-payment-webhook-event.ts`, `lib/payments/apply-payment-webhook-event.test.ts` |
| Extract API shape | `app/api/applications/[id]/extract/route.ts` (only if `ValidationResult` type export / payload needs explicit field docs) |
| Client | `components/apply/application-draft-panel.tsx` |
| Docs (optional note) | `docs/superpowers/specs/2026-04-15-passport-ocr-documents-retention-design.md` — add one-line “superseded for checkout prerequisites” pointer **only if** maintainers want traceability (not required for MVP). |

**No DB migration** for this feature.

---

### Task 0: Lock scope + grep sweep

**Files:** (none)

- [ ] **Step 1:** Re-read the 2026-05-01 spec §3.1–§3.3 end-to-end.
- [ ] **Step 2:** Run ripgrep and confirm no other code paths set `ready_for_payment` or duplicate upload gating:

```bash
rg -n "ready_for_payment|computeValidation|evaluateApplicationReadiness|retainRequiredDocuments" --glob "*.ts" --glob "*.tsx"
```

- [ ] **Step 3:** Note for implementer: `ApplicantReview` today maps `blocked_missing_required_fields` to “Complete required details” even when **only** uploads are missing (because `computeValidation` uses that readiness for upload gaps). Task 5 fixes this by branching on `paymentReadiness` / upload presence for labels.

---

### Task 1: Dual readiness in `computeValidation`

**Files:**

- Modify: `lib/documents/validation-readiness.ts`
- Modify: `lib/documents/validation-readiness.test.ts`

**Contract (locked):**

- `ValidationResult` gains **`paymentReadiness: Readiness`**.
- **`readiness`** (existing): unchanged — still `blocked_missing_required_fields` when **either** profile keys are missing **or** either upload is missing (after validation passes).
- **`paymentReadiness`:** `blocked_validation` if any `validationFailures`; else `blocked_missing_required_fields` if `requiredFieldsMissing.length > 0`; else **`ready`** (upload booleans **ignored**).

**Implementation sketch (replace the single `let readiness` block with computed pair):**

```ts
  const profileOrUploadMissing =
    requiredFieldsMissing.length > 0 ||
    !input.uploads.passportCopyPresent ||
    !input.uploads.personalPhotoPresent;

  let readiness: Readiness;
  let paymentReadiness: Readiness;

  if (validationFailures.length > 0) {
    readiness = "blocked_validation";
    paymentReadiness = "blocked_validation";
  } else if (profileOrUploadMissing) {
    readiness = "blocked_missing_required_fields";
    paymentReadiness =
      requiredFieldsMissing.length > 0
        ? "blocked_missing_required_fields"
        : "ready";
  } else {
    readiness = "ready";
    paymentReadiness = "ready";
  }
```

Return both on the `ValidationResult` object (update JSDoc at top of file: payment vs case).

- [ ] **Step 1:** Add **`paymentReadiness`** to the type and implementation.
- [ ] **Step 2:** Update tests in `validation-readiness.test.ts`:
  - Rename or duplicate the test **“blocks on missing upload even when profile complete”** — assert `readiness === "blocked_missing_required_fields"` **and** `paymentReadiness === "ready"`.
  - Keep all existing `readiness` expectations unchanged.
  - Add one assertion on an existing “ready” case: `paymentReadiness === "ready"`.
- [ ] **Step 3:** Run:

```bash
pnpm exec vitest run lib/documents/validation-readiness.test.ts
```

Expected: all pass.

- [ ] **Step 4:** Commit message example: `feat(documents): add paymentReadiness separate from case readiness`

---

### Task 2: `evaluateApplicationReadiness` uses `paymentReadiness`

**Files:**

- Modify: `lib/applications/evaluate-readiness.ts`
- Create: `lib/applications/evaluate-readiness.test.ts` (recommended — pure unit tests with mocked `tx`)

**Logic change (locked):**

- Replace `const isReady = validation.readiness === "ready"` with **`const isPaymentReady = validation.paymentReadiness === "ready"`** for:
  - `canAdvanceToPayment` (advance to `ready_for_payment`)
  - `else if (!isReady && app.applicationStatus === "ready_for_payment")` revert — use **`!isPaymentReady`** so losing **profile** completeness drops you out of `ready_for_payment` even if uploads are still missing.

- [ ] **Step 1:** Update the file comment block at top to describe **payment** vs **case** readiness.
- [ ] **Step 2:** Add Vitest file with **at least**:
  - **Fixture:** profile-complete validation result with `paymentReadiness === "ready"` and `readiness !== "ready"` (uploads false) — expect UPDATE to `ready_for_payment` when current status is `needs_review`.
  - **Fixture:** `paymentReadiness` not ready (missing `fullName`) — expect no promotion when status was `needs_review`.
  - **Fixture:** status `ready_for_payment` and `paymentReadiness` becomes not ready — expect revert to `needs_review`.

Use a minimal mock `tx` pattern (similar spirit to `retain-required-documents.test.ts`) **or** test `computeValidation` + a tiny extracted pure function if you prefer to avoid heavy DB mocks — **but** the promotion rules must be covered somewhere.

- [ ] **Step 3:** Run:

```bash
pnpm exec vitest run lib/applications/evaluate-readiness.test.ts
```

(if file exists)

- [ ] **Step 4:** Commit: `feat(applications): advance ready_for_payment from paymentReadiness`

---

### Task 3: Partial retain on payment

**Files:**

- Modify: `lib/applications/retain-required-documents.ts`
- Modify: `lib/applications/retain-required-documents.test.ts`

**Behavior (locked):**

- For each of `PASSPORT_COPY`, `PERSONAL_PHOTO`:
  - **No** latest `uploaded_temp` row → **skip** (not an error).
  - Latest row **not** `uploaded_temp` (e.g. already `retained`) → treat as **skip** for that type (idempotent paid retry: nothing to do for that slot). **Do not** return `MISSING_REQUIRED_DOCUMENT` for “already retained” on webhook re-delivery if the app is already `paid` — caller already short-circuits; for first paid, if one is already retained from an edge race, skip that type.
  - Latest row **no blob bytes** → collect as **`BLOB_BYTES_MISSING`** for that type (hard partial failure).
- **Success:** `ok: true`, `retainedDocumentIds` may be length 0, 1, or 2.
- **Failure:** return `ok: false` **only** if `BLOB_BYTES_MISSING` non-empty (at least one corrupt slot). `MISSING_REQUIRED_DOCUMENT` path **removed** for “both missing” (both missing ⇒ success, zero updates).

**Return type:** extend `RetentionSuccess` to allow `retainedDocumentIds: []` with a defined `retainedAt` (use `now` passed in).

- [ ] **Step 1:** Rewrite the loop per type; update JSDoc (remove “abort paid transition” language; align with spec).
- [ ] **Step 2:** Replace tests in `retain-required-documents.test.ts`:
  - **Both missing** → `ok: true`, `retainedDocumentIds: []`, zero updates.
  - **One present with bytes, other missing** → one document + one blob update.
  - **Integrity (locked):** For each type, evaluate independently. **Retain every type that has `uploaded_temp` + bytes.** If **any** type has a temp row **without** bytes, return `{ ok: false, reason: 'BLOB_BYTES_MISSING', missing: [...] }` **after** applying retains for the good types (webhook does not roll back `paid`; admin flag follows). Tests must cover “photo retained, passport bytes missing ⇒ one update + failure”.
- [ ] **Step 3:** Run:

```bash
pnpm exec vitest run lib/applications/retain-required-documents.test.ts
```

- [ ] **Step 4:** Commit: `feat(applications): partial retain required docs on payment`

---

### Task 4: Webhook audit only on real retain failure

**Files:**

- Modify: `lib/payments/apply-payment-webhook-event.ts`
- Modify: `lib/payments/apply-payment-webhook-event.test.ts`

**Logic (locked):**

- After `retainRequiredDocuments`, if `!retainRes.ok`, keep existing **`adminAttentionRequired` + `payment_paid_docs_retain_failed_flagged`** audit.
- If `retainRes.ok` **and** `retainedDocumentIds.length === 0`, **no** new audit row (normal “paid with no uploads yet”).
- If `retainRes.ok` **and** `retainedDocumentIds.length > 0`, optional **info** audit is **not required** for MVP (YAGNI).

- [ ] **Step 1:** Adjust mocks in tests: first-paid transition with retain returning `{ ok: true, retainedDocumentIds: [], retainedAt: new Date() }` — expect **no** `payment_paid_docs_retain_failed_flagged` path (spy audit insertions or assert `adminAttentionRequired` not set for retention — mirror how test file asserts today).
- [ ] **Step 2:** Add test: retain `{ ok: false, reason: 'BLOB_BYTES_MISSING', ... }` still flags admin (existing behavior).
- [ ] **Step 3:** Run:

```bash
pnpm exec vitest run lib/payments/apply-payment-webhook-event.test.ts
```

- [ ] **Step 4:** Commit: `fix(payments): only flag retain failure on real blob errors`

---

### Task 5: Client — gate payment on `paymentReadiness`

**Files:**

- Modify: `components/apply/application-draft-panel.tsx`

**Changes (locked):**

1. Destructure `paymentReadiness` from `computeValidation(...)`.
2. **`journeyStep`:** use `paymentReadiness === "ready"` instead of `readiness === "ready"` for step 4 when unpaid (keep `checkout_created` / `paid` overrides as today).
3. **Payment section** (`readiness === "ready" && app.paymentStatus === "unpaid"`): change to **`paymentReadiness === "ready"`**.
4. **`ApplicantReview`:** pass **`readiness`** for missing-field list + validation errors; pass **`paymentReadiness`** (new prop) for the **badge** text:
   - If `paymentReadiness === "ready"` and `readiness !== "ready"` because uploads missing → show neutral success-tier badge, e.g. **“Ready for payment — add passport and photo when you can”** (exact copy product can tweak).
   - If `paymentReadiness === "ready"` and `readiness === "ready"` → keep **“Ready for payment”**.
   - Validation / missing profile: unchanged (warn tones).
5. **Documents section** header: replace **“Both required for submission”** with neutral wording, e.g. **“Passport and photo are required before we can submit to authorities; you can still pay first.”** (keep `gotBoth` success chip when both present).

6. **`ExtractResponse`** type: extend `validation` with optional `paymentReadiness` if the API returns full `ValidationResult` — run:

```bash
rg -n "validation:" components/apply/application-draft-panel.tsx app/api/applications/\\[id\\]/extract/route.ts
```

If `extract` returns `ValidationResult` wholesale, TypeScript may pick up `paymentReadiness` automatically once the type exports it — update the client type block at lines ~52–58 to include `paymentReadiness?: Readiness` or import a shared type if one exists.

- [ ] **Step 1:** Implement UI + props.
- [ ] **Step 2:** Manual smoke: profile-complete, **no** uploads → payment block visible, journey step 4, checkout button reachable (provider permitting).
- [ ] **Step 3:** Run:

```bash
pnpm run lint
pnpm run test:ci
pnpm run build
```

- [ ] **Step 4:** Commit: `feat(apply): allow checkout when profile ready without uploads`

---

### Task 6: Regression sweep + integration touchpoints

**Files:** (as discovered)

- [ ] **Step 1:** Run full CI trio again after any cross-file fixes.
- [ ] **Step 2:** Search for tests that assumed **“missing both docs ⇒ retain failure”** or **`ready_for_payment` requires uploads**:

```bash
rg -n "blocked_missing_required_fields|retainRequiredDocuments|ready_for_payment" --glob "*.test.ts"
```

- [ ] **Step 3:** Update any broken expectations (e.g. integration tests building fake apps for checkout).

---

## Plan self-review

| Spec section | Task covering it |
|--------------|------------------|
| §3.1 Payment vs case | Task 1, 2, 5 |
| §3.2 Client + server | Task 2 (server promotion), 5 (client) |
| §3.3 Retention / webhook | Task 3, 4 |
| §3.4 Checkout freeze | No code change if upload route already blocks pending checkout when docs exist — **verify** `app/api/applications/[id]/documents/upload/route.ts` still blocks mutation of required types during pending checkout. |
| §3.5 Draft continuation | Implicit — no change to resume tokens. |
| §6 Acceptance | Tasks 1–5 tests + Task 6 sweep |

**Placeholder scan:** None intentional.

**Type consistency:** `paymentReadiness` must appear on every `ValidationResult` construction path (only one factory: `computeValidation`).

---

## Execution handoff

**Plan complete and saved to** `docs/superpowers/plans/2026-05-01-optional-docs-at-checkout-implementation.md`.

**Two execution options:**

1. **Subagent-driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration (`superpowers:subagent-driven-development`).

2. **Inline execution** — Run tasks in this session with checkpoints (`superpowers:executing-plans`).

Which approach do you want?
