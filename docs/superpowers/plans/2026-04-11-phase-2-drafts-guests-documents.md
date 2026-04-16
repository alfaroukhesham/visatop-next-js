# Phase 2 — Drafts, guests, documents — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship server-authoritative **application drafts** created immediately after **nationality + visa service** selection, with **signed-in** and **guest** paths, **resume token** (hashed at rest), **fixed draft TTL**, **cleanup of expired unpaid drafts**, and a **document + extraction stub** pipeline—without Paddle checkout (Phase 3).

**Architecture:** Extend `application` with a **hashed resume token** for guests. **Signed-in** users use **`withClientDbActor`** plus new **RLS INSERT/UPDATE** policies scoped to `user_id = app.actor_id()` and draft-only constraints. **Guest** reads/writes after create: the **plaintext resume token is never stored in `localStorage`**; the server sets it in an **`HttpOnly` `Secure` `SameSite=Lax`** cookie on **`POST /api/applications`** (guest). Subsequent **`GET` / `PATCH` / documents / extract** for that draft read the token from the **`Cookie`** header server-side, verify against `resume_token_hash`, then run **`withSystemDbActor`** with queries **hard-bound** to `application.id` from the URL (RLS still cannot infer identity from cookies—verification happens in the route). **Documents** use the same guest vs signed-in split. **TTL** comes from env (or DB later); **`draft_expires_at`** is set once at creation (fixed window, not sliding). **Cleanup** runs under **`withSystemDbActor`** behind a **secret** or **Vercel Cron**-compatible route.

**Tech Stack:** Next.js App Router route handlers, Drizzle ORM, Neon HTTP + `db.transaction`, Postgres RLS (`drizzle/*.sql`), Vitest (`pnpm test` / `pnpm run test:ci`), existing **`jsonOk` / `jsonError`** ([`lib/api/response.ts`](../../lib/api/response.ts)), **`parseJsonBody`** ([`lib/api/parse-json-body.ts`](../../lib/api/parse-json-body.ts)), **`withClientDbActor` / `withSystemDbActor`** ([`lib/db/actor-context.ts`](../../lib/db/actor-context.ts)).

**Product / rules sources:** [`docs/IMPLEMENTATION_REFERENCE.md`](../../IMPLEMENTATION_REFERENCE.md) §3–4, §6, §9–10; [`docs/original-plan.md`](../../original-plan.md); workspace rules `visa-drafts-and-guest-storage.mdc`, `visa-application-state-machine.mdc`, `visa-api-response-envelope.mdc`, `visa-db-actor-context-usage.mdc`, `visa-rbac-and-rls.mdc`.

---

## File map (create / modify)

| Area | Create | Modify |
|------|--------|--------|
| Constants / domain | `lib/applications/status.ts` | — |
| Resume token crypto | `lib/applications/resume-token.ts` | — |
| Resume cookie (name + `Set-Cookie` / parse) | `lib/applications/resume-cookie.ts` | — |
| Draft TTL resolution | `lib/applications/draft-ttl.ts` | — |
| DB schema | `lib/db/schema/applications.ts` (extend), `lib/db/schema/application-document.ts` (new file) | `lib/db/schema/index.ts` |
| Migrations | `drizzle/0004_phase2_drafts_documents.sql` (name adjust to next journal id) | `drizzle/meta/_journal.json` (via `pnpm drizzle-kit generate` if you use kit) |
| HTTP | `app/api/applications/route.ts`, `app/api/applications/[id]/route.ts`, `app/api/applications/[id]/documents/route.ts`, `app/api/internal/cleanup-drafts/route.ts` (or `app/api/cron/...` per hosting) | — |
| Tests | `lib/applications/*.test.ts`, `app/api/applications/**/*.test.ts` | — |
| Docs | — | [`docs/IMPLEMENTATION_REFERENCE.md`](../../IMPLEMENTATION_REFERENCE.md) §9 Phase 2 row + §3 cross-links once shipped |

**Existing files to reuse as patterns:** [`app/api/applications/mine/route.ts`](../../app/api/applications/mine/route.ts) (client list), [`app/api/catalog/services/route.ts`](../../app/api/catalog/services/route.ts) (validation + `withSystemDbActor`), [`drizzle/0002_harsh_wolverine.sql`](../../drizzle/0002_harsh_wolverine.sql) lines 415–430 (current client `application` RLS), [`drizzle/0003_catalog_addon_rls.sql`](../../drizzle/0003_catalog_addon_rls.sql) (split write policies pattern).

---

## Locked domain constants (use everywhere)

**File:** `lib/applications/status.ts`

```typescript
export const APPLICATION_STATUS = {
  DRAFT: "draft",
} as const;

export const PAYMENT_STATUS = {
  UNPAID: "unpaid",
} as const;

export const FULFILLMENT_STATUS = {
  NOT_STARTED: "not_started",
} as const;
```

**Draft create body (Zod):** `nationalityCode` (alpha-2, same as catalog), `serviceId` (uuid string from `visa_service.id`), optional `guestEmail` (nullable string, max length reasonable e.g. 320).

**Statuses on insert:** `applicationStatus = draft`, `paymentStatus = unpaid`, `fulfillmentStatus = not_started`.

---

### Task 1: Application status constants (pure module)

**Files:**
- Create: `lib/applications/status.ts`
- Test: `lib/applications/status.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/applications/status.test.ts
import { describe, expect, it } from "vitest";
import { APPLICATION_STATUS, PAYMENT_STATUS, FULFILLMENT_STATUS } from "./status";

describe("application status constants", () => {
  it("exports stable draft lifecycle defaults", () => {
    expect(APPLICATION_STATUS.DRAFT).toBe("draft");
    expect(PAYMENT_STATUS.UNPAID).toBe("unpaid");
    expect(FULFILLMENT_STATUS.NOT_STARTED).toBe("not_started");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run lib/applications/status.test.ts`

Expected: **FAIL** (file `./status` not found).

- [ ] **Step 3: Minimal implementation**

Create `lib/applications/status.ts` with the exact exports from the “Locked domain constants” section above.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run lib/applications/status.test.ts`

Expected: **PASS**.

- [ ] **Step 5: Commit**

```bash
git add lib/applications/status.ts lib/applications/status.test.ts
git commit -m "feat(applications): add phase-2 status constants for drafts"
```

---

### Task 2: Resume token — generate, hash, verify (pure crypto)

**Files:**
- Create: `lib/applications/resume-token.ts`
- Test: `lib/applications/resume-token.test.ts`

**Behavior:** `generateResumeToken()` returns `{ plainToken, hash }` where `plainToken` is high-entropy (e.g. 32 bytes from `crypto.randomBytes`, base64url). `hashResumeToken(plain)` uses **SHA-256** hex (or base64) for storage in `application.resume_token_hash`. `timingSafeEqualUtf8(a, b)` compares hashes only.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/applications/resume-token.test.ts
import { describe, expect, it } from "vitest";
import { generateResumeToken, hashResumeToken, verifyResumeToken } from "./resume-token";

describe("resume-token", () => {
  it("verifyResumeToken returns true for matching plain token", () => {
    const { plainToken, hash } = generateResumeToken();
    expect(verifyResumeToken(plainToken, hash)).toBe(true);
  });

  it("verifyResumeToken returns false for wrong token", () => {
    const { hash } = generateResumeToken();
    expect(verifyResumeToken("wrong-token", hash)).toBe(false);
  });

  it("hashResumeToken is deterministic", () => {
    const h1 = hashResumeToken("same");
    const h2 = hashResumeToken("same");
    expect(h1).toBe(h2);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL** (`pnpm exec vitest run lib/applications/resume-token.test.ts`)

- [ ] **Step 3: Implement** `generateResumeToken`, `hashResumeToken`, `verifyResumeToken` using Node `crypto` (`createHash("sha256")`, `timingSafeEqual` on buffers of equal length).

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit** `feat(applications): add resume token hash helpers`

---

### Task 2b: Resume cookie — `Set-Cookie` builder + parse from `Cookie` header

**Files:**
- Create: `lib/applications/resume-cookie.ts`
- Test: `lib/applications/resume-cookie.test.ts`

**Locked cookie contract (MVP):**
- **Name:** constant `vt_resume` (optional env override `RESUME_COOKIE_NAME` later—YAGNI unless you need multi-tenant cookie names).
- **Value:** the **plaintext** resume token only (high entropy from Task 2). The client may store **`application.id`** in memory or **non-secret** UI state for routing; **never** put the plaintext token in `localStorage`.
- **`Set-Cookie` attributes:** `HttpOnly`, `Secure` (production; in local dev you may use `Secure` only when `NODE_ENV === 'production'` or when `https`—document in Task 12), `SameSite=Lax`, `Path=/`, **`Max-Age`** = same seconds as draft TTL (align with `DRAFT_TTL_HOURS` × 3600) so the cookie lifetime tracks the draft window.
- **Guest `POST` response:** JSON body is **`{ application: { id, …public fields } }` only** — **no** `resumeToken` field in JSON. Attach **`Set-Cookie`** via `jsonOk(..., { headers: { 'Set-Cookie': buildResumeSetCookieValue(plainToken, maxAgeSec, { secure }) } })` ([`lib/api/response.ts`](../../lib/api/response.ts) already merges `headers`).

**Helpers to implement:**
- `buildResumeSetCookieValue(plainToken: string, maxAgeSeconds: number, opts?: { secure?: boolean }): string` — returns a **full** `Set-Cookie` header value (single cookie).
- `readResumeTokenFromRequestCookies(cookieHeader: string | null, name?: string): string | null` — parse raw `Cookie` header (Vitest-friendly; in App Router you can also use `cookies().get(name)` where applicable).

- [ ] **Step 1: RED** — tests: built string contains `HttpOnly`, `SameSite=Lax`, `Path=/`, name `vt_resume`, and `Max-Age=86400` when passed `86400`; parser extracts value from `Cookie: vt_resume=abc; other=x`.

- [ ] **Step 2: GREEN** — implement `resume-cookie.ts`.

- [ ] **Step 3: Commit** `feat(applications): add HttpOnly resume cookie helpers`

---

### Task 3: Draft TTL — compute `draftExpiresAt` from “fixed window”

**Files:**
- Create: `lib/applications/draft-ttl.ts`
- Test: `lib/applications/draft-ttl.test.ts`

**Behavior:** `computeDraftExpiresAt(createdAt: Date, ttlHours: number): Date` returns `new Date(createdAt.getTime() + ttlHours * 3600 * 1000)` (non-sliding; caller passes `createdAt = now()` at insert).

**TTL source (MVP):** `getDraftTtlHours()` reads `Number(process.env.DRAFT_TTL_HOURS)` defaulting to `48` if unset/invalid. **Follow-up (same phase if time):** read from a `platform_setting` table keyed `draft_ttl_hours` — only add if Task 4 migration already introduces the table; otherwise YAGNI.

- [ ] **Step 1: Failing test** — assert `computeDraftExpiresAt(new Date("2026-01-01T00:00:00Z"), 24)` → `2026-01-02T00:00:00.000Z`.

- [ ] **Step 2: RED** — `pnpm exec vitest run lib/applications/draft-ttl.test.ts`

- [ ] **Step 3: GREEN** — implement `draft-ttl.ts`.

- [ ] **Step 4: Commit** `feat(applications): compute draft expiry from TTL hours`

---

### Task 4: Schema — `resume_token_hash` on `application` + `application_document` table

**Files:**
- Modify: `lib/db/schema/applications.ts` — add `resumeTokenHash: text("resume_token_hash")` nullable + index in table callback: `index("application_resumeTokenHash_idx").on(t.resumeTokenHash)` **only if** partial unique is done in SQL migration (Drizzle may not express partial unique; **prefer unique index in raw SQL migration** on `resume_token_hash` where not null).
- Create: `lib/db/schema/application-document.ts`:

```typescript
import { relations, sql } from "drizzle-orm";
import { pgTable, text, timestamp, index, bigint, integer } from "drizzle-orm/pg-core";
import { application } from "./applications";

export const EXTRACTION_STATUS = {
  PENDING: "pending",
  QUEUED: "queued",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
} as const;

export const applicationDocument = pgTable(
  "application_document",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    applicationId: text("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    extractionStatus: text("extraction_status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("application_document_applicationId_idx").on(t.applicationId),
  ],
);
```

- Modify: `lib/db/schema/index.ts` — `export * from "./application-document";`

- [ ] **Step 1: TDD at migration level** — **before** applying migration, add a **Vitest** that imports schema types and asserts table export exists (optional smoke). **Required:** after migration file exists, add **`tests/integration/rls-applications.test.ts`** (skipped unless `RUN_DB_TESTS=1`) with one test: `system` actor can `select` application by id after insert (see Task 6).

- [ ] **Step 2: Generate migration** using repo convention (`pnpm drizzle-kit generate` or hand-author `drizzle/0004_*.sql` matching `_journal.json` next tag).

**Migration SQL must include:**
- `ALTER TABLE application ADD COLUMN resume_token_hash text;`
- `CREATE UNIQUE INDEX ... ON application (resume_token_hash) WHERE resume_token_hash IS NOT NULL;` (prevents duplicate guest token hashes)
- `CREATE TABLE application_document (...);`
- **RLS** enable + policies:
  - **No** `client` policy on `application_document` until guest/client paths are fully modeled; **Phase 2 MVP:** only **`system`** (and **`admin`** with `applications.read`/`applications.write` if already seeded) policies mirroring `application` admin split **or** rely solely on **route-layer** `withSystemDbActor` for guest doc inserts — **simplest MVP:** RLS `ENABLE` + **`application_document_system_all`** `FOR ALL` `USING (app_actor_type()='system')` **plus** admin read/write policies analogous to `application` admin policies from `0002`. **Do not** add permissive client `FOR ALL`.

- [ ] **Step 3: Commit** `feat(db): phase-2 application resume hash and document table`

---

### Task 5: RLS — client can INSERT/UPDATE own draft `application`

**Files:**
- Modify: `drizzle/0004_*.sql` (append or separate `0005` if you split) — add policies:

```sql
-- INSERT: client may create row with user_id = actor id
CREATE POLICY application_client_insert_own ON application
  FOR INSERT
  WITH CHECK (
    app_actor_type() = 'client'
    AND user_id IS NOT NULL
    AND user_id = app_actor_id()
    AND is_guest = false
  );

-- UPDATE: client may update own row while still draft + unpaid (narrow USING + WITH CHECK)
CREATE POLICY application_client_update_own_draft ON application
  FOR UPDATE
  USING (
    app_actor_type() = 'client'
    AND user_id IS NOT NULL
    AND user_id = app_actor_id()
    AND application_status = 'draft'
    AND payment_status = 'unpaid'
  )
  WITH CHECK (
    app_actor_type() = 'client'
    AND user_id IS NOT NULL
    AND user_id = app_actor_id()
    AND application_status = 'draft'
    AND payment_status = 'unpaid'
  );
```

**Note:** Adjust column names to match actual SQL (`application_status` vs `"application_status"` per existing migration style).

- [ ] **Step 1: RED integration test** — in `tests/integration/rls-applications.test.ts`, case: `withActor('client', userId, '', ...)` **INSERT** into `application` **fails** before migration; **passes** after policies (requires real DB).

- [ ] **Step 2: Apply migration** locally; run `RUN_DB_TESTS=1 DATABASE_URL=... pnpm exec vitest run tests/integration/rls-applications.test.ts`

- [ ] **Step 3: Commit** `fix(rls): allow client insert/update for own draft applications`

---

### Task 6: `POST /api/applications` — signed-in draft create

**Files:**
- Create: `app/api/applications/route.ts`
- Test: `app/api/applications/route.test.ts`

**Contract:**
- Auth: Better Auth session required (`auth.api.getSession` from [`lib/auth`](../../lib/auth.ts) — mirror [`app/api/applications/mine/route.ts`](../../app/api/applications/mine/route.ts)).
- Body: `{ nationalityCode, serviceId }` — validate alpha-2 + service id shape (reuse regex from catalog or `z.string().min(1)` for serviceId).
- DB: `withClientDbActor(userId, async (tx) => tx.insert(application).values({...}).returning())`
- Set `isGuest: false`, `userId: userId`, `draftExpiresAt: computeDraftExpiresAt(new Date(), getDraftTtlHours())`, `resumeTokenHash: null`.
- Response: `jsonOk({ application: { id, referenceNumber, applicationStatus, paymentStatus, fulfillmentStatus, draftExpiresAt } }, { requestId })` — **omit** internal fields; **no** resume cookie for signed-in path (session owns the row via `user_id`).

- [ ] **Step 1: RED test** — mock `withClientDbActor` + `auth.getSession`, assert `POST` returns **401** without session; **400** on invalid body; **201** with valid body shape (mock insert returning one row).

```typescript
// app/api/applications/route.test.ts (sketch — fill imports to match repo)
import { describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "t-ap-post" }),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/db/actor-context", () => ({ withClientDbActor: vi.fn() }));

import { auth } from "@/lib/auth";
import * as actor from "@/lib/db/actor-context";
import { POST } from "./route";

describe("POST /api/applications", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await POST(
      new Request("http://localhost/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nationalityCode: "US", serviceId: "svc-1" }),
      }),
    );
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: GREEN** — implement route using `parseJsonBody` + `jsonOk`/`jsonError`.

- [ ] **Step 3: Commit** `feat(api): POST /api/applications for signed-in draft`

---

### Task 7: `POST /api/applications` — guest draft create (**HttpOnly** resume cookie)

**Files:**
- Modify: `app/api/applications/route.ts`
- Modify: `app/api/applications/route.test.ts`
- Use: `lib/applications/resume-cookie.ts` (Task 2b)

**Behavior:** If **no session**, accept guest create: `withSystemDbActor(async (tx) => { ... })` with `isGuest: true`, `userId: null`, `resumeTokenHash: hash`, same status fields and `draftExpiresAt`.

**Response:** `jsonOk({ application: { id, ...public fields } }, { status: 201, requestId, headers: { 'Set-Cookie': buildResumeSetCookieValue(plainToken, maxAgeSeconds) } })` — **JSON must not include** `resumeToken`. The browser stores the secret **only** in the **HttpOnly** cookie.

**Tests:** Assert **201**, response JSON **does not** have `resumeToken` / `resume_token`; assert **`Set-Cookie`** header is present and contains `HttpOnly` (parse `res.headers.get('set-cookie')` — note casing). Mock `withSystemDbActor`.

**Security:** Rate-limit consideration is **out of scope** for this plan document; add a follow-up task in PR if deploying publicly. **CSRF:** `SameSite=Lax` + same-site API usage is the baseline; document that **state-changing** guest routes should remain **POST/PATCH/DELETE** (not `GET`) so simple cross-site navigations do not mutate drafts.

- [ ] **Step 1: RED** — test: no session + valid body → **201**, no token in JSON, `Set-Cookie` present.

- [ ] **Step 2: GREEN** — branch on session null vs present; wire Task 2b.

- [ ] **Step 3: Commit** `feat(api): guest draft create with HttpOnly resume cookie`

---

### Task 8: `GET/PATCH /api/applications/[id]` — **resume cookie** for guest, session for user

**Files:**
- Create: `app/api/applications/[id]/route.ts`
- Test: `app/api/applications/[id]/route.test.ts`
- Create: `lib/applications/authorize-application-access.ts` (pure: `(session, applicationRow, resumeTokenPlain) => 'ok' | 'forbidden'` — `resumeTokenPlain` comes from **parsed Cookie**, not headers)

**Guest read:** Read plaintext token via **`readResumeTokenFromRequestCookies(req.headers.get('cookie'), 'vt_resume')`** (or `cookies().get('vt_resume')` in handlers that run in the App Router request context). Handler: `withSystemDbActor` → `select * from application where id = $id` → constant-time **`verifyResumeToken(token, row.resume_token_hash)`** → if ok return **neutral** payload per `visa-application-state-machine.mdc` (no internal automation strings). If cookie missing or verification fails → **`403`** (or **`401`**—pick one and keep consistent).

**User read:** `withClientDbActor` + `where id = $id and user_id = userId` (ignore resume cookie if session present; **prefer session** when both exist to avoid ambiguity).

**Guest PATCH (MVP minimal):** allow updating **only** `guest_email` while draft+unpaid — same cookie verification as GET; or **defer PATCH** for guest if not required.

**Clear cookie (optional MVP):** when draft is deleted or expires, cleanup route or DELETE handler may return **`Set-Cookie`** with **`Max-Age=0`** to clear `vt_resume` — document in Task 11/12 if implemented.

- [ ] **Step 1: RED tests** for GET **403** wrong/missing cookie, **200** with `Cookie: vt_resume=<plain>` matching row (mocked DB).

- [ ] **Step 2: GREEN**

- [ ] **Step 3: Commit** `feat(api): GET application by id with resume cookie or session`

---

### Task 9: Documents — `POST /api/applications/[id]/documents` (metadata only, stub storage)

**Files:**
- Create: `app/api/applications/[id]/documents/route.ts`
- Test: `app/api/applications/[id]/documents/route.test.ts`

**MVP body:** `{ storageKey, mimeType, sizeBytes }` — all required; **no** file bytes in JSON. Validates reasonable MIME and positive `sizeBytes`.

**Auth:** Same as Task 8 (session **or** **`vt_resume` HttpOnly cookie** + `id` in path).

**DB:** `withClientDbActor` or `withSystemDbActor` matching Task 8 decision; insert into `application_document` with `extractionStatus: 'pending'`.

- [ ] **Step 1: RED** — 401/403/201 matrix.

- [ ] **Step 2: GREEN**

- [ ] **Step 3: Commit** `feat(api): stub application document metadata create`

---

### Task 10: Extraction stub — queue flag only

**Files:**
- Create: `app/api/applications/[id]/extract/route.ts` (POST — no-op queue: sets `extractionStatus` to `queued` on **all** pending docs for that application, or inserts a no-op job row if you introduced `extraction_job` — **YAGNI:** only PATCH documents to `queued` in MVP)

- Test: `app/api/applications/[id]/extract/route.test.ts`

- [ ] **Step 1: RED** — POST returns **202** with `{ accepted: true, documentIds: [...] }`.

- [ ] **Step 2: GREEN**

- [ ] **Step 3: Commit** `feat(api): stub document extraction queue endpoint`

---

### Task 11: Cleanup — expired unpaid drafts

**Files:**
- Create: `app/api/internal/cleanup-drafts/route.ts`
- Test: `app/api/internal/cleanup-drafts/route.test.ts` (mock env secret)

**Behavior:** `POST` with header `x-internal-secret: process.env.INTERNAL_CRON_SECRET` (or query token — pick one). Uses `withSystemDbActor` to `delete` (or `update` archive flag if you prefer soft-delete — **YAGNI:** hard delete child rows via `ON DELETE CASCADE` from `0002`) where `payment_status = 'unpaid'` and `draft_expires_at < now()` and `application_status = 'draft'`.

- [ ] **Step 1: RED** — wrong secret → **401**/**403**; right secret + mock actor → **200** with `{ deletedCount: n }`.

- [ ] **Step 2: GREEN**

- [ ] **Step 3: Commit** `feat(api): internal cleanup of expired unpaid drafts`

---

### Task 12: `.env.example` + docs touch-up

**Files:**
- Modify: [`.env.example`](../../.env.example) — `DRAFT_TTL_HOURS=48`, `INTERNAL_CRON_SECRET=` (generate instructions). Note: **guest resume** uses **`HttpOnly` cookie `vt_resume`** (not `localStorage`); align cookie **`Max-Age`** with draft TTL hours.
- Modify: [`docs/IMPLEMENTATION_REFERENCE.md`](../../IMPLEMENTATION_REFERENCE.md) — Phase 2 row: link to **resume cookie** + cleanup route + document stub; one line on **`SameSite=Lax`** + POST-only mutations for CSRF baseline.

- [ ] **Step 1: Commit** `docs: document phase-2 env and application draft endpoints`

---

## Self-review (author checklist)

**1. Spec coverage**

| Requirement (IMPL + original-plan) | Task |
|------------------------------------|------|
| Create `Application` on nationality + service | 6, 7 |
| Fixed draft TTL (non-sliding) | 3, 6, 7 |
| Admin-configurable TTL | 3 (env MVP); optional DB settings follow-up noted |
| Client stores only **non-secret** draft id for routing; **resume secret** in **`HttpOnly`** cookie | 2b, 7, 8 (aligns with `visa-drafts-and-guest-storage.mdc` — avoid token in `localStorage`) |
| Cleanup unpaid expired | 11 |
| Guest RLS gap / resume token hashed | 4, 7, 8 |
| Documents + extraction stub | 9, 10 |
| Split statuses | 1 + insert values in 6/7 |
| JSON envelope + request id | 6–11 (use `jsonOk`/`jsonError`, `headers().get('x-request-id')`) |
| No Paddle / checkout in Phase 2 | Omitted intentionally |

**2. Placeholder scan:** No `TBD` / vague “handle errors” steps; follow-up items are explicit (rate limit, per-service TTL, soft delete).

**3. Type / naming consistency:** `application_status`, `payment_status`, `fulfillment_status` column naming must match **SQL** in migrations (`snake_case` in DB, Drizzle property camelCase in TS).

---

## Execution handoff

**Plan complete and saved to** `docs/superpowers/plans/2026-04-11-phase-2-drafts-guests-documents.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. **REQUIRED SUB-SKILL:** `superpowers:subagent-driven-development`.

2. **Inline Execution** — Run tasks sequentially in one session with checkpoints. **REQUIRED SUB-SKILL:** `superpowers:executing-plans`.

**Which approach?**

---

## TDD discipline (for every implementer)

For **each** task: write or extend the test first → run and confirm **RED** (meaningful failure) → smallest production change → run **GREEN** → `pnpm run lint` + `pnpm run test:ci` + `pnpm run build` before commit. **No production code without a failing test first** (see attached `test-driven-development` skill).
