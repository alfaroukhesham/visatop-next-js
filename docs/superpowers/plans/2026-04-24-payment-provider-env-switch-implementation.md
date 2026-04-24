# Payment provider env switch (Paddle | Ziina) — Implementation plan (draft)

> **For agentic workers:** Use **subagent-driven-development** or **executing-plans** to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an env-controlled single active payment provider (`paddle` default | `ziina`), with shared webhook application logic, discriminated checkout API responses, Ziina **redirect** checkout + dedicated webhook route, and admin refund branching—without changing Paddle behavior when `PAYMENT_PROVIDER=paddle`.

**Architecture:** Extract **`applyPaymentWebhookEvent`** + **`NormalizedPaymentWebhookEvent`** from the Paddle webhook route; add **`computePaymentEventPayloadHash(provider, rawBody)`** per spec §5.3; introduce **`lib/payments/registry.ts`** (or `resolve-payment-provider.ts`) to select checkout + refund implementations; keep **two webhook URLs** (`/api/webhooks/paddle`, `/api/webhooks/ziina`). Client uses **`jsonOk` discriminated `data`** (§5.1).

**Tech stack:** Next.js App Router, Drizzle, Neon, existing `jsonOk`/`jsonError` (`lib/api/response.ts`), Paddle SDKs unchanged, Ziina REST (`fetch` to `ZIINA_API_BASE_URL`), Vitest.

**Spec:** [2026-04-24-payment-provider-env-switch-design.md](../specs/2026-04-24-payment-provider-env-switch-design.md)

**Scope decisions (locked for this plan):**

| Topic | Choice |
|-------|--------|
| Checkout DB boundary | **Keep single transaction** including provider HTTP (spec §7.2.1 option 1) for v1—same as today. Document HTTP timeout < DB timeout. |
| `payment_event.payload_hash` | **Prefix rule for both providers** from release: `sha256(provider + "\n" + rawBody)` hex. Coordinate deploy so in-flight Paddle retries during cutover are acceptable. |
| Refund completion | **Baseline §7.6:** Ziina admin refund mirrors Paddle (API call + `refund_pending`); **no** new `refund.completed` handling for Paddle in this epic unless explicitly added as a stretch task. |
| `provider_operation_id` | **Add column** + wire on Ziina create intent (spec §8). |

---

## File map (create / modify)

| Path | Responsibility |
|------|------------------|
| `drizzle/NNNN_payment_provider_operation_id.sql` | Add `payment.provider_operation_id` nullable `text`. |
| `lib/db/schema/payments.ts` | New column `providerOperationId`. |
| `lib/payments/payment-event-hash.ts` | `computePaymentEventPayloadHash(provider: "paddle" \| "ziina", rawBody: string): string` (hex SHA-256). |
| `lib/payments/normalized-webhook.ts` | `NormalizedPaymentWebhookEvent` type + `PaymentWebhookKind` enum/union. |
| `lib/payments/apply-payment-webhook-event.ts` | Core state machine (moved from paddle route); **R8** provider check; uses normalized event only. |
| `lib/payments/resolve-payment-provider.ts` | Read `PAYMENT_PROVIDER`, validate env, export `getActivePaymentProviderKind()`, `assertZiinaConfig()`, etc. |
| `lib/payments/ziina-client.ts` | `createPaymentIntent`, `createRefund` (thin fetch wrappers + errors). |
| `lib/payments/ziina-webhook.ts` | `verifyZiinaWebhook(req, rawBody)`, `parseZiinaWebhookToNormalized(rawBody)`. |
| `lib/payments/checkout-types.ts` (or extend `types.ts`) | Exported **`CheckoutSessionData`** union for API + client. |
| `lib/payments/paddle-adapter.ts` | No behavioral change; optionally re-export or narrow types. |
| `app/api/checkout/route.ts` | Branch on provider; insert `payment.provider`; Ziina success URLs; return discriminated `data`. |
| `app/api/webhooks/paddle/route.ts` | Verify + parse Paddle → normalized; **new hash**; delegate `applyPaymentWebhookEvent`. |
| `app/api/webhooks/ziina/route.ts` | **New** — verify HMAC + optional IP; parse → normalized; delegate. |
| `app/api/admin/applications/[id]/refund/route.ts` | Branch `payment.provider` → Paddle vs Ziina refund. |
| `components/apply/paddle-checkout-button.tsx` | Narrow `envelope.data` by `provider`; handle `ziina` with redirect. **Rename** is optional (e.g. `ApplicationCheckoutButton`); YAGNI: keep filename, branch inside, or add `ziina-redirect-checkout.tsx` imported by panel. |
| `components/apply/application-draft-panel.tsx` | Pass provider from checkout response or read from env is wrong—**must** use server response `data.provider`. |
| `app/(client)/apply/applications/[id]/checkout/return/page.tsx` (path TBD) | Success interstitial + polling. |
| `app/(client)/apply/applications/[id]/checkout/cancel/page.tsx` | Cancel UX + link back. |
| `lib/api/response.ts` | Extend `ApiErrorCode` with codes used at checkout/webhook (e.g. `PAYMENT_PROVIDER_ERROR`, `SERVICE_UNAVAILABLE` already exists—reuse or add narrow codes). |
| `.cursor/rules/netlify-env.mdc` or `README` / internal env doc | Env matrix (pointer to spec §16). |
| `lib/payments/__tests__/apply-payment-webhook-event.test.ts` (or `tests/…`) | Unit tests for core. |

---

## Wave A — Schema + hash primitive + types

### Task A1: Migration `provider_operation_id`

**Files:**

- Create: `drizzle/NNNN_payment_provider_operation_id.sql` (use next sequential number after latest in `drizzle/`)
- Modify: `lib/db/schema/payments.ts`

- [ ] **Step 1:** List `drizzle/` migrations; pick next id `NNNN`.
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

**Files:**

- Create: `lib/payments/apply-payment-webhook-event.ts`
- Modify: `app/api/webhooks/paddle/route.ts` (thin wrapper)

- [ ] **Step 1:** Copy paid / failed / audit / doc retention / resurrection / amount-mismatch logic from `paddle/route.ts` into `applyPaymentWebhookEvent(tx, event, ctx)` where `ctx` includes at least `provider: "paddle"` for assertion, `requestId`, raw `providerEventId` for inserts.
- [ ] **Step 2:** After loading `payRow`, **assert** `payRow.provider === event.provider`; on mismatch log + audit stub + **return** early without mutation (R8).
- [ ] **Step 3:** Replace `crypto.createHash("sha256").update(bodyText)` with `computePaymentEventPayloadHash("paddle", bodyText)` for `payment_event` insert.
- [ ] **Step 4:** Paddle route: verify signature → parse to normalized (new small `paddle-webhook-normalize.ts` or inline in route) → hash → insert event → call `applyPaymentWebhookEvent`.
- [ ] **Step 5:** Manual test: Paddle sandbox checkout still completes; duplicate webhook still no-ops.

### Task B2: Paddle → normalized parser

**Files:**

- Create: `lib/payments/paddle-webhook-normalize.ts` (optional file) OR keep in route

- [ ] **Step 1:** Map existing `paddleAdapter.parseWebhookEvent` output + raw JSON to `NormalizedPaymentWebhookEvent` (`provider: "paddle"`, `rawEventType` = `event_type`, `providerEventId` from `event_id`).
- [ ] **Step 2:** Map `transaction.completed` / `transaction.paid` → `payment_completed`; `transaction.payment_failed` → `payment_failed`.

---

## Wave C — Registry + checkout API + client (Paddle default unchanged)

### Task C1: `resolve-payment-provider`

**Files:**

- Create: `lib/payments/resolve-payment-provider.ts`

- [ ] **Step 1:** `getActivePaymentProvider(): "paddle" | "ziina"` — default `"paddle"` if unset.
- [ ] **Step 2:** `getZiinaConfig()` throws or returns `Result` with clear error for checkout when `ZIINA_ACCESS_TOKEN` missing and provider is `ziina`.
- [ ] **Step 3:** Log selected provider once at cold path (avoid per-request spam) if useful.

### Task C2: Checkout union + `POST /api/checkout`

**Files:**

- Create: `lib/payments/checkout-types.ts` — `export type CheckoutSessionData = …` (spec §5.1)
- Modify: `app/api/checkout/route.ts`

- [ ] **Step 1:** On insert, set `provider: getActivePaymentProvider()` instead of hardcoded `"paddle"`.
- [ ] **Step 2:** If `paddle`: existing flow; `jsonOk` data `{ provider: "paddle", transactionId, clientToken }`.
- [ ] **Step 3:** If `ziina`: generate `operationId` UUID; persist to `payment.providerOperationId` before HTTP call; build success/cancel/failure URLs with `{PAYMENT_INTENT_ID}` placeholder per Ziina docs; `fetch` `POST …/payment_intent`; on success set `provider_checkout_id` from response id; `jsonOk` `{ provider: "ziina", redirectUrl }`.
- [ ] **Step 4:** Map Ziina 4xx/5xx to `jsonError` with codes per spec §5.1 / §5.4 (transaction rolls back on throw inside tx).
- [ ] **Step 5:** Extend `ApiErrorCode` if new codes are needed (`PAYMENT_PROVIDER_ERROR` etc.).

### Task C3: Client checkout button + panel

**Files:**

- Modify: `components/apply/paddle-checkout-button.tsx`
- Modify: `components/apply/application-draft-panel.tsx`

- [ ] **Step 1:** Parse `envelope.data.provider`; if `paddle`, existing Paddle path.
- [ ] **Step 2:** If `ziina`, `window.location.href = envelope.data.redirectUrl` (or `<a>` with same effect); keep loading state until navigation.
- [ ] **Step 3:** Panel: adjust copy for Ziina (“You will be redirected to complete payment”) if trivial; avoid env-based branching for provider (must use checkout response).

---

## Wave D — Ziina return pages (polling)

### Task D1: Return + cancel routes

**Files:**

- Create: `app/(client)/apply/applications/[id]/checkout/return/page.tsx`
- Create: `app/(client)/apply/applications/[id]/checkout/cancel/page.tsx` (or single page + `searchParams`)

- [ ] **Step 1:** Success route: read `applicationId` from params; client component polls same API used elsewhere for application detail (or extract shared hook); backoff 1s cap 2s; max ~120s; terminals `paid`, `failed`, `unpaid`/`checkout_created` per spec §7.4.
- [ ] **Step 2:** On `paid`, `router.replace` to existing submitted/thank-you flow as today.
- [ ] **Step 3:** Cancel page: copy + link back to `/apply/applications/[id]` (no trust of query for paid state).
- [ ] **Step 4:** Ensure guest/auth access matches existing application pages (reuse patterns from draft panel data loading).

---

## Wave E — Ziina webhook route

### Task E1: Verification + IP optional

**Files:**

- Create: `lib/payments/ziina-webhook.ts`
- Create: `app/api/webhooks/ziina/route.ts`

- [ ] **Step 1:** Read raw body as text; verify `X-Hmac-Signature` per spec §5.2 (fail closed prod without secret).
- [ ] **Step 2:** If `ZIINA_ENFORCE_WEBHOOK_IP_ALLOWLIST=true`, compare `x-forwarded-for` / socket remote against Ziina-published IPs (document header trust for Netlify).
- [ ] **Step 3:** Parse JSON; map `payment_intent.status.updated` → normalized `payment_completed` / `payment_failed` / ignore non-terminal updates as needed (mirror Paddle idempotency).
- [ ] **Step 4:** `computePaymentEventPayloadHash("ziina", rawBody)` → insert `payment_event` ON CONFLICT DO NOTHING → `applyPaymentWebhookEvent`.
- [ ] **Step 5:** Register URL in Ziina dashboard staging; manual test with test intent.

---

## Wave F — Admin refund branch

### Task F1: Ziina refund API

**Files:**

- Modify: `lib/payments/ziina-client.ts`
- Modify: `app/api/admin/applications/[id]/refund/route.ts`

- [ ] **Step 1:** Implement `initiateZiinaRefund({ paymentIntentId, operationId, amountMinor, currency, test })` per Ziina OpenAPI `/refund`.
- [ ] **Step 2:** In refund route, if `payment.provider === "ziina"`, call Ziina instead of Paddle; same post-DB status semantics as Paddle branch today (`refund_pending`, audit).
- [ ] **Step 3:** If Ziina refund fails, return `jsonError` with Paddle parity HTTP codes where sensible.

---

## Wave G — Tests, docs, verification

### Task G1: Unit tests

**Files:**

- Create: `lib/payments/__tests__/apply-payment-webhook-event.test.ts` (path per repo vitest convention)

- [ ] **Step 1:** Table-driven tests: first `payment_completed` applies paid; duplicate normalized+hash no-op; amount mismatch sets `admin_attention_required`; **provider mismatch** no-op + would audit (mock audit if heavy).
- [ ] **Step 2:** `payment_failed` clears checkout lock like Paddle route today.

### Task G2: Env documentation

**Files:**

- Modify: env template / `netlify-env` rule / `AGENTS.md` pointer — minimal table: `PAYMENT_PROVIDER`, Ziina vars, Paddle vars, webhook secrets.

### Task G3: Verification commands (before merge claim)

- [ ] `pnpm exec vitest run` (or project test command) for touched tests.
- [ ] `pnpm lint` / `pnpm tsc --noEmit` as per repo standard.
- [ ] Manual: `PAYMENT_PROVIDER=paddle` full checkout regression.
- [ ] Manual: `PAYMENT_PROVIDER=ziina` test intent + webhook delivery (staging).

---

## Checkout-cancel interaction (`checkout-cancel`)

- [ ] **Document / verify:** `POST …/checkout-cancel` remains valid for Ziina when user returns without paying and cancels in-app; does not conflict with webhook `canceled` (ordering: both idempotent toward unpaid/failed payment row—confirm exact `payment.status` values match product intent; align with spec §7.3.1).

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
| `NEXT_PUBLIC_APP_URL` missing | Fail checkout with clear `jsonError` when building Ziina return URLs. |

---

## Commit strategy

- **Commit 1:** Wave A (schema + hash + types) — small, reversible.
- **Commit 2:** Wave B (extract apply + Paddle uses new hash) — behavior parity critical.
- **Commit 3:** Wave C (registry + checkout + client).
- **Commit 4:** Wave D + E + F + G in logical chunks or one feature branch per wave.

---

**Draft status:** Ready for your review. Edit this file directly for scope tweaks (e.g. rename checkout button component, exact return URL paths, or stretch tasks). After approval, implementers should tick checkboxes in order and reference the spec for normative behavior.
