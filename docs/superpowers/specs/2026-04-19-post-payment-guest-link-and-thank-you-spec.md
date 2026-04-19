# Post-payment experience and guest application linking

**Status:** Draft **v3** — normative sections are binding unless the **Decisions log** is amended.  
**Not committed:** Do not commit to git until product explicitly approves.  
**Depends on:** Phase 3 Paddle + webhooks, `vt_resume` cookie, `application` schema, Better Auth, `jsonOk` / `jsonError` envelope, RLS actor wrappers.

---

## Decisions log (stakeholder + defaults)

| ID | Decision | Owner | Notes |
|----|----------|-------|--------|
| D1 | **Primary** post-link redirect: **`/portal/application-workspace?applicationId=<uuid>`**. | Product | Same milestone as `link-after-auth` (D8). |
| D8 | Workspace **must** consume `applicationId`, call **`GET /api/applications/mine`**, highlight row. | Stakeholder (2026-04-19) | |
| **D9** | **`prepare-guest-link-intent` allowed with or without session** when **`vt_resume` verifies** for the body `applicationId`, the application row’s **`user_id` IS NULL**, and §5 allows minting (e.g. `paid`). Fixes **sign-in-first** without mandating UI order only. | Stakeholder + review (2026-04-19) | Client may call `prepare` from any surface that holds guest cookies; **404 on submitted does not forbid `prepare`** if API rules pass. |
| **D10** | Closed set of **`details.code`** values for link/prepare failures — see **§7.3** table (normative). | Review (2026-04-19) | Do not overload one code for intent/resume skew vs wrong human vs missing row. |
| **D11** | **Release slip:** If workspace highlight **not** shipped in the link milestone, **`302` → `/apply/applications/[id]?linked=1`** (session-owned). **Last resort** only: **`/portal`**. Optional **`WORKSPACE_APPLICATION_HIGHLIGHT_ENABLED`** default **`true`**; when **`false`**, use slip path **without** blocking link. | Review (2026-04-19) | Supersedes older “no `/portal` only” wording where it conflicted. |
| D2 | Email policy v1: **relaxed, possession-only**. | Product | On success, if normalized emails differ → **`admin_attention_required = true`**. |
| D3 | Same user already linked: **HTTP 200** + **`alreadyLinked: true`**. | Product | |
| D4 | **Superseded by D10** for wire-up; historically “wrong session” cases are expressed only via **`details.code`** in §7.3 — do **not** map intent/resume skew to **`LINK_SESSION_MISMATCH`**. | Stakeholder | |
| D5 | After link: **`resume_token_hash = NULL`**. | Product | **Guest resume deep links for that application are dead** post-link; slip redirect **`/apply/...`** is **session-owned** only. |
| D6 | Confirming payment: **180s** cap, polling §13. | Eng default | |
| D7 | Submitted route: **`/apply/applications/[id]/submitted`**. | Product | |

---

## 1. Problem statement

After payment, users need closure UI aligned with **DB truth** (webhooks), not Paddle overlay alone. Guests need **minimal chore** to attach the paid application to a **new or existing** account without pasting IDs, without weakening possession-based security.

---

## 2. Non-goals (v1)

- Linking without **resume possession** (no email-only magic link attach in v1).
- Cross-device automatic attach after OAuth on a **different** browser (v1 policy: **by design** only same-browser; see §8).
- Account merge, multi-email consolidation.

---

## 3. Invariants (non-negotiable)

1. **`payment_status = paid`** is set only by **trusted server paths** (webhooks per product rules); the submitted page **never** claims “paid” from client-only Paddle state.
2. **Guest link** never trusts **client-supplied `application_id` alone**; binding uses **`vt_link_intent`** + **`vt_resume`** verification against the row.
3. After successful link, **`resume_token_hash` is NULL`** (D5).
4. All **JSON routes** use **`jsonOk` / `jsonError`** + **`x-request-id`**, **`export const runtime = "nodejs"`** on `app/api/**`.
5. **RLS:** writes to `application` use **`withClientDbActor`** / **`withSystemDbActor`** per project rules.

---

## 4. Authorization matrix

| Actor | Condition | **Read** `/apply/applications/[id]/submitted` | **`prepare-guest-link-intent`** | **`link-after-auth`** |
|-------|-----------|-----------------------------------------------|----------------------------------|------------------------|
| **Guest** (no session) | Valid **`vt_resume`** for `id` | **Yes** | **Yes** if §5 allows mint and `user_id` IS NULL | **No** (401) |
| **Guest + session** (any user **U**) | Valid **`vt_resume`** for body `applicationId`, `user_id` IS NULL, §5 allows | **No** for **other** `id` without read access (**404**) | **Yes** for that `applicationId` (D9) | **Yes** after same checks as link handler |
| **Signed-in owner** | `user_id = session.user.id` | **Yes** | **No** (not a guest-unclaimed row) | **No** |
| **Signed-in** | No resume, not owner | **404** for guest app | **No** | **No** |
| **Nobody** | No session, no valid resume | **404** | **No** | **No** |

**Normative — submitted read vs prepare (D9):** A user may **not** read the submitted page for app **B** without read access, but may still **`POST prepare`** for **B** if **`vt_resume` verifies for B** and §5 allows. Product surfaces **should** call `prepare` before redirecting to auth when possible; **API must not** require “no session.”

**IDOR — submitted `GET`:** Failed read → **404** `NOT_FOUND` (unified).

**Link `POST` — enumeration:** **`403`/`422`/`409` responses must not echo** target **`applicationId`** inside **`details`** (use stable **`details.code`** only). **`404`** for unknown row after valid intent parse may use generic `NOT_FOUND` only.

**Link endpoint:** No session → **401**. See **§7.3** for all other codes.

---

## 5. State gating matrix (normative)

Use **two axes**; implementers combine with **AND** (blocking rules win).

### 5.A `payment_status` (application row)

| `payment_status` | Submitted page (success path) | `prepare-guest-link-intent` | `link-after-auth` |
|------------------|------------------------------|-----------------------------|-------------------|
| `unpaid` (and not `paid`) | Not success / §13 if on submitted | **No** | **No** |
| `checkout_created` | §13 confirming only | **No** (default) | **No** |
| `paid` | Success branch (**§5.B** may modify) | **Yes** if `user_id` IS NULL + guest proof | **Yes** if all §7 checks pass |
| **`refund_pending`**, **`refunded`**, **`failed`** | No success link UX; neutral/support | **No** | **No** |

### 5.B When `payment_status = paid` — `application_status` and flags

| `application_status` | `admin_attention_required` | Submitted UI | `prepare` | `link-after-auth` |
|----------------------|---------------------------|--------------|-----------|-------------------|
| **`cancelled`** | any | Blocked copy; **no** account CTAs | **No** | **No** |
| not `cancelled` | `false` | Full success | **Yes** | **Yes** |
| not `cancelled` | `true` | Success + **muted** “We’re reviewing your file” strip | **Yes** | **Yes** |

**Blocking rule (single sentence):** **`link-after-auth`** and **`prepare`** are **denied** when **`payment_status` ∈ { `refund_pending`, `refunded`, `failed` }** *or* **`application_status` = `cancelled`** — regardless of `admin_attention_required`. **`admin_attention_required` alone** does **not** block link if `payment_status` is still **`paid`**.

**Concurrency / webhook ordering:** Inside **`link-after-auth`**, after **`FOR UPDATE`** on `application`, **re-read** `payment_status` (and gating columns) **before** final `UPDATE` so a concurrent **webhook** cannot be silently overwritten by stale client assumptions.

---

## 6. Intent cookie (normative — no forks)

| Attribute | Value |
|-----------|--------|
| Name | **`vt_link_intent`** |
| Value | **`base64url(payload).base64url(hmac)`** where `payload = JSON.stringify({ applicationId, exp })`, `exp` unix seconds, **`HMAC-SHA256`** over payload bytes using **`GUEST_LINK_INTENT_SECRET`** (32+ byte secret in env; **never** reuse Paddle secrets). |
| TTL | **1800 s** from `exp`; reject if `now > exp`. |
| Attributes | **`HttpOnly`**, **`Secure`** in production, **`Path=/`**, **`SameSite=Lax`**, **`Max-Age`** = TTL. |
| Set | **Only** `POST /api/apply/prepare-guest-link-intent`. **Never** on GET. |
| Clear | Successful `link-after-auth` clears cookie (`Max-Age=0`); logout clears intent too. |

**Secret rotation (v1):** If **`GUEST_LINK_INTENT_SECRET`** rotates, existing intents **fail** `GUEST_LINK_INTENT_INVALID` until the user **re-runs `prepare`**. **No** multi-version secret support in v1.

**CSRF:** Both endpoints **`POST`** + **`Content-Type: application/json`**. **`Origin`** allowlist aligned with auth app URLs.

---

## 7. API contracts

### 7.1 `POST /api/apply/prepare-guest-link-intent`

**Purpose:** Set **`vt_link_intent`** for one `applicationId`.

**Auth:** **Session optional** (D9). **Authorization** = same **guest possession** as `resolveApplicationAccess` for that `applicationId`: **`vt_resume` verifies** `resume_token_hash`, row is **`is_guest`** with **`user_id` IS NULL**, and **§5** allows mint (e.g. **`paid`**).

**Body:** `{ "applicationId": "<uuid>" }` (strict).

**Deny:** No resume / wrong app → **404** `NOT_FOUND`. Not `paid` (per §5) → **409** `details.code` **`INTENT_REQUIRES_PAID`** (other prepare denials may use **`LINK_NOT_ALLOWED`**). Else **200** + **`jsonOk({ prepared: true, applicationId })`** + `Set-Cookie` so **`/apply/link-after-signup`** can read the id from JSON without parsing the HttpOnly intent cookie.

### 7.2 `POST /api/applications/link-after-auth` — ordered branches

**Auth:** Session **required** (`401` if absent).

**Inputs:** Session user **`U`**, cookies **`vt_link_intent`**, **`vt_resume`**.

**Execute in one transaction** with **`SELECT … FOR UPDATE`** on `application` by id from intent; **after lock**, re-read **`payment_status`**, **`application_status`**, **`user_id`**, **`resume_token_hash`**, then:

1. **Intent token invalid** (missing cookie, malformed payload, bad HMAC, **`exp` < now**) → **422** `VALIDATION_ERROR`, **`details.code` = `GUEST_LINK_INTENT_INVALID`**. *(Never **404** for parse-only failures.)*

2. **Application row missing** (valid intent, id deleted / never existed) → **404** `NOT_FOUND`.

3. **`user_id = U`** and guest link already completed (`is_guest` false) → **200** `alreadyLinked: true` (D3); **no** writes.

4. **`user_id` non-null and ≠ `U`** → **409** `CONFLICT`, **`details.code` = `LINK_NOT_ALLOWED`**.

5. **`user_id` IS NULL** (guest-unclaimed):  
   - If **`vt_resume` cookie absent** → **403** `FORBIDDEN`, **`details.code` = `LINK_RESUME_REQUIRED`**.  
   - If **`vt_resume` present** but **does not verify** for **this** `applicationId` (skew / wrong possession) → **403** `FORBIDDEN`, **`details.code` = `LINK_INTENT_RESUME_MISMATCH`**.  
   - If **verifies**, continue.

6. Re-apply **§5** matrix on **post-lock** values; if blocked → **409** `LINK_NOT_ALLOWED`.

7. **`UPDATE`** (and D2 email flag if needed), audit §10, commit, clear intent cookie.

**`LINK_SESSION_MISMATCH`:** Reserved for **explicit session-policy denies** not covered above; **v1** — **do not emit** for intent/resume skew (use **`LINK_INTENT_RESUME_MISMATCH`** / **`LINK_RESUME_REQUIRED`** only). Remove from default client switch unless a future rule assigns it.

### 7.3 `details.code` closed set (normative)

| `details.code` | HTTP | Meaning |
|----------------|------|---------|
| `GUEST_LINK_INTENT_INVALID` | 422 | Intent cookie missing, malformed, bad HMAC, or expired |
| `LINK_RESUME_REQUIRED` | 403 | Intent valid; **no** `vt_resume` cookie on link request |
| `LINK_INTENT_RESUME_MISMATCH` | 403 | Intent valid; resume present but **does not verify** for intent’s `applicationId` |
| `LINK_NOT_ALLOWED` | 409 | §5 matrix blocks (cancelled, refund states, etc.) or **other owner** |
| `INTENT_REQUIRES_PAID` | 409 | Prepare only: not paid |
| `LINK_SESSION_MISMATCH` | 403 | **Reserved** for future “cannot attach to this session” product rules **other than** resume skew / missing resume. **v1:** **do not emit** (no handler branch, no `details.code` emission) for cases covered by **`LINK_INTENT_RESUME_MISMATCH`** or **`LINK_RESUME_REQUIRED`**. |

**`403` / `422` / `409` bodies:** **`details`** carry **`code`** only — **no** raw `applicationId` in `details` for link failures (enumeration hygiene).

### 7.4 HTTP status summary (`link-after-auth` + prepare)

| HTTP | `details.code` (when set) | When |
|------|---------------------------|------|
| **200** | — | Link success or **D3** `alreadyLinked`; prepare success |
| **401** | — | `link-after-auth` with no session |
| **403** | `LINK_RESUME_REQUIRED`, `LINK_INTENT_RESUME_MISMATCH`, or (reserved) `LINK_SESSION_MISMATCH` | Resume branch failures (**never 404** here) |
| **404** | `NOT_FOUND` | Prepare: no guest read. Link: **only** after valid intent parse, **row** missing for decoded `applicationId` |
| **409** | `LINK_NOT_ALLOWED`, `INTENT_REQUIRES_PAID` | Matrix / other-owner / prepare not paid |
| **422** | `GUEST_LINK_INTENT_INVALID` | Intent missing, malformed, bad HMAC, or expired |

---

## 8. Cross-device (v1)

Automatic link requires **same browser profile** intent + resume + auth before TTL. Else **§12** playbook.

---

## 9. Acceptance criteria (Given / When / Then)

**A. Submitted `GET`**

- Read access (guest resume **or** owner) → **200**, one **`h1`**, server-driven status.
- No read access → **404**.

**B. Confirming payment** — unchanged from v2 §13 (180s, 2s / 5s poll, terminal panel).

**C. Prepare** — **Given** `paid` + `user_id` IS NULL + resume verifies, **with or without** prior session (D9) → **200** + cookie.

**D. Link** — branches in **§7.2**; **Given** post-lock `payment_status` flipped to **`refund_pending`** → **409** `LINK_NOT_ALLOWED`.

**E. Returning to submitted without `vt_resume`** (guest bookmark) → **404** on `GET` — **normative copy hint:** “Keep this browser or use the email we sent you; opening this page elsewhere may not work.”

---

## 10. Audit (minimum schema)

Same as v2 **except** `after_json` uses **non-PII flags only**, e.g. **`{ userId, isGuest: false, resumeCleared: true, emailsDiffer: true }`** (boolean), **not** raw emails. Field-level PII and retention follow **`docs/IMPLEMENTATION_REFERENCE.md`** audit / RBAC sections (cite in implementation PR if rules move).

---

## 11. UX and microcopy (normative baseline)

**Submitted success — information architecture**

1. **`h1`** — payment received (neutral).
2. **Status** — one line from server: application + payment state (no internal jargon).
3. **Next steps (guest):** **Primary:** Create account (→ auth `callbackURL` → link route). **Secondary:** Sign in — “I already have an account” (same flow). **Tertiary:** Browse services → `/apply/start` (or catalog entry).
4. **Next steps (signed-in owner):** **Primary:** Open **applications / workspace** (`/portal/application-workspace` or `mine` consumer). **Secondary:** Start another application.
5. **Footer** — support / FAQ.

**Forbidden phrases:** “automation failed,” margin/cost, raw Paddle errors, blaming user for webhook delay.

**Accessibility:** focus **`h1`** on land; **`role="status"`** live region for confirming poll; tab order: H1 → status → primary → secondary → footer.

---

## 12. Support playbook

- **Never** ask the user to paste full passport data in chat.
- **Do** ask for **`reference_number`** if present; else **last 8 of `application.id`** (support internal lookup by full id).
- **Never** ask for **`vt_resume`** raw value (cannot verify over phone).
- Internal: locate row by `reference_number` / id, verify `paid`, verify `user_id` if post-link.

---

## 13. Confirming payment — failure contract

| Phase | Client behavior |
|-------|-----------------|
| T+0–60s | Poll every **2s** |
| T+60–180s | Poll every **5s** |
| T+>180s | **Stop** polling; show **terminal panel**: title “We’re still confirming your payment”, body with reference line, **button** “Refresh status” (manual `router.refresh()` or refetch), link “Contact support” with `mailto:` or `/help` **including reference in subject suggestion only** |

Server remains authoritative; user may leave and return; webhook eventually sets `paid`. **Guest returning** to **`/submitted`** on a **device without** `vt_resume` still gets **404** per **§9.E** — same expectation as “refresh broke my thank-you” support cases.

---

## 14. Analytics (minimum viable)

**Funnel:** `submitted_view` → `guest_link_intent_prepared` → `auth_callback_land` → `link_after_auth_success` | `link_after_auth_fail`

**`auth_callback_land` — fire point (normative):** **Once per successful navigation** to **`/apply/link-after-signup`**, when the client observes **session user id transition** from **unset → set** (e.g. **`useEffect`** with ref guard `firedRef` after `useSession()` / auth client resolves). **Do not** fire on Strict Mode double-mount **twice** (use ref). Server-only alternative: single server log on **first GET** that sees session cookie — pick **one** implementation; default **client ref-guarded** for v1.

**`link_after_auth_fail.reason` closed enum:** `intent_invalid`, `intent_resume_mismatch`, `resume_required`, `not_paid`, `cancelled`, `refund_state`, `not_found`, `already_owned_other`, `invalid_origin`, `link_policy_denied` (maps **`LINK_NOT_ALLOWED`** without finer `details` subcodes), `unknown`.

**Cardinality:** ≤ 1 `guest_link_intent_prepared` per application per 30 min per browser (client debounce optional).

---

## 15. Rollout, abuse, release

**Rate limits — normative floors** (PR may tighten, **not** loosen below):

| Endpoint | Floor |
|----------|--------|
| `prepare-guest-link-intent` | **60 / hour / IP**; **120 / hour / `applicationId`** |
| `link-after-auth` | **30 / hour / IP**; **60 / hour / authenticated `userId`** |

**Kill switch:** **`GUEST_LINK_AFTER_AUTH_ENABLED`** default `true` → **`503`** when `false`.

**D11 slip:** If **`WORKSPACE_APPLICATION_HIGHLIGHT_ENABLED`** is **`false`** or workspace route incomplete, redirect **`/apply/applications/[id]?linked=1`**; last resort **`/portal`**.

---

## 16. Implementation order (post-approval)

1. Submitted page + §13 + **§9.E** copy.  
2. Draft redirect when `paid`.  
3. `prepare` (D9 auth text) + cookie + rate limits.  
4. `link-after-auth` §7.2 + post-lock re-read + audit + tests.  
5. Workspace `?applicationId=` **or** D11 slip path + flag.  
6. Copy + a11y + analytics fire-point.

---

## 17. Revision history

| Rev | When (UTC) | Change |
|-----|----------------|--------|
| v0 | 2026-04-19 | Initial draft. |
| v1 | 2026-04-19 | CPM pass → v2 structure. |
| v2 | 2026-04-19 | Decisions log, matrices, contracts, audit, analytics floor. |
| v3 | 2026-04-19 | Second-round review: §7.2 rewrite, D9–D11, matrix split, HTTP alignment, rate floors, secret rotation, audit/analytics, slip path, enumeration note, rev table format. |
