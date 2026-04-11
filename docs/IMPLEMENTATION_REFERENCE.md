# Visa platform — implementation reference

This document consolidates the **implementation-level** decisions and conventions for the visa platform features discussed in the brainstorm, focusing on **Paddle**, **application state machine**, **pricing/quotes**, **affiliate automation**, **draft expiry**, and **RBAC + RLS**.

For product intent, IA, and design direction, see:
- [`PRODUCT_REQUIREMENTS.md`](../PRODUCT_REQUIREMENTS.md)
- [`DESIGN.md`](../DESIGN.md)
- [`docs/plans/2026-04-07-visa-platform-design.md`](./plans/2026-04-07-visa-platform-design.md)

---

## 1) Payments (Merchant of Record) — Paddle

### Goals

- **Provider abstraction**: app code calls a small internal `PaymentProvider` interface; Paddle is one adapter.
- **Webhooks-first**: browser redirects are not authoritative; Paddle webhooks drive final payment state.
- **Quote lock**: when checkout is created, a `PriceQuote` is locked so later reference price sync does not change what the user is charged.
- **No internal cost leakage**: the client never sees affiliate-cost vs margin breakdown. They see one total.

### Modeling choice (locked)

- **Hybrid catalog (C)**:
  - Paddle has a small set of generic products (e.g. “Visa Application Service”).
  - Variant specifics (e.g. “30-day single entry”) are rendered in checkout display and stored in metadata.
  - **DB is source of truth** for services, eligibility, and pricing.

### MVP scope (locked)

- **One-time payments + one-time add-ons (B)**:
  - Each application is a one-time payment.
  - Optional one-time add-ons (priority processing, SMS updates) attach to the quote and appear as additional line items.

### Required metadata in checkout

Include stable internal identifiers so webhooks can reconcile:
- `applicationId`
- `serviceId` (visa service variant)
- `priceQuoteId`
- `userId` (nullable for guests)
- `isGuest` (boolean)
- optionally: `affiliateSiteId` / `affiliateConnectorId`

### Refund policy shape (locked)

- Refund is an **admin intent**.
- Provider adapter executes refund (full/partial).
- Status is “refund pending” until confirmed by webhook.
- Always idempotent (webhook/event table).

---

## 2) Pricing + quotes + sync

### Reference vs displayed price

- **Reference cost**: scraped/observed price from affiliate (admin-only).
- **Displayed price**: \(reference cost + configured margin + add-ons - discounts\).
- Margin is configurable globally and per service; discount/override is allowed with audit.

### Repricing behavior (locked)

- **Before checkout creation / firm intent**: prices are live and can increase; no promise of old low price if the user waits.
- **After checkout creation**: lock the quote amount for the checkout; charge that amount even if reference changes.

### Sync cadence (locked)

- Default **daily** sync.
- Admin can initiate **manual sync** anytime.
- Sync runs as a background job with **progress** and **notify on change**.

---

## 3) Guest drafts + expiry

### Draft creation (locked)

- Create an `Application` **as soon as** the user selects **nationality + service**.

### localStorage stance (security)

- Treat localStorage as **unsafe for PII** (XSS/shared device risk).
- Store only a **resume token / draft id** and minimal UI state client-side.
- Store documents + extracted fields server-side.

### Expiry (locked)

- **Fixed** window (not sliding).
- Admin-configurable globally (e.g. 24h/48h/7d) and optionally per service.

### Cleanup

- Background cleanup deletes/archives expired **unpaid** drafts.
- Never auto-delete if `paymentStatus != unpaid`.

---

## 4) Application state machine (split statuses)

### Why split

Avoid state explosion by separating:
- user-facing lifecycle (`applicationStatus`)
- money movement (`paymentStatus`)
- ops execution (`fulfillmentStatus`)
- job attempts (`automationJobs` table)

### Suggested enums (starting point)

**applicationStatus**
- `draft`
- `needs_docs`
- `extracting`
- `needs_review`
- `ready_for_payment`
- `in_progress`
- `awaiting_authority`
- `completed`
- `cancelled`

**paymentStatus**
- `unpaid`
- `checkout_created`
- `paid`
- `refund_pending`
- `refunded`
- `failed` (optional)

**fulfillmentStatus**
- `not_started`
- `automation_running`
- `manual_in_progress`
- `ready_for_ops_payment`
- `submitted`
- `done`

### Client-facing language rule (locked)

Client sees neutral status like “Processing” / “Awaiting authority decision” and does **not** see internal notes, affiliate cost, margins, or “automation failed” details.

---

## 5) Affiliate automation (scrape + Playwright)

### Integration constraint (locked)

- No official API; automation is **brittle by nature**.

### Operational guardrails (required)

- Per-service enable/disable + **kill switch** for automation.
- Observability: job status, attempt count, error, timestamps; store artifacts (screenshots/trace) with redaction where needed.
- Manual fallback: ops can complete the affiliate journey manually and mark **manual success**.

### Manual success proof (tiered, locked)

Proof requirement depends on service value/risk; proof is **internal-only** (receipt upload and/or structured fields like amount/currency/affiliate reference).

---

## 6) RBAC + RLS (DB-level enforcement)

### Decisions (locked)

- RBAC is required.
- Enforcement is both:
  - **App layer** (central checks, good errors)
  - **DB layer** (Postgres RLS for sensitive tables)

### Actor context pattern

RLS policies depend on request-scoped “actor” context set at the start of each request/server action:
- `app.actor_type` = `admin|client|system`
- `app.actor_id` = stable id
- optionally: `app.actor_permissions` (comma-delimited or JSON)

Policies use `current_setting('app.actor_type', true)` and `current_setting('app.actor_id', true)` to allow/deny.

### Single-tenant note (locked)

No `org_id` required in MVP; separation is based on actor type and ownership (client user vs admin capabilities).

### Runtime helper (required)

Because the project uses **Neon HTTP** (`drizzle-orm/neon-http`), `set_config(...)` variables only persist **within a transaction**.

Use `lib/db/actor-context.ts` helpers:
- `withAdminDbActor(adminUserId, ({ tx, permissions }) => ...)`
- `withClientDbActor(userId, fn)`
- `withSystemDbActor(fn)`

These wrap all DB work in one transaction, set:
- `app.actor_type`
- `app.actor_id`
- `app.actor_permissions`

and then run your queries against the transaction handle so RLS can evaluate correctly.

**Admin permissions in the same transaction:** `withAdminDbActor` resolves RBAC permissions **once** inside the same `db.transaction` as `set_config`, sets `app.actor_permissions`, and passes `{ tx, permissions }` to your callback (so `runAdminDbJson` can gate on `permissions` without a second query).

### RLS policy shape (Phase 0)

Migrated in `drizzle/0002_harsh_wolverine.sql`:

- **Admin:** separate policies for **`SELECT`** vs **`INSERT`/`UPDATE`/`DELETE`** where read/write should differ (e.g. `affiliate.read` vs `affiliate.write`, `jobs.read` vs `jobs.run`).
- **Client:** scaffold allows **`SELECT`** on own `application` / `price_quote` only when `user_id` matches `app.actor_id` (signed-in users).
- **`system`:** broad **`FOR ALL`** on several tables for webhooks/background jobs — see trust boundary below.

### Known gaps to close in Phases 1–4 (review follow-ups)

1. **`audit_log` writes**  
   Phase 1 catalog/pricing admin mutations write **`audit_log`** rows (requires **`audit.write`**, seeded on **`super_admin`** per migration **`0003_catalog_addon_rls`**). Extend the same pattern to other privileged surfaces as they ship (payments, applications, etc.).

2. **Guest applications vs RLS**  
   Client policies require **`user_id IS NOT NULL`**. **Guests** (`user_id` null) need a deliberate design:
   - server-only routes that use a **resume token** / hashed secret and **do not** rely on “client actor” RLS for guest rows, **or**
   - new columns + policies (e.g. match `resume_token_hash` under `client` actor).

3. **`payments.refund` permission**  
   Seeded in RBAC but **not** wired into RLS yet. Admin **`payment`** / **`payment_event`** are read-only for admins today; refunds likely use **`system`** after webhook verification or new policies gated on `payments.refund`.

4. **`system` actor trust boundary**  
   Never derive `app.actor_type = system` from user input. Only **verified webhooks**, **signed internal jobs**, or other **non-spoofable** entrypoints may call `withSystemDbActor`.

5. **Money columns**  
   Amounts use **`bigint`** (minor units) on `payment`, `price_quote`, `affiliate_reference_price`; **`margin_policy.value`** uses **`numeric(18,6)`**. Document minor-unit discipline in app code; use `bigint` string mode later if totals approach JS safe integer limits.

---

## 7) HTTP: middleware, API envelope, observability

### Middleware (`middleware.ts`)

- **Matchers:** `/api/*`, `/portal`, `/portal/*`, `/admin`, `/admin/*`.
- **`x-request-id`:** Set on incoming request headers (or generated) and echoed on the response; route handlers should read via `headers().get('x-request-id')` and pass into `jsonOk` / `jsonError`.
- **`x-pathname`:** Set from `nextUrl.pathname` for **`/portal*`** and **`/admin*`** so layouts can build accurate **`callbackUrl`** after sign-in.

### JSON API envelope (`lib/api/response.ts`)

- Use **`jsonOk` / `jsonError`** for non–Better-Auth JSON routes (see Cursor rule `visa-api-response-envelope.mdc`).
- **`details`** must stay free of secrets/PII.

### OpenTelemetry (`instrumentation.ts`)

- Server-only; skipped on Edge (`NEXT_RUNTIME === edge`).
- **`OTEL_EXPORTER_OTLP_ENDPOINT`** — if set, traces export via OTLP HTTP; if unset, SDK runs without exporting.
- Optional: **`OTEL_SERVICE_NAME`**, **`OTEL_DIAGNOSTIC_LOGS=1`** for verbose OTel internal logs.
- **Lookahead:** narrow `@opentelemetry/auto-instrumentations-node` to only what you need; document sampling in production.

### Logging (`lib/logger.ts`)

- **Pino** with redaction paths for common secret/PII keys. Prefer **small structured fields**; redaction is a backstop, not primary control.

---

## 8) Testing & repo hygiene (baseline)

### Tooling (Phase 1+)

- **Vitest** — `pnpm test` / `pnpm test:ci` ([`vitest.config.ts`](../vitest.config.ts)). CI runs lint, `test:ci`, and **`pnpm run build`** ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).
- **TDD expectation:** add or extend tests before (or alongside) behavior changes; keep suites green on every merge.
- **Postgres RLS integration:** [`tests/integration/rls-catalog.test.ts`](../tests/integration/rls-catalog.test.ts) runs only when **`RUN_DB_TESTS=1`** and **`DATABASE_URL`** point at a database where migrations (including **`0003_catalog_addon_rls`**) are applied.

### Testing (recommended next)

- Smoke: migrations apply on a clean DB.
- RLS: at least one scenario each for **client own-row**, **admin with/without permission**, **system** (internal test only). Phase 1 adds catalog/pricing admin matrix coverage in the integration file above.

### Git scope for AI tooling

- **Committed:** **`.cursor/rules/`** (project Cursor rules).
- **Ignored (local only):** **`.agents/`**, **`skills-lock.json`**, and other paths under **`.cursor/`** except **`rules/`** (e.g. local skills). See root [`.gitignore`](../.gitignore). They do not affect runtime.

### Local dev origins (`next.config.ts`)

- **`allowedDevOrigins`** merges env-derived hosts; **`EXPLICIT_ALLOWED_DEV_ORIGINS`** can list a fixed ngrok host for HMR. For a neutral public baseline, keep the explicit list **empty** and use **`ALLOWED_DEV_ORIGINS`** / auth URLs instead.

---

## 9) Phased delivery (1–4) — scope and RLS touchpoints

Phase 0 (schema, migration `0002_harsh_wolverine`, actor helpers, envelope, middleware, OTel/Pino) is the baseline. The rows below are **what each phase should deliver** and **which Phase 0 gaps it should close**.

| Phase | Product focus | Engineering / RLS |
|--------|----------------|-------------------|
| **1 — Catalog + pricing** | Admin CRUD for visa services (enable/disable, attributes), nationality ↔ service eligibility, margin policies (global + per-service), **displayed price** from reference + margin + add-ons − discounts (pre–checkout intent). | Extend or tighten RLS so admin writes align with seeded permissions (e.g. **`pricing.*`**, **`catalog.*`** as you wire routes). Ensure **audit** on pricing/discount actions once **`audit_log` INSERT** is allowed (see §6 gaps). |
| **2 — Drafts, guests, documents** | Create **`application`** on nationality + service; **fixed** draft TTL + cleanup for **unpaid** only; document upload + extraction pipeline (can stub OCR). | **Guest path:** today’s client RLS expects **`user_id = app.actor_id`**. Implement **resume token** (hashed) + **server-only** access and/or **new RLS** for guest rows — do not rely on “signed-in client” policies for guests. |
| **3 — Paddle** | `PaymentProvider` + Paddle adapter; checkout creation **locks** `price_quote`; webhooks → normalized events; admin refund intent → provider → webhook-confirmed state; **idempotent** `payment_event`. | All webhook and payment state transitions that bypass user context run under **`withSystemDbActor`** only after **signature verification**. Wire **`payments.refund`** (or system-only writes) for refund-related rows. Keep **split** `applicationStatus` / `paymentStatus` / `fulfillmentStatus`. |
| **4 — Affiliate automation** | Connectors per domain, reference **daily + manual** sync with progress and notify-on-change; Playwright jobs with artifacts, retries, **manual fallback** and **kill switch**. | Job runners use **`system`** (or dedicated policies) for writes to sync/automation tables; never set **`system`** from request input. Redact artifacts; observability on every job attempt. |

**Cross-cutting (any phase):** resolve **`audit_log` INSERT** (§6.1) before treating audit as reliable; treat **`system`** as a **trust boundary** (§6.4).

---

## 10) Phase 1 — catalog + pricing (implemented)

- **Migration [`0003_catalog_addon_rls`](../drizzle/0003_catalog_addon_rls.sql):** `addon.amount` / `addon.currency` (minor units); seeds **`catalog.read`**, **`catalog.write`**, **`audit.write`**; RLS on catalog tables, `margin_policy`, `affiliate_site`, `affiliate_reference_price`; admin + **`system`** read policies for public catalog paths; **`audit_log` INSERT** for admins with **`audit.write`**.
- **RLS write policies (Postgres):** use separate **`FOR INSERT`**, **`FOR UPDATE`**, and **`FOR DELETE`** admin policies (each with the right `USING` / `WITH CHECK` shape). Do **not** replace invalid multi-action syntax with a single permissive **`FOR ALL`** policy, because that can unintentionally widen **SELECT** when policies are permissive.
- **Pricing library:** [`lib/pricing/compute-display-price.ts`](../lib/pricing/compute-display-price.ts), [`lib/pricing/resolve-catalog-pricing.ts`](../lib/pricing/resolve-catalog-pricing.ts); canonical affiliate site via **`PRICING_AFFILIATE_SITE_ID`** (optional, see [`.env.example`](../.env.example)).
- **Public APIs:** `GET /api/catalog/nationalities`, `GET /api/catalog/services?nationality=XX` — client payload is **totals only** (no reference/margin breakdown).
- **Admin APIs:** `/api/admin/catalog/*` (visa services, nationalities, eligibility) and `/api/admin/pricing/*` (margin policies, reference prices) — **`runAdminDbJson`** gates on `permissions` from **`withAdminDbActor`** (same transaction as the handler body; see [`lib/admin-api/require-admin-db.ts`](../lib/admin-api/require-admin-db.ts)). Mutations require **`audit.write`** and append **`audit_log`** via [`lib/admin-api/write-admin-audit.ts`](../lib/admin-api/write-admin-audit.ts).
- **Admin UI:** [`app/admin/(protected)/catalog/page.tsx`](../app/admin/(protected)/catalog/page.tsx) — read-only overview (mutations via APIs).

