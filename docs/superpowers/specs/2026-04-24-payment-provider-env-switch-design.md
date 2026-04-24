# Payment provider env switch (Paddle | Ziina)

**Status:** Draft for review  
**Date:** 2026-04-24  
**Related:** [2026-04-18-phase3-paddle-admin-design.md](./2026-04-18-phase3-paddle-admin-design.md), `visa-payments-paddle` skill, [Ziina custom integration](https://docs.ziina.com/developers/custom-integration)

## 1. Purpose

Introduce a **single active payment provider** per deployment, selected by **environment configuration**, without scattering provider logic across the app. **Paddle** and **Ziina** each keep a dedicated implementation module. **Ziina v1** optimizes for speed: **hosted redirect** checkout (user leaves the apply site briefly); **robustness** comes from **server-side webhooks** as the source of truth (same principle as today’s Paddle flow).

## 2. Goals

- One env-controlled switch (e.g. `PAYMENT_PROVIDER=paddle|ziina`) determines which implementation runs for **checkout creation**, **webhook processing**, and **admin refund initiation**.
- Reuse existing **domain invariants**: price quote lock at checkout start, `payment` + `payment_event` rows, idempotent transitions, application `paymentStatus` / `checkoutState` / post-paid side effects aligned with current Paddle behavior.
- **Ziina:** create payment intent server-side, persist **payment intent id**, return **redirect URL** to the client; confirm pay/fail via **Ziina webhooks** (not success URL alone).
- **Paddle:** preserve current behavior (overlay checkout, Paddle webhooks, admin refund) when the switch is `paddle`.

## 3. Non-goals (YAGNI)

- Choosing provider **per checkout** or **per user** (only global env switch in v1).
- Ziina **embedded** iframe checkout (requires domain verification + Ziina approval; deferred).
- Partial refunds for Ziina unless Ziina API and admin UI already align with existing “full refund only” MVP for Paddle.
- Runtime hot-switching without redeploy (config is read at process start).
- Abstracting **Paddle’s** public SDK types through a single mega-interface that hides all provider-specific shapes; instead use a **small shared core** plus **provider modules** that return explicit discriminated results.

## 4. Current context (repo)

- `POST /api/checkout` runs an atomic transaction: checkout lock on `application`, `price_quote` insert, `payment` insert with **`provider: "paddle"`** hardcoded, `paddleAdapter.createCheckout`, stores **`provider_checkout_id`** = Paddle transaction id.
- Client: `PaddleCheckoutButton` → `Paddle.Checkout.open({ transactionId })`.
- `POST /api/webhooks/paddle`: signature verification, parse event, dedupe via **`payment_event.payload_hash`**, resolve `payment` by checkout/txn id or metadata, update `payment` / `application` / audit / doc retention.
- Admin: `POST /api/admin/applications/[id]/refund` uses **`paddleAdapter`** and **`provider_transaction_id`**.
- `lib/payments/types.ts` defines **`PaymentProvider`** but it is **Paddle-shaped** (`transactionId` + `clientToken`, Paddle webhook parse shape, `PaddleRefundReason`).

## 5. Requirements

| ID | Requirement |
|----|-------------|
| R1 | Exactly one “active” provider per deployment, driven by env; misconfiguration (active Ziina but missing Ziina secrets) must fail fast at checkout/webhook with clear logs, not silent wrong-provider behavior. |
| R2 | `payment.provider` must reflect the provider used for that row (`paddle` \| `ziina`). |
| R3 | Checkout API returns a **discriminated** payload so the client can render the correct UX without inferring from optional fields. |
| R4 | **Webhooks are authoritative** for `paid` / `failed` (and refund completion if applicable). Success/cancel **redirect** is for UX only. |
| R5 | Ziina webhooks: verify **HMAC** (`X-Hmac-Signature` vs raw body) when `ZIINA_WEBHOOK_SECRET` is set; optionally enforce **sender IP allowlist** per Ziina docs (document trade-off: strict IP vs proxies). |
| R6 | Idempotency: reuse **`payment_event`** unique **`payload_hash`**; Ziina events need a stable hash of canonical body (raw string preferred). |
| R7 | Admin refund: branch on **`payment.provider`**; Ziina path calls Ziina refund API with correct ids/amount/currency; audit trail preserved. |

## 6. Approaches considered

### A. Thin router + fat providers (recommended)

**Idea:** `getActivePaymentConfig()` reads env. `lib/payments/registry.ts` (or similar) exports `getCheckoutAdapter()`, `getWebhookVerifierForPath()`, `getRefundAdapter()`. Each provider module implements the same **narrow internal contracts** (checkout session result, normalized webhook event, refund call). Shared module **`applyPaymentWebhookEvent(tx, normalized)`** contains the state machine currently embedded in `webhooks/paddle/route.ts`.

**Pros:** Clear boundaries; Paddle file shrinks to verification + normalize + delegate; Ziina adds parallel files; tests can target `applyPaymentWebhookEvent` with synthetic normalized events.  
**Cons:** One refactor pass to extract shared webhook logic from the existing Paddle route.

### B. Single `PaymentProvider` interface forcing all methods

**Idea:** Expand one interface until Paddle and Ziina both satisfy it.

**Pros:** One type name.  
**Cons:** Leaky abstractions (`verifyWebhookSignature` signatures differ); fake “unified” event types obscure real payloads; harder to maintain.

### C. Separate top-level API routes only (no shared webhook core)

**Idea:** Copy-paste Paddle webhook state machine into `webhooks/ziina`.

**Pros:** Fast first paste.  
**Cons:** Drift risk; duplicate bugs; violates DRY for invariants (amount check, resurrection guard, doc retention).

**Recommendation:** **A** — thin registry + shared `applyPaymentWebhookEvent` + provider-specific verify/normalize.

## 7. Architecture

### 7.1 Configuration

- **`PAYMENT_PROVIDER`**: `paddle` (default for backward compatibility) \| `ziina`.
- **Paddle:** existing `PADDLE_*`, `NEXT_PUBLIC_PADDLE_*` unchanged.
- **Ziina:** `ZIINA_API_BASE_URL` default `https://api-v2.ziina.com/api`, `ZIINA_ACCESS_TOKEN`, optional `ZIINA_WEBHOOK_SECRET`, optional `ZIINA_ENFORCE_WEBHOOK_IP_ALLOWLIST=true|false` (default **false** in dev, **true** in prod recommendation documented with caveat for unusual proxies).

Startup / first request: if `PAYMENT_PROVIDER=ziina`, require Ziina vars; do not require Paddle keys unless provider is paddle (document matrix in Netlify/env docs when implemented).

### 7.2 Checkout (`POST /api/checkout`)

1. Resolve active provider from env.
2. Unchanged: access control, checkout lock, pricing, `price_quote` insert, `payment` insert with **`provider`** = active value, `status: checkout_created`, `application.payment_status` update.
3. Call **provider checkout module**:
   - **Paddle:** current `paddleAdapter.createCheckout` → store `provider_checkout_id` = transaction id → response `{ provider: "paddle", transactionId, clientToken }`.
   - **Ziina:** `POST /payment_intent` with `amount` (minor units), `currency_code`, `message` (e.g. service label), **`success_url` / `cancel_url` / `failure_url`** built from `NEXT_PUBLIC_APP_URL` (or dedicated `APP_BASE_URL`) + routes that include **`{PAYMENT_INTENT_ID}`** substitution per Ziina docs, **`test: true`** when env says sandbox/test. Store **`provider_checkout_id`** = payment intent **id** from response. Return **`{ provider: "ziina", redirectUrl }`** (from `redirect_url` field).

**Idempotency / retries:** Ziina supports **`operation_id`** (client UUID); generate once per payment row attempt and send on create to safe retries (specify in implementation plan).

### 7.3 Client UX

- **`PaddleCheckoutButton`:** unchanged when response is `paddle` (overlay).
- **Ziina:** new small component or branch inside apply panel: on `ziina`, **`window.location.href = redirectUrl`** (or link with same effect). **`onOverlayClosed`-style refetch:** on return pages (`/apply/.../payment-return` or reuse submitted flow with query params), refetch application; **do not** treat query param “success” as paid—only **`paymentStatus === "paid"`** from API after webhook.

### 7.4 Return URLs (Ziina redirect)

- Dedicated **return routes** (exact paths in implementation plan): e.g. success and cancel pages under `apply/applications/[id]/…` that show “Processing…” vs “Cancelled / try again” and poll **`GET`** application until paid or timeout.
- URLs must be **https** in production for Ziina.

### 7.5 Webhooks

- **Keep** `POST /api/webhooks/paddle` for Paddle (URL stable for existing dashboard config).
- **Add** `POST /api/webhooks/ziina` for Ziina.
- **Pipeline:** raw body string → **provider verify** (Paddle signature vs Ziina HMAC + optional IP) → **provider parse** → **`NormalizedPaymentWebhookEvent`** (internal type: at minimum `provider`, `kind` e.g. `payment_completed` \| `payment_failed`, `providerPaymentId`, `amountMinor`, `currency`, `metadata` map with `applicationId` when available) → **payload hash** → insert `payment_event` ON CONFLICT DO NOTHING → if new, **`applyPaymentWebhookEvent(tx, event)`**.

**Ziina event:** `payment_intent.status.updated` — map `completed` → same branch as Paddle `transaction.paid` / `transaction.completed`; map terminal failure/cancel to align with `transaction.payment_failed` behavior (`payment.failed`, release `checkout_state`, etc.). Parser must read Ziina **`data`** shape from docs and extract intent id + status + amounts for verification against `payment` row.

### 7.6 Refunds

- Admin refund route: after loading latest `payment` for application, **`switch (payment.provider)`**:
  - `paddle`: existing Paddle adjustment flow.
  - `ziina`: call Ziina **`POST /refund`** with persisted ids; handle **`refund.status.updated`** if Ziina sends it (webhook index mentions it); align `payment_status` / `payment.status` with existing refund semantics.

### 7.7 Observability and safety

- Structured logs: `payment_provider`, `application_id`, `payment_id`, never log secrets or full PAN.
- Amount mismatch: same **`admin_attention_required`** pattern as Paddle webhook when event amount ≠ quoted `payment.amount`.
- Ziina test mode: env **`ZIINA_TEST_MODE=true`** maps to `test: true` on intent (and refund if applicable).

## 8. Data model

- **No migration required for v1** if `payment.provider` remains free text and both `paddle` / `ziina` values are allowed.
- **Optional follow-up:** check constraint or enum in DB for `provider` — out of scope unless desired for safety.

**Field mapping (Ziina):**

| Column | Ziina meaning |
|--------|----------------|
| `provider_checkout_id` | Payment intent id (created) |
| `provider_transaction_id` | Set when webhook confirms paid to same intent id (or Ziina’s canonical “completed” id if distinct — **implementation must verify API response** and document actual field) |

## 9. Security

- Secrets only on server; Ziina token never exposed to client.
- Webhook: HMAC verification mandatory when secret configured; document IP allowlist option and operational risk of spoofing if disabled.
- CSRF: return pages are GET; do not trust them for state changes.

## 10. Testing strategy

- Unit tests: `applyPaymentWebhookEvent` with normalized events (paid, failed, duplicate payload, amount mismatch, cancelled application).
- Integration (manual or e2e): Ziina test intent + test cards / `test: true` per Ziina docs.
- Regression: full Paddle checkout path unchanged when `PAYMENT_PROVIDER=paddle`.

## 11. Rollout

1. Ship refactor extracting shared webhook core + registry with **only Paddle** wired (no behavior change).
2. Add Ziina modules + webhook route behind env; staging uses `ziina` + test mode.
3. Production: set env per region/product line as needed.

## 12. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Drift between two webhook parsers | Normalized event type + single `applyPaymentWebhookEvent`. |
| User lands on success URL before webhook | Return page polls API; copy explains delay. |
| Wrong env in production | Document env matrix; optional startup assert. |
| Ziina webhook body shape changes | Version lock in client; monitor Ziina changelog; log raw type field. |

## 13. Open decisions (defaults suggested)

1. **IP allowlist for Ziina webhooks:** Recommended **on** in production if infrastructure uses predictable egress; **off** in local dev. Document in env template.
2. **Exact return routes:** Product choice between minimal “return to draft panel” vs dedicated interstitial pages — **default:** dedicated **`…/checkout/return`** and **`…/checkout/cancel`** under apply for clear polling UX.
3. **`operation_id` for Ziina:** **Default:** generate UUID per `payment` row at insert, store in memory for request only vs persist — **persist** on `payment` table only if a column exists; if not, pass deterministic hash from `payment.id` as UUID v5 — **prefer** storing `ziina_operation_id` in `payment` only if migration acceptable; else use **`payment.id`** mapped to UUID format or add nullable column `provider_operation_id` in a small migration. **Spec recommendation:** add optional **`provider_operation_id`** text column for clean Ziina retries (implementation plan decides).

---

## 14. Approval checklist (brainstorming gate)

- [ ] Product accepts redirect-away UX for Ziina v1.
- [ ] Engineering accepts refactor extracting shared webhook application logic.
- [ ] Ops accepts env matrix and Ziina webhook URL registration (`/api/webhooks/ziina`).

**Next step after approval:** Use **writing-plans** skill to produce `docs/superpowers/plans/2026-04-24-payment-provider-env-switch-implementation.md` with file-by-file tasks.
