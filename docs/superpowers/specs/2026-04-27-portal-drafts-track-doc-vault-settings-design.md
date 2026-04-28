# Portal IA + Drafts/Track pagination + My Documents vault (reuse) + Settings (password change)

Date: 2026-04-27  
Owner: Client portal (signed-in)  
Scope: Client-only portal UX + server APIs + DB schema changes needed to support reusable user documents.

## Goals

- Provide a clear, consistent `/portal` experience with the correct entry points:
  - New application
  - Draft applications (paginated)
  - Track application (signed-in = paginated list)
  - My documents (vault + immediate reuse)
- Reduce repeated uploads by introducing a reusable **user document vault** that can be attached into applications.
- Add a user **Settings** page for personal details and in-page password change.

## Non-goals (for this spec)

- Guest “track by email/phone” hardening (OTP) — explicitly deferred.
- Deduplicated/shared blob storage between vault and applications — reuse is implemented via **copy into application documents** (see §6.2).
- Admin portal behavior changes.

## UX / Information Architecture

### Routes

- `/portal` (signed-in only): landing tiles
- `/portal/drafts`: signed-in drafts list (cursor pagination)
- `/portal/documents`: user document vault (upload + list + preview + attach-to-app flow entry)
- `/portal/settings`: personal details + password change
- `/apply/track`: dual mode
  - signed-in: paginated list of the user’s applications (cursor)
  - guest: existing lookup form remains

### Portal tiles (`/portal`)

Tiles shown (signed-in):

1. **New application** → `/apply/start`
2. **Draft applications** → `/portal/drafts`
3. **Track application** → `/apply/track`
4. **My documents** → `/portal/documents`

Rename:
- “Dashboard” tile becomes **Draft applications**
- “All applications” tile becomes **Track application**

### Header account button

- “Account” button should route to **`/portal/settings`** (not the old dashboard page).

## Draft applications (signed-in) — cursor pagination

### Definition

Draft applications for a signed-in user are:

- `application.userId = session.user.id`
- `paymentStatus` indicates **not paid** (implementation should rely on the project’s status helpers / canonical states)
- `draftExpiresAt IS NULL OR draftExpiresAt > now()`

Notes:
- Only show drafts that can be resumed, meaning **non-expired** drafts only (i.e., hide expired drafts).

### Pagination

- Cursor pagination (server-side), ordered by `(createdAt desc, id desc)`.
- Query parameters:
  - `limit` (default 5, max 50)
  - `cursor` (opaque string encoding last `(createdAt, id)` pair)

### UI

List row includes:
- Reference (reference number if present, else id short)
- Created date/time
- Service / nationality summary if available
- Neutral status label (avoid internal automation wording)
- Primary action: **Continue** → existing draft continuation route (current application workspace / draft panel entrypoint)

## Track application (`/apply/track`) — signed-in mode

### Signed-in behavior (Option A)

If signed in:
- show paginated list of **all applications owned by the user** (cursor pagination).
- newest first.

Row:
- Reference
- Created date/time
- Headline status label (use existing user-facing tracking logic)
- Action:
  - If draft/unpaid: “Continue”
  - Else: “Open” (routes to the appropriate application workspace page)

### Guest behavior (deferred hardening)

If not signed in:
- keep the current lookup form, but results must be **cursor paginated** using the same query shape as signed-in lists.
- OTP-based safeguards are out-of-scope for this spec.

## My documents (vault) + immediate reuse into applications

### User intent

Signed-in users can maintain a personal document vault so that when they start a new application they can attach existing documents instead of re-uploading.

Documents include:
- Passport bio page (vault)
- Personal photo (vault)
- Supporting documents (e.g. air ticket, hotel reservation, additional passport page, other supporting files)

Clarification:
- “Passport cover/additional page” is **optional** and treated as **supporting**.

### Document types

Vault-level `user_document.documentType`:
- `passport_copy`
- `personal_photo`
- `supporting`

Application-level types remain as-is (`application_document.documentType` already supports `passport_copy | personal_photo | supporting | ...`).

### Reuse mechanism (copy model)

When a user selects a vault doc to use in an application:
- The server validates eligibility against the application context (e.g., passport expiry rules, size/content type constraints).
- If valid:
  - create a new `application_document` record for that application with the chosen `documentType`
  - copy bytes into `application_document_blob`
  - record provenance link from the new application document to the source vault document
- If invalid:
  - return a neutral error message (no internal details)
  - user may upload a new version (either into vault or directly to application)

Rationale:
- Copy keeps application document lifecycle (temp retention, locks during checkout, extraction workflows) unchanged and reduces coupling risk.

### Vault UI (`/portal/documents`)

Sections:
- Passport (bio page)
- Personal photo
- Supporting documents
  - Air ticket
  - Hotel reservation
  - Additional passport page (optional)
  - Other supporting documents

Each section supports:
- Upload (max size consistent with existing application upload constraints)
- List items (filename, uploaded date, optional expiry, preview)
- Optional delete in v1 (either soft-delete or “upload new version” preferred)

### Application ↔ vault is bidirectional (guest-linking ingestion)

When a user creates an application as a **guest**, then later creates an account and **links** that application to their user:

- Any uploaded application documents that are eligible for reuse (passport copy, personal photo, supporting) must also be saved into the user vault.
- This ingestion should be idempotent (avoid duplicates) using `sha256` + `documentType` + `userId`.
- Provenance should be recorded so we can explain “Imported from application” in the vault UI (optional in v1).

### Reuse UX entrypoints

In application draft upload UI (and/or portal documents page):
- Add a “Choose from My documents” action next to each upload slot (passport/photo/supporting).
- Selecting opens a list filtered by required type.
- Confirm “Use this document” attaches to the application (server copy).

## Settings (`/portal/settings`) — personal details + password change

### Personal details

Display:
- Name
- Email (read-only)

Optional editable fields (v1):
- Name (if supported by Better Auth user profile update)

### Password change (in-page)

Requirement:
- Allow change password in-page using **current password + new password**.

Implementation:
- Use Better Auth server APIs for password update.
- Must handle:
  - wrong current password (friendly error)
  - new password policy validation (min length etc.)
  - success confirmation

Email provider integration:
- Not required for the in-page flow itself, but if Better Auth requires email-based flows for this operation in current configuration, provide a fallback plan (still within this feature) that sends a reset email and guides the user through completion.

## API + DB requirements

### New tables

- `user_document`
- `user_document_blob`
- `application_document_source` (provenance for vault → application copy)

All must be protected by RLS and accessed via the existing actor-context wrappers:
- client: `withClientDbActor(userId, (tx) => ...)`

### New/updated routes (high level)

- Draft list endpoint (signed-in):
  - `GET /api/portal/drafts?limit=&cursor=`
- Signed-in track list endpoint:
  - `GET /api/portal/applications?limit=&cursor=`
- Vault endpoints:
  - `POST /api/portal/documents/upload` (multipart)
  - `GET /api/portal/documents?limit=&cursor=&type=`
  - `GET /api/portal/documents/:id/preview`
  - `POST /api/applications/:id/documents/attach-from-vault` (body: `userDocumentId`, `documentType`)
- Settings endpoints:
  - `GET /api/portal/me`
  - `POST /api/portal/change-password`

All JSON endpoints must use the project envelope:
- `jsonOk(...)` / `jsonError(...)`
- pass through `x-request-id`

All `app/api/**/route.ts` must include:
- `export const runtime = "nodejs";`

## Performance / pagination

- Use server-side cursor pagination for both:
  - drafts list
  - signed-in track list
- Prefer returning only needed fields for list rows (no blobs).

## Risks & mitigations

- **Coupling vault + application flows**: mitigated by “copy model” and provenance link.
- **Hydration/UI inconsistency**: keep portal header consistent; avoid session-dependent SSR mismatches.
- **RLS leakage**: enforce access only via actor-context wrappers and ensure policies restrict to owner userId.

## Acceptance criteria

- `/portal` shows the 4 tiles with correct labels and destinations.
- `/portal/drafts` lists only signed-in drafts with cursor pagination.
- `/apply/track` for signed-in users shows paginated list of their applications; guests still see lookup form.
- `/portal/documents` allows uploading and previewing vault documents.
- Users can attach a vault document into an application without re-uploading (creates an application document row + blob).
- `/portal/settings` shows personal details and allows changing password in-page.

