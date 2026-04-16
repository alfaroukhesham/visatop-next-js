# Passport OCR + Neon document storage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved spec in [`docs/superpowers/specs/2026-04-15-passport-ocr-documents-retention-design.md`](../specs/2026-04-15-passport-ocr-documents-retention-design.md): multipart uploads into Postgres `bytea`, single-page passport PDF → normalized JPEG, Gemini sync extraction (2 attempts), validation/readiness, preview/download, guest rate limits, webhook retention on `paid`, lease+`runId` concurrency, and admin delete with audit.

**Architecture:** Extend `application` with applicant profile + extraction summary columns; replace metadata-only `storage_key` documents with `application_document` + `application_document_blob` (1:1); add `application_document_extraction` per attempt. Client routes use existing session / `vt_resume` + `withClientDbActor` / `withSystemDbActor`; admin routes use `runAdminDbJson` + `withAdminDbActor`. OCR and image/PDF normalization live in server-only libs (`lib/ocr/`, `lib/documents/`). JSON APIs use `jsonOk`/`jsonError` + `runtime = "nodejs"`.

**Tech Stack:** Next.js App Router route handlers, Drizzle + Neon serverless `Pool`, Postgres RLS (extend policies for new tables), Vitest, Zod, Gemini API (`@google/generative-ai` or REST), `sharp` for raster normalization, PDF page count + render (e.g. `pdfjs-dist` + `@napi-rs/canvas` or `canvas` — pick one and lock in Task 0).

**Product / rules sources:** spec above; [`docs/IMPLEMENTATION_REFERENCE.md`](../IMPLEMENTATION_REFERENCE.md); workspace rules `visa-api-response-envelope.mdc`, `visa-db-actor-context-usage.mdc`, `visa-rbac-and-rls.mdc`, `visa-drafts-and-guest-storage.mdc`, `visa-payments-paddle.mdc` (webhook retention).

**Default execution mode:** Use **subagent-driven** development unless the team explicitly requests a single long session with **executing-plans**.

---

## File map (create / modify)

| Area | Create | Modify |
|------|--------|--------|
| Schema | `lib/db/schema/application-document-blob.ts`, `application-document-extraction.ts` (or single file) | `lib/db/schema/application-document.ts`, `lib/db/schema/applications.ts`, `lib/db/schema/index.ts` |
| Migrations | **One** `drizzle/0007_<slug>.sql` for Tasks 1–2 (see Task 0 migration rule) | `drizzle/meta/_journal.json` |
| Domain | `lib/documents/normalize-image.ts`, `lib/documents/normalize-passport-upload.ts`, `lib/documents/validation-readiness.ts`, `lib/ocr/gemini-passport.ts`, `lib/ocr/schema.ts` | — |
| API | `app/api/applications/[id]/documents/upload/route.ts`, `.../preview/route.ts`, `.../download/route.ts` | `app/api/applications/[id]/documents/route.ts`, `app/api/applications/[id]/route.ts` (list fields), `app/api/applications/[id]/extract/route.ts`, `app/api/internal/cleanup-drafts/route.ts` |
| Admin API | `app/api/admin/applications/[id]/route.ts` (DELETE), `app/api/admin/applications/[id]/documents/[documentId]/route.ts` (DELETE) | — |
| Rate limit | `lib/applications/document-rate-limit.ts` | upload/preview/extract routes (after Task 6 exists) |
| Env | — | `.env.example` (`GEMINI_API_KEY`, optional model id) |
| Docs | — | `docs/IMPLEMENTATION_REFERENCE.md` §11 Phase 2 row when feature ships |
| UI | `components/apply/…` (wizard steps) | `app/apply/...` pages as needed |

---

### Task 0: Read spec + lock dependency choices

**Files:** (none)

- [ ] **Step 1:** Re-read the spec §5.6–5.7, §10, §11, §12A, §13 end-to-end.
- [ ] **Step 2:** Lock PDF stack: e.g. `pdfjs-dist` for page count + first-page render to bitmap, then `sharp` to JPEG. **Lock max raster dimensions** for PDF page render to align with §5.6 (e.g. cap so long edge ≤ 4096 before JPEG encode).
- [ ] **Step 3:** **Sharp + serverless:** confirm deployment target (Vercel/Node) supports `sharp` native binaries; add `next.config` / `serverExternalPackages` notes if required. Document fallback if bundle fails (narrower max dimension only — avoid WASM rabbit hole in MVP).
- [ ] **Step 4:** Lock Gemini SDK + env var names; add to `.env.example`. **CI:** `pnpm run test:ci` must **never** require a real API key — mocks only (Task 5).
- [ ] **Step 5:** **Migration naming rule (locked):** Use **one** Drizzle migration file for schema Tasks 1–2: next journal entry, e.g. `drizzle/0007_passport_ocr_documents.sql` (adjust slug/number after reading `drizzle/meta/_journal.json`). Do **not** split 0007/0008 unless a deliberate rollback boundary is needed.

---

### Task 1: Database migration — `application` profile + extraction summary

**Files:**
- Modify: `lib/db/schema/applications.ts`
- Create: same `drizzle/0007_<slug>.sql` as Task 2 (single file)

**Columns to add (names camelCase in Drizzle, snake_case in SQL per project convention):**

- Profile: `fullName`, `dateOfBirth`, `placeOfBirth`, `nationality`, `passportNumber`, `passportExpiryDate`, `profession`, `address` (types: `text` + `date` where appropriate)
- Contact: `phone`, `email` (if not already present — verify schema)
- **Provenance (must decide here, before Task 8):** one JSON column e.g. `applicantProfileProvenanceJson` mapping field → `{ source: 'ocr' | 'manual' }` **or** explicit `*Source` columns — **no deferral past Task 8**
- Extraction: `passportExtractionStatus`, `passportExtractionUpdatedAt`, `passportExtractionStartedAt`, `passportExtractionLeaseExpiresAt`, `passportExtractionRunId`, `passportExtractionDocumentId`, `passportExtractionSha256`
- Checkout freeze: `checkoutState` nullable text `none | pending` (or boolean `checkoutPending`)

- [ ] **Step 1:** Add Drizzle columns + SQL in **0007** migration.
- [ ] **Step 2:** `pnpm exec drizzle-kit check` or project migrate script; fix drift.
- [ ] **Step 3:** Commit: `feat(db): application profile and passport extraction summary columns`

---

### Task 2: Database migration — document model + blobs + extraction attempts

**Files:**
- Modify: `lib/db/schema/application-document.ts`
- Create: `lib/db/schema/application-document-blob.ts`, `lib/db/schema/application-document-extraction.ts`
- **Same** `drizzle/0007_<slug>.sql` as Task 1

**`application_document` changes:**

- Add: `documentType`, `status`, `contentType`, `byteLength`, `originalFilename`, `sha256`
- **Phase 2:** make `storage_key` nullable; new uploads omit it; old stub rows remain until deleted.

**`application_document_blob` / `application_document_extraction`:** per spec §9.2–9.3

**Indexes:** UNIQUE `(application_id, document_type, sha256)` where `document_type` maps to column `documentType`

- [ ] **Step 1:** Implement schema + SQL + RLS for new tables (mirror existing `application_document` policy split: system / admin / client).
- [ ] **Step 2:** **RLS matrix:** extend `tests/integration/rls-*.test.ts` or add `tests/integration/rls-application-documents.test.ts` (skipped unless `RUN_DB_TESTS=1`) covering at least: system insert for guest path, client own-row, admin with permission.
- [ ] **Step 3:** Commit: `feat(db): document blobs and extraction attempt rows` (same commit as Task 1 if preferred: one migration, one commit)

---

### Task 3: Pure libs — image + PDF normalization

**Files:**
- Create: `lib/documents/normalize-image.ts` — §5.6
- Create: `lib/documents/passport-pdf.ts` — single-page check + page 1 raster; **max dimensions** locked in Task 0
- Create: `lib/documents/normalize-passport-upload.ts`
- Create: `lib/documents/normalize-supporting-upload.ts`

- [ ] **Step 1:** Vitest + tiny fixtures in `tests/fixtures/`
- [ ] **Step 2:** `PDF_NOT_SINGLE_PAGE` path
- [ ] **Step 3:** Commit: `feat(documents): server-side image and passport PDF normalization`

---

### Task 4: Validation + readiness calculator

**Files:**
- Create: `lib/documents/validation-readiness.ts`, `lib/documents/validation-readiness.test.ts`

- [ ] **Step 1:** Unit tests: 180-day UTC, DOB, readiness precedence
- [ ] **Step 2:** Commit: `feat(documents): applicant validation and readiness`

---

### Task 5: Gemini OCR adapter (sync, 2 attempts)

**Files:**
- Create: `lib/ocr/schema.ts`, `lib/gemini/client.ts`, `lib/ocr/gemini-passport.ts`

- [ ] **Step 1:** Vitest with **mocked** SDK/fetch — **no `GEMINI_API_KEY` in CI** (`test:ci` must pass with env unset).
- [ ] **Step 2:** Commit: `feat(ocr): gemini passport extraction adapter`

---

### Task 6: Guest rate limiting helper (**before** upload route)

**Files:**
- Create: `lib/applications/document-rate-limit.ts`

**Semantics (locked for MVP honesty):**

- Implementation uses **in-memory** counters per Node process (sliding window or token bucket).
- On **serverless** (multiple instances, cold starts), limits are **best-effort per instance**, not globally exact for IP/applicationId. Product numbers in spec §13 are **targets**; enforcement may under- or over-count vs a single global store.
- **Document in code comment** at top of `document-rate-limit.ts`: MVP acceptable; **stretch:** Redis/Upstash/KV for strict dual counters.

- [ ] **Step 1:** Unit tests for counter behavior (same process)
- [ ] **Step 2:** Commit: `feat(api): guest document rate limit primitives`

---

### Task 7: `POST .../documents/upload` (multipart) + replace semantics + document list for gating

**Files:**
- Create: `app/api/applications/[id]/documents/upload/route.ts`
- Modify: `app/api/applications/[id]/documents/route.ts` — **`GET`** list documents for this application (metadata only: `id`, `documentType`, `status`, `sha256`, `contentType`, `tempExpiresAt` per spec) **or** extend **`GET /api/applications/[id]`** response to include `documents: [...]` so the wizard can know “passport + photo present” without local-only state. **Pick one** and document in handler comment.
- Deprecate JSON-only `POST` body upload if superseded.

**Behavior:**

- Parse multipart: `documentType`, `file`
- Auth: session or resume cookie (same as today)
- Enforce 8MB, MIME allowlist §10.1
- `tempExpiresAt = draftExpiresAt` when unpaid
- **Replace / same `documentType` (spec §5.2):** in **one transaction**: find prior latest non-deleted row for that type → hard-delete blob + mark document `deleted` (or delete row) → insert new `application_document` + blob → reset `passportExtraction*` + `passportExtractionRunId = 0` when replacing `passport_copy`
- **Wire Task 6:** call rate limit helper for upload (+ preview later); return `429` per spec
- **Checkout freeze:** if `checkoutState === 'pending'`, reject replace/delete of `passport_copy` / `personal_photo` with clear error code

- [ ] **Step 1:** Route tests (mock actor/DB pattern from `app/api/applications/route.test.ts`)
- [ ] **Step 2:** Commit: `feat(api): multipart upload, replace, and document listing`

---

### Task 8: `POST .../extract` — full sync pipeline

**Files:**
- Modify: `app/api/applications/[id]/extract/route.ts`

**Behavior:**

- Load latest `passport_copy` + blob; OCR input is normalized JPEG (PDF already normalized at upload)
- Lease: atomic conditional update + `runId` increment (§10.2.1)
- Up to 2 OCR attempts; persist extraction rows
- Merge OCR respecting provenance (§6.4) — **requires Task 1 decision**
- Validation + `ocrMissingFields` / `submissionMissingFields` / `validation` payload
- Clear lease on terminal outcome; `409 STALE_EXTRACTION_LEASE` when appropriate

**Automated tests (high value):**

- [ ] **Concurrency:** second concurrent `POST /extract` gets `409 EXTRACTION_ALREADY_RUNNING`; stale lease → terminal `failed` → retry succeeds (mocked clock or short lease in test).
- [ ] **Provenance:** field marked manual is **not** overwritten when OCR runs again (unit or route test).

- [ ] **Step 1:** Implement + tests above
- [ ] **Step 2:** Wire **Task 6** rate limit on extract
- [ ] **Step 3:** Commit: `feat(api): sync passport extract with lease and gemini`

---

### Task 9: `GET .../preview` and `GET .../download`

**Files:**
- Create: `app/api/applications/[id]/documents/[documentId]/preview/route.ts`
- Create: `app/api/applications/[id]/documents/[documentId]/download/route.ts`

- [ ] **Step 1:** Wire **Task 6** rate limit on preview (shares upload counters per spec)
- [ ] **Step 2:** Tests 403/404
- [ ] **Step 3:** Commit: `feat(api): document preview and download streaming`

---

### Task 10: Internal blob cleanup + checkout freeze + payment webhook retention

**Files:**
- Modify: `app/api/internal/cleanup-drafts/route.ts` (or add `app/api/internal/cleanup-document-blobs/route.ts` if separation is cleaner)
- Modify: future Paddle webhook handler (when Phase 3 lands)

**Blob cleanup (spec §11.1 safety net):**

- If draft delete **cascades** application → documents → blobs, confirm FK `ON DELETE CASCADE` from `application_document` → blob removes bytes when application row is deleted by existing draft cleanup.
- **Additionally:** implement or extend a job so orphaned **temp** blobs with `tempExpiresAt < now`, `retainedAt IS NULL`, `paymentStatus = unpaid` are deleted (covers partial failures without full application delete). Document which path is redundant after verifying cascades.

**Webhook retention:**

- Within transaction that sets `paymentStatus = paid`: set `retainedAt`, clear `tempExpiresAt`, `status = retained` for required docs.
- **Invariant (spec):** if required docs missing, **do not** commit `paid`; **log structured alert** + ops path (no silent partial paid). Matches spec “precondition fails → not paid”.

- [ ] **Step 1:** Implement retention helper + call site (webhook or stub + doc)
- [ ] **Step 2:** Extend cleanup for temp blobs if needed
- [ ] **Step 3:** Commit: `feat(api): document retention on payment and temp blob cleanup`

---

### Task 11: Admin delete — application + document

**Files:**
- Create: `app/api/admin/applications/[id]/route.ts` — `DELETE`
- Create: `app/api/admin/applications/[id]/documents/[documentId]/route.ts` — `DELETE`
- Use: `lib/admin-api/write-admin-audit.ts`, `runAdminDbJson`, permissions seeded

- [ ] **Step 1:** Tests with mocked admin actor
- [ ] **Step 2:** Commit: `feat(admin): delete applications and documents with audit`

---

### Task 12: Apply UI — upload → extract → review

**Files:**
- Modify: `components/apply/`, `app/apply/`

- [ ] **Step 1:** Use **Task 7** list/GET so gating does not rely on client-only memory for “both uploads exist”
- [ ] **Step 2:** Manual smoke
- [ ] **Step 3:** Commit: `feat(apply): passport upload extract and review flow`

---

### Task 13: CI + docs touch-up

- [ ] **Step 1:** `pnpm run lint`, `pnpm run test:ci`, `pnpm run build`
- [ ] **Step 2:** Update `docs/IMPLEMENTATION_REFERENCE.md` §11
- [ ] **Step 3:** Final commit: `docs: phase-2 passport ocr and documents`

---

## Self-review (plan vs spec)

| Spec section | Task coverage |
|--------------|---------------|
| §1 Decisions (sync, 2 attempts, retention on paid, checkout freeze) | Tasks 1, 8, 10 |
| §5.2 Replace hard delete | Task 7 |
| §5.6–5.7 Image + PDF | Tasks 0, 3, 7 |
| §6–7 Extraction + validation | Tasks 4, 8 |
| §9–10 API + list/gating | Tasks 7–9 |
| §11 TTL + cleanup + webhook | Task 10 |
| §12A Admin delete | Task 11 |
| §13 Rate limits (honest serverless) | Tasks 6, 7–9 |
| Apply UI | Task 12 |

**Gaps closed vs prior plan draft:** Rate limit **before** upload; serverless caveat; cleanup job touchpoint; replace explicit; GET list; webhook invariant logging; RLS test subtask; provenance decided Task 1; concurrency + provenance tests Task 8; single migration file rule Task 0.

---

## Execution handoff

**Plan complete and saved to** `docs/superpowers/plans/2026-04-16-passport-ocr-documents-implementation.md`.

**Execution options:**

1. **Subagent-Driven (default)** — Fresh subagent per task; **REQUIRED SUB-SKILL:** `superpowers:subagent-driven-development`.
2. **Inline** — Single session, **REQUIRED SUB-SKILL:** `superpowers:executing-plans`.

Use **(1)** unless the team asks for a single long implementation session.
