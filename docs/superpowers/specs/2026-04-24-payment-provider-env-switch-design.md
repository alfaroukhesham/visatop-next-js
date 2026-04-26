# Payment provider env switch (Paddle | Ziina)

**Status:** Implementation-ready draft (post-review)  
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
- **Partial refunds** for any provider in this release remain **out of scope** (admin and types today are full-refund MVP). The `visa-payments-paddle` skill’s “support full/partial” line should be **reconciled in-repo** when partial refunds ship (doc/skill amendment), not in this project’s first env-switch PR unless explicitly pulled in.
- Runtime hot-switching without redeploy (config is read at process start).
- Abstracting **Paddle’s** public SDK types through a single mega-interface that hides all provider-specific shapes; instead use a **small shared core** plus **provider modules** that return explicit discriminated results.

## 4. Current context (repo) — honest baseline

- `POST /api/checkout` runs an **atomic DB transaction** that includes **external** `paddleAdapter.createCheckout` (Paddle HTTP) **before commit**, while checkout lock (`application.checkout_state = pending`) is held. See **§7.2.1** for transaction-boundary rules.
- `payment.provider` is today effectively always **`paddle`** (hardcoded at insert).
- Client: `PaddleCheckoutButton` posts checkout, expects **`jsonOk` envelope** (`ok`, `data`, `error`) — see **§5.1**.
- `POST /api/webhooks/paddle`: signature verification, parse, **`payment_event`** dedupe via **`payload_hash`**, resolve `payment`, apply paid/failed paths. **`refund.completed`** appears in `lib/payments/types.ts` as a possible parsed type but **is not applied** in the webhook route today (no transition from `refund_pending` off webhook).
- Admin: `POST /api/admin/applications/[id]/refund` calls Paddle, sets application/payment into **`refund_pending`** (or equivalent) — **terminal refunded state is not webhook-driven for Paddle in current code**.
- Client cancel: `POST /api/applications/[id]/checkout-cancel` (see `application-draft-panel.tsx`) resets checkout when user cancels from **your** UI; Ziina users may abandon on the host — **§7.3.1**.
- `lib/payments/types.ts` **`PaymentProvider`** is Paddle-shaped and only `paddleAdapter` implements it.

## 5. Requirements

| ID | Requirement |
|----|-------------|
| R1 | Exactly one active provider per deployment; misconfiguration fails fast with clear logs and **documented HTTP + envelope** (see **§5.4**). |
| R2 | `payment.provider` reflects the provider used (`paddle` \| `ziina`). |
| R3 | Checkout success response uses existing **`jsonOk` envelope**; **`data`** is a **discriminated union** by `provider` (see **§5.1**). |
| R4 | Webhooks are authoritative for **paid** / **failed** capture paths. Success/cancel **redirect** is UX-only. |
| R5 | Ziina webhooks: verify per **§5.2**; optional IP allowlist per env. |
| R6 | Idempotency: **`payment_event.payload_hash`** input per **§5.3** (never hash normalized-only JSON without provider binding). |
| R7 | Admin refund: branch on `payment.provider`; Ziina calls Ziina refund API. **Refund terminal semantics:** see **§7.6** (baseline vs unified). |
| R8 | **Provider integrity:** after resolving `payment`, `payment.provider` must equal **route-implied or event-carried** provider; else **reject** (401/400), **no state change**, **audit log** (see **§7.2.2**). Optional strengthener: metadata/quote match when provider supports it. |
| R9 | **Correlation:** Paddle keeps custom metadata on checkout. Ziina **create payment intent** OpenAPI (current docs) does **not** expose arbitrary metadata fields — correlation is **`provider_checkout_id` === intent id** from the **signed** webhook, plus amount/currency checks against `payment` / `price_quote`. If Ziina adds metadata later, implementation may add optional equality checks. If product later requires tamper-evident return URLs, add a **signed return token** or short-lived **nonce** row (out of v1 unless required). |
| R10 | **Checkout cancel:** in-app cancel API behavior must be documented relative to Ziina abandon path (**§7.3.1**). |

### 5.1 Checkout API wire format (`jsonOk` / `jsonError`)

Clients today assume an envelope, not raw provider payloads.

**Success (`jsonOk`):** `data` MUST be exactly one of:

```ts
// Discriminated by `provider` — implement as TS union + runtime narrow
type CheckoutData =
  | { provider: "paddle"; transactionId: string; clientToken: string }
  | { provider: "ziina"; redirectUrl: string };
```

**Errors:** On validation/access errors, unchanged `jsonError` behavior. When **`PAYMENT_PROVIDER=ziina`** but Ziina is misconfigured (missing token, bad base URL) or Ziina returns a **non-retryable** client error after DB work:

- Define **`error.code`** (e.g. `PAYMENT_PROVIDER_ERROR`, `ZIINA_UNAVAILABLE`) and HTTP status (**502** upstream, **503** if intentionally unavailable).
- **If provider HTTP runs inside the same DB transaction as today:** Drizzle rolls back the whole transaction — **`checkout_state`** and **`payment`** rows are not left half-applied (current Paddle pattern).
- **If implementation later splits phases** (see **§7.2.1**): spec requires explicit **cleanup** of `checkout_created` / `checkout_state` stale rows and user-visible retry — document in implementation plan.

### 5.2 Ziina webhook HMAC (R5) — implementation contract

Per [Ziina webhooks](https://docs.ziina.com/api-reference/webhook/index): when a **secret** was configured at webhook registration, requests include **`X-Hmac-Signature`**: **hex-encoded HMAC-SHA256** of the **raw request body** (same bytes verified as received; no JSON re-serialization).

| Environment | `ZIINA_WEBHOOK_SECRET` set | Behavior |
|-------------|----------------------------|----------|
| Production | Yes | Reject request if HMAC invalid (**401**). |
| Production | No | **Fail closed:** reject (**401** or **503** with code `webhook_secret_not_configured`) — no application of events. |
| Development | No | May allow **dev-only** bypass behind explicit `ZIINA_WEBHOOK_ALLOW_UNSIGNED=true` (default false); log **CRITICAL** if used. |

**Replay:** If Ziina documents timestamped signatures or replay windows, implementation MUST follow vendor spec; if not documented, log **`providerEventId`** / hash dedupe provides idempotency only (not replay attack prevention beyond duplicate delivery).

**IP allowlist:** Optional; if enabled, reject non-allowlisted source IPs per Ziina docs. Document proxy caveats.

### 5.3 `payment_event.payload_hash` (R6)

**Rule:** `payload_hash = sha256_hex(provider + "\n" + rawBody)` where **`provider`** is the literal string `paddle` or `ziina`, and **`rawBody`** is the exact webhook POST body string used for signature verification.

- **Paddle migration note:** today’s Paddle path hashes **raw body only**; when touching this code, **migrate** existing dedupe to the prefixed form **or** keep Paddle on legacy hash until a one-time migration job — **implementation plan must pick one** and avoid dual-write ambiguity. Recommended: **new prefix rule for both** from env-switch release, accept that old Paddle events are not re-playable for dedupe collision (negligible if deploy is coordinated).

**Forbidden:** hashing only a normalized JSON projection for storage (collision risk across providers).

### 5.4 Misconfiguration matrix (R1)

| `PAYMENT_PROVIDER` | Missing vars | Checkout | Webhook receiver |
|--------------------|--------------|----------|-------------------|
| `paddle` | `PADDLE_API_KEY` / client token | Fail with `jsonError`, no partial DB commit if tx includes provider call | Paddle route returns 401 on bad signature |
| `ziina` | `ZIINA_ACCESS_TOKEN` | Fail fast `jsonError` with code | Ziina route fail closed per §5.2 |

## 6. Approaches considered

### A. Thin router + fat providers (recommended)

**Idea:** `getActivePaymentConfig()` reads env. `lib/payments/registry.ts` (or similar) exports checkout creation, **per-route** webhook verify+normalize (see below), refund initiation. Shared **`applyPaymentWebhookEvent(tx, normalized)`** owns the state machine now in `webhooks/paddle/route.ts`.

**Webhook routing:** **No** single URL that dynamically picks provider from payload — **two routes** (`/api/webhooks/paddle`, `/api/webhooks/ziina`) so misconfiguration cannot route a Paddle payload through Ziina verification.

**Pros:** Clear boundaries; tests target `applyPaymentWebhookEvent` with synthetic normalized events.  
**Cons:** One refactor to extract shared webhook logic.

### B. Single `PaymentProvider` mega-interface — not recommended

### C. Duplicated Ziina webhook handler — not recommended

**Recommendation:** **A**.

## 7. Architecture

### 7.1 Configuration

- **`PAYMENT_PROVIDER`**: `paddle` (default) \| `ziina`.
- **Paddle:** existing env vars unchanged.
- **Ziina:** `ZIINA_API_BASE_URL` (default `https://api-v2.ziina.com/api`), `ZIINA_ACCESS_TOKEN`, `ZIINA_WEBHOOK_SECRET` (required prod), `ZIINA_ENFORCE_WEBHOOK_IP_ALLOWLIST`, `ZIINA_TEST_MODE` → `test: true` on intents/refunds as applicable.

Pin **base URL** in config; document upgrade path when Ziina versions API.

### 7.2 Checkout (`POST /api/checkout`)

1. Resolve active provider from env.
2. Access control, pricing resolution, unchanged business rules.
3. DB: checkout lock, `price_quote`, `payment` (`provider` = active), `application.payment_status` / `checkout_state` per existing semantics.

#### 7.2.1 External provider call and DB transaction boundary

**Today:** Paddle `createCheckout` runs **inside** the same transaction as inserts. **Implications:** long lock hold if Paddle/Ziina is slow; on provider **timeout**, entire transaction rolls back — **good** for consistency, **bad** for lock contention.

**Spec options (implementation plan picks one and documents):**

1. **Status quo (v1 acceptable):** Keep single transaction including provider HTTP; document **SLO** (“provider create must complete within N s”) and monitor; ensure HTTP client timeouts < DB statement timeout to avoid orphan locks.
2. **Two-phase (recommended for scale follow-up):** Short tx: lock + quote + `payment` in **`creating_provider_session`** (new status) or reuse `checkout_created` with explicit sub-state; commit; call provider; second tx attaches `provider_checkout_id` or marks **`failed`** with cleanup. Requires **stale cleanup** job or TTL for abandoned rows.

**Rollback:** If Ziina returns 5xx **inside** single-tx model, full rollback — no `payment` row. If two-phase, spec **§5.1** error semantics + user retry copy.

#### 7.2.2 Provider integrity (R8)

Immediately after resolving `payment` row (by ids / fallback rules):

1. Assert **`payment.provider === normalizedEvent.provider`** where `normalizedEvent.provider` is set from the **route** (`paddle` \| `ziina`), not from client-supplied webhook JSON alone.
2. On mismatch: **log + audit**, return **401** or **400**; **no** `payment` / `application` updates.

Optional: if provider payload includes structured metadata and Ziina gains parity, assert **`priceQuoteId` / `applicationId`** match the `payment` row.

### 7.3 Client UX

- **Paddle:** unchanged overlay when `data.provider === "paddle"`.
- **Ziina:** redirect to `data.redirectUrl`; return pages poll API (**§7.4**).

#### 7.3.1 Cancel and abandon

- **In-app cancel:** `POST /api/applications/[id]/checkout-cancel` today marks **`checkout_created`** payment / resets checkout — keep for Ziina when user returns **without** paying and hits cancel in your UI.
- **Ziina host abandon:** user may never hit your cancel API. **Authoritative** release of `checkout_created` / failure semantics comes from **Ziina webhook** terminal statuses (`failed`, `canceled`, etc.) mapped like Paddle **`transaction.payment_failed`**. Cancel URL on the intent is **UX alignment** (show “cancelled”) — **not** required to duplicate server state if webhook will follow; if webhook is delayed, return page polling (**§7.4**) still applies.

### 7.4 Return URLs and polling contract (Ziina)

- Routes under `apply/applications/[id]/…` (exact paths in implementation plan): **success** and **cancel/failure** interstitials.
- **Polling:** `GET` the same application fetch API the draft panel uses (or dedicated lightweight status endpoint if added), interval with **backoff** (e.g. 1s → 2s cap), **max duration** (e.g. 120s product-tunable), then show **timeout** copy (“Payment may still be processing; refresh or contact support”) with **support** path.
- **Terminal states:** `paid` → redirect to success UX; `failed` / back to unpaid per product rules; still **`checkout_created`** at timeout → message + link back to draft.
- **Auth:** same rules as application workspace (**401** → sign-in / guest token flow) — do not leak payment existence across tenants.

### 7.5 Webhooks

- **`POST /api/webhooks/paddle`** — unchanged URL for Paddle dashboard.
- **`POST /api/webhooks/ziina`** — new; register in Ziina with secret for HMAC.

**Pipeline:** raw body → verify (per provider) → parse → **`NormalizedPaymentWebhookEvent`** → **`payload_hash`** per **§5.3** → `payment_event` INSERT ON CONFLICT DO NOTHING → **`applyPaymentWebhookEvent`**.

**Ziina:** `payment_intent.status.updated` → map **`completed`** to same **idempotent** paid path as Paddle (`UPDATE ... WHERE status != paid` pattern); terminal failure/cancel → failed path; **no double-fire** of doc retention / first-paid audit (mirror Paddle’s `paymentBecamePaid` / `applicationBecamePaid` logic).

### 7.6 Refunds — baseline vs unified (R7)

**Baseline (honest, shippable v1):**

- **Paddle:** keep **current** behavior: admin initiates refund → **`refund_pending`** (or current status); **do not** claim webhook-driven `refunded` unless implementation adds **`refund.completed`** handling on the same release.
- **Ziina:** admin calls Ziina refund API; same **`refund_pending`** semantics as Paddle unless webhooks are implemented **for both** providers in the same change.

**Elevated option (single follow-up epic):** Unified **`refund.completed` / `refund.status.updated`** handling moves **`refund_pending` → `refunded`** (or final) with shared audit — **must** include **Paddle** parity, not Ziina-only.

The implementation plan must **name** which baseline is in scope for the first merge.

### 7.7 Observability and safety

- Structured logs: `payment_provider`, `application_id`, `payment_id`, `request_id` (from `x-request-id` or generated), `rawEventType`, never secrets/PAN.
- **Counters / metrics (P1, logs-only v1 OK):** webhook verify failures, dedupe hits (`onConflictDoNothing`), amount mismatch, no payment row, **provider mismatch** (R8).
- Amount mismatch: preserve **`admin_attention_required`** pattern.
- **Alignment with `visa-payments-paddle`:** provider IDs and secrets are **server-only**; client receives only **`transactionId` + `clientToken` (Paddle)** or **`redirectUrl` (Ziina)** — never raw Ziina tokens on the client.

## 8. Data model

- **`payment.provider`** text: `paddle` \| `ziina`.
- **`provider_operation_id` (recommended v1 for Ziina):** nullable **`text`** column on **`payment`** storing the UUID sent as Ziina **`operation_id`** for safe retries. **Avoid** “UUIDv5 derived from CUID `payment.id`” — awkward and error-prone. Checkout today uses **`createId()`** for payment PK; keep PK as-is, store operation id separately.

**Ziina column mapping:**

| Column | Ziina |
|--------|--------|
| `provider_checkout_id` | Payment intent id |
| `provider_transaction_id` | Set on paid confirmation (intent id or distinct id per API — verify against webhook payload) |
| `provider_operation_id` | Client UUID sent to Ziina create intent |

## 9. Security

- Server-only secrets.
- **§5.2** HMAC fail-closed rules.
- **§7.2.2** provider binding.
- Return pages are **GET** — never trust query string alone for financial state; **poll** server state.

## 10. Testing strategy

- Unit: `applyPaymentWebhookEvent` — paid, failed, duplicate hash, amount mismatch, cancelled application resurrection, **provider mismatch**.
- Contract tests: normalized event parser fixtures per provider.
- Manual / e2e: Ziina test mode; Paddle regression with `PAYMENT_PROVIDER=paddle`.

## 11. Rollout

1. Extract `applyPaymentWebhookEvent` + hash rule migration decision (**§5.3**); Paddle-only, no behavior change.
2. Add Ziina checkout + webhook + return pages behind env.
3. Prod env matrix (**§16**).

## 12. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Webhook misrouted to wrong row | R8 + intent id lookup + signed payload |
| Lock held too long | §7.2.1 monitoring; two-phase follow-up |
| User trusts success URL | Polling + copy |
| Hash collision across providers | §5.3 prefixed hash |

## 13. Resolved / remaining product decisions

1. **IP allowlist:** prod recommendation remains **on** when egress is known; **off** local; document in **§16**.
2. **Return routes:** default dedicated **`…/checkout/return`** and **`…/checkout/cancel`** (or single page with query) — finalize paths in implementation plan.
3. **`operation_id`:** **v1 default = add `provider_operation_id` column** + populate on Ziina checkout (see **§8**).

## 14. Approval checklist

- [ ] Product: redirect-away UX + return page polling + **timeout copy** approved.
- [ ] Legal / product: what users see on Ziina-hosted pages acceptable.
- [ ] Security: **R8** provider mismatch + **§5.2** fail-closed signed off.
- [ ] Data: **`provider_operation_id` migration** approved (or explicit waiver with single-flight checkout only).
- [ ] Support: delayed webhook / polling timeout playbook.
- [ ] Engineering: **refund baseline** for first merge explicitly chosen (**§7.6**).
- [ ] Ops: **§16** env matrix + webhook registration checklist.

**Next step after approval:** **writing-plans** → `docs/superpowers/plans/2026-04-24-payment-provider-env-switch-implementation.md`.

## 15. Implementation readiness (review fold-in)

This section captures **P0 / P1** items so engineering does not rediscover them in PR review.

**P0 — contract and safety**

- Provider integrity **§7.2.2**; correlation **R9** (no fake metadata on Ziina create today).
- Wire envelope **§5.1**; misconfig **§5.4**.
- Transaction boundary and rollback **§7.2.1** + **§5.1** errors.
- Payload hash input **§5.3** (prefix + raw body).
- HMAC details **§5.2**.
- Cancel vs abandon **§7.3.1**.
- Refund honesty **§7.6**.

**P1 — robustness**

- **`NormalizedPaymentWebhookEvent` required fields:** `provider`, `kind`, `providerPaymentId`, `amountMinor`, `currency`, `metadata` (may be empty for Ziina v1), **`rawEventType`**, optional **`providerEventId`** for `payment_event.provider_event_id` (null if absent).
- **Idempotent paid transition:** same `UPDATE ... WHERE ne(status, 'paid')` pattern for Ziina completed events as Paddle paid/completed.
- **Polling:** **§7.4** backoff, max duration, terminals, auth.
- **Metrics:** **§7.7** minimal log counters.

**P2 — ops docs (same release or immediately after)**

- **§16** env matrix, webhook URL checklist, CS copy for delayed confirmation, API base URL pinning.

## 16. Ops and documentation

| Layer | `PAYMENT_PROVIDER=paddle` | `PAYMENT_PROVIDER=ziina` |
|-------|---------------------------|---------------------------|
| Dev | Paddle sandbox keys | Ziina test token + `ZIINA_TEST_MODE` |
| Staging | Per env | Ziina staging/test + webhook secret |
| Prod | Live Paddle | Live Ziina + **required** webhook secret + IP allowlist decision |

**Webhook checklist**

- Paddle: existing URL unchanged.
- Ziina: register **`/api/webhooks/ziina`**, store secret, verify HMAC in staging before prod.

**Health / on-call**

- “Paid delayed”: return page polling + CS script referencing `requestId` in logs.

**Versioning**

- Pin `ZIINA_API_BASE_URL`; document bump process when Ziina ships API revisions.

---

## Minor consistency (repo vs types)

- **`refund.completed`:** listed in `ParsedWebhookEvent` union but **not** applied in `webhooks/paddle/route.ts` — treat as **future** or implement under **§7.6** unified option; do not document as “handled” today.
