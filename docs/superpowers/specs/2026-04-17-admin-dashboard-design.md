# Admin Dashboard & Applications Management Design

## 1. Overview
This specification defines the redesign and implementation of the Admin portal to support actual operations. It transitions the application verification queue into a fully functional CRUD interface and introduces a new analytics hub. 

**Phase Dependency Note:** This spec assumes Phase 2 (Drafts, guests, documents) is complete. Phase 3 (Paddle) is not yet implemented, so no monetary or revenue metrics will be displayed.

## 2. Navigation & Structure

### Current State
- The admin hub (`/admin/(protected)/page.tsx`) links to: Catalog, Pricing, Settings, Operations, and Automations.
- `Automations` is a fully fleshed out rule editor and will be preserved.

### Target State
- **Migration Plan**: `/admin/operations` will be replaced by `/admin/applications`. `/admin/automations` remains untouched.
- **Hub Updates**: The hub grid will be updated to feature 6 cards:
  - **Catalog** (Globe icon)
  - **Pricing** (Banknote icon)
  - **Settings** (Sliders icon)
  - **Automations** (Sparkles icon)
  - **Applications** (FileText icon): "Application verification queue and manual review workspace."
  - **Analytics** (BarChart icon): "High-level metrics and active user directory."

## 3. Applications Management

### 3.1 List View (`/admin/applications`)
- **Columns**: 
  - Application ID
  - Applicant Name (`fullName` — fallback to "Unnamed Draft" or `guestEmail` if null)
  - Destination & Service (Resolved to `nationality.name` and `visaService.name`, not raw codes)
  - **Status (Split Model)**: Three distinct badges for `applicationStatus`, `paymentStatus`, and `fulfillmentStatus`.
  - Created Date
- **Data Filtering & Pagination**: 
  - Server-side cursor-based pagination with state stored in the URL query string (`?cursor=...&status=...`) for bookmarkability.
  - Default sort: `createdAt DESC`. Sortable by `createdAt` and `applicationStatus`.
  - Search by Application ID, `guestEmail`, or Applicant Name (updates URL `?q=...`).
  - Filter by `applicationStatus` (e.g., `needs_review`).
- **Row-level Actions**: Actions menu for quick navigation to the Detail View. All editing happens in the Detail View.
- **States**: Skeleton rows for loading (`loading.tsx`), empty state if search yields no results, error boundaries for DB failures.

### 3.2 Detail View (`/admin/applications/[id]`)
- **Layout & Responsiveness**: 
  - Desktop (>1024px): 50/50 split view. Left side: Form fields and status controls. Right side: Sticky document viewer.
  - Tablet/Mobile: Stacked view (Documents above, Form below).
- **Read Section**: 
  - Previews `application_document_blob` bytes. Handles expiration (if `tempExpiresAt` passed, show "Blob Expired").
- **Edit Section (Applicant Profile)**: 
  - Editable fields limited to the applicant profile: `fullName`, `dateOfBirth`, `placeOfBirth`, `applicantNationality`, `passportNumber`, `passportExpiryDate`, `profession`, `address`, `phone`.
  - `nationalityCode` and `serviceId` are read-only to preserve checkout integrity.
  - **Checkout Freeze**: If `checkoutState === 'pending'`, fields are disabled with a tooltip explaining checkout is in progress.
  - **Concurrent Editing**: Optimistic concurrency control via `updatedAt` checking in the PATCH request to prevent two admins from overwriting each other.
- **Status Controls & Allowed Edits**:
  - Admins can manually transition `applicationStatus` (see matrix below) and `fulfillmentStatus` (e.g., to `manual_in_progress` or `done` for manual fallback). 
  - `paymentStatus` is **system-only** (webhook-driven) and read-only for admins.
- **Transition Matrix (`applicationStatus`)**:
  | From | Allowed Targets | Guards & Notes |
  |------|-----------------|----------------|
  | `draft` | `needs_docs`, `cancelled` | |
  | `needs_docs` | `extracting`, `cancelled` | |
  | `extracting` | `needs_review` | System-only (after OCR) |
  | `needs_review` | `ready_for_payment`, `cancelled` | |
  | `ready_for_payment` | `in_progress` | `paymentStatus` must be `paid` |
  | `in_progress` | `awaiting_authority`, `cancelled` | |
  | `awaiting_authority` | `completed`, `cancelled` | |
  | `completed` | (Terminal) | Rollbacks not permitted. |
  | `cancelled` | (Terminal) | Rollbacks not permitted. |

- **Transition Matrix (`fulfillmentStatus`)**:
  | From | Allowed Targets | Guards & Notes |
  |------|-----------------|----------------|
  | `not_started` | `manual_in_progress` | Admin manual takeover. |
  | `automation_running` | `manual_in_progress` | Fallback after automation failure. |
  | `manual_in_progress` | `ready_for_ops_payment`, `submitted` | |
  | `ready_for_ops_payment` | `submitted` | |
  | `submitted` | `done` | |
  | `done` | (Terminal) | |

- **Delete Action**: Provides a UI confirmation modal. Dispatches to existing `DELETE /api/admin/applications/[id]`.

### 3.3 API Layer
- All new routes must specify `export const runtime = "nodejs"`.
- **Endpoints**:
  - `GET /api/admin/applications`: Lists applications.
  - `PATCH /api/admin/applications/[id]/profile`: Updates profile fields.
    - **Validation**: Requires valid dates and trims strings.
    - **Audit**: Writes `audit_log` row for profile edits and updates `applicantProfileProvenanceJson` with `{ source: 'manual' }`.
  - `POST /api/admin/applications/[id]/transition`: Explicitly handles status advancements (RPC style).
    - **Request body**: `{ "field": "applicationStatus" | "fulfillmentStatus", "to": "<target_value>" }`.
    - **Server validates** the transition against the matrix and guards before applying.
    - **Audit**: Writes `audit_log` noting field, from-value, and to-value.
- **Security**: Uses `withAdminDbActor` and `runAdminDbJson`. Requires `["applications.read"]` for GET. Requires `["applications.write", "audit.write"]` for mutations.

## 4. Analytics & User Directory

### 4.1 Metrics
- **Time Windowing**: Default to "Last 30 Days" with a date picker to adjust.
- **Available Metrics**: 
  - Application counts grouped by `applicationStatus`.
  - Checkouts created (based on `priceQuote.lockedAt`).
  - OCR extraction success rates.
  - *No revenue/monetary metrics* will be shown until Phase 3 (Paddle) introduces the `payment` table.

### 4.2 User Directory
- A table listing platform users with server-side cursor pagination.
- **Resolution Strategy**: Since guests have no `userId`, the directory unions registered users (`user.id`) and guests (grouped by `guestEmail`). Pagination operates over this unified CTE/view.

### 4.3 User Drill-down
- Route: `/admin/analytics/users/[id]` (for registered) and `/admin/analytics/guests/[encoded_email]` (for guests).
- **Encoding**: Guest emails use base64url encoding (RFC 4648 §5, no padding).
- Displays contact info and a history of applications.

## 5. Technical Specification
- **RLS & Actor Context**: All DB calls wrapped in `withAdminDbActor`. 
- **Data Fetching**: List/Detail views use Server Components + Suspense boundaries.
- **State Updates**: Updates via API routes (`/api/admin/...`) rather than Server Actions to maintain uniform error envelopes (`jsonOk`/`jsonError`) and cleanly integrate with `runAdminDbJson`.

## 6. Design System Alignment
- Follows tokens in `DESIGN.md`.
- **Typography**: Red Hat Display (`--font-display`), Red Hat Text (`--font-body`).
- **Badges**:
  - Success (`--color-success` / `#3E8635`): `completed`, `paid`, `done`.
  - Warning/Accent: `needs_review`, `in_progress`, `awaiting_authority`.
  - Muted (`--color-muted`): `draft`, `unpaid`, `cancelled`, `not_started`, and all unmapped statuses.
- **Layout**: Sharp corners (`--radius` = 0px). High contrast. Button CTAs left-aligned.
