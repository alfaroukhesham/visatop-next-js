---
title: Passport OCR + Documents (Neon-only) — Implementable Spec
date: 2026-04-15
status: Draft (revised; legacy appendix removed)
---

## 0) Changelog (important)

- **Removed** a duplicated legacy appendix that contradicted locked decisions (retention trigger, “6 months” wording, attempt UI copy).
- This file is now **single-source-of-truth** for the feature.
- **Tightened** lease completion semantics, payment-time document prerequisites, rate-limit bucket semantics, submission-required field list, and status boundaries (`failed` vs `needs_manual` vs `blocked_invalid_doc`).
- **Added** checkout pending “document freeze”, money/webhook edge posture, field-array semantics, `STALE_EXTRACTION_LEASE` in the API error index, and MVP image normalization rules.
- **Added** **single-page PDF** for `passport_copy` (normalize to JPEG then OCR), **PDF** for `supporting` (storage only, no OCR), **`PDF_NOT_SINGLE_PAGE`** error.

## 1) Decisions (locked)

- **Extraction mode**: **Sync** (one HTTP request runs up to **2** OCR attempts).
- **Max OCR attempts**: 2 attempts per passport document version (keyed by `sha256`).
- **UX**: dedicated step **Upload → Extract → Review**, and **block submission** until required fields complete + validation passes.
- **Storage constraint**: **Neon DB only** (no storage buckets).
- **Retention trigger**: document blobs become **retained when `paymentStatus = paid`** (webhook-driven; see §11.2).
- **Draft policy alignment**: drafts are deleted/cleaned only when **`paymentStatus = unpaid`** and **`draftExpiresAt < now()`** (existing Phase-2 rule).
- **Payment prerequisites (locked)**: the user **cannot** reach `paymentStatus = paid` unless **both** required uploads exist (`passport_copy` + `personal_photo`) in `uploaded_temp` (pre-payment) / `retained` (post-payment transition) and pass upload-time validation.
- **Checkout initiation gate (locked)**: creating checkout / starting payment must be blocked unless the same prerequisites are satisfied (so the paid webhook invariant is not “best effort”).
- **Checkout freeze (locked MVP)**: while a checkout is **pending/in-flight** for an application, the user **must not** be able to **replace/delete** required documents (`passport_copy`, `personal_photo`). This prevents “checkout created → user mutates docs → webhook cannot retain” money/DB drift without implementing refunds in MVP.

## 2) Scope

### 2.1 In scope

- Passport OCR for:
  - full name, DOB, place of birth, nationality, passport number, passport expiry date
  - profession + address (expected manual)
- Upload + store:
  - passport copy (bio page image)
  - personal photo (portrait)
  - supporting docs (optional; not required to submit)
- Temporary draft storage in Postgres (`bytea`) with cleanup
- Retain blobs on payment (webhook/idempotent handler)
- Preview + download endpoints (streaming) with explicit auth rules
- Explicit states, transitions, API contracts, and acceptance criteria
- **Server-side normalization (MVP)**: images per §5.6; **passport single-page PDF** rendered to image then same pipeline (see §5.7); **supporting PDFs** stored as-is, **no OCR** (see §5.7)

### 2.2 Out of scope (this spec)

- Handwriting OCR
- MRZ check-digit validation
- **HEIC** uploads (MVP rejects)
- OCR on **supporting** documents (storage/preview/download only)
- Client-side crop UI
- Async extraction jobs / polling APIs

## 3) Definitions (avoid ambiguity)

- **`extraction.status`**: “did we successfully read required OCR fields from the passport image?”
- **`readiness`**: “can the user submit/continue?” (includes manual-required fields + validation)
- **`document.status`**: metadata lifecycle for a specific uploaded file row
- **`blob.tempExpiresAt`**: when the **bytes** may be deleted if still unpaid + not retained

**Truth statement (locked):** `extraction.status = succeeded` does **not** imply `readiness = ready`.  
Example: OCR can succeed while passport expiry fails the 180-day rule → `readiness = blocked_validation`.

## 4) State model (explicit)

This feature uses four axes. Values are strings in DB.

### 4.1 Document lifecycle status (per `application_document`)

- `missing` (UI-derived; no row)
- `uploaded_temp` (upload succeeded; blob exists; unpaid retention not granted)
- `retained` (paid retention granted)
- `rejected` (upload rejected: type/size/corrupt)
- `deleted` (blob removed; metadata may remain for audit depending on implementation choice)

**Upload-time rejections map here** (`rejected`). These documents must never reach extraction.

**Transitions**

- `missing -> uploaded_temp`: upload succeeds
- `uploaded_temp -> deleted`: user replaces OR cleanup deletes temp blob OR TTL expiry deletes blob
- `uploaded_temp -> retained`: payment confirmed (retention trigger)
- `uploaded_temp -> rejected`: upload rejected
- `retained -> deleted`: not allowed for clients/guests; **admin-only** (see §12A)

### 4.2 Extraction overall status (per application, passport only)

- `not_started`
- `running`
- `succeeded`
- `needs_manual` (after 2 attempts, still missing required OCR fields)
- `blocked_invalid_doc` (passport image exists but is not usable for OCR after upload-time checks passed)
- `failed` (provider/system error; user may continue manually)

**Extraction-time failures map here** (`blocked_invalid_doc`, `failed`).  
**Rule:** `blocked_invalid_doc` is only reachable if the latest passport doc is `uploaded_temp` and passes upload validation, but OCR cannot produce required fields (e.g., unreadable image / model parse failure).

**Status boundaries (locked):**

- **`failed`**: transport/provider outage/timeouts, **or** the model returns **non-JSON / schema-invalid** output, **or** lease staleness aborts an in-flight run. Treat as “no trustworthy structured OCR output.”
- **`needs_manual`**: the model returns **valid JSON matching the OCR schema**, but **required OCR fields are still missing** after attempt 2.
- **`blocked_invalid_doc`**: valid JSON envelope, but the server determines the passport image content is **not usable** for OCR under MVP rules (extreme blur/glare/low resolution heuristics).  
  **If these heuristics are not implemented in MVP, do not use `blocked_invalid_doc`—map those cases to `failed` instead.**

**Transitions**

- `not_started -> running`: user clicks “Extract”
- `running -> succeeded`: attempt 1 or 2 yields required OCR fields (parseable)
- `running -> needs_manual`: after attempt 2 still missing required OCR fields
- `running -> blocked_invalid_doc`: OCR cannot proceed on an “otherwise valid upload”
- `running -> failed`: provider/system error / timeout
- any -> `not_started`: user uploads a new passport image (new `sha256`)

### 4.3 Application readiness for submission

- `blocked_missing_required_fields`
- `blocked_validation`
- `ready`

### 4.4 Blob retention state (per blob)

- `temp` (`retainedAt` null, `tempExpiresAt` set while unpaid)
- `retained` (`retainedAt` set)
- `deleted`

## 5) UX flow (exact)

### 5.1 Step 0 — Contact info

User enters **email + phone** (pre-existing requirement).

### 5.2 Step 1 — Upload documents

Required:

- Passport copy (bio page **image or single-page PDF**; §5.7)
- Personal photo (portrait; **image only**)

Optional:

- Supporting documents (future expansion)

UI states per upload:

- Uploading (progress)
- Uploaded (thumbnail + Replace)
- Rejected (reason + action)

**Thumbnails / previews (locked):**

- The UI may show an immediate preview using the browser’s **local `File` object** after picking a file.
- For returning users / refresh, the UI may fetch a server preview via **`GET .../preview`** (see §10.4).
- The UI must not assume `download` works for temp blobs.

**Replace behavior (locked):**

- creates a **new** `application_document` row (new `id`, new `sha256`)
- **Hard delete** the previous temp blob row(s) and mark the previous document row `deleted` (preferred for MVP; avoids ambiguous “ghost metadata”)
- resets passport extraction overall status to `not_started`
- clears extraction summary pointers (`passportExtractionDocumentId`, `passportExtractionSha256`) immediately
- resets `passportExtractionRunId = 0` and clears any active lease fields (see §9.4)
- does not auto-overwrite any user-entered form fields

### 5.3 Step 2 — Extract (dedicated step)

User taps **Extract**.

Copy rules:

- Primary: “Extracting your details…”
- If attempt 2 runs: “Improving results…” (**do not** show “Attempt 1/2” as primary UI)
- If extraction ends in `needs_manual` / `failed`: “We couldn’t read everything clearly. Please review and add the missing details.”

### 5.4 Step 3 — Review & complete

- Prefill OCR fields where allowed by precedence rules (§6.4).
- Show a **single checklist** of missing required submission fields (distinct from OCR-missing; see §10.2 response fields).
- **Block submission** until readiness is `ready`.
- “Save and return later” preserves manual edits. Under normal operation, document bytes remain available for the **draft window** because `tempExpiresAt = draftExpiresAt` (see §11.1). §5.5 covers edge cases (manual deletion/partial failures).

### 5.5 Silent failure prevention: draft alive but blob expired (locked UX)

Because drafts may outlive temp blob deletion policies, the product must handle:

- Draft still valid (`draftExpiresAt > now`, `paymentStatus=unpaid`)
- Latest required document row exists but blob bytes are missing (`deleted`) OR `tempExpiresAt < now` triggered cleanup

**UI behavior (locked):**

- Show a top banner: “We can’t access your uploaded file anymore. Please re-upload your passport photo to continue.”
- Set gating: user cannot click **Extract** until a fresh `uploaded_temp` passport exists.

### 5.6 Server-side image normalization (MVP; locked)

Goal: reduce OCR failures from camera rotation + metadata surprises, without turning into an image-processing product.

Applies to **`image/jpeg` and `image/png`** uploads for:

- **`passport_copy`** (when the user uploads an image, not a PDF)
- **`personal_photo`** (images only in MVP)
- **`supporting`** when the file is an image

Steps:

- Decode image server-side; if decode fails → `400 CORRUPT_IMAGE`
- Apply **EXIF orientation** auto-correction so pixels are “upright”
- Strip metadata segments that are not required for rendering (EXIF/ICC comments where safe)
- If either dimension exceeds **4096px**, downscale preserving aspect ratio so max dimension is **4096px** (no upscaling)
- Re-encode as **JPEG** at quality **85** before computing `sha256` and persisting bytes (stable hashing + predictable size)

### 5.7 PDF rules (MVP; locked)

**`passport_copy` — PDF (`application/pdf`)**

- **Allowed** for OCR. **Not allowed** for `personal_photo`.
- **Single-page only:** server must verify the PDF has **exactly one page**. If not → `400 PDF_NOT_SINGLE_PAGE` with user-visible copy: “Please upload a single-page PDF of the passport bio page.”
- Pipeline: render that page to a raster → apply §5.6 to the raster → persist **normalized JPEG bytes** with `contentType: image/jpeg` (same as image uploads). OCR always runs on this normalized image.
- `sha256` is computed on the **persisted normalized bytes** (post-PDF render + JPEG encode).

**`supporting` — PDF (`application/pdf`)**

- **Allowed** for storage, preview, and download.
- **No OCR** and no text extraction in MVP.
- Store **original PDF bytes** as uploaded (optionally virus-scan later; out of scope here). `contentType` remains `application/pdf`; `sha256` is computed on **original bytes**.

**`supporting` — images**

- Follow §5.6; no OCR.

## 6) Extraction (sync) — exact behavior

### 6.1 Required OCR fields (extraction success criteria)

`extraction.status = succeeded` only if all are present **and parseable**:

- `fullName`
- `dateOfBirth`
- `nationality`
- `passportNumber`
- `passportExpiryDate`

Notes:

- `placeOfBirth` may be null (manual).
- `profession` and `address` are expected manual and do not gate extraction success.

### 6.2 Two-attempt rule (exact)

For a given passport document `sha256`:

- Run attempt 1.
- If any required OCR field missing OR required date fields fail parsing → run attempt 2.
- After attempt 2:
  - if still missing required OCR fields → `needs_manual`
  - else `succeeded`

No further attempts unless a new passport image is uploaded (new sha).

**Passport source note (locked):** “new upload” includes a new **image** file or a new **single-page PDF**; both become a normalized JPEG blob before hashing and OCR (§5.7).

### 6.3 Timeouts

- Server budget for the whole extraction request: **25 seconds**.
- If timeouts occur → `failed` (user can proceed manually).

### 6.4 Prefill + manual precedence (locked)

Each profile field has provenance `source = ocr | manual`.

Rules:

- OCR may write a field only if it’s empty OR previously `source=ocr`.
- If user sets `source=manual`, OCR must never overwrite it automatically.
- MVP does not include “Replace my entered details with OCR”.

### 6.5 Validation interaction (locked)

After OCR attempts (still within the same sync request), server computes `validation` for **submission readiness**:

- passport expiry rule (§7.1)
- DOB rule (§7.2)
- required submission fields present (locked list below)

**Submission-required fields (locked MVP list):**

- `email`
- `phone`
- `fullName`
- `dateOfBirth`
- `placeOfBirth`
- `nationality`
- `passportNumber`
- `passportExpiryDate`
- `profession`
- `address`
- required uploads exist: `passport_copy` + `personal_photo` (each latest non-deleted row is `uploaded_temp` pre-payment)

**Important:** validation failures do **not** downgrade `extraction.status` from `succeeded` to `needs_manual`.  
They affect `readiness` / `validation.validationFailures` instead.

**Readiness precedence (locked):** if any `validation.validationFailures` exist, set `readiness = blocked_validation` **even if** `requiredFieldsMissing` is non-empty. If there are no validation failures but required fields are missing, set `readiness = blocked_missing_required_fields`.

## 7) Validation rules (exact)

### 7.1 Time base + “6 months”

- Use **server time in UTC** (`nowUtcDate` in validation payload).
- Define 6 months as **180 days** for MVP.
- Rule: `passportExpiryDate >= (today_utc + 180 days)`.

### 7.2 DOB sanity

- DOB must satisfy: `1900-01-01 <= dob <= today_utc`

### 7.3 Manual entry validation

Manual edits must pass the same validations before readiness becomes `ready`.

## 8) Data schemas (exact)

### 8.1 OCR result JSON schema (stored)

```json
{
  "schemaVersion": 1,
  "fullName": "string|null",
  "dateOfBirth": "YYYY-MM-DD|null",
  "placeOfBirth": "string|null",
  "nationality": "string|null",
  "passportNumber": "string|null",
  "passportExpiryDate": "YYYY-MM-DD|null",
  "profession": "string|null",
  "address": "string|null"
}
```

### 8.2 Validation JSON schema (stored + returned)

```json
{
  "schemaVersion": 1,
  "nowUtcDate": "YYYY-MM-DD",
  "readiness": "blocked_missing_required_fields|blocked_validation|ready",
  "requiredFieldsMissing": ["fieldName"],
  "validationFailures": [
    { "code": "passport_expired_or_insufficient_validity", "message": "Passport must be valid for at least 6 months." },
    { "code": "dob_invalid", "message": "Date of birth looks invalid. Please check and correct it." }
  ]
}
```

## 9) Database model (Neon / Postgres)

### 9.1 `application_document` (existing) — required extensions

Add columns:

- `documentType`: `passport_copy | personal_photo | supporting`
- `status`: `uploaded_temp | retained | rejected | deleted`
- `contentType` (string)
- `byteLength` (int)
- `originalFilename` (string, nullable)
- `sha256` (string, required)

**Uniqueness (locked):** unique on **`(application_id, document_type, sha256)`**  
Rationale: prevents duplicate rows from double-submit uploads; still allows replace (new sha).

### 9.2 `application_document_blob` (new, 1:1)

Columns:

- `documentId` (PK/FK to `application_document.id`, **ON DELETE CASCADE**)
- `bytes` (`bytea`)
- `createdAt`
- `tempExpiresAt` (nullable; null when retained)
- `retainedAt` (nullable)

### 9.3 `application_document_extraction` (new, per attempt)

Columns:

- `id`
- `documentId`
- `attempt` (1|2)
- `status` (`started|succeeded|failed`)
- `provider` (`gemini`)
- `model` (string)
- `promptVersion` (int)
- `latencyMs` (int)
- `usage` (json, nullable)
- `resultJson` (json)
- `validationJson` (json)
- `errorCode`, `errorMessage` (no PII)
- `startedAt`, `finishedAt`

### 9.4 Extraction summary (required for UI simplicity)

Add to `application` (or 1:1 table):

- `passportExtractionStatus`
- `passportExtractionUpdatedAt`
- `passportExtractionStartedAt` (nullable; used for stale `running` recovery)
- `passportExtractionLeaseExpiresAt` (nullable; short lease window; see §10.2 concurrency)
- `passportExtractionRunId` (int; monotonically increments on each successful lease acquisition; used to reject late writes)
- `passportExtractionDocumentId`
- `passportExtractionSha256`

**Replace rules:** on new passport upload, set:

- `passportExtractionStatus = not_started`
- `passportExtractionDocumentId = null`
- `passportExtractionSha256 = null`
- `passportExtractionStartedAt = null`
- `passportExtractionLeaseExpiresAt = null`
- `passportExtractionRunId = 0` (invalidates any in-flight OCR writes tied to a prior document)

## 10) API contracts (exact; enveloped)

All JSON responses use `jsonOk/jsonError` and must pass through `x-request-id`.

### 10.1 Upload document bytes (multipart)

`POST /api/applications/[id]/documents/upload`

Multipart fields:

- `documentType` = `passport_copy|personal_photo|supporting`
- `file` = image

Success `201`:

```json
{
  "document": {
    "id": "uuid",
    "documentType": "passport_copy",
    "status": "uploaded_temp",
    "sha256": "hex",
    "contentType": "image/jpeg",
    "byteLength": 123,
    "originalFilename": "passport.jpg",
    "tempExpiresAt": "2026-04-20T12:34:56.000Z",
    "draftExpiresAt": "2026-04-22T12:34:56.000Z"
  }
}
```

Errors:

- `401/403` unauthorized/forbidden
- `404` application not found
- `413` `FILE_TOO_LARGE`
- `415` `UNSUPPORTED_TYPE` (e.g. HEIC, PDF on `personal_photo`, PDF on disallowed types)
- `400` `CORRUPT_IMAGE`
- `400` `PDF_NOT_SINGLE_PAGE` (**passport_copy** PDF with more than one page)

**Allowed MIME by `documentType` (locked):**

- `passport_copy`: `image/jpeg`, `image/png`, `application/pdf` (single-page only; §5.7)
- `personal_photo`: `image/jpeg`, `image/png` only
- `supporting`: `image/jpeg`, `image/png`, `application/pdf` (no OCR)

### 10.2 Extract passport (sync)

`POST /api/applications/[id]/extract`

Success `200`:

```json
{
  "extraction": {
    "status": "succeeded",
    "attemptsUsed": 1,
    "documentId": "uuid",
    "prefill": {
      "fullName": "string|null",
      "dateOfBirth": "YYYY-MM-DD|null",
      "placeOfBirth": "string|null",
      "nationality": "string|null",
      "passportNumber": "string|null",
      "passportExpiryDate": "YYYY-MM-DD|null",
      "profession": "string|null",
      "address": "string|null"
    },
    "ocrMissingFields": [],
    "submissionMissingFields": ["profession", "address"],
    "validation": {
      "schemaVersion": 1,
      "nowUtcDate": "YYYY-MM-DD",
      "readiness": "blocked_validation",
      "requiredFieldsMissing": ["profession", "address"],
      "validationFailures": [
        { "code": "passport_expired_or_insufficient_validity", "message": "Passport must be valid for at least 6 months." }
      ]
    }
  }
}
```

Field semantics (locked):

- `ocrMissingFields`: missing required OCR fields (should be empty when `status` is `succeeded`)
- `validation.requiredFieldsMissing`: canonical list of **missing submission-required field keys** from §6.5 (presence gating)
- `validation.validationFailures`: canonical list of **rule failures** even when values exist (e.g., expiry policy, DOB invalid)
- `submissionMissingFields`: **UI convenience** array; MUST be derivable from `validation.requiredFieldsMissing` (typically identical). UI should prefer `validation.requiredFieldsMissing` for logic to avoid double-counting bugs.

Errors:

- `404` `NO_PASSPORT_DOCUMENT`
- `409` `EXTRACTION_ALREADY_RUNNING`
- `409` `STALE_EXTRACTION_LEASE`
- `429` `RATE_LIMITED`

### 10.2.1 Concurrency + stuck `running` recovery (locked)

**Single-flight mutex (DB-backed):**

- On entering `POST /extract`, attempt to acquire a lease:
  - set `passportExtractionLeaseExpiresAt = now + 30s`
  - increment `passportExtractionRunId` (monotonic per application row; resets to `0` on passport replace per §9.4)
  - only one request succeeds; others get `409 EXTRACTION_ALREADY_RUNNING`

**Atomicity (locked):** lease acquisition MUST be a **single conditional SQL update** (or equivalent) that transitions `not_started|needs_manual|failed|blocked_invalid_doc -> running` **only if** no active lease exists. No read-then-write races.

**Lease release + terminal transition (locked):**

- On handler completion (**any** outcome: `succeeded`, `needs_manual`, `failed`, `blocked_invalid_doc`), atomically:
  - set terminal `passportExtractionStatus`
  - set `passportExtractionLeaseExpiresAt = null`
  - set `passportExtractionStartedAt = null`

**Late completion safety (locked):**

- Any DB writes to `application` profile fields from OCR must be guarded by **`passportExtractionRunId` captured at lease acquisition** (incremented only on successful lease acquisition).
- If the lease is no longer valid at commit time **or** `passportExtractionRunId` no longer matches, the server must **discard** OCR writes and return **`409 STALE_EXTRACTION_LEASE`** (client retries).

**`passportExtractionRunId` monotonicity (locked):**

- Increment **only** on successful lease acquisition inside `POST /extract`.
- **Do not** increment on stale recovery transitions (those should only terminate `running` → `failed`).

**Stale recovery:**

- If `passportExtractionStatus = running` and `passportExtractionLeaseExpiresAt < now`, treat lease as expired:
  - transition to `failed` with `errorCode = STALE_EXTRACTION_LEASE`
  - allow a new `POST /extract`

**Crash mid-request:**

- Worst case: status remains `running` until lease expiry, then stale recovery clears it.

Client guidance:

- On `409`, wait **1s** then retry **up to 3 times** (jittered).

### 10.3 Download document (streaming; retained only)

`GET /api/applications/[id]/documents/[documentId]/download`

Rules:

- Allowed when requester owns the application (session or valid resume cookie) **AND** blob is `retained`
- **Admin access allowed** (see §12A)

Headers (locked):

- `Content-Type` from stored metadata
- `Content-Length`
- `Cache-Control: private, no-store`
- `Content-Disposition: attachment; filename="passport.jpg"` (ASCII fallback)

### 10.4 Preview document (streaming; temp allowed)

`GET /api/applications/[id]/documents/[documentId]/preview`

Rules:

- Allowed for owner when document is `uploaded_temp` **or** `retained`
- Same auth as upload/extract routes
- Same caching headers as download
- **`Content-Type`**: `image/jpeg` / `image/png` for images; **`application/pdf`** for supporting PDFs (stream original bytes)
- **Rate limits**: preview shares the **same guest counters** as upload (see §13).

## 12A) Admin control (required)

Admins must have full control to delete:

- **media** (document blobs + metadata), including retained media
- **full applications** (cascade delete)

This must be implemented with:

- admin authentication + permission gating (RBAC)
- DB actor context + RLS enforcement
- audit logs for destructive actions

### 12A.1 Permissions (conceptual)

Exact permission strings should align to existing RBAC naming, but the feature requires:

- **applications.delete**: delete applications and their associated rows/blobs
- **documents.delete**: delete documents/blobs (including retained)

### 12A.2 Admin delete behavior (locked)

**Admin delete media**

- Admins can delete an `application_document` in any status (`uploaded_temp` or `retained`).
- The delete MUST remove bytes (`bytea`) from `application_document_blob` and mark the document row `deleted` (or hard-delete row if your DB/audit strategy prefers; pick one consistently).
- Deleting required docs updates readiness (typically becomes `blocked_missing_required_fields`) and blocks checkout initiation.

**Admin delete application**

- Admins can delete an entire application.\n- Deletion must cascade to documents/blobs/extraction rows via FK cascades.\n- If the application was paid, this is an **admin intent**; payment/refund handling is out of scope here but must be handled operationally.

### 12A.3 Audit + safety (locked)

- All admin deletes must write an audit log entry containing:
  - actor id
  - action (`application.delete` / `document.delete`)
  - entity ids (applicationId, documentId)
  - minimal before-state (documentType/status) **without** bytes or OCR output

### 12A.4 RLS / actor context (locked)

- All admin deletes must execute under `withAdminDbActor(adminUserId, ...)` and rely on RLS + permissions.\n- Do not use `db` directly for RLS-protected tables.\n- Do not use `withSystemDbActor` for admin deletes.

## 11) Retention + cleanup (exact)

### 11.1 Temp blob TTL for unpaid drafts (locked; fixes “stranded draft” confusion)

For `paymentStatus = unpaid` uploads:

- Set `tempExpiresAt = application.draftExpiresAt` (same instant)

Rationale:

- If the draft is still valid, the uploaded bytes remain available for OCR/review.
- When the draft expires (unpaid), existing cleanup deletes the application row and cascades delete blobs.

Cleanup job (blob-level safety net) deletes blobs where:

- `retainedAt IS NULL`
- `tempExpiresAt < now()`
- application `paymentStatus = unpaid`

**Note:** with `tempExpiresAt = draftExpiresAt`, blob expiry aligns with draft expiry; §5.5 is mainly for edge cases (manual deletion, partial failures).

### 11.2 Retain on payment (locked; webhook-driven)

Retention must occur in the **payment webhook / idempotent payment handler** that transitions `paymentStatus` to `paid` (per product rules: webhooks are source of truth).

**Precondition (locked):** the handler must verify the application has **latest** `passport_copy` and `personal_photo` documents in `uploaded_temp` (bytes present) **before** committing `paymentStatus = paid`.  
If the precondition fails, the webhook must **not** mark paid (treat as an internal invariant violation / ops alert), because checkout must have been blocked at initiation time (see §1 payment prerequisites).

**Commercial edge case (locked MVP posture):** the provider may still show a charge attempt while the DB refuses `paid`. MVP avoids this class of issues by **freezing required document mutations while checkout is pending** (§1 “Checkout freeze”). If a precondition failure still occurs, treat it as **ops alert + manual reconciliation** (no automated refund playbook in MVP).

Within that transaction:

- set `retainedAt = now()` for all required documents’ blobs for that application
- set `tempExpiresAt = null`
- set `application_document.status = retained`

Refund/chargeback does not auto-delete blobs in MVP (**known compliance debt**; must be addressed before GDPR-style promises).

## 12) Security & privacy (acceptance)

- No document bytes in JSON responses.
- Logs must not include multipart bodies, **base64 snippets**, or OCR raw dumps beyond the strict OCR schema above.
- Guest access: only via HttpOnly `vt_resume` cookie; cookie TTL must not exceed draft TTL.
- RLS + actor context enforced for documents/blobs/extraction rows.

## 13) Rate limits (guest; locked MVP numbers)

Apply to guests only (signed-in users inherit session abuse protections later):

**Bucket semantics (locked):** each limit is enforced as **dual counters** (stricter):

- Upload + preview share one counter: **20/hour per client IP** **and** **20/hour per `applicationId`**
- Extract: **10/hour per client IP** **and** **10/hour per `applicationId`**

A request is rejected if **either** counter exceeds its threshold.

Return `429 RATE_LIMITED` with stable error message (no PII).

## 14) Acceptance criteria (measurable)

### Upload

- Accept **passport_copy**: jpeg, png, or **single-page PDF** up to 8MB; **personal_photo**: jpeg/png only; **supporting**: jpeg, png, or PDF (no OCR).
- Reject multi-page passport PDF with `PDF_NOT_SINGLE_PAGE`.
- Correct error codes and user-visible rejection messaging.
- Upload response includes `tempExpiresAt` and `draftExpiresAt`.
- Replace resets extraction summary fields and extraction status to `not_started` without overwriting manual fields.

### Extraction

- Max 2 attempts per passport sha256.
- Attempt 2 runs only if required OCR fields missing after attempt 1.
- Extraction never overwrites fields marked manual.
- `extraction.status` may be `succeeded` while `validation.readiness` is `blocked_validation` (explicitly tested).
- Latency SLO measurement population: **only** `extraction.status in (succeeded, needs_manual, failed)` and `latencyMs` recorded on final outcome row (exclude stale lease resets).
- If MVP does not implement blur/glare heuristics, **do not emit** `blocked_invalid_doc` anywhere (map to `failed` instead) and exclude `blocked_invalid_doc` from product analytics dashboards until defined.
- Lease fields are cleared on **every** terminal extraction outcome (`passportExtractionLeaseExpiresAt` null).
- Late OCR writes after lease invalidation / run reset are rejected (`409 STALE_EXTRACTION_LEASE`) and do not mutate profile fields.

### Review gating

- Submit blocked until readiness is `ready`.
- Missing fields shown as checklist + inline errors.

### Retention

- Temp blobs deleted when unpaid and past `tempExpiresAt` (aligned to draft expiry).
- On payment webhook transition to `paid`, required blobs become retained in the **same DB transaction** as payment state update.

### Payments

- Checkout/payment initiation is blocked unless `passport_copy` + `personal_photo` uploads exist and are valid per upload rules.
- While checkout is pending/in-flight, required document replace/delete is blocked (see §1 checkout freeze).
