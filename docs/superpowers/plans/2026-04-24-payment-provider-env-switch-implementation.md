# Payment provider env switch (Paddle | Ziina) — Implementation plan (draft)

> **For agentic workers:** Use **subagent-driven-development** or **executing-plans** to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an env-controlled single active payment provider (`paddle` default | `ziina`), with shared webhook application logic, discriminated checkout API responses, Ziina **redirect** checkout + dedicated webhook route, and admin refund branching—without changing Paddle behavior when `PAYMENT_PROVIDER=paddle`.

**Architecture:** Extract **`applyPaymentWebhookEvent`** + **`NormalizedPaymentWebhookEvent`** from the Paddle webhook route; add **`computePaymentEventPayloadHash(provider, rawBody)`** per spec §5.3; use **`lib/payments/resolve-payment-provider.ts`** as the single entry for env validation + active provider (YAGNI: no separate `registry.ts` unless multiple call sites need a facade). Keep **two webhook URLs** (`/api/webhooks/paddle`, `/api/webhooks/ziina`). Client uses **`jsonOk` discriminated `data`** (§5.1).

**Tech stack:** Next.js App Router, Drizzle, Neon, existing `jsonOk`/`jsonError` (`lib/api/response.ts`), Paddle SDKs unchanged, Ziina REST (`fetch` to `ZIINA_API_BASE_URL`), Vitest.

**Spec:** [2026-04-24-payment-provider-env-switch-design.md](../specs/2026-04-24-payment-provider-env-switch-design.md)

**Scope decisions (locked for this plan):**

| Topic | Choice |
|-------|--------|
| Checkout DB boundary | **Keep single transaction** including provider HTTP (spec §7.2.1 option 1) for v1—same as today. **Ziina `fetch` must use `AbortController` (or equivalent) with a timeout strictly below the DB/Neon statement timeout** so a hung provider does not hold `checkout_state = pending` until DB kill. Document target (e.g. 25s client vs 60s DB—tune to your Neon plan). |
| `payment_event.payload_hash` | **Prefix rule for both providers** from release: `sha256(provider + "\n" + rawBody)` hex. Coordinate deploy so in-flight Paddle retries during cutover are acceptable. |
| Refund completion | **Baseline §7.6:** Ziina admin refund mirrors Paddle (API call + `refund_pending`); **no** new `refund.completed` handling for Paddle in this epic unless explicitly added as a stretch task. |
| `provider_operation_id` | **Add column** + wire on Ziina create intent (spec §8). |

---

## File map (create / modify)

| Path | Responsibility |
|------|------------------|
| `drizzle/0012_payment_provider_operation_id.sql` | Add `payment.provider_operation_id` nullable `text` (next id after `0011_*` at time of writing—re-number if a newer migration lands first). |
| `lib/db/schema/payments.ts` | New column `providerOperationId`. |
| `lib/payments/payment-event-hash.ts` | `computePaymentEventPayloadHash(provider: "paddle" \| "ziina", rawBody: string): string` (hex SHA-256). |
| `lib/payments/normalized-webhook.ts` | `NormalizedPaymentWebhookEvent` type + `PaymentWebhookKind` enum/union. |
| `lib/payments/apply-payment-webhook-event.ts` | Core state machine (moved from paddle route); accepts **`payRow` + `normalizedEvent`** (caller resolves row and enforces **R8 before** `payment_event` insert); optional defensive assert inside. |
| `lib/payments/resolve-payment-provider.ts` | Read `PAYMENT_PROVIDER`, validate env, export `getActivePaymentProviderKind()`, `assertZiinaConfig()`, etc. |
| `lib/payments/ziina-client.ts` | `createPaymentIntent`, `createRefund` (thin fetch wrappers + errors). |
| `lib/payments/ziina-webhook.ts` | `verifyZiinaWebhook(req, rawBody)`, `parseZiinaWebhookToNormalized(rawBody)`. |
| `lib/payments/checkout-types.ts` (or extend `types.ts`) | Exported **`CheckoutSessionData`** union for API + client — **no** `server-only` / Node-only imports (safe for `paddle-checkout-button.tsx`). |
| `lib/payments/paddle-webhook-normalize.ts` | `normalizePaddleWebhookToEvent` (Task B2). |
| `lib/payments/paddle-adapter.ts` | No behavioral change; optionally re-export or narrow types. |
| `app/api/checkout/route.ts` | Branch on provider; insert `payment.provider`; Ziina success URLs; return discriminated `data`. |
| `app/api/webhooks/paddle/route.ts` | Verify + parse → resolve `payRow` → **R8** → prefixed hash → `payment_event` dedupe → **`applyPaymentWebhookEvent(tx, payRow, …)`**. |
| `app/api/webhooks/ziina/route.ts` | **New** — same orchestration as Paddle route (verify → parse → resolve → **R8** → hash → dedupe insert → `applyPaymentWebhookEvent`). |
| `app/api/admin/applications/[id]/refund/route.ts` | Branch `payment.provider` → Paddle vs Ziina refund. |
| `components/apply/paddle-checkout-button.tsx` | Narrow `envelope.data` by `provider`; handle `ziina` with redirect. **Rename** is optional (e.g. `ApplicationCheckoutButton`); YAGNI: keep filename, branch inside, or add `ziina-redirect-checkout.tsx` imported by panel. |
| `components/apply/application-draft-panel.tsx` | Pass provider from checkout response or read from env is wrong—**must** use server response `data.provider`. |
| `app/(client)/apply/applications/[id]/checkout/return/page.tsx` (path TBD) | Success interstitial + polling. |
| `app/(client)/apply/applications/[id]/checkout/cancel/page.tsx` | Cancel UX + link back. |
| `lib/api/response.ts` | Extend `ApiErrorCode` with narrow codes (see **§ ApiErrorCode additions** below); reuse existing `SERVICE_UNAVAILABLE` where appropriate. |
| `.cursor/rules/netlify-env.mdc` or `README` / internal env doc | Env matrix (pointer to spec §16). |
| `lib/payments/apply-payment-webhook-event.test.ts` (colocated; Vitest `**/*.{test,spec}.{ts,tsx}`) | Tests for core / helpers per **Task G1** strategy. |

### ApiErrorCode additions (normative for implementers)

Add (or map to existing) codes so checkout, webhooks, and ops docs stay aligned with spec §5.1 / §5.2 / §5.4:

| Code | Use |
|------|-----|
| `PAYMENT_PROVIDER_ERROR` | Active provider misconfigured (e.g. Ziina token missing when `PAYMENT_PROVIDER=ziina`). |
| `ZIINA_UNAVAILABLE` | Ziina HTTP 5xx / timeout after request started (checkout; often rolls back whole tx). |
| `ZIINA_CLIENT_ERROR` | Ziina 4xx from create intent (mapping to **400** / **502** per product). |
| `WEBHOOK_SECRET_NOT_CONFIGURED` | Ziina webhook in production without `ZIINA_WEBHOOK_SECRET` (spec §5.2 fail-closed). |
| `WEBHOOK_SIGNATURE_INVALID` | HMAC or Paddle signature verification failed (**401**). |

---

## Wave A — Schema + hash primitive + types

### Task A1: Migration `provider_operation_id`

**Files:**

- Create: `drizzle/0012_payment_provider_operation_id.sql` (or next free id if `0012` already taken)
- Modify: `lib/db/schema/payments.ts`

- [ ] **Step 1:** List `drizzle/` migrations; confirm filename **`0012_payment_provider_operation_id.sql`** (or bump if newer migrations exist).
- [ ] **Step 2:** Add nullable column:

```sql
ALTER TABLE payment ADD COLUMN provider_operation_id text;
```

- [ ] **Step 3:** Drizzle schema mirror: `providerOperationId: text("provider_operation_id")`.
- [ ] **Step 4:** Run migrate locally; confirm no RLS breakage (column nullable).

### Task A2: `computePaymentEventPayloadHash`

**Files:**

- Create: `lib/payments/payment-event-hash.ts`
- Test: `lib/payments/payment-event-hash.test.ts` (or colocated vitest)

- [ ] **Step 1:** Implement `computePaymentEventPayloadHash(provider, rawBody)` exactly as spec §5.3 (`provider + "\n" + rawBody`, UTF-8, SHA-256 hex).
- [ ] **Step 2:** Unit test: same body different provider → different hash; stable for same inputs.

### Task A3: Normalized webhook type

**Files:**

- Create: `lib/payments/normalized-webhook.ts`

- [ ] **Step 1:** Define `NormalizedPaymentWebhookEvent` with required fields per spec §15: `provider`, `kind`, `providerPaymentId`, `amountMinor`, `currency`, `metadata`, `rawEventType`, `providerEventId?: string | null`.
- [ ] **Step 2:** Define `kind` union: at minimum `payment_completed`, `payment_failed` (map provider-specific events into these for v1 paid/fail paths).

---

## Wave B — Extract `applyPaymentWebhookEvent` (Paddle-only behavior preserved)

### Task B1: Move state machine to shared module

**Webhook pipeline order (R8 + spec §7.5):** Do **not** insert `payment_event` until the resolved `payment` row passes **R8**. `normalizedEvent.provider` must be set from the **route** literal (`"paddle"` / `"ziina"`), never from untrusted client-shaped fields alone.

**Files:**

- Create: `lib/payments/apply-payment-webhook-event.ts`
- Modify: `app/api/webhooks/paddle/route.ts` (thin wrapper)

- [ ] **Step 1:** Copy paid / failed / audit / doc retention / resurrection / amount-mismatch logic from `paddle/route.ts` into **`applyPaymentWebhookEvent(tx, payRow, event, ctx)`** — signature takes **already-resolved** `payRow` plus `NormalizedPaymentWebhookEvent`; `ctx` includes `requestId`, `providerEventId` (for audit payloads), etc. No second full resolve inside `apply` unless you intentionally re-read for freshness (default: use passed `payRow`).
- [ ] **Step 2 — Route orchestration (inside `withSystemDbActor` tx, same as today):** verify Paddle signature → read `bodyText` → parse → **`normalizePaddleWebhookToEvent(bodyText, …)`** with **`provider: "paddle"`** fixed from route.
- [ ] **Step 3:** Resolve `payRow` using **existing** Paddle lookup rules (`providerCheckoutId` / `providerTransactionId` / metadata + `checkout_created` fallback).
- [ ] **Step 4 (R8, before `payment_event`):** If `payRow.provider !== "paddle"`, structured **log** + **`auditLog`** row documenting rejection (no `payment` / `application` updates) + **`return`** **`jsonError` 401** (or **400** per product). **Do not** insert `payment_event`.
- [ ] **Step 5:** `requirePaymentEventPayloadHashDedupeIndex` → `computePaymentEventPayloadHash("paddle", bodyText)` → `insert(paymentEvent).onConflictDoNothing({ target: payloadHash }).returning()` — if **no** row returned (duplicate), **return** early (**no** `applyPaymentWebhookEvent`).
- [ ] **Step 6:** Call **`applyPaymentWebhookEvent(tx, payRow, normalizedEvent, ctx)`**. Optional defensive assert: `payRow.provider === normalizedEvent.provider`.
- [ ] **Step 7:** Manual test: Paddle sandbox checkout still completes; duplicate webhook still no-ops; **fabricate** provider-mismatch row in dev to confirm **no** `payment_event` and **401** response.

**Transaction note:** R8 failure must **not** leave a dedupe row. If `withSystemDbActor` commits on a bare `return` from the callback, use **`throw`** (after audit) or an explicit rollback pattern your actor supports so R8 exits do not commit an ambiguous transaction—confirm wrapper semantics with existing `paddle/route.ts` patterns.

### Task B2: Paddle → normalized parser

**Files:**

- Create: `lib/payments/paddle-webhook-normalize.ts` (recommended) **or** keep in route

- [ ] **Step 1:** Export **`normalizePaddleWebhookToEvent(bodyText, …)`** (name used in **Task B1**) mapping `paddleAdapter.parseWebhookEvent` + raw JSON to `NormalizedPaymentWebhookEvent` (`provider: "paddle"` **always** — set inside function; `rawEventType` = `event_type`, `providerEventId` from `event_id`).
- [ ] **Step 2:** Map `transaction.completed` / `transaction.paid` → `payment_completed`; `transaction.payment_failed` → `payment_failed`.

---

## Wave C — Resolve provider + checkout API + client (Paddle default unchanged)

### Task C1: `resolve-payment-provider`

**Files:**

- Create: `lib/payments/resolve-payment-provider.ts`

- [ ] **Step 1:** `getActivePaymentProvider(): "paddle" | "ziina"` — default `"paddle"` if unset.
- [ ] **Step 2:** `getZiinaConfig()` throws or returns `Result` with clear error for checkout when `ZIINA_ACCESS_TOKEN` missing and provider is `ziina`.
- [ ] **Step 3:** Log active provider at **debug** or on first resolution per process if useful — avoid assuming “once per cold start” in serverless (many isolates); do not spam **info** per request.

### Task C2: Checkout union + `POST /api/checkout`

**Files:**

- Create: `lib/payments/checkout-types.ts` — `export type CheckoutSessionData = …` (spec §5.1)
- Modify: `app/api/checkout/route.ts`

- [ ] **Step 1:** On insert, set `provider: getActivePaymentProvider()` instead of hardcoded `"paddle"`.
- [ ] **Step 2:** If `paddle`: existing flow; `jsonOk` data `{ provider: "paddle", transactionId, clientToken }`.
- [ ] **Step 3:** If `ziina`: generate `operationId` UUID; persist to `payment.providerOperationId` before HTTP call; build success/cancel/failure URLs with `{PAYMENT_INTENT_ID}` placeholder per Ziina docs. **Base URL:** prefer server-only **`APP_BASE_URL`** (or `VERCEL_URL`/`NETLIFY` canonical pattern) for constructing return URLs; if only `NEXT_PUBLIC_APP_URL` exists in your deployment, document that as fallback — **`jsonError` `PAYMENT_PROVIDER_ERROR`** if **no** safe absolute HTTPS base can be resolved in production.
- [ ] **Step 3b:** Wrap Ziina `fetch` in **`AbortController`** timeout (see scope table: must be **<** DB statement timeout).
- [ ] **Step 4:** Map Ziina 4xx/5xx / timeout to `jsonError` using **§ ApiErrorCode additions** (`ZIINA_CLIENT_ERROR`, `ZIINA_UNAVAILABLE`, etc.); transaction rolls back on throw inside tx.
- [ ] **Step 5:** Wire new `ApiErrorCode` values in `lib/api/response.ts` (and any `jsonError` call sites).

### Task C3: Client checkout button + panel

**Files:**

- Modify: `components/apply/paddle-checkout-button.tsx`
- Modify: `components/apply/application-draft-panel.tsx`

- [ ] **Step 1:** Parse `envelope.data.provider`; if `paddle`, existing Paddle path.
- [ ] **Step 2:** If `ziina`, `window.location.href = envelope.data.redirectUrl` (or `<a>` with same effect); keep loading state until navigation.
- [ ] **Step 3:** Panel: adjust copy for Ziina (“You will be redirected to complete payment”) if trivial; avoid env-based branching for provider (must use checkout response).

### Task C4: In-app checkout cancel vs Ziina (`checkout-cancel`)

**Files:**

- Modify: `app/api/applications/[id]/checkout-cancel/route.ts` (only if behavior must differ per provider; otherwise verify only)
- Reference: spec §7.3.1, `application-draft-panel.tsx`

- [ ] **Step 1:** Confirm `POST /api/applications/[id]/checkout-cancel` remains valid when `PAYMENT_PROVIDER=ziina` and user cancels from **your** UI after returning without paying (same `checkoutState` / `paymentStatus` / `payment.status` semantics as Paddle).
- [ ] **Step 2:** Idempotency matrix (document in PR): **cancel API** vs **Ziina webhook** terminal (`canceled` / `failed`) — both should converge on the same stable end state (e.g. `payment.status = failed`, `checkout_state = none`, `paymentStatus` per product); second application of either path must **not** duplicate critical audits or flap state.
- [ ] **Step 3:** If product requires different `payment.status` label for user-cancel vs provider-fail, spec it explicitly; otherwise keep parity with Paddle **`transaction.payment_failed`** path.

---

## Wave D — Ziina return pages (polling)

### Task D1: Return + cancel routes

**Files:**

- Create: `app/(client)/apply/applications/[id]/checkout/return/page.tsx`
- Create: `app/(client)/apply/applications/[id]/checkout/cancel/page.tsx` (or single page + `searchParams`)

- [ ] **Step 1:** Success route: read `applicationId` from params; client component polls **`GET /api/applications/${applicationId}`** via **`fetchApiEnvelope<{ application: … }>`** (same contract as `application-draft-panel.tsx`); backoff **1s → cap 2s**; max **~120s**; terminals **`paid`**, **`failed`**, still **`checkout_created`** / **`unpaid`** at timeout per spec §7.4; **401** → same guest/sign-in recovery as draft panel.
- [ ] **Step 2:** On `paid`, `router.replace` to existing submitted/thank-you flow as today.
- [ ] **Step 3:** Cancel page: copy + link back to `/apply/applications/[id]` (no trust of query for paid state).
- [ ] **Step 4:** Ensure guest/auth access matches existing application pages (reuse patterns from draft panel data loading).

---

## Wave E — Ziina webhook route

### Task E1: Verification + IP optional

**Files:**

- Create: `lib/payments/ziina-webhook.ts`
- Create: `app/api/webhooks/ziina/route.ts`

**Pipeline:** Same **R8-before-`payment_event`** order as **Task B1**: verify → parse → resolve `payRow` → **R8** (`payRow.provider === "ziina"`) → hash → insert `payment_event` → if inserted → `applyPaymentWebhookEvent`. `normalizedEvent.provider` is always **`"ziina"`** from the route.

- [ ] **Step 1:** Read raw body as **exact string** used for HMAC. Verify **`X-Hmac-Signature`** per spec §5.2: **production** — fail closed if secret missing (**401** / **503** + `WEBHOOK_SECRET_NOT_CONFIGURED`); invalid HMAC → **`WEBHOOK_SIGNATURE_INVALID`**. **Development:** optional bypass only if **`ZIINA_WEBHOOK_ALLOW_UNSIGNED=true`**, default **false**; log **CRITICAL** when bypass is active (spec §5.2 table).
- [ ] **Step 2:** If `ZIINA_ENFORCE_WEBHOOK_IP_ALLOWLIST=true`, compare source IP against Ziina-published allowlist **using the header your platform documents as trustworthy** (Netlify: understand **`x-forwarded-for`** first vs last hop; client-spoofed values are a risk if you read the wrong segment—document the chosen rule or defer allowlist until ops confirms egress IPs + edge behavior).
- [ ] **Step 3:** Parse JSON; map `payment_intent.status.updated` → normalized `payment_completed` / `payment_failed` / ignore non-terminal updates (mirror Paddle **`UPDATE … WHERE status != paid`** idempotency inside `apply`).
- [ ] **Step 4:** Resolve `payRow` by intent id / existing fallbacks (spec R9: correlation primarily **`provider_checkout_id`**); **R8**; `computePaymentEventPayloadHash("ziina", rawBody)` → insert `payment_event` **ON CONFLICT DO NOTHING** → if new row, **`applyPaymentWebhookEvent(tx, payRow, normalizedEvent, ctx)`**.
- [ ] **Step 5:** Register URL in Ziina dashboard staging; manual test with test intent.

---

## Wave F — Admin refund branch

### Task F1: Ziina refund API

**Files:**

- Modify: `lib/payments/ziina-client.ts`
- Modify: `app/api/admin/applications/[id]/refund/route.ts`

- [ ] **Step 0:** Introduce **`ZiinaProviderError`** (or equivalent) in `ziina-client.ts` — mirror **`PaddleProviderError`**: message, optional HTTP status, sanitized upstream code/body snippet for logs only (never return secrets to client).
- [ ] **Step 1:** Implement `initiateZiinaRefund({ paymentIntentId, operationId, amountMinor, currency, test })` per Ziina OpenAPI `/refund`.
- [ ] **Step 2:** In refund route, if `payment.provider === "ziina"`, call Ziina instead of Paddle; same post-DB status semantics as Paddle branch today (`refund_pending`, audit).
- [ ] **Step 3:** If Ziina refund fails, return `jsonError`; map **`ZiinaProviderError`** to HTTP status / `details` similarly to **`PaddleProviderError`** in the Paddle branch.

---

## Wave G — Tests, docs, verification

### Task G1: Unit tests

**Files:**

- Create: `lib/payments/payment-event-hash.test.ts` (Wave A2 — required).
- Create: `lib/payments/apply-payment-webhook-event.test.ts` **or** `tests/…` integration — Vitest picks up any `**/*.test.ts`.

**Strategy (pick what ships fastest without blocking the epic):**

- **Minimum:** colocated tests for **`computePaymentEventPayloadHash`**, **`normalizePaddleWebhookToEvent` / Ziina parser** (fixtures from sanitized real payloads), and a **thin test** that R8 guard + “no insert on mismatch” is invoked **before** dedupe insert (can live in route handler test with mocked `tx` if needed).
- **`applyPaymentWebhookEvent` full table:** if mocking Drizzle + `retainRequiredDocuments` is heavy, use **one** focused integration test against test DB **or** inject small ports/callbacks for audit/doc side effects (implementation choice—document in PR).

- [ ] **Step 1:** Table-driven tests where feasible: first `payment_completed` applies paid; duplicate hash → **no** second `apply` side effects; amount mismatch sets `admin_attention_required`; **R8 / provider mismatch** → **no** `payment_event` insert (when testing route) or **no** application mutation (when testing `apply` with forced mismatch).
- [ ] **Step 2:** `payment_failed` clears checkout lock like Paddle route today.

### Task G2: Env documentation

**Files:**

- Modify: env template / `netlify-env` rule / `AGENTS.md` pointer — minimal table: `PAYMENT_PROVIDER`, Ziina vars, Paddle vars, webhook secrets.

### Task G3: Verification commands (before merge claim)

- [ ] `pnpm test:ci` (repo: **`vitest run`**) for touched tests.
- [ ] `pnpm lint` / `pnpm tsc --noEmit` as per repo standard.
- [ ] Manual: `PAYMENT_PROVIDER=paddle` full checkout regression.
- [ ] Manual: `PAYMENT_PROVIDER=ziina` test intent + webhook delivery (staging).

---

## Stretch (explicitly out of default checklist)

- [ ] Two-phase checkout transaction (spec §7.2.1 option 2) for lower lock hold time.
- [ ] Unified **`refund.completed` / `refund.status.updated`** for Paddle + Ziina (spec §7.6 elevated option).
- [ ] Metrics beyond logs (_counters_).

---

## Risk register (implementation)

| Risk | Mitigation in PR |
|------|-------------------|
| Hash prefix breaks replay of old Paddle events mid-flight | Deploy in low-traffic window; accept duplicate processing only if Paddle resends old body (rare). |
| Ziina webhook payload shape differs from docs | Log `rawEventType` + store raw snippet size-limited; feature-flag kill switch `PAYMENT_PROVIDER=paddle`. |
| No safe absolute HTTPS base for return URLs | Fail checkout with **`PAYMENT_PROVIDER_ERROR`** / clear message when neither **`APP_BASE_URL`** (preferred) nor a documented fallback can build Ziina success/cancel/failure URLs. |
| Ziina HTTP hangs | **`AbortController`** timeout < DB timeout; map to **`ZIINA_UNAVAILABLE`** (**502**). |

---

## Commit strategy

- **Commit 1:** Wave A (schema + hash + types) — small, reversible.
- **Commit 2:** Wave B (extract apply + Paddle uses new hash) — behavior parity critical.
- **Commit 3:** Wave C (`resolve-payment-provider` + checkout + client + **Task C4** cancel verification).
- **Commit 4:** Wave D + E + F + G in logical chunks or one feature branch per wave.

---

**Draft status:** Ready for your review. Edit this file directly for scope tweaks (e.g. rename checkout button component, exact return URL paths, or stretch tasks). After approval, implementers should tick checkboxes in order and reference the spec for normative behavior.
