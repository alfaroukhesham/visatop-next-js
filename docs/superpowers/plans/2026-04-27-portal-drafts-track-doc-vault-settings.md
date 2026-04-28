# Portal + Drafts/Track pagination + Doc vault (bi-directional reuse) + Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/portal` with the correct tiles and implement cursor-paginated drafts + signed-in track lists, a reusable “My documents” vault that can attach to applications (and ingest on guest→account link), and a `/portal/settings` page with in-page password change.

**Architecture:** Add user-level document tables (`user_document` + blob) and a provenance link table so attaching from vault copies bytes into existing `application_document` tables without changing existing application document lifecycle. Use server-side cursor pagination endpoints for drafts and application lists, and update client pages to consume the new endpoints via the existing API response envelope.

**Tech Stack:** Next.js App Router (route handlers + RSC pages), Drizzle ORM, Neon serverless + RLS actor context wrappers, Better Auth, Vitest (`pnpm test:ci`).

## Solidified decisions (to avoid thrash)

- **Source of truth for access control**: Vault + document bytes are **RLS-protected** tables. All reads/writes happen inside `withClientDbActor(...)` / `withSystemDbActor(...)`, and the migration must **enable RLS + add policies**.
- **Vault “attach” semantics**: attaching from vault is a **copy** into `application_document` + `application_document_blob` (no shared blobs) with a provenance link row; this preserves existing application document lifecycle and keeps application retention rules unchanged.
- **Idempotency rules**:
  - Vault upload and ingestion use a unique key on `(userId, sha256, documentType)` (vault dedupe).
  - Attach-from-vault must be safe to retry (either dedupe by `application_document_app_type_sha_uidx` or by checking provenance first).
- **Cursor pagination**: ordering is always `(createdAt desc, id desc)` and cursors are always produced/consumed via `lib/api/cursor.ts` helpers (no per-route ad-hoc base64 encoding).
- **Non-goals**: no sharing of vault documents across users; no “delete from vault” flow in this phase; no admin UI for vault.

> Note: This repo’s workflow rules say **don’t commit docs until reviewed/approved**. The “Commit” steps below are implementation guidance only.

---

## File map (what will change)

**DB schema**
- Create: `lib/db/schema/user-document.ts` (new tables + unions)
- Modify: `lib/db/schema/index.ts` (export new tables if you centralize exports)
- Create migration: `drizzle/000X_user_document_vault.sql` (or generated via `pnpm db:generate`)

**Portal + pages**
- Modify: `app/(client)/portal/page.tsx` (tiles: rename + new tile)
- Create: `app/(client)/portal/drafts/page.tsx` (draft list UI)
- Create: `app/(client)/portal/documents/page.tsx` (vault UI)
- Create: `app/(client)/portal/settings/page.tsx` (settings UI)
- Modify: `app/(client)/apply/track/page.tsx` (signed-in list + guest lookup)

**API routes (must include `export const runtime = "nodejs";`)**
- Create: `app/api/portal/drafts/route.ts` (GET cursor list)
- Create: `app/api/portal/applications/route.ts` (GET cursor list for signed-in track)
- Create: `app/api/portal/documents/upload/route.ts` (POST multipart)
- Create: `app/api/portal/documents/route.ts` (GET cursor list + type filter)
- Create: `app/api/portal/documents/[id]/preview/route.ts` (GET preview)
- Create: `app/api/applications/[id]/documents/attach-from-vault/route.ts` (POST attach/copy)
- Create: `app/api/portal/me/route.ts` (GET current user info)
- Create: `app/api/portal/change-password/route.ts` (POST current→new password)

**Guest-link ingestion (bi-directional)**
- Modify: `app/api/applications/link-after-auth/route.ts` (after successful link: ingest eligible app docs into vault; idempotent)

**Tests**
- Create: `app/api/portal/drafts/route.test.ts`
- Create: `app/api/portal/applications/route.test.ts`
- Create: `app/api/portal/documents/route.test.ts`
- Create: `app/api/applications/[id]/documents/attach-from-vault/route.test.ts`
- Extend: `app/api/applications/link-after-auth/route.test.ts` (assert ingestion)

---

## Cursor pagination conventions (shared)

Cursor encoding should be opaque and stable:

- Sort order: `(createdAt desc, id desc)`
- Cursor payload: `{ createdAt: string; id: string }` where `createdAt` is ISO.
- Encode as base64url JSON.

Reference helper (create in `lib/api/cursor.ts` if you want reuse):

```ts
export type Cursor = { createdAt: string; id: string };

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}
```

API response shape for lists (enveloped via `jsonOk`):

```ts
{
  items: T[];
  nextCursor: string | null;
}
```

Default `limit`: **5**. Max `limit`: 50.

---

## Task 1: Add user document vault tables (Drizzle schema + migration)

**Files:**
- Create: `lib/db/schema/user-document.ts`
- Modify: `lib/db/schema/index.ts` (if needed)
- Create: `drizzle/000X_user_document_vault.sql` (via drizzle-kit generate)
- Test: `lib/db/schema/user-document.test.ts` (optional light type test) OR rely on route tests.

- [ ] **Step 1: Add schema definitions**

Create `lib/db/schema/user-document.ts`:

```ts
import { relations, sql } from "drizzle-orm";
import { bigint, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { applicationDocument } from "./application-document";
import { bytea, DOCUMENT_TYPE } from "./application-document";

export type UserDocumentType =
  | (typeof DOCUMENT_TYPE)[keyof typeof DOCUMENT_TYPE]
  // Keep vault flexible even if app docs add more types later:
  | "supporting";

export const SUPPORTING_CATEGORY = {
  AIR_TICKET: "air_ticket",
  HOTEL_RESERVATION: "hotel_reservation",
  PASSPORT_ADDITIONAL_PAGE: "passport_additional_page",
  OTHER: "other",
} as const;
export type SupportingCategory = (typeof SUPPORTING_CATEGORY)[keyof typeof SUPPORTING_CATEGORY];

export const userDocument = pgTable(
  "user_document",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),

    documentType: text("document_type").notNull(), // matches UserDocumentType
    // Optional for `supporting` only
    supportingCategory: text("supporting_category"),

    contentType: text("content_type"),
    byteLength: bigint("byte_length", { mode: "number" }),
    originalFilename: text("original_filename"),
    sha256: text("sha256").notNull(),

    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("user_document_userId_idx").on(t.userId),
    index("user_document_type_idx").on(t.documentType),
    index("user_document_createdAt_idx").on(t.createdAt),
    uniqueIndex("user_document_user_sha_type_uidx").on(t.userId, t.sha256, t.documentType),
  ],
);

export const userDocumentBlob = pgTable("user_document_blob", {
  documentId: text("document_id").primaryKey().references(() => userDocument.id, { onDelete: "cascade" }),
  bytes: bytea("bytes").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const applicationDocumentSource = pgTable(
  "application_document_source",
  {
    applicationDocumentId: text("application_document_id")
      .primaryKey()
      .references(() => applicationDocument.id, { onDelete: "cascade" }),
    userDocumentId: text("user_document_id").notNull().references(() => userDocument.id, { onDelete: "cascade" }),
    copiedAt: timestamp("copied_at").defaultNow().notNull(),
  },
  (t) => [index("application_document_source_userDocumentId_idx").on(t.userDocumentId)],
);

export const userDocumentRelations = relations(userDocument, ({ one }) => ({
  user: one(user, { fields: [userDocument.userId], references: [user.id] }),
  blob: one(userDocumentBlob, { fields: [userDocument.id], references: [userDocumentBlob.documentId] }),
}));
```

- [ ] **Step 2: Generate migration**

Run:

```bash
pnpm -s db:generate
```

Expected: A new `drizzle/*.sql` migration containing `user_document`, `user_document_blob`, `application_document_source` tables and indexes.

- [ ] **Step 2b: Add RLS + policies in the migration (required)**

In the generated SQL migration, add (or ensure) the following:

- Enable RLS:
  - `ALTER TABLE user_document ENABLE ROW LEVEL SECURITY;`
  - `ALTER TABLE user_document_blob ENABLE ROW LEVEL SECURITY;`
  - `ALTER TABLE application_document_source ENABLE ROW LEVEL SECURITY;`
- Policies (minimal, client-owned read/write):
  - `user_document`: allow client select/insert/update/delete where `user_id = current_setting('app.actor_id', true)`.
  - `user_document_blob`: allow access only via join to `user_document` for the same user.
  - `application_document_source`: allow client select/insert where the `application_document_id` belongs to an application owned by the actor (join `application_document` → `application` on `user_id`).

If you already have a central “RLS helper SQL style” in this repo, follow that style (naming, `USING` vs `WITH CHECK`, etc.)—the key is: **no direct access without actor context**.

- [ ] **Step 3: Apply migration locally**

Run:

```bash
pnpm -s db:migrate
```

- [ ] **Step 4: Run CI tests**

Run:

```bash
pnpm -s test:ci
```

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema/user-document.ts drizzle
git commit -m "feat: add user document vault tables"
```

---

## Task 2: Cursor helpers + limit parsing (shared infra)

**Files:**
- Create: `lib/api/cursor.ts`
- Test: `lib/api/cursor.test.ts`

- [ ] **Step 1: Add helper**

Create `lib/api/cursor.ts` with `encodeCursor`, `decodeCursor`, and a safe `parseLimit`:

```ts
export type Cursor = { createdAt: string; id: string };

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

export function parseLimit(raw: string | null, opts?: { defaultLimit?: number; max?: number }) {
  const def = opts?.defaultLimit ?? 5;
  const max = opts?.max ?? 50;
  const n = raw ? Number(raw) : def;
  if (!Number.isFinite(n)) return def;
  return Math.max(1, Math.min(max, Math.floor(n)));
}
```

- [ ] **Step 2: Add tests**

Create `lib/api/cursor.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { decodeCursor, encodeCursor, parseLimit } from "./cursor";

describe("cursor", () => {
  test("encode/decode roundtrip", () => {
    const raw = encodeCursor({ createdAt: "2026-01-01T00:00:00.000Z", id: "id-1" });
    expect(decodeCursor(raw)).toEqual({ createdAt: "2026-01-01T00:00:00.000Z", id: "id-1" });
  });
  test("decode invalid returns null", () => {
    expect(decodeCursor("not-base64")).toBeNull();
  });
  test("parseLimit defaults to 5", () => {
    expect(parseLimit(null)).toBe(5);
  });
  test("parseLimit clamps", () => {
    expect(parseLimit("999", { max: 50 })).toBe(50);
    expect(parseLimit("0")).toBe(1);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm -s test:ci
```

- [ ] **Step 4: Commit**

```bash
git add lib/api/cursor.ts lib/api/cursor.test.ts
git commit -m "chore: add cursor pagination helpers"
```

---

## Task 3: Draft list API (`GET /api/portal/drafts`) with cursor pagination

**Files:**
- Create: `app/api/portal/drafts/route.ts`
- Create: `app/api/portal/drafts/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `app/api/portal/drafts/route.test.ts` following existing route test patterns in the repo. The test should assert:
- unauthenticated → 401
- authenticated → returns `{ items, nextCursor }`
- excludes expired drafts
- default limit 5

Example skeleton (adapt to your test harness utilities):

```ts
import { describe, expect, test } from "vitest";

describe("GET /api/portal/drafts", () => {
  test("requires session", async () => {
    const res = await fetch("http://test/api/portal/drafts");
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Implement route**

Create `app/api/portal/drafts/route.ts`:

```ts
import { headers } from "next/headers";
import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api/response";
import { decodeCursor, encodeCursor, parseLimit } from "@/lib/api/cursor";
import { withClientDbActor } from "@/lib/db/actor-context";
import { application } from "@/lib/db/schema/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) return jsonError("UNAUTHORIZED", "Unauthorized", { status: 401, requestId });

  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"), { defaultLimit: 5, max: 50 });
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  const now = new Date();

  const rows = await withClientDbActor(session.user.id, async (tx) => {
    const baseWhere = and(
      eq(application.userId, session.user.id),
      // “not paid” + resumable draft; keep aligned with your canonical state helpers if available
      eq(application.paymentStatus, "unpaid"),
      or(isNull(application.draftExpiresAt), gt(application.draftExpiresAt, now)),
    );

    const cursorWhere = cursor
      ? or(
          lt(application.createdAt, new Date(cursor.createdAt)),
          and(eq(application.createdAt, new Date(cursor.createdAt)), lt(application.id, cursor.id)),
        )
      : undefined;

    return tx
      .select({
        id: application.id,
        referenceNumber: application.referenceNumber,
        serviceId: application.serviceId,
        nationalityCode: application.nationalityCode,
        createdAt: application.createdAt,
        draftExpiresAt: application.draftExpiresAt,
      })
      .from(application)
      .where(cursorWhere ? and(baseWhere, cursorWhere) : baseWhere)
      .orderBy(desc(application.createdAt), desc(application.id))
      .limit(limit + 1);
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const last = slice[slice.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

  return jsonOk(
    {
      items: slice.map((r) => ({
        id: r.id,
        referenceDisplay: r.referenceNumber ?? r.id.slice(0, 8),
        serviceId: r.serviceId,
        nationalityCode: r.nationalityCode,
        createdAt: r.createdAt.toISOString(),
        draftExpiresAt: r.draftExpiresAt ? r.draftExpiresAt.toISOString() : null,
      })),
      nextCursor,
    },
    { requestId },
  );
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm -s test:ci
```

- [ ] **Step 4: Commit**

```bash
git add app/api/portal/drafts/route.ts app/api/portal/drafts/route.test.ts
git commit -m "feat: add cursor-paginated drafts api"
```

---

## Task 4: Signed-in applications list API (`GET /api/portal/applications`) for Track (cursor pagination)

**Files:**
- Create: `app/api/portal/applications/route.ts`
- Create: `app/api/portal/applications/route.test.ts`

- [ ] **Step 1: Write failing test**

Test:
- requires auth
- default limit 5
- returns stable ordering + nextCursor.

- [ ] **Step 2: Implement route**

Use `withClientDbActor` and select minimal fields needed plus statuses for `computeClientApplicationTracking`:

```ts
import { headers } from "next/headers";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api/response";
import { decodeCursor, parseLimit, encodeCursor } from "@/lib/api/cursor";
import { withClientDbActor } from "@/lib/db/actor-context";
import { application } from "@/lib/db/schema/applications";
import { computeClientApplicationTracking } from "@/lib/applications/user-facing-tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) return jsonError("UNAUTHORIZED", "Unauthorized", { status: 401, requestId });

  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"), { defaultLimit: 5, max: 50 });
  const cursor = decodeCursor(url.searchParams.get("cursor"));

  const rows = await withClientDbActor(session.user.id, async (tx) => {
    const baseWhere = eq(application.userId, session.user.id);
    const cursorWhere = cursor
      ? or(
          lt(application.createdAt, new Date(cursor.createdAt)),
          and(eq(application.createdAt, new Date(cursor.createdAt)), lt(application.id, cursor.id)),
        )
      : undefined;

    return tx
      .select({
        id: application.id,
        referenceNumber: application.referenceNumber,
        createdAt: application.createdAt,
        applicationStatus: application.applicationStatus,
        paymentStatus: application.paymentStatus,
        fulfillmentStatus: application.fulfillmentStatus,
        adminAttentionRequired: application.adminAttentionRequired,
      })
      .from(application)
      .where(cursorWhere ? and(baseWhere, cursorWhere) : baseWhere)
      .orderBy(desc(application.createdAt), desc(application.id))
      .limit(limit + 1);
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const last = slice[slice.length - 1];

  return jsonOk(
    {
      items: slice.map((r) => ({
        id: r.id,
        referenceDisplay: r.referenceNumber ?? r.id.slice(0, 8),
        createdAt: r.createdAt.toISOString(),
        clientTracking: computeClientApplicationTracking({
          applicationStatus: r.applicationStatus,
          paymentStatus: r.paymentStatus,
          fulfillmentStatus: r.fulfillmentStatus,
          adminAttentionRequired: r.adminAttentionRequired,
        }),
      })),
      nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null,
    },
    { requestId },
  );
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm -s test:ci
```

- [ ] **Step 4: Commit**

```bash
git add app/api/portal/applications/route.ts app/api/portal/applications/route.test.ts
git commit -m "feat: add cursor-paginated signed-in application list api"
```

---

## Task 5: Update `/apply/track` page (signed-in list + guest lookup w/ pagination)

**Files:**
- Modify: `app/(client)/apply/track/page.tsx`
- Modify/Create: `components/apply/application-track-lookup-form.tsx` (guest pagination integration)
- Create: `components/portal/signed-in-track-list.tsx` (client component) OR implement as RSC using server fetch to `/api/portal/applications`.

- [ ] **Step 1: Implement signed-in mode**

In `app/(client)/apply/track/page.tsx`:
- read `session` via `auth.api.getSession({ headers: await headers() })`
- if session exists: render signed-in list component that fetches from `/api/portal/applications?limit=5`
- else: render existing `<ApplicationTrackLookupForm />`

- [ ] **Step 2: Add pagination UI**

Signed-in list should show:
- items
- “Load more” button using `nextCursor`

Guest lookup should:
- POST to existing `/api/applications/track-lookup` to get initial matches
- then call a new **paginated** variant:
  - either extend existing `POST /api/applications/track-lookup` to accept cursor/limit (recommended: add a `GET` or `POST` with `cursor` and return nextCursor), or
  - add `app/api/applications/track-lookup/list/route.ts` that accepts `{ contact, cursor, limit }`.

**Implementation decision (recommended):** extend existing `POST` body schema to:

```ts
{ contact: string; limit?: number; cursor?: string | null }
```

and return `{ applications, nextCursor }`.

- [ ] **Step 3: Add/adjust tests**

Extend `app/api/applications/track-lookup/route.test.ts` to cover:
- default limit 5
- cursor returns next page

- [ ] **Step 4: Run tests + commit**

```bash
pnpm -s test:ci
git add app/(client)/apply/track/page.tsx app/api/applications/track-lookup/route.ts app/api/applications/track-lookup/route.test.ts components/apply/application-track-lookup-form.tsx
git commit -m "feat: paginate track results for guests and signed-in users"
```

---

## Task 6: Portal landing tiles update (`/portal`)

**Files:**
- Modify: `app/(client)/portal/page.tsx`

- [ ] **Step 1: Update tiles**

Change:
- “Dashboard” → “Draft applications” → `/portal/drafts`
- “All applications” → “Track application” → `/apply/track`
- Add new tile “My documents” → `/portal/documents`

- [ ] **Step 2: Run tests + commit**

```bash
pnpm -s test:ci
git add app/(client)/portal/page.tsx
git commit -m "feat: update portal tiles for drafts, track, and documents"
```

---

## Task 7: Draft applications page (`/portal/drafts`) consuming drafts API

**Files:**
- Create: `app/(client)/portal/drafts/page.tsx`
- Create: `components/portal/drafts-list.tsx` (client component)

- [ ] **Step 1: Implement page**

RSC page renders layout + loads initial list via client component.

Client component:
- fetch `/api/portal/drafts?limit=5`
- list items with “Continue” link:
  - choose existing continuation route currently used for drafts (likely `/apply/applications/[id]` or `/portal/application-workspace?applicationId=` depending on your flow).
- load-more via `nextCursor`.

- [ ] **Step 2: Run tests + commit**

```bash
pnpm -s test:ci
git add app/(client)/portal/drafts/page.tsx components/portal/drafts-list.tsx
git commit -m "feat: add portal drafts page with cursor pagination"
```

---

## Task 8: Vault upload + list + preview APIs

**Files:**
- Create: `app/api/portal/documents/upload/route.ts`
- Create: `app/api/portal/documents/route.ts`
- Create: `app/api/portal/documents/[id]/preview/route.ts`
- Create tests: `app/api/portal/documents/route.test.ts`
- Reuse helpers:
  - use existing upload patterns from `app/api/applications/[id]/documents/upload/route.ts`

- [ ] **Step 1: Upload route**

Requirements:
- authenticated only
- accepts multipart: `documentType`, optional `supportingCategory`, `file`
- compute `sha256`
- insert metadata into `user_document` (idempotent: if same `userId+sha256+documentType` exists, reuse row)
- insert blob into `user_document_blob` if new

- [ ] **Step 2: List route**

`GET /api/portal/documents?type=&limit=&cursor=` returns:
- items: `id, documentType, supportingCategory, originalFilename, byteLength, contentType, sha256, createdAt, expiresAt`
- nextCursor

- [ ] **Step 3: Preview route**

`GET /api/portal/documents/:id/preview`:
- checks ownership via `withClientDbActor`
- streams bytes with proper `Content-Type`

- [ ] **Step 4: Tests**

Cover:
- 401 if no session
- upload then list shows item
- preview returns 200 with correct content-type

- [ ] **Step 5: Run tests + commit**

```bash
pnpm -s test:ci
git add app/api/portal/documents app/api/portal/documents/route.test.ts
git commit -m "feat: add vault upload/list/preview apis"
```

---

## Task 9: Attach-from-vault API (copy into application documents + provenance)

**Files:**
- Create: `app/api/applications/[id]/documents/attach-from-vault/route.ts`
- Create: `app/api/applications/[id]/documents/attach-from-vault/route.test.ts`
- Modify (optional): `lib/applications/document-upload.ts` to share logic

- [ ] **Step 1: Failing test**

Test should assert:
- requires session
- validates app ownership
- copies blob and creates `application_document` + `application_document_blob`
- writes `application_document_source`

- [ ] **Step 2: Route implementation**

Pseudo:
- `session = auth.api.getSession`
- verify user owns application (via `withClientDbActor` select application FOR UPDATE)
- verify `user_document` belongs to user
- copy bytes:
  - insert into `application_document` with same `documentType` and metadata
  - insert into `application_document_blob`
  - insert into `application_document_source`

Idempotency options (pick one and test it):
- **Option A (preferred)**: attempt to insert `application_document` and rely on `application_document_app_type_sha_uidx`; if it conflicts, reuse the existing `application_document.id` and ensure `application_document_source` row exists.
- **Option B**: check `application_document_source` first (by `userDocumentId` + `applicationId` join) and early-return if already attached.

- [ ] **Step 3: Tests + commit**

```bash
pnpm -s test:ci
git add app/api/applications/[id]/documents/attach-from-vault
git commit -m "feat: attach vault documents to applications via copy"
```

---

## Task 10: Vault UI (`/portal/documents`) + “use in application” affordance

**Files:**
- Create: `app/(client)/portal/documents/page.tsx`
- Create: `components/portal/vault-uploader.tsx`
- Create: `components/portal/vault-list.tsx`
- Modify: `components/apply/application-draft-panel.tsx` (add “Choose from My documents” next to upload slots)

- [ ] **Step 1: Vault page**

UI sections:
- Passport (bio page)
- Personal photo
- Supporting documents with category selector:
  - air ticket / hotel reservation / additional passport page / other

- [ ] **Step 2: “Choose from My documents” in draft panel**

For each doc slot:
- open dialog listing vault docs filtered by type
- on confirm: call `/api/applications/:id/documents/attach-from-vault`
- refresh draft panel (`load({ silent: true })`)

- [ ] **Step 3: Run tests + commit**

```bash
pnpm -s test:ci
git add app/(client)/portal/documents/page.tsx components/portal components/apply/application-draft-panel.tsx
git commit -m "feat: add my documents vault ui and attach flow"
```

---

## Task 11: Bi-directional ingestion on guest→account link

**Files:**
- Modify: `app/api/applications/link-after-auth/route.ts`
- Modify test: `app/api/applications/link-after-auth/route.test.ts`

- [ ] **Step 1: Extend test first**

Add a test case:
- create an application as guest with uploaded `application_document` rows (passport_copy, personal_photo, supporting)
- perform link-after-auth
- assert corresponding `user_document` rows exist for the user (idempotent by sha256+type)

- [ ] **Step 2: Implement ingestion**

After successful application ownership update (inside the same `withSystemDbActor` tx):
- select eligible `application_document` metadata + blob bytes for the linked application
- for each:
  - upsert into `user_document` on `(userId, sha256, documentType)`
  - insert blob if new

Idempotency:
- use the unique index on `(userId, sha256, documentType)` and `onConflictDoNothing`/select-first pattern.

- [ ] **Step 2b: Decide which application documents are eligible**

In ingestion, only consider application documents that are:
- owned by the linked application
- have non-null `sha256`
- are in a “kept” state (e.g. `status = retained` **or** whatever your canonical “user-provided doc” statuses are at link time)

Avoid ingesting:
- admin-only document types (e.g. outcome packs)
- deleted/rejected docs

- [ ] **Step 3: Run tests + commit**

```bash
pnpm -s test:ci
git add app/api/applications/link-after-auth/route.ts app/api/applications/link-after-auth/route.test.ts
git commit -m "feat: ingest application documents into vault on guest link"
```

---

## Task 12: Settings APIs + page (personal details + change password)

**Files:**
- Create: `app/api/portal/me/route.ts`
- Create: `app/api/portal/change-password/route.ts`
- Create: `app/(client)/portal/settings/page.tsx`
- Create: `components/portal/change-password-form.tsx`
- Test: `app/api/portal/change-password/route.test.ts`

- [ ] **Step 1: `GET /api/portal/me`**

Return: `{ user: { id, name, email } }` for signed-in users; 401 otherwise.

- [ ] **Step 2: `POST /api/portal/change-password`**

Body:
```ts
{ currentPassword: string; newPassword: string }
```

Implementation:
- Validate session
- Call Better Auth server API for password change (current→new). **Confirm the exact API surface in this repo** (e.g. `auth.api.changePassword(...)` or the correct Better Auth method) and use that directly—don’t roll your own hashing.
- Return `jsonOk({ changed: true })` or `jsonError("VALIDATION_ERROR", ...)`.

- [ ] **Step 3: Settings UI**

RSC page:
- reads server session (redirect to `/sign-in?callbackUrl=/portal/settings` if missing)
- shows personal details
- renders `<ChangePasswordForm />` client component that posts to change-password route

- [ ] **Step 4: Run tests + commit**

```bash
pnpm -s test:ci
git add app/api/portal app/(client)/portal/settings components/portal
git commit -m "feat: add portal settings page and password change"
```

---

## Task 13: Account button routing

**Files:**
- Modify: `components/client/client-app-header.tsx`

- [ ] **Step 1: Point Account button to `/portal/settings`**

- [ ] **Step 2: Run tests + commit**

```bash
pnpm -s test:ci
git add components/client/client-app-header.tsx
git commit -m "feat: route account button to portal settings"
```

---

## Self-review checklist (plan vs spec)

- [ ] **Drafts**: non-expired only; cursor pagination; default limit 5.
- [ ] **Track**: signed-in shows paginated list (Option A); guest lookup results paginated.
- [ ] **Vault**: upload/list/preview; attach-from-vault copy; supporting categories; bidirectional ingestion on guest link.
- [ ] **Settings**: personal details + in-page password change.
- [ ] **API envelope + runtime**: all new routes use `jsonOk/jsonError` and include `export const runtime = "nodejs";`.
- [ ] **RLS**: all DB access via `withClientDbActor`/`withSystemDbActor` as appropriate.

---

## Execution choice

Plan complete and saved to `docs/superpowers/plans/2026-04-27-portal-drafts-track-doc-vault-settings.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?

