# Phase 3 — Paddle Payments + Admin Dashboard

**Supersedes:** `2026-04-17-admin-dashboard-design.md` (admin sections folded into this combined spec).

**Phase dependency:** Phase 2 (drafts, guests, documents, passport OCR) is complete.

---

## 1. Scope

Combined release covering two implementation tracks, delivered in order:

- **Part A — Paddle payments:** `PaymentProvider` abstraction, Paddle adapter, client-facing checkout (overlay), webhook processing, quote locking, document retention on `paid`, admin refund intent.
- **Part B — Admin dashboard:** Replace `/admin/operations` with `/admin/applications` (CRUD + status transitions), add `/admin/analytics` (metrics hub), payment visibility.

Both tracks share a prerequisite: upgrading the application status model from the simplified Phase 2 values to the full IMPLEMENTATION_REFERENCE §4 enums.

---

## 2. Status Model Upgrade

### 2.1 New enums (`lib/applications/status.ts`)

**`applicationStatus`:**
`draft` · `needs_docs` · `extracting` · `needs_review` · `ready_for_payment` · `in_progress` · `awaiting_authority` · `completed` · `cancelled`

**`paymentStatus`:**
`unpaid` · `checkout_created` · `paid` · `refund_pending` · `refunded` · `failed`

**`fulfillmentStatus`:**
`not_started` · `automation_running` · `manual_in_progress` · `ready_for_ops_payment` · `submitted` · `done`

**`checkoutState`:** `none` · `pending` (unchanged).

### 2.2 Data migration

DB columns remain `text` (no Postgres enum). Migration `0008` updates existing rows:

| Column | Old value | New value |
|--------|-----------|-----------|
| `applicationStatus` | `submitted` | `needs_review` |
| `applicationStatus` | `in_review` | `needs_review` |
| `applicationStatus` | `approved` | `completed` |
| `applicationStatus` | `rejected` | `cancelled` |
| `paymentStatus` | `pending` | `checkout_created` |
| `fulfillmentStatus` | `in_progress` | `manual_in_progress` |
| `fulfillmentStatus` | `failed` | `not_started` |

### 2.3 Application lifecycle (user-driven checkout)

System-driven auto-transitions through the application flow:

```
draft ──→ needs_docs           (on creation / when user opens draft)
needs_docs ──→ extracting      (when user triggers OCR)
extracting ──→ needs_review    (when OCR completes)
needs_review ──→ ready_for_payment  (when readiness = "ready")
ready_for_payment ──→ in_progress   (webhook confirms payment)
```

Admin-driven transitions:

```
in_progress ──→ awaiting_authority
awaiting_authority ──→ completed
any non-terminal ──→ cancelled
```

The user **does not wait for admin review** before paying. The system auto-advances to `ready_for_payment` once readiness passes. Admins can intervene post-payment if issues are found.

---

## 3. Part A — Paddle Payments

### 3.1 Provider abstraction

```
lib/payments/
  types.ts              — PaymentProvider interface + shared types
  paddle-adapter.ts     — Paddle SDK implementation
  checkout.ts           — createCheckout() orchestrator
  webhook-handler.ts    — processWebhookEvent() (idempotent)
```

**`PaymentProvider` interface:**

```typescript
interface PaymentProvider {
  createCheckout(params: CreateCheckoutParams): Promise<ProviderCheckoutResult>;
  verifyWebhookSignature(body: string, signature: string): boolean;
  parseWebhookEvent(body: string): ParsedWebhookEvent;
  initiateRefund(transactionId: string, amount?: number): Promise<RefundResult>;
}
```

**`CreateCheckoutParams`:**

```typescript
type CreateCheckoutParams = {
  applicationId: string;
  priceQuoteId: string;
  totalAmount: number;       // minor units (adapter must convert to string decimal for Paddle API e.g. "150.00")
  currency: string;
  serviceLabel: string;      // e.g. "Egypt — 30-day single entry"
  customerEmail?: string;    // guest email or user email
  metadata: Record<string, string>;  // applicationId, serviceId, userId, isGuest
};
```

### 3.2 Checkout creation flow

**Endpoint:** `POST /api/checkout`

**Access:** Session (`withClientDbActor`) or resume cookie (`withSystemDbActor` after cookie validation). Same access resolver pattern as document APIs.

**Steps (single transaction):**

1. Load application — verify `applicationStatus = ready_for_payment`, `paymentStatus = unpaid`
2. **Race Condition Guard:** Use an atomic update to lock the checkout state *before* proceeding:
   ```sql
   UPDATE application 
   SET checkout_state = 'pending' 
   WHERE id = ? AND checkout_state = 'none' 
   RETURNING *
   ```
   If 0 rows returned → `409 CHECKOUT_EXISTS` (prevent double-billing).
3. Compute display price via `resolveClientDisplayPrice(tx, serviceId)`
4. If price is null (no reference/margin configured) → `400 PRICING_UNAVAILABLE`
5. Create `price_quote` row — `lockedAt = now()`, full breakdown JSON
6. Create `payment` row — `provider = paddle`, `status = checkout_created`, amount from quote
7. Update application — `paymentStatus = checkout_created`, `checkoutState = 'pending'` (already set by atomic guard, ensure transaction commits)
8. Call `paddleAdapter.createCheckout()` — pass metadata with `applicationId`, `priceQuoteId`, `serviceId`, `userId`
9. Store `providerCheckoutId` on `payment` row
10. Return `{ transactionId, clientToken }` to frontend

**Error states:**
- Application not in `ready_for_payment` → `400 INVALID_STATUS`
- Already has a checkout → `409 CHECKOUT_EXISTS` (return existing transaction for retry)
- Pricing not configured → `400 PRICING_UNAVAILABLE`

### 3.3 Price display endpoint

**Endpoint:** `GET /api/applications/[id]/price`

**Access:** Same as application access (session or cookie).

Returns the current display price for the application's service without locking a quote. Used by the Apply UI to show price before the user clicks "Pay & Submit".

```json
{
  "ok": true,
  "data": {
    "displayAmount": 15000,
    "currency": "USD",
    "formatted": "$150.00"
  }
}
```

Returns `null` if pricing is not configured for the service (no reference cost or margin).

### 3.4 Webhook receiver

**Endpoint:** `POST /api/webhooks/paddle`

**Security:** Signature verification using `PADDLE_WEBHOOK_SECRET`. No session required — runs under `withSystemDbActor` only after signature passes (§6.4 trust boundary).

**Idempotency:** SHA-256 hash of raw payload body → check `payment_event.payloadHash` → skip if duplicate.

**Event handling (inside `withSystemDbActor` transaction):**

| Paddle event | Action |
|---|---|
| `transaction.completed` | `payment.status = paid`, `application.paymentStatus = paid`, `application.applicationStatus = in_progress`, `application.checkoutState = none`, call `retainRequiredDocuments()` |
| `transaction.payment_failed` | `payment.status = failed`, `application.paymentStatus = failed`, `application.checkoutState = none` (user can create new checkout) |
| `transaction.updated` | Update `payment.providerTransactionId` if changed |
| `refund.completed` | `payment.status = refunded`, `application.paymentStatus = refunded` |

**On `transaction.completed`:** 
**CRITICAL:** If the Paddle webhook says they paid, **they are paid**. Transition the status to `paid` unconditionally. 

**Resurrection Guard:** Check `applicationStatus`. If it is `cancelled` or `completed`, **DO NOT** update it to `in_progress`. Instead, set `adminAttentionRequired = true` (user paid for a terminal application). 

**Amount Validation:** Compare the paid amount in the webhook to `payment.amount`. If the paid amount is less (e.g. from a Paddle coupon), set `adminAttentionRequired = true`.

Then, call `retainRequiredDocuments()`. If document retention fails (e.g., missing blob, database lock), **DO NOT ABORT** the payment transition. 
Instead:
1. Log a `CRITICAL` error.
2. Set `application.adminAttentionRequired = true` (New DB column).
3. The payment remains `paid`, but the application is flagged for immediate admin intervention to locate the missing blobs or contact the customer.

**On `transaction.payment_failed`:** Reset `checkoutState` so the user can attempt a new checkout. Do not delete the failed payment/quote rows (audit trail).

### 3.5 Client-side UI — Apply panel payment section

**Dependencies:** `@paddle/paddle-js` (client), `@paddle/paddle-node-sdk` (server).

**Environment variables:**

```env
PADDLE_API_KEY=...                     # server-side (exists)
PADDLE_WEBHOOK_SECRET=...              # webhook signature verification
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=...    # client-side checkout overlay
NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox # sandbox | production
```

**UI behavior** (added to `application-draft-panel.tsx` as the final section):

| Application state | What the user sees |
|---|---|
| `readiness ≠ ready` | Actionable checklist of blockers (see §3.6) |
| `readiness = ready`, `paymentStatus = unpaid` | Price summary + "Pay & Submit" button |
| `paymentStatus = checkout_created` | "Complete your payment" + resume button + "Cancel payment" button + **10-minute countdown timer** |
| `paymentStatus = paid` | ✓ Payment confirmed — transaction ID, amount, date |
| `paymentStatus = failed` | "Payment failed — try again" + new checkout button |
| `paymentStatus = refunded` | "Payment refunded" badge |

**"Pay & Submit" flow:**

1. User clicks "Pay & Submit"
2. Frontend calls `POST /api/checkout`
3. Response includes `transactionId`
4. Frontend calls `Paddle.Checkout.open({ transactionId })` — overlay opens. The UI displays a 10-minute countdown timer.
5. User completes payment in overlay
6. Overlay fires `checkout.completed` event → frontend polls `GET /api/applications/[id]` for status update
7. Webhook fires server-side → status transitions happen
8. Frontend detects `paymentStatus = paid` → shows confirmation

**Checkout Cancellation & TTL:**
- **Client Cancellation:** User clicks "Cancel Payment". Frontend calls `POST /api/checkout/cancel`, which resets `checkoutState = none` and `paymentStatus = unpaid` (or `failed`).
- **TTL Expiry:** If the 10-minute timer expires, the frontend automatically triggers the cancellation flow.
- **Background Sweep:** A background job (e.g., triggered on draft cleanup) sweeps `checkout_created` payments older than 15 minutes, transitioning them to `failed` and unlocking `checkoutState`, ensuring no permanent freezes if the user closes their browser.

### 3.6 Readiness messaging

When `applicationStatus = needs_review` and readiness ≠ `ready`, show an actionable checklist instead of the payment section:

- ⬜ "Upload passport photo" — if `passport_copy` document missing
- ⬜ "Upload personal photo" — if `personal_photo` document missing
- ⬜ "Your passport must be valid for at least 180 days from today" — if passport validity fails
- ⬜ "Enter your date of birth" — if DOB missing
- ⬜ "Complete required fields: [field list]" — for any other missing required fields

Items show ✅ when satisfied. The "Pay & Submit" button appears only when all items are checked.

### 3.7 Admin refund flow

**Endpoint:** `POST /api/admin/applications/[id]/refund`

**Permissions:** `payments.refund` + `audit.write`

**Request body:** `{ reason: PaddleRefundReason, amount?: number }` (amount optional — defaults to full refund). 
*Note: `PaddleRefundReason` must exactly map to Paddle API's accepted ENUM values (e.g., `fraud`, `accidental`, `customer_request`).*

**Steps:**

1. Load application — verify `paymentStatus = paid`
2. Load latest `payment` row for the application
3. Call `paddleAdapter.initiateRefund(payment.providerTransactionId, reason, amount)`
4. Update `application.paymentStatus = refund_pending`
5. Write audit log: action `application.refund.initiate`, captures reason, admin ID, amount
6. Return success — final `refunded` state happens via webhook

**Guard:** Cannot refund if `paymentStatus ≠ paid`. Cannot double-refund.

---

## 4. Part B — Admin Dashboard

### 4.1 Navigation & structure

**Hub updates** (`app/admin/(protected)/page.tsx`):

Replace the current 5-card grid with 6 cards:

| Card | Route | Icon | Description |
|------|-------|------|-------------|
| Catalog | `/admin/catalog` | `Globe2` | Nationalities and visa services |
| Margins & reference | `/admin/pricing` | `Banknote` | Margin policies and reference costs |
| Platform settings | `/admin/settings` | `SlidersHorizontal` | Draft TTL and operational keys |
| Automations | `/admin/automations` | `Sparkles` | Rule list and IF/THEN editor |
| Applications | `/admin/applications` | `FileText` | Application verification queue and manual review workspace |
| Analytics | `/admin/analytics` | `BarChart` | High-level metrics and active user directory |

**Migration:** Delete `app/admin/(protected)/operations/` and `components/portal/admin-operations-client.tsx`. Preserve any reusable design patterns (table layout, drawer, badge styling) for reference during implementation.

### 4.2 Applications list (`/admin/applications`)

**Data source:** Shared query `listAdminApplications(tx, params)` in `lib/applications/admin-queries.ts`.

**Attention Required Banner:**
Display a prominent alert banner above the table: `"⚠️ X applications require your attention [View]"`. Clicking "View" applies a `?attention=true` URL query parameter, filtering the main paginated table to only show applications where `adminAttentionRequired = true`. This preserves cursor pagination while highlighting issues.

**Columns:**

| Column | Source | Notes |
|--------|--------|-------|
| Application ID | `application.id` | Mono font |
| Applicant | `application.fullName` | Fallback: `guestEmail` or "Unnamed draft" |
| Destination & Service | `nationality.name` + `visaService.name` | Resolved via LEFT JOIN, not raw codes |
| Application Status | `application.applicationStatus` | Color-coded badge |
| Payment Status | `application.paymentStatus` | Color-coded badge |
| Fulfillment Status | `application.fulfillmentStatus` | Color-coded badge |
| Created | `application.createdAt` | Formatted date |

**Badge colors** (per DESIGN.md):

- **Success** (`#3E8635`): `completed`, `paid`, `done`
- **Warning/accent**: `needs_review`, `in_progress`, `awaiting_authority`, `checkout_created`, `refund_pending`, `automation_running`, `manual_in_progress`
- **Muted** (`--color-muted`): `draft`, `unpaid`, `cancelled`, `not_started`, `needs_docs`, `extracting`, `ready_for_payment`, and all unmapped

**Pagination:** Server-side cursor-based. Cursor format: `{createdAt ISO}|{id}`. Page size: 50. State stored in URL query params (`?cursor=...&status=...&q=...`) for bookmarkability.

**Search:** `ILIKE` on `application.id`, `guestEmail`, `fullName`. Leading wildcard — acceptable for current scale, upgrade to `pg_trgm` if needed.

**Filter:** Dropdown for `applicationStatus` values.

**States:** Skeleton rows for `loading.tsx`, empty state for no results, `error.tsx` for DB failures.

**API:** `GET /api/admin/applications` — `runAdminDbJson` with `applications.read`.

### 4.3 Application detail (`/admin/applications/[id]`)

**Layout:** Desktop (>1024px) 50/50 split. Left: form fields + status controls + payment summary. Right: sticky document viewer. Tablet/mobile: stacked.

**Left column sections:**

1. **Application header** — ID, nationality (read-only), service (read-only), created date
2. **Status controls** — dropdowns for `applicationStatus` and `fulfillmentStatus` with allowed transitions. `paymentStatus` is read-only display.
3. **Payment summary** (new) — shown when `paymentStatus ≠ unpaid`: status badge, transaction ID, amount, currency, payment date. "Initiate Refund" button when `paymentStatus = paid`.
4. **Applicant profile form** — editable fields: `fullName`, `dateOfBirth`, `placeOfBirth`, `applicantNationality`, `passportNumber`, `passportExpiryDate`, `profession`, `address`, `phone`. Disabled with tooltip when `checkoutState = pending`. Optimistic concurrency via `updatedAt`.
5. **Delete action** — confirmation modal → `DELETE /api/admin/applications/[id]`.

**Right column:**

Document viewer showing `application_document_blob` previews. "Blob Expired" indicator if `tempExpiresAt` has passed. Download links for retained documents.

**Transition matrix (`applicationStatus`):**

| From | Admin-allowed targets | Guards |
|------|----------------------|--------|
| `draft` | `needs_docs`, `cancelled` | |
| `needs_docs` | `extracting`, `cancelled` | Admin can un-stuck OCR |
| `needs_review` | `ready_for_payment`, `cancelled` | |
| `ready_for_payment` | `cancelled` | `→ in_progress` is system-only (webhook) |
| `in_progress` | `awaiting_authority`, `cancelled` | |
| `awaiting_authority` | `completed`, `cancelled` | |
| `completed` | (terminal) | |
| `cancelled` | (terminal) | |

**Transition matrix (`fulfillmentStatus`):**

| From | Admin-allowed targets | Guards |
|------|----------------------|--------|
| `not_started` | `manual_in_progress` | Admin manual takeover |
| `automation_running` | `manual_in_progress` | Fallback after automation failure |
| `manual_in_progress` | `ready_for_ops_payment`, `submitted` | |
| `ready_for_ops_payment` | `submitted` | |
| `submitted` | `done` | |
| `done` | (terminal) | |

**APIs:**

| Method | Endpoint | Permission | Purpose |
|--------|----------|------------|---------|
| `GET` | `/api/admin/applications` | `applications.read` | Paginated list |
| `PATCH` | `/api/admin/applications/[id]/profile` | `applications.write` + `audit.write` | Profile edit with optimistic concurrency |
| `POST` | `/api/admin/applications/[id]/transition` | `applications.write` + `audit.write` | Status transition with matrix validation |
| `POST` | `/api/admin/applications/[id]/refund` | `payments.refund` + `audit.write` | Initiate refund |
| `DELETE` | `/api/admin/applications/[id]` | `applications.write` + `audit.write` | Delete (existing) |

All routes: `export const runtime = "nodejs"`, `export const dynamic = "force-dynamic"`.

Transition API uses `SELECT ... FOR UPDATE` to prevent race conditions. Profile PATCH checks `updatedAt` for optimistic concurrency — returns `409 CONFLICT` if stale.

### 4.4 Analytics hub (`/admin/analytics`)

**Metrics (Server Component + `withAdminDbActor`):**

- Application counts grouped by `applicationStatus`
- Checkouts created (count of `price_quote` rows with `lockedAt IS NOT NULL`)
- OCR extraction success rates (`passportExtractionStatus` distribution)
- Payment metrics: paid count, total revenue (SUM of `payment.amount` where `status = paid`)
- Time windowing: default last 30 days, date picker to adjust

**User directory:** Deferred to follow-up plan. Note placeholder in spec.

**API:** Queries run directly in the RSC via `withAdminDbActor` — no separate API route needed for read-only metrics.

---

## 5. Migration & RLS

### 5.1 Migration `0008_phase3_paddle_status_upgrade.sql`

**Data migration:**
- UPDATE statements for old → new status values (§2.2)

**Schema changes:**
- Add `adminAttentionRequired` boolean column to `application` table (defaults to `false`).

**New RLS policies:**
- `payment`: system `FOR ALL`, admin `SELECT` with `applications.read`, **client `SELECT` own row (via application `user_id` match)**
- `payment_event`: system `FOR ALL`, admin `SELECT` with `applications.read`
- `price_quote`: extend existing — add client `SELECT` own row (via application `user_id` match), system `FOR ALL`

**New RBAC seeds:**
- `payments.read` — "View payment details"
- `payments.refund` — "Initiate payment refunds"
- `analytics.read` — "Access analytics dashboard"
- All three assigned to `super_admin` role

### 5.2 RLS actor context usage

| Operation | Actor | Notes |
|-----------|-------|-------|
| Checkout creation (signed-in) | `withClientDbActor` | User creates own checkout |
| Checkout creation (guest) | `withSystemDbActor` | After resume cookie verification |
| Webhook processing | `withSystemDbActor` | After Paddle signature verification only |
| Admin list/detail | `withAdminDbActor` via `runAdminDbJson` | Permissions checked in-transaction |
| Admin refund | `withAdminDbActor` via `runAdminDbJson` | Requires `payments.refund` |
| Price display | `withSystemDbActor` | Public pricing, no PII |

---

## 6. Environment Variables

```env
# Existing
PADDLE_API_KEY=...                     # Server-side Paddle API key

# New
PADDLE_WEBHOOK_SECRET=...              # Webhook signature verification
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=...    # Client-side Paddle.js token
NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox # "sandbox" | "production"
```

---

## 7. Testing Strategy

| Layer | Scope | Method |
|-------|-------|--------|
| Unit | `PaymentProvider` interface, quote locking, transition matrix, pricing computation | Vitest mocks |
| Unit | Webhook idempotency (duplicate `payloadHash` rejection) | Vitest with mock tx |
| Unit | Status enum completeness, transition matrix coverage | Vitest assertions |
| Integration | RLS: webhook writes under `system`, admin reads, admin refund, client quote reads | `RUN_DB_TESTS=1` |
| Integration | Checkout → quote lock → `checkoutState` freeze → document freeze | Vitest with DB |
| API | Admin CRUD: list, transition, profile, refund | Vitest route tests with mocked `runAdminDbJson` |
| E2E | Full flow: draft → upload → extract → pay → admin review | Manual + optional Playwright |

---

## 8. Implementation Order

| Step | Track | Description |
|------|-------|-------------|
| 1 | Prerequisite | Status enum upgrade + migration `0008` |
| 2 | A | `PaymentProvider` interface + Paddle adapter |
| 3 | A | Checkout API (`POST /api/checkout`) + quote locking |
| 4 | A | Price display API (`GET /api/applications/[id]/price`) |
| 5 | A | Webhook receiver (`POST /api/webhooks/paddle`) + event processing |
| 6 | A | Apply UI payment section + readiness checklist + Paddle.js |
| 7 | A | Admin refund API |
| 8 | B | Admin hub navigation update (6-card grid) |
| 9 | B | Admin applications list page + `GET` API |
| 10 | B | Admin application detail page + transition + profile APIs |
| 11 | B | Admin analytics hub |
| 12 | Cross | RLS integration tests |
| 13 | Cross | Update `IMPLEMENTATION_REFERENCE.md` §12 |

---

## 9. Design System Alignment

Per `DESIGN.md` and `PRODUCT_REQUIREMENTS.md`:

- **Typography:** Red Hat Display (headings), Red Hat Text (body), Red Hat Mono (data/IDs)
- **Colors:** Primary `#EE0000`, Success `#3E8635`, Muted `#6A6E73`
- **Layout:** Sharp corners (`--radius: 0px`), high contrast, primary CTA left-aligned
- **Badges:** Flat surface with left border color-coding (matching existing operations table pattern)
- **Payment section:** Inline card at bottom of Apply panel vertical flow, primary red "Pay & Submit" CTA

---

## 10. Out of Scope

- User directory and drill-down pages (§4.2–4.3 of previous admin spec) — follow-up plan
- Subscription/recurring payments — MVP is one-time only
- Add-on selection UI (user-facing) — add-ons are included automatically per service config
- CSV/XLSX import pipeline — Phase 4
- Automated fulfillment / browser automation — Phase 4
- Service-level admin review gating — deferred (all services use user-driven checkout)
