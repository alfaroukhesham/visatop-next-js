### Paddle + DB reality check (important)

You’re using **Neon HTTP + Drizzle** (`drizzle-orm/neon-http`). That’s fine, but for **DB-level RLS** we need a way to tell Postgres “who is acting” per request. The standard pattern is:

- Keep **one DB connection user** (what you have today)
- For each request, run `select set_config('app.actor_type', 'admin|client|system', true)` and `set_config('app.actor_id', '<id>', true)` (and optionally permissions)
- RLS policies use `current_setting('app.actor_type', true)` / `current_setting('app.actor_id', true)`

We’ll implement a tiny helper so every server action/route handler sets these configs before touching protected tables.

---

### Task breakdown (implementation order)

#### Phase 0 — Plumbing (1–2 days) — **largely done**
- **DB “actor context” helper**: `lib/db/actor-context.ts` — `withAdminDbActor` / `withClientDbActor` / `withSystemDbActor` (transaction + `set_config`)
- **RBAC tables + seed**: in migration `drizzle/0002_harsh_wolverine.sql` (permissions + `super_admin` role). **Assign `admin_user_role` manually** for the first admin.
- **Audit log table**: schema exists; **RLS currently allows admin SELECT only** — add **`INSERT` policy** or write via **`withSystemDbActor`** before relying on audit inserts from admin transactions (see [`IMPLEMENTATION_REFERENCE.md`](./IMPLEMENTATION_REFERENCE.md)).

**Post–Phase 0 (before leaning on RLS in prod):**

- **Guest rows**: client RLS requires `user_id`; design resume-token / server routes for guests (Phase 2).
- **`system` actor**: only verified webhooks / internal jobs; never from user-controlled input.
- **Refunds**: seed permission `payments.refund`; wire RLS or system-only payment writes (Phase 3).

#### Phase 1 — Catalog + pricing (2–4 days)
- **Visa services**: admin CRUD (enable/disable, attributes like duration/entries)
- **Eligibility mapping**: service ↔ nationality list
- **Margin policy**: global + per-service overrides
- **Price quote engine**: computes displayed price from reference cost + margin + add-ons − discount

#### Phase 2 — Application drafts + guest resume (3–6 days)
- **Applications** created at nationality+service selection
- **Draft expiry**: fixed window (admin-configurable), cleanup job
- **Documents + extraction** tables (stub OCR initially if needed)

#### Phase 3 — Payments (Paddle adapter) (3–6 days)
- `PaymentProvider` interface + **Paddle adapter**
- Checkout creation locks a `price_quote`
- Webhook handler idempotently updates `paymentStatus` and writes normalized payment events
- Admin refund intent → provider refund → webhook-confirmed state

#### Phase 4 — Affiliate automation & sync jobs (parallel track) (5–12 days)
- **Affiliate connector** table (domain, auth mode, selector version, kill switch)
- **Daily sync job** + **manual “sync now”** + job progress + “notify on change”
- **Playwright automation jobs** with artifacts + retry/manual fallback workflow

**Phases 1–4 (RLS touchpoints, exit criteria):** see **§9** in [`IMPLEMENTATION_REFERENCE.md`](./IMPLEMENTATION_REFERENCE.md).

---

### Schema (Drizzle tables) we’ll add

#### RBAC + audit
- `admin_permission` (key, description)
- `admin_role` (name)
- `admin_role_permission` (roleId, permissionId)
- `admin_user_role` (adminUserId, roleId)
- `audit_log` (actorType, actorId, action, entityType, entityId, before/after JSON, createdAt)

#### Catalog + pricing
- `nationality` (code, name) *(or store code-only and render from ISO list; DB is fine for admin mapping)*
- `visa_service` (id, name, enabled, durationDays, entries, etc.)
- `visa_service_eligibility` (serviceId, nationalityCode)
- `margin_policy` (scope: global/service, mode percent/fixed, **value `numeric(18,6)`**, currency, …)
- `addon` + `visa_service_addon` (optional)
- `price_quote` (applicationId, **total_amount `bigint`** minor units, currency, lockedAt, **breakdown_json**, …)

#### Applications
- `application` (id, userId nullable, guestEmail nullable, nationalityCode, serviceId, **applicationStatus**, **paymentStatus**, **fulfillmentStatus**, `draftExpiresAt`, `referenceNumber`, timestamps)
- `application_discount` (applicationId, type, amount, reason, adminUserId, createdAt) *(or encode into `price_quote` + audit)*

#### Payments
- `payment` (…, **amount `bigint`** minor units, currency, …)
- `payment_event` (paymentId, providerEventId, type, payloadHash, receivedAt) for idempotency

#### Automation + sync
- `affiliate_site` (domain, enabled)
- `affiliate_connector` (siteId, name, enabled, credentialsRef/encrypted blob, config JSON, selectorVersion, killSwitch)
- `price_sync_job` (status, startedAt, finishedAt, requestedByAdminId nullable, logs)
- `affiliate_reference_price` (serviceId, siteId, **amount `bigint`** minor units, currency, observedAt, sourceUrl, raw JSON)
- `automation_job` (applicationId, connectorId, status, attempt, lastError, artifactRefs, startedAt, finishedAt)

---

### API / server actions (MVP)

#### Client
- `GET /api/catalog/nationalities` → only those with enabled eligible services
- `GET /api/catalog/services?nationality=XX`
- `POST /api/applications` → create draft (nationality + service)
- `POST /api/applications/:id/documents` → upload metadata (storage TBD)
- `POST /api/applications/:id/extract` → queue extraction
- `POST /api/applications/:id/checkout` → create `price_quote` + Paddle checkout URL
- `GET /api/applications/:id/status` → friendly status (no margin/cost leakage)

#### Admin
- `GET/POST/PATCH /api/admin/services`
- `POST /api/admin/services/:id/enable|disable`
- `POST /api/admin/pricing/sync` (manual) + `GET /api/admin/pricing/sync/:jobId`
- `POST /api/admin/applications/:id/manual-success` (tiered proof)
- `POST /api/admin/payments/:id/refund` (intent)
- `GET /api/admin/audit` (permission-gated)

#### Webhooks
- `POST /api/webhooks/paddle` → verify signature → idempotent event handling

---

