# Post-payment guest link + submitted experience — Implementation Plan **v3.1 (Phase 3 worktree–aligned, final review)**

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship **`/apply/applications/[id]/submitted`**, **`POST /api/apply/prepare-guest-link-intent`**, **`POST /api/applications/link-after-auth`**, **`/apply/link-after-signup`**, post-link redirect (workspace + D11 slip), confirming-payment UX, rate limits, kill switch, audit, and analytics per **`docs/superpowers/specs/2026-04-19-post-payment-guest-link-and-thank-you-spec.md` v3** (plus **normative spec edits** listed under “Spec deltas” — no implementation-only drift).

**Architecture:** Server remains source of truth for **`payment_status`**. Guest possession is proven by **`vt_resume`** + `resume_token_hash` using the same verification pattern as **`app/api/applications/[id]/route.ts`**. **`prepare`** never authorizes on session alone (D9): always **`loadGuestApplicationRowByResumeCookie`**. **`link-after-auth`** uses **`withSystemDbActor`** for **`FOR UPDATE`** / **`UPDATE`** / audit insert on guest rows under existing **`application_system_all`**; Better Auth session **`U`** is verified in the handler before opening the transaction. Intent cookie **`vt_link_intent`** is HMAC-signed server-side. Pure functions centralize §5 matrix checks for tests; **`guestLinkMatrixAllowsLink`** includes an explicit **`payment_status === "paid"`** guard so **`link-after-auth`** cannot pass the matrix on **`unpaid` / `checkout_created`** (v3.1 P0).

**Tech stack:** Next.js App Router, Better Auth, Drizzle + Neon serverless Pool, `jsonOk` / `jsonError`, Vitest, sliding-window rate limits (same **best-effort** contract as `document-rate-limit.ts`), `RESUME_COOKIE_NAME` / `readResumeTokenFromRequestCookies`.

---

## Phase 3 worktree (verified — **read this before coding**)

Canonical checkout on disk: **`.worktrees/phase-3/`** (separate git worktree for the `phase3` line of work). The **main repo workspace** may still be **pre–Phase 3**; do not assume `main` has these files until merged.

| Artifact | Fact (as of inspection of `.worktrees/phase-3`) |
|----------|--------------------------------------------------|
| **Migrations** | SQL through **`drizzle/0009_checkout_client_write_rls.sql`**. Next new file for guest-link DB work is **`drizzle/0010_*.sql`** (not `0008` — that name is already **`0008_phase3_paddle_status_upgrade.sql`**). |
| **`0008_phase3_paddle_status_upgrade.sql`** | Adds **`admin_attention_required`**; remaps **`application_status`** (`submitted`/`in_review` → **`needs_review`**, `approved` → **`completed`**, `rejected` → **`cancelled`**); sets **`payment_status`** from **`pending`** → **`checkout_created`**. |
| **`lib/db/schema/applications.ts`** | Includes **`adminAttentionRequired: boolean("admin_attention_required")`**. |
| **Canonical enums** | **`lib/applications/status.ts`** — `APPLICATION_STATUSES`, `PAYMENT_STATUSES` (`unpaid`, `checkout_created`, `paid`, `refund_pending`, `refunded`, `failed`), `FULFILLMENT_STATUSES`. **Gating and tests must use these strings**, not pre–Phase 3 vocabulary. |
| **`toPublicApplication`** | Does **not** yet expose **`adminAttentionRequired`** — guest-link / submitted still needs the **`public-application.ts`** change in this plan. |
| **Paddle / checkout** | **`app/api/checkout/route.ts`**, **`app/api/webhooks/paddle/route.ts`**, **`app/api/applications/[id]/checkout-cancel/route.ts`** exist on the worktree. Confirming-payment UI should align with **`checkout_created`** / **`paid`** from `PAYMENT_STATUSES`. |
| **Portal workspace** | **`app/portal/application-workspace/page.tsx`** still **`redirect`s** `?applicationId=` → **`/apply/applications/[id]`** — Task 8 replaces that when highlight is enabled (same as current main plan intent). |

**Executor rule:** Branch off **the commit that contains `0009` + Phase 3 schema** (usually: merge `phase3` into your feature branch, or implement **inside** `.worktrees/phase-3` and merge back).

**Document vs runtime:** The **Phase 3 artifact table** reflects a point-in-time inspection of **`.worktrees/phase-3`**. Whoever executes must **re-run once on their branch** (e.g. `ls drizzle/*.sql | tail -8`, `grep admin_attention_required lib/db/schema/applications.ts`) and tick the prerequisite box — do not treat this file as proof your checkout matches.

---

## Prerequisites (binding)

1. **Phase 3 schema + migrations are on your branch.** Verify at least one of: **`grep admin_attention_required` in `lib/db/schema/applications.ts`**, or presence of **`drizzle/0008_phase3_paddle_status_upgrade.sql`** + **`0009_checkout_client_write_rls.sql`**. If missing, **merge `phase3` or work in `.worktrees/phase-3`** before Task 0. This plan **does not** add `admin_attention_required` (already in `0008`).
2. Recommended **git worktree** for isolation (`using-git-worktrees` skill); optional **implement entirely in `.worktrees/phase-3`** then open PR from that branch.
3. **`429` + `RATE_LIMITED`:** Already in `lib/api/response.ts` on Phase 3 tree. Reuse for prepare/link rate limits; include **`Retry-After`** header (seconds) like `app/api/applications/[id]/extract/route.ts`. Add any **additional** `ApiErrorCode` values only if product needs a distinct top-level code (e.g. **`SERVICE_UNAVAILABLE`** for kill switch); sub-cases continue to use **`details.code`** string.
4. **Branch guard (avoid “main without Phase 3”):** Add a **PR checklist** or lightweight **CI step** that fails (or skips with warning) if `drizzle/0008_phase3_paddle_status_upgrade.sql` is absent **or** `lib/applications/status.ts` does not export **`PAYMENT_STATUSES`** / **`APPLICATION_STATUSES`**. Anyone copy-pasting Task 1 on pre–Phase 3 `main` will otherwise get **broken imports**.

---

## Spec + code merge policy (AGENTS.md tension)

Repo rule: **do not commit specs until product approves.** This plan’s **Spec deltas** are normative for engineering once approved.

**Pick one per release window (document in PR description):**

- **A — Spec first:** Product approves spec amendments in **PR #1** (spec-only); code PR **depends on** merged spec.  
- **B — Same merge window:** Product explicitly approves spec + implementation **before merge**; **one PR** contains spec + code (allowed when product has pre-approved the bundle).  
- **C — Code behind flag:** Land code with feature flag off; spec amendment follows in a **second** approved PR before flag on.

Do **not** leave “same PR as code” ambiguous with “never commit docs until approved” — the EM picks **A / B / C** per release.

---

## Spec deltas (amend v3 before or in the same PR as code — no “plan-only normative”)

| Delta | Action |
|-------|--------|
| **`prepare` response** | §7.1: **`jsonOk({ prepared: true, applicationId })`** so **`link-after-signup`** can redirect without parsing HttpOnly intent. |
| **`LINK_SESSION_MISMATCH` v1** | **Remove** from implementer-facing closed set: v1 **must not emit** this code (no branch, no client handling). Either delete the reserved row in spec §7.3 or mark **“not used in v1”** in one sentence. Aligns with stakeholder lean toward **C** (no phantom code path). |
| **Lifecycle strings (Phase 3)** | Spec v3 prose uses legacy **`submitted`** / **`pending`** in places. **Implementation** uses **`lib/applications/status.ts`** after `0008`: e.g. post-payment rows are typically **`application_status: "needs_review"`** (or later pipeline states), **`payment_status: "checkout_created"`** until webhook sets **`paid`**. Update product-facing spec copy in the same PR as code where still normative. |

---

## Binding decisions (tech lead / review closure)

| Topic | Decision |
|-------|----------|
| **`admin_attention_required`** | **Owned by Phase 3** (already landed in phase3 worktree/branch). Guest-link **consumes** it only. |
| **`LINK_SESSION_MISMATCH`** | **v1:** **Do not implement** — no handler branch, no `details.code` emission. Spec trimmed as above. |
| **Bad `Origin` on JSON POST** | Return **`403 FORBIDDEN`** with **`details: { code: "INVALID_ORIGIN" }`** (not link-failure codes). Task 11 maps **`INVALID_ORIGIN`** to analytics reason **`invalid_origin`** (or `unknown` if you want fewer buckets — pick one and document). |
| **`canCompleteGuestLink` naming** | Pure function is **matrix-only for rows where `user_id` IS NULL** (unclaimed guest). Rename to **`guestLinkMatrixAllowsLink(row)`** (or equivalent) so nobody calls it for idempotent “already linked to U” rows. **D3** stays **only** in the route handler **before** matrix. |
| **`guestLinkMatrixAllowsLink` + `paid`** | **Normative (v3.1):** The link matrix path **must** require **`payment_status === "paid"`** (in addition to blocked refund states and non-`cancelled` application status). Otherwise **`link-after-auth`** could pass matrix on **`unpaid` / `checkout_created`** with valid resume + intent — **forbidden** by spec §5. |
| **Rate limit §15** | Floors are **per-process best-effort** (same disclaimer header as `lib/applications/document-rate-limit.ts`); not a global distributed guarantee until Redis/KV. |
| **`WORKSPACE_APPLICATION_HIGHLIGHT_ENABLED`** | **Deployment knob:** when **`false`**, behavior matches **D11 slip** (primary workspace UI deferred). One sentence for PM: “flag off emulates slipped workspace release.” |

---

## Merge sequencing (manager view — adjust PR boundaries to team taste)

1. **DB only:** One new SQL migration after **`0009`** — filename **`drizzle/0010_guest_link_audit_system_insert.sql`** (adjust number only if another `0010` lands first on your branch). Contents: **`audit_log_system_insert`** only. Verify policy name uniqueness on target DB (exact policy name string; **`DROP POLICY IF EXISTS`** must match). **Acceptance:** **`tests/integration/guest-link-audit-rls.test.ts`** (or equivalent) runs `withSystemDbActor` → `audit_log` insert and **fails without migration**; gate with **`process.env.GUEST_LINK_RLS_INTEGRATION`** if CI DB is not always available — **one blessed path**, not ad-hoc laptop scripts.
2. **Libs:** intent, gating, rate limit, resume helper, post-link URL, json-post-origin (+ unit tests).
3. **API routes** + route tests (split **7A** / **7B** across PRs if needed).
4. **UI:** submitted, link-after-signup, workspace highlight, apply paid → submitted redirect.
5. **Analytics + copy + verification sweep.**  
   **Do not** land UI before APIs unless endpoints are behind **`GUEST_LINK_AFTER_AUTH_ENABLED`** and UI handles 503.

On **`main`**, prefer **squash** to one feature commit or a small stack; per-task commits are fine in a **worktree** branch.

---

## File map (create / modify)

| Path | Responsibility |
|------|------------------|
| **Create** `lib/applications/guest-link-intent.ts` | Sign / verify `vt_link_intent`; TTL 1800s; `timingSafeEqual` |
| **Create** `lib/applications/guest-link-intent.test.ts` | |
| **Create** `lib/applications/guest-link-gating.ts` | **`canMintGuestLinkIntent`**, **`guestLinkMatrixAllowsLink`** (unclaimed guest rows only; **link matrix requires `paid`**) |
| **Create** `lib/applications/guest-link-gating.test.ts` | |
| **Create** `lib/applications/guest-resume-access.ts` | **`loadGuestApplicationRowByResumeCookie`** — shared with `[id]/route.ts` |
| **Create** `lib/applications/guest-link-rate-limit.ts` | §15 floors + **file header** = same in-process disclaimer as `document-rate-limit.ts` |
| **Create** `lib/applications/guest-link-rate-limit.test.ts` | |
| **Create** `lib/api/json-post-origin.ts` | Trusted origin for state-changing JSON POSTs |
| **Create** `lib/api/json-post-origin.test.ts` | |
| **Create** `lib/applications/post-link-redirect.ts` | D1 / D11 / env flag |
| **Create** `app/api/apply/prepare-guest-link-intent/route.ts` | |
| **Create** `app/api/applications/link-after-auth/route.ts` | |
| **Create** route tests for both | |
| **Create** `app/apply/applications/[id]/submitted/page.tsx` | RSC + **`notFound()`** = same 404 posture as API |
| **Create** `components/apply/submitted-application-client.tsx` | |
| **Create** `app/apply/link-after-signup/page.tsx` | `"use client"` + loading gate + optional **noindex** (metadata export from small server wrapper **or** `next/head` / layout — document chosen pattern) |
| **Create** `lib/analytics/guest-link-events.ts` | §14 constants + `INVALID_ORIGIN` |
| **Modify** `docs/superpowers/specs/2026-04-19-post-payment-guest-link-and-thank-you-spec.md` | Spec deltas (prepare payload, `LINK_SESSION_MISMATCH` v1) — **only after product allows spec edits** per repo rules |
| **Modify** `app/api/applications/[id]/route.ts` | Use **`guest-resume-access.ts`** |
| **Modify** `drizzle/` | **`0010_guest_link_audit_system_insert.sql`** (after Phase 3 `0009`): **`audit_log_system_insert`** only (`DROP POLICY IF EXISTS …` then `CREATE POLICY`, per team standard) |
| **Modify** `lib/api/response.ts` | **`SERVICE_UNAVAILABLE`** (and any other missing top-level codes) |
| **Modify** `lib/applications/public-application.ts` | Expose **`adminAttentionRequired`** for submitted strip if not already |
| **Modify** `app/portal/application-workspace/page.tsx` | Highlight + mine when flag on; else slip redirect |
| **Modify** `app/apply/applications/[id]/page.tsx` | Paid → submitted redirect |
| **Modify** `.env.example` | Guest-link env vars |

**Not in this plan (Phase 3):** `ALTER TABLE application ADD admin_attention_required …` / Drizzle field addition — already done upstream.

---

### Task 0: DB — `audit_log` system insert + verification

**Files:**

- Create: **`drizzle/0010_guest_link_audit_system_insert.sql`** (on top of Phase 3 **`0009`**; renumber only if `0010` already taken)
- Modify: `.env.example` (can defer to Task 5/6 if preferred)

- [ ] **Step 1: Migration SQL** — **Only** audit policy (no `application` column):

```sql
DROP POLICY IF EXISTS "audit_log_system_insert" ON "audit_log";

CREATE POLICY "audit_log_system_insert" ON "audit_log"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'system');
```

- [ ] **Step 2: Verify** — **Preferred:** `tests/integration/guest-link-audit-rls.test.ts` — `withSystemDbActor(async (tx) => tx.insert(auditLog).values({ … }))` **succeeds** with migration applied; **fails** (or skips with clear message) without. Confirms GUC **`system`** matches policy. Optional env gate: **`GUEST_LINK_RLS_INTEGRATION=1`** for CI/staging DB only.

- [ ] **Step 3: Commit** — `feat(db): audit_log system insert for guest-link audit broker`

---

### Task 1: `guest-link-gating` + tests

**Files:** `lib/applications/guest-link-gating.ts`, `lib/applications/guest-link-gating.test.ts`

- [ ] **Step 1: RED** — `pnpm vitest run lib/applications/guest-link-gating.test.ts` → FAIL.

- [ ] **Step 2: Test source** (import **`guestLinkMatrixAllowsLink`**; matrix tests use **only** `userId: null` rows; D3 / “already linked” is **not** tested here):

```ts
import { describe, expect, it } from "vitest";
import { canMintGuestLinkIntent, guestLinkMatrixAllowsLink } from "./guest-link-gating";

describe("guest-link-gating", () => {
  it("denies prepare when not paid", () => {
    expect(
      canMintGuestLinkIntent({
        paymentStatus: "unpaid",
        applicationStatus: "draft",
        userId: null,
        isGuest: true,
      }).ok,
    ).toBe(false);
  });

  it("allows prepare when paid guest unclaimed", () => {
    expect(
      canMintGuestLinkIntent({
        paymentStatus: "paid",
        applicationStatus: "needs_review",
        userId: null,
        isGuest: true,
      }).ok,
    ).toBe(true);
  });

  it("matrix denies refund_pending", () => {
    expect(
      guestLinkMatrixAllowsLink({
        paymentStatus: "refund_pending",
        applicationStatus: "needs_review",
        userId: null,
      }).ok,
    ).toBe(false);
  });

  it("matrix denies unpaid (link path must not pass without paid)", () => {
    expect(
      guestLinkMatrixAllowsLink({
        paymentStatus: "unpaid",
        applicationStatus: "needs_review",
        userId: null,
      }).ok,
    ).toBe(false);
  });

  it("matrix denies checkout_created", () => {
    expect(
      guestLinkMatrixAllowsLink({
        paymentStatus: "checkout_created",
        applicationStatus: "needs_review",
        userId: null,
      }).ok,
    ).toBe(false);
  });

  it("matrix denies cancelled", () => {
    expect(
      guestLinkMatrixAllowsLink({
        paymentStatus: "paid",
        applicationStatus: "cancelled",
        userId: null,
      }).ok,
    ).toBe(false);
  });

  it("matrix allows paid + admin_attention_required on unclaimed row", () => {
    expect(
      guestLinkMatrixAllowsLink({
        paymentStatus: "paid",
        applicationStatus: "needs_review",
        userId: null,
        adminAttentionRequired: true,
      }).ok,
    ).toBe(true);
  });

  it("matrix rejects non-null userId (caller must handle D3 before matrix)", () => {
    expect(
      guestLinkMatrixAllowsLink({
        paymentStatus: "paid",
        applicationStatus: "needs_review",
        userId: "user-1",
      }).ok,
    ).toBe(false);
  });
});
```

- [ ] **Step 3: GREEN** — `lib/applications/guest-link-gating.ts`:

```ts
export type GatingInput = {
  paymentStatus: string;
  applicationStatus: string;
  userId: string | null;
  isGuest?: boolean;
  adminAttentionRequired?: boolean;
};

const BLOCKED_PAYMENT = new Set(["refund_pending", "refunded", "failed"]);

export function canMintGuestLinkIntent(row: GatingInput): { ok: true } | { ok: false; reason: string } {
  if (row.userId != null) return { ok: false, reason: "not_guest_unclaimed" };
  if (row.isGuest === false) return { ok: false, reason: "not_guest_row" };
  if (BLOCKED_PAYMENT.has(row.paymentStatus)) return { ok: false, reason: "payment_blocked" };
  if (row.paymentStatus !== "paid") return { ok: false, reason: "intent_requires_paid" };
  if (row.applicationStatus === "cancelled") return { ok: false, reason: "cancelled" };
  return { ok: true };
}

export function guestLinkMatrixAllowsLink(row: GatingInput): { ok: true } | { ok: false; reason: string } {
  if (row.userId != null) return { ok: false, reason: "not_unclaimed" };
  if (BLOCKED_PAYMENT.has(row.paymentStatus)) return { ok: false, reason: "payment_blocked" };
  // §5 / link-after-auth: matrix allows attach only when money is settled — same bar as prepare intent for "paid", but explicit here so unpaid/checkout_created cannot slip through with resume+intent.
  if (row.paymentStatus !== "paid") return { ok: false, reason: "link_requires_paid" };
  if (row.applicationStatus === "cancelled") return { ok: false, reason: "cancelled" };
  return { ok: true };
}
```

**Constants:** Prefer `import { PAYMENT_STATUSES, APPLICATION_STATUSES } from "@/lib/applications/status"` in production gating (or duplicate only the subset you need in `guest-link-gating.ts` with a comment “must match `status.ts`”). **`BLOCKED_PAYMENT`** must match **`PAYMENT_STATUSES`** refund family on the Phase 3 branch. Use literal **`"paid"`** (must equal the `PAYMENT_STATUSES` entry for paid — verify after import if you refactor enums).

- [ ] **Step 4: Commit**

---

### Task 2: `guest-resume-access` + refactor `[id]/route`

- [ ] **Step 3: Test** — Run:

```bash
pnpm vitest run app/api/applications/route.test.ts "app/api/applications/[id]/extract/route.test.ts"
```

(Paths with brackets **quoted** for zsh.) If **`[id]/route.test.ts` does not exist**, omit that path; do **not** reference non-existent files.

---

### Task 3–4: Intent + rate limit

Task 4 **Step 0:** Paste at top of **`guest-link-rate-limit.ts`** the same **in-process / serverless best-effort** paragraph as **`document-rate-limit.ts`** (by reference: “see `document-rate-limit.ts` header” + one-sentence summary).

---

### Task 5: `response.ts` + `json-post-origin`

- Add **`SERVICE_UNAVAILABLE`** to `ApiErrorCode`.
- **`assertTrustedJsonPostOrigin`:** on failure return **`jsonError("FORBIDDEN", "Invalid request origin", { status: 403, requestId, details: { code: "INVALID_ORIGIN" } })`**. **Never** map **`INVALID_ORIGIN`** to **`link_after_auth_fail`** with link-specific reasons.

---

### Task 6: `prepare-guest-link-intent`

- **Normative response:** **`jsonOk({ prepared: true, applicationId }, { requestId, headers: { Set-Cookie: … } })`** (spec delta).
- Rate limit failure: **`jsonError("RATE_LIMITED", …, { status: 429, requestId, headers: { "Retry-After": "…" } })`** (match extract route).

---

### Task 7A: `link-after-auth` — happy path + idempotency (PR 1)

**Files:** `app/api/applications/link-after-auth/route.ts` (skeleton), `route.test.ts`

- Session → **401** if missing.
- Intent parse → **422** `GUEST_LINK_INTENT_INVALID` (before tx).
- **`withSystemDbActor`:** `FOR UPDATE` → **404** if no row → **200** D3 **`userId === U && !isGuest`** → **409** other owner → **403** resume branches → **`guestLinkMatrixAllowsLink`** on post-lock row → **409** `LINK_NOT_ALLOWED` if false → **UPDATE** + audit + commit.
- **v1:** **Do not** reference or emit **`LINK_SESSION_MISMATCH`**.
- **`emailsDiffer` / `adminAttentionRequired`:** merge per spec D2.

---

### Task 7B: `link-after-auth` — edge matrix + Set-Cookie + tests (PR 2)

- Full **`details.code`** matrix tests: **`GUEST_LINK_INTENT_INVALID`**, **`LINK_RESUME_REQUIRED`**, **`LINK_INTENT_RESUME_MISMATCH`**, **`LINK_NOT_ALLOWED`**; assert **`details` never contains `applicationId`**.
- **`Set-Cookie`** clear **`vt_link_intent`** on success and on **403 / 422 / 409** from link handler.

---

### Task 8: Post-link redirect + workspace

- **`buildPostLinkLocation`:** flag **`!== "false"`** → workspace with `?applicationId=`; else **`/apply/applications/[id]?linked=1`**; last resort **`/portal`** per spec D11 if ever needed.
- **PM line:** **`WORKSPACE_APPLICATION_HIGHLIGHT_ENABLED=false`** emulates **slipped workspace** (D11).

---

### Task 9: Submitted page + client

- [ ] **Checkbox — 404 posture:** RSC must call **`notFound()`** for any failure (no access, unknown id); **must not** render a shell that distinguishes “missing id” vs “no cookie” (match **`GET /api/applications/[id]`** envelope posture for API; for RSC, unified **404 page**).

---

### Task 10: `link-after-signup`

- **`applicationId`** from **`prepare`** JSON only (stored in **`sessionStorage`** immediately before redirect to auth **or** read from last prepare response in same navigation — **not** from cookie parsing). **Safari private mode / blocked storage:** if `sessionStorage` is missing after return, show neutral copy to **run `prepare` again** (user still has resume cookie) or re-open auth from submitted — **do not** infinite-loop `link-after-auth`.
- **Loading gate:** No “call link before session” flash; show neutral spinner until session resolved.
- **SEO:** `robots: { index: false, follow: false }` (or equivalent) on this flow-only page — document in metadata.

---

### Task 11: Analytics

- Map **`INVALID_ORIGIN`** separately from link failures.
- Closed enum for **`link_after_auth_fail`** per spec §14; add **`invalid_origin`** if not present.

---

### Task 12: Verification sweep

- `pnpm exec tsc --noEmit` / `pnpm vitest run` / lint.
- **Manual:** Prefer **seeded DB row** (`payment_status = paid`, `user_id` null, valid `resume_token_hash`) + scripted **`Cookie:`** headers **or** dev-only route test — **or** full Paddle path if available. Do **not** block QA on MoR alone.

---

## Self-review (spec coverage)

| Spec section | Task(s) |
|--------------|---------|
| §7.1 prepare + `applicationId` | Task 6 + spec delta |
| §7.3 codes | Tasks 6–7B; **`LINK_SESSION_MISMATCH`** removed for v1 (spec delta) |
| §15 rate limits | Task 4 + disclaimer |
| D11 / env flag | Task 8 + “Binding decisions” |
| Audit RLS | Task 0 verification |
| D2 admin flag | Task 7A (Phase 3 column) |
| §5 matrix + **`paid`** for link | Task 1 **`guestLinkMatrixAllowsLink`** + Task 7A |
| Phase 3 enums / `0008` remap | “Phase 3 worktree” section + Task 1 literals + spec delta row |

**Gaps closed vs engineering review:** migration ownership; `LINK_SESSION_MISMATCH`; policy verification; **`INVALID_ORIGIN`**; gating rename; rate-limit disclaimer; Task 7 split; submitted 404; link-after-signup loading/SEO; QA without Paddle; real vitest path quoting; merge slices; `429` reuse.

---

**Plan v3.1 saved to `docs/superpowers/plans/2026-04-19-post-payment-guest-link-thank-you.md`.** **P0 applied:** `guestLinkMatrixAllowsLink` **requires `payment_status === "paid"`** + matching tests. Execution: **subagent-driven** or **inline** per your earlier preference when you start implementation.
