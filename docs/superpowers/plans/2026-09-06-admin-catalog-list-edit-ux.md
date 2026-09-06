# Admin catalog list-then-edit UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Spec:** [2026-09-06-admin-catalog-list-edit-ux-design.md](../specs/2026-09-06-admin-catalog-list-edit-ux-design.md)  
> **Do not commit docs or code until the user asks.** Suggested commit messages are for later.

**Goal:** Replace the admin Catalog dump (inline-edit tables + global eligibility form) with Document-rules-style read-only lists, dedicated add/edit pages, and bidirectional eligibility nested under nationality and service.

**Architecture:** Keep `visa_service_eligibility` as the source of truth. Add delete helpers that `409` when an `application` row still references the entity. Extend eligibility `POST` to accept `{ pairs }` in one transaction. Replace `catalog-workspace.tsx` with a tabbed hub plus small page components. No new tables.

**Tech Stack:** Next.js App Router, Drizzle + Neon, `runAdminDbJson` / `withAdminDbActor`, `jsonOk`/`jsonError`, Vitest, existing `ConfirmDialog` / `ListPaginatorBar` / `usePaginatedList`. Components: `FC` + `I*Props`, types `T*`, arrow functions only. Every new `app/api/**/route.ts` must `export const runtime = "nodejs"`.

---

## Review locks

| Topic | Rule |
|---|---|
| Hub | `/admin/catalog?tab=services\|nationalities`. Unknown tab → services. |
| Lists | Read-only. No inputs in rows. On/Off is a badge. |
| Forms | Dedicated pages only. |
| Nationality open | Combined page: fields + eligible services. |
| Service edit | Fields + eligible nationalities. |
| Pickers | Unlinked items only. Multi-select + one confirm. `{ pairs }` POST. |
| Delete | `409 CONFLICT` if any application references the row. Copy: disable instead. Allowed delete cascades eligibility/prices/doc extras. |
| Nav | Label **Catalog**. Overview card title **Catalog**. |
| Document rules | “Add eligibility” → `/admin/catalog/nationalities/[code]`. |
| Out of scope | Pricing, public catalog APIs, Document rules assignment logic. |

---

## File map

| Area | Create | Modify | Remove after Task 12 |
|---|---|---|---|
| Delete domain | `lib/admin/catalog/delete-catalog-entity.ts` + `.test.ts` | — | — |
| Eligibility domain | `lib/admin/catalog/link-eligibility-pairs.ts` + `.test.ts` | `eligibility/route.ts` + `.test.ts`, `eligibility-mutations.ts` | — |
| Delete API | — | `nationalities/[code]/route.ts` + `.test.ts`, `visa-services/[id]/route.ts` + `.test.ts` | — |
| List shape | — | `catalog-types.ts`, `list-catalog-eligibility.ts`, GET eligibility test mock | — |
| Loaders | `lib/admin/catalog/get-catalog-entity.ts` | `load-catalog-page.ts` (keep) | — |
| Hub UI | `catalog-hub.tsx`, `catalog-service-list.tsx`, `catalog-nationality-list.tsx` | `catalog/page.tsx`, `admin-shell.tsx`, `app/admin/(protected)/page.tsx` | `catalog-workspace.tsx` |
| Forms | `catalog-service-form.tsx`, `catalog-nationality-form.tsx` | — | — |
| Nested eligibility | `catalog-eligibility-links.tsx`, `catalog-eligibility-picker.tsx`, `catalog-entity-delete-dialog.tsx` | `use-catalog-eligibility-page.ts` (reuse) | `catalog-eligibility-section.tsx`, `catalog-eligibility-table.tsx`, `catalog-eligibility-link-form.tsx` |
| Pages | `catalog/services/new`, `catalog/services/[id]/edit`, `catalog/services/[id]/nationalities/add`, `catalog/nationalities/new`, `catalog/nationalities/[code]`, `catalog/nationalities/[code]/services/add` | Document rules eligibility links | — |

Do **not** touch `catalog-document-rules-table.tsx`.

---

### Task 1: Delete domain (TDD)

**Files:**
- Create: `lib/admin/catalog/delete-catalog-entity.ts`
- Create: `lib/admin/catalog/delete-catalog-entity.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it, vi } from "vitest";
import { count, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import {
  CatalogDeleteBlockedError,
  CatalogEntityNotFoundError,
  deleteCatalogNationality,
  deleteCatalogVisaService,
} from "./delete-catalog-entity";

const makeTx = () => {
  const selectResult: unknown[] = [];
  const countResult = [{ n: 0 }];
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() => {
          if (table === schema.application) {
            return Promise.resolve(countResult);
          }
          return {
            limit: vi.fn(() => Promise.resolve(selectResult)),
          };
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  };
  return { tx, selectResult, countResult };
};

describe("deleteCatalogNationality", () => {
  it("throws not found when the code is missing", async () => {
    const { tx } = makeTx();
    await expect(deleteCatalogNationality(tx as never, "ZZ")).rejects.toBeInstanceOf(
      CatalogEntityNotFoundError,
    );
  });

  it("throws blocked when an application references the code", async () => {
    const { tx, selectResult, countResult } = makeTx();
    selectResult.push({ code: "IN", name: "India", enabled: true });
    countResult[0] = { n: 2 };
    await expect(deleteCatalogNationality(tx as never, "IN")).rejects.toBeInstanceOf(
      CatalogDeleteBlockedError,
    );
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it("deletes when no applications reference the code", async () => {
    const { tx, selectResult } = makeTx();
    const row = { code: "IN", name: "India", enabled: true };
    selectResult.push(row);
    await expect(deleteCatalogNationality(tx as never, "IN")).resolves.toEqual(row);
    expect(tx.delete).toHaveBeenCalled();
  });
});

describe("deleteCatalogVisaService", () => {
  it("throws blocked when an application references the service", async () => {
    const { tx, selectResult, countResult } = makeTx();
    selectResult.push({ id: "svc-1", name: "Tourist", enabled: true });
    countResult[0] = { n: 1 };
    await expect(deleteCatalogVisaService(tx as never, "svc-1")).rejects.toBeInstanceOf(
      CatalogDeleteBlockedError,
    );
  });
});
```

If the mock `select` chain does not match Drizzle’s builder, rewrite the helper to accept an injected `countApplications` in tests — **do not** skip the three behaviors: not found, blocked, delete.

- [ ] **Step 2: Run tests and confirm they fail**

```bash
rtk pnpm exec vitest run lib/admin/catalog/delete-catalog-entity.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
import { count, eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export class CatalogEntityNotFoundError extends Error {
  readonly code = "CATALOG_ENTITY_NOT_FOUND" as const;
  constructor(message = "Not found") {
    super(message);
    this.name = "CatalogEntityNotFoundError";
  }
}

export class CatalogDeleteBlockedError extends Error {
  readonly code = "CATALOG_DELETE_BLOCKED" as const;
  constructor(
    message = "This item is used on applications. Disable it instead of deleting.",
  ) {
    super(message);
    this.name = "CatalogDeleteBlockedError";
  }
}

const countApplications = async (
  tx: DbTransaction,
  where: ReturnType<typeof eq>,
): Promise<number> => {
  const rows = await tx.select({ n: count() }).from(schema.application).where(where);
  return Number(rows[0]?.n ?? 0);
};

export const deleteCatalogNationality = async (tx: DbTransaction, code: string) => {
  const codeUpper = code.trim().toUpperCase();
  const existing = await tx
    .select()
    .from(schema.nationality)
    .where(eq(schema.nationality.code, codeUpper))
    .limit(1);
  const row = existing[0];
  if (!row) throw new CatalogEntityNotFoundError("Nationality not found");
  const n = await countApplications(tx, eq(schema.application.nationalityCode, codeUpper));
  if (n > 0) {
    throw new CatalogDeleteBlockedError(
      "This nationality is used on applications. Disable it instead of deleting.",
    );
  }
  await tx.delete(schema.nationality).where(eq(schema.nationality.code, codeUpper));
  return row;
};

export const deleteCatalogVisaService = async (tx: DbTransaction, id: string) => {
  const existing = await tx
    .select()
    .from(schema.visaService)
    .where(eq(schema.visaService.id, id))
    .limit(1);
  const row = existing[0];
  if (!row) throw new CatalogEntityNotFoundError("Service not found");
  const n = await countApplications(tx, eq(schema.application.serviceId, id));
  if (n > 0) {
    throw new CatalogDeleteBlockedError(
      "This service is used on applications. Disable it instead of deleting.",
    );
  }
  await tx.delete(schema.visaService).where(eq(schema.visaService.id, id));
  return row;
};
```

- [ ] **Step 4: Re-run tests — expect PASS**

- [ ] **Step 5: Suggested commit** `feat(admin): block catalog deletes when applications exist`

---

### Task 2: DELETE routes (TDD)

**Files:**
- Modify: `app/api/admin/catalog/nationalities/[code]/route.ts`
- Create: `app/api/admin/catalog/nationalities/[code]/route.test.ts`
- Modify: `app/api/admin/catalog/visa-services/[id]/route.ts`
- Modify: `app/api/admin/catalog/visa-services/[id]/route.test.ts`

- [ ] **Step 1: Failing nationality DELETE tests** (same mock style as `visa-services/[id]/route.test.ts`)

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "del-nat" }),
}));
vi.mock("@/lib/admin-auth", () => ({
  adminAuth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/lib/db/actor-context", () => ({
  withAdminDbActor: vi.fn(),
}));

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { DELETE } from "./route";
import {
  CatalogDeleteBlockedError,
  CatalogEntityNotFoundError,
} from "@/lib/admin/catalog/delete-catalog-entity";

vi.mock("@/lib/admin/catalog/delete-catalog-entity", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/catalog/delete-catalog-entity")>(
    "@/lib/admin/catalog/delete-catalog-entity",
  );
  return { ...actual, deleteCatalogNationality: vi.fn() };
});

import { deleteCatalogNationality } from "@/lib/admin/catalog/delete-catalog-entity";

const authed = () => {
  vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
    fn({ tx: {} as never, permissions: ["catalog.read", "catalog.write", "audit.write"] }),
  );
};

describe("DELETE /api/admin/catalog/nationalities/[code]", () => {
  it("returns 401 without a session", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await DELETE(new Request("http://localhost/api/admin/catalog/nationalities/IN"), {
      params: Promise.resolve({ code: "IN" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 409 when applications still use the nationality", async () => {
    authed();
    vi.mocked(deleteCatalogNationality).mockRejectedValue(
      new CatalogDeleteBlockedError(
        "This nationality is used on applications. Disable it instead of deleting.",
      ),
    );
    const res = await DELETE(new Request("http://localhost/api/admin/catalog/nationalities/IN"), {
      params: Promise.resolve({ code: "IN" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CONFLICT");
  });

  it("returns 404 when missing", async () => {
    authed();
    vi.mocked(deleteCatalogNationality).mockRejectedValue(new CatalogEntityNotFoundError());
    const res = await DELETE(new Request("http://localhost/api/admin/catalog/nationalities/ZZ"), {
      params: Promise.resolve({ code: "ZZ" }),
    });
    expect(res.status).toBe(404);
  });
});
```

Visa-service tests in `visa-services/[id]/route.test.ts` (import `DELETE` alongside existing `PATCH`):

```typescript
it("returns 409 when applications still use the service", async () => {
  vi.mocked(deleteCatalogVisaService).mockRejectedValue(
    new CatalogDeleteBlockedError(
      "This service is used on applications. Disable it instead of deleting.",
    ),
  );
  const res = await DELETE(new Request("http://localhost/api/admin/catalog/visa-services/s1"), {
    params: Promise.resolve({ id: "s1" }),
  });
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.error.code).toBe("CONFLICT");
});

it("returns 404 when the service is missing", async () => {
  vi.mocked(deleteCatalogVisaService).mockRejectedValue(new CatalogEntityNotFoundError());
  const res = await DELETE(new Request("http://localhost/api/admin/catalog/visa-services/missing"), {
    params: Promise.resolve({ id: "missing" }),
  });
  expect(res.status).toBe(404);
});
```

- [ ] **Step 2: Run tests — expect FAIL** (DELETE not exported)

- [ ] **Step 3: Add DELETE handlers**

Nationality (`nationalities/[code]/route.ts`):

```typescript
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { code } = await ctx.params;
  return runAdminDbJson(
    requestId,
    ["catalog.read", "catalog.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      try {
        const row = await deleteCatalogNationality(tx, code);
        await writeAdminAudit(tx, {
          adminUserId,
          action: "catalog.nationality.delete",
          entityType: "nationality",
          entityId: row.code,
          beforeJson: JSON.stringify({ code: row.code, name: row.name, enabled: row.enabled }),
        });
        return jsonOk({ deleted: { code: row.code } }, { requestId });
      } catch (e) {
        if (e instanceof CatalogEntityNotFoundError) {
          return jsonError("NOT_FOUND", e.message, { status: 404, requestId });
        }
        if (e instanceof CatalogDeleteBlockedError) {
          return jsonError("CONFLICT", e.message, { status: 409, requestId });
        }
        throw e;
      }
    },
  );
}
```

Visa service (`visa-services/[id]/route.ts`): same shape, call `deleteCatalogVisaService(tx, id)`, audit `catalog.visa_service.delete` / `entityType: "visa_service"` / `entityId: row.id`, return `{ deleted: { id: row.id } }`.

Keep `export const runtime = "nodejs"`.

- [ ] **Step 4: Re-run both test files — expect PASS**

- [ ] **Step 5: Suggested commit** `feat(admin): add catalog nationality and service delete routes`

---

### Task 3: Bulk eligibility pairs (TDD)

**Files:**
- Create: `lib/admin/catalog/link-eligibility-pairs.ts`
- Create: `lib/admin/catalog/link-eligibility-pairs.test.ts`
- Modify: `app/api/admin/catalog/eligibility/route.ts`
- Modify: `app/api/admin/catalog/eligibility/route.test.ts`
- Modify: `lib/admin/catalog/eligibility-mutations.ts`

- [ ] **Step 1: Domain tests**

```typescript
import { describe, expect, it, vi } from "vitest";
import { LinkEligibilityValidationError, linkEligibilityPairs } from "./link-eligibility-pairs";

describe("linkEligibilityPairs", () => {
  it("rejects an empty pairs array", async () => {
    await expect(linkEligibilityPairs({} as never, [])).rejects.toBeInstanceOf(
      LinkEligibilityValidationError,
    );
  });

  it("rejects more than 200 pairs", async () => {
    const pairs = Array.from({ length: 201 }, (_, i) => ({
      serviceId: "s",
      nationalityCode: "IN",
    }));
    await expect(linkEligibilityPairs({} as never, pairs)).rejects.toBeInstanceOf(
      LinkEligibilityValidationError,
    );
  });

  it("inserts new pairs and skips audit for conflicts", async () => {
    const inserted = [
      { serviceId: "s1", nationalityCode: "IN" },
      undefined,
    ];
    let i = 0;
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(async () => {
              const row = inserted[i];
              i += 1;
              return row ? [row] : [];
            }),
          })),
        })),
      })),
    };
    const writeAudit = vi.fn();
    const result = await linkEligibilityPairs(tx as never, [
      { serviceId: "s1", nationalityCode: "IN" },
      { serviceId: "s1", nationalityCode: "US" },
    ], { adminUserId: "a1", writeAudit });
    expect(result.created).toEqual([{ serviceId: "s1", nationalityCode: "IN" }]);
    expect(result.deduped).toBe(1);
    expect(writeAudit).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `linkEligibilityPairs`**

```typescript
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export class LinkEligibilityValidationError extends Error {
  readonly code = "LINK_ELIGIBILITY_VALIDATION" as const;
  constructor(message: string) {
    super(message);
    this.name = "LinkEligibilityValidationError";
  }
}

export type TEligibilityPair = { serviceId: string; nationalityCode: string };

export const linkEligibilityPairs = async (
  tx: DbTransaction,
  pairs: TEligibilityPair[],
  opts: {
    adminUserId: string;
    writeAudit: (row: TEligibilityPair) => Promise<void>;
  },
): Promise<{ created: TEligibilityPair[]; deduped: number }> => {
  if (pairs.length < 1 || pairs.length > 200) {
    throw new LinkEligibilityValidationError("Provide between 1 and 200 eligibility pairs.");
  }
  const created: TEligibilityPair[] = [];
  let deduped = 0;
  for (const raw of pairs) {
    const nationalityCode = raw.nationalityCode.trim().toUpperCase();
    const serviceId = raw.serviceId.trim();
    const inserted = await tx
      .insert(schema.visaServiceEligibility)
      .values({ serviceId, nationalityCode })
      .onConflictDoNothing()
      .returning();
    const row = inserted[0];
    if (!row) {
      deduped += 1;
      continue;
    }
    const pair = { serviceId: row.serviceId, nationalityCode: row.nationalityCode };
    created.push(pair);
    await opts.writeAudit(pair);
  }
  return { created, deduped };
};
```

Do **not** catch FK errors here — `runAdminDbJson` already maps FK violations to 400. Map `LinkEligibilityValidationError` to `jsonError("VALIDATION_ERROR", e.message, { status: 400 })` in the route.

- [ ] **Step 4: Route tests for POST**

Keep the existing single-pair body working. Add:

```typescript
it("accepts pairs and returns created + deduped counts", async () => {
  // mock session + actor + spy linkEligibilityPairs
  const res = await POST(jsonRequest("http://localhost/api/admin/catalog/eligibility", "POST", {
    pairs: [
      { serviceId: "s1", nationalityCode: "in" },
      { serviceId: "s1", nationalityCode: "US" },
    ],
  }));
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.data.createdCount).toBe(2);
});

it("rejects empty pairs", async () => {
  const res = await POST(jsonRequest(..., { pairs: [] }));
  expect(res.status).toBe(400);
});
```

- [ ] **Step 5: Update POST handler**

```typescript
const pairSchema = z.object({
  serviceId: z.string().min(1),
  nationalityCode: z.string().length(2).regex(/^[A-Za-z]{2}$/).transform((s) => s.toUpperCase()),
});
const bodySchema = z.union([
  pairSchema,
  z.object({ pairs: z.array(pairSchema).min(1).max(200) }),
]);
```

If `"pairs" in parsed.data`, call `linkEligibilityPairs` and return `jsonOk({ createdCount, dedupedCount, items: created }, { status: createdCount > 0 ? 201 : 200 })`. Else keep the current single-pair 201/200 + `{ eligibility, deduped }` response.

- [ ] **Step 6: Client helper**

Add to `eligibility-mutations.ts`:

```typescript
export const linkCatalogEligibilityPairs = async (pairs: Array<{ serviceId: string; nationalityCode: string }>) =>
  fetchApiEnvelope<{ createdCount: number; dedupedCount: number }>(
    apiHref("/admin/catalog/eligibility"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairs }),
    },
  );
```

Add `deleteCatalogNationality` / `deleteCatalogVisaService` fetch helpers in the same file or `lib/admin/catalog/catalog-entity-mutations.ts` using `DELETE` + `apiHref`.

- [ ] **Step 7: Run eligibility + domain tests — expect PASS**

- [ ] **Step 8: Suggested commit** `feat(admin): bulk-create catalog eligibility pairs`

---

### Task 4: Eligibility list includes nationality name

**Files:**
- Modify: `lib/admin/catalog/catalog-types.ts`
- Modify: `lib/admin/catalog/list-catalog-eligibility.ts`
- Modify: `app/api/admin/catalog/eligibility/route.test.ts`

Service edit must show country **name**, not only the ISO code.

- [ ] **Step 1:** Add `nationalityName: string` to `CatalogEligibility`.

- [ ] **Step 2:** Inner-join `schema.nationality` in `listCatalogEligibility` and select `nationalityName: schema.nationality.name`.

- [ ] **Step 3:** Update the GET test mock in `eligibility/route.test.ts` to include `nationalityName: "United States"`. Dump-table components still compile until Task 10; they do not construct `CatalogEligibility` literals.

- [ ] **Step 4:** `rtk pnpm exec vitest run app/api/admin/catalog/eligibility/route.test.ts lib/admin/catalog` — expect PASS.

- [ ] **Step 5: Suggested commit** `feat(admin): include nationality name on eligibility list`

---

### Task 5: Nav + overview copy

**Files:**
- Modify: `components/admin/admin-shell.tsx`
- Modify: `app/admin/(protected)/page.tsx`

- [ ] **Step 1:** Change nav item `{ href: "/admin/catalog", key: "catalog", label: "Catalog" }`.

- [ ] **Step 2:** Overview card `title: "Catalog"`. Keep description “Manage services and nationalities.”

- [ ] **Step 3: Suggested commit** `fix(admin): rename Services nav to Catalog`

---

### Task 6: Catalog hub (read-only lists)

**Files:**
- Create: `components/admin/catalog-hub.tsx`
- Create: `components/admin/catalog-service-list.tsx`
- Create: `components/admin/catalog-nationality-list.tsx`
- Create: `lib/admin/catalog/catalog-entity-mutations.ts` (if not created in Task 3)
- Modify: `app/admin/(protected)/catalog/page.tsx`
- Keep: `lib/admin/catalog/load-catalog-page.ts`

Do **not** add a shadcn Tabs package. Use two `Link`s to `?tab=`.

- [ ] **Step 1: Replace catalog page**

`searchParams` is `Promise<{ tab?: string | string[] }>`. Normalize: `services` unless the value is exactly `nationalities`. Drop `prefillNat`. Title “Visa catalog”, subtitle “Manage services and nationalities.” Render `<CatalogHub tab={tab} nationalities={...} services={...} canWrite={...} />`.

- [ ] **Step 2: Hub chrome**

```tsx
<nav aria-label="Catalog sections" className="flex flex-wrap gap-1">
  <Link href="/admin/catalog?tab=services" className={cn(buttonVariants({ variant: tab === "services" ? "default" : "ghost" }))}>
    Services
  </Link>
  <Link href="/admin/catalog?tab=nationalities" className={cn(buttonVariants({ variant: tab === "nationalities" ? "default" : "ghost" }))}>
    Nationalities
  </Link>
</nav>
```

Primary Add: `/admin/catalog/services/new` or `/admin/catalog/nationalities/new` (write only).

- [ ] **Step 3: Service list** — copy `DocumentRulesWorkspace` list chrome (search, `usePaginatedList`, `ListPaginatorBar`). Each row: name, duration, entries, On/Off badge, **Edit** → `/admin/catalog/services/[id]/edit`, **Delete** opens confirm. No `<Input>` in the row.

Delete confirm copy:

> Delete this service? This also removes its eligibility links, customer prices, and extra document rules. Applications are not deleted. If this service is used on an application, delete will fail — disable it instead.

On `409`, flash the envelope message and keep the row. On success, `router.refresh()`.

- [ ] **Step 4: Nationality list** — same list chrome. Row: code, name, badge, **Open** → `/admin/catalog/nationalities/[code]`, **Delete** with the nationality variant of the same confirm copy.

- [ ] **Step 5:** Hub should compile. Old `AdminCatalogWorkspace` can remain unused until Task 12. Do not leave inline-edit rows on the hub.

- [ ] **Step 6: Suggested commit** `feat(admin): replace catalog hub with read-only service and nationality lists`

---

### Task 7: Create + edit forms (no eligibility yet)

**Files:**
- Create: `components/admin/catalog-service-form.tsx`
- Create: `components/admin/catalog-nationality-form.tsx`
- Create: `lib/admin/catalog/get-catalog-entity.ts`
- Create: `app/admin/(protected)/catalog/services/new/page.tsx`
- Create: `app/admin/(protected)/catalog/services/[id]/edit/page.tsx`
- Create: `app/admin/(protected)/catalog/nationalities/new/page.tsx`
- Create: `app/admin/(protected)/catalog/nationalities/[code]/page.tsx`

Follow `document-rules/new/page.tsx`: `getAdminUserId` + `withAdminDbActor`, forbidden card, `AdminShell` `active="catalog"`.

- [ ] **Step 1: Loaders**

```typescript
export const getCatalogNationality = async (tx: DbTransaction, code: string) => {
  const rows = await tx
    .select({ code: schema.nationality.code, name: schema.nationality.name, enabled: schema.nationality.enabled })
    .from(schema.nationality)
    .where(eq(schema.nationality.code, code.trim().toUpperCase()))
    .limit(1);
  return rows[0] ?? null;
};

export const getCatalogVisaService = async (tx: DbTransaction, id: string) => {
  const rows = await tx
    .select({
      id: schema.visaService.id,
      name: schema.visaService.name,
      enabled: schema.visaService.enabled,
      durationDays: schema.visaService.durationDays,
      entries: schema.visaService.entries,
    })
    .from(schema.visaService)
    .where(eq(schema.visaService.id, id))
    .limit(1);
  return rows[0] ?? null;
};
```

Missing entity → `notFound()` like Document rules.

- [ ] **Step 2: Service form** (`ICatalogServiceFormProps`: `mode: "create" | "edit"`, optional `service`, `canWrite`)

Create: POST `/admin/catalog/visa-services`, then `router.push(/admin/catalog/services/${id}/edit)`.  
Edit: PATCH same id. Back link `/admin/catalog?tab=services`. Fields: name, duration days, entries, enabled checkbox (this checkbox is on the **form page**, not the hub list). Show envelope errors; keep values.

- [ ] **Step 3: Nationality form**

Create: POST `/admin/catalog/nationalities` (code + name + enabled), then `router.push(/admin/catalog/nationalities/${code})`.  
Edit (on combined page): code read-only; PATCH name + enabled. Back link `/admin/catalog?tab=nationalities`.

- [ ] **Step 4: Pages**

- `services/new` — title “Add service”
- `services/[id]/edit` — title service name, subtitle “Edit this service.” Form only in this task.
- `nationalities/new` — title “Add nationality”
- `nationalities/[code]` — title `${name} (${code})`, subtitle “Edit this nationality and its eligible services.” Form only; eligibility list in Task 8.

- [ ] **Step 5: Suggested commit** `feat(admin): add catalog service and nationality form pages`

---

### Task 8: Nested eligibility lists + remove

**Files:**
- Create: `components/admin/catalog-eligibility-links.tsx`
- Modify: service edit page and nationality page

- [ ] **Step 1: `CatalogEligibilityLinks`**

Props:

```typescript
interface ICatalogEligibilityLinksProps {
  mode: "nationality" | "service";
  nationalityCode?: string;
  serviceId?: string;
  canWrite: boolean;
  addHref: string;
}
```

Use `useCatalogEligibilityPage` with `appliedFilters` locked to `nationalityCode` or `serviceId`. Read-only rows:

- Nationality mode: service name, “No price — hidden on apply” if `!hasPrice`, Remove.
- Service mode: `${nationalityCode} ${nationalityName}`, same price warning, Remove.

Empty copy:

- Nationality: “No eligible services. Add a service to offer a product for this nationality.”
- Service: “No eligible nationalities. Add a nationality to offer this product.”

Remove: `ConfirmDialog` then `removeCatalogEligibility`. Never delete the parent entity.

Write-only **Add service** / **Add nationality** `Link` to `addHref`.

- [ ] **Step 2:** Mount on nationality page below the form (`mode="nationality"`, addHref `.../services/add`). Mount on service edit below the form (`mode="service"`, addHref `.../nationalities/add`).

- [ ] **Step 3: Suggested commit** `feat(admin): show bidirectional eligibility lists on catalog detail pages`

---

### Task 9: Picker pages

**Files:**
- Create: `components/admin/catalog-eligibility-picker.tsx`
- Create: `app/admin/(protected)/catalog/nationalities/[code]/services/add/page.tsx`
- Create: `app/admin/(protected)/catalog/services/[id]/nationalities/add/page.tsx`

- [ ] **Step 1: Picker**

Load all services or nationalities from the existing GET list endpoints (already on the page via SSR is better):

SSR the full `nationalities` or `services` array plus current eligibility ids (`listCatalogEligibility` with `pageSize: 100`, loop if `total > 100`, or a dedicated select of linked ids in the page loader). Candidates = all minus linked.

`CatalogEligibilityPicker`: search, paginated checkboxes, **Add selected** calls `linkCatalogEligibilityPairs`. Then `router.push` back to the parent page.

Empty: “All services are already linked.” / “All nationalities are already linked.”

Read-only: no checkboxes, no Add.

Cancel link back to the parent page.

- [ ] **Step 2: Pages**

- Nationality picker title “Add services · {name}”
- Service picker title “Add nationalities · {name}”
- Forbidden / missing same as other catalog pages

- [ ] **Step 3: Suggested commit** `feat(admin): add catalog eligibility picker pages`

---

### Task 10: Retarget Document rules + remove dump UI

**Files:**
- Modify: `components/admin/document-rules-country-services.tsx`
- Modify: `components/admin/document-rules-wizard.tsx`
- Modify: any other `prefillNat` / `#catalog-eligibility` href
- Remove: `components/admin/catalog-workspace.tsx`
- Remove: `components/admin/catalog-eligibility-section.tsx`
- Remove: `components/admin/catalog-eligibility-table.tsx`
- Remove: `components/admin/catalog-eligibility-link-form.tsx`

- [ ] **Step 1:** Replace both “Add eligibility” navigations with:

```typescript
router.push(`/admin/catalog/nationalities/${encodeURIComponent(nationalityCode)}`);
```

- [ ] **Step 2:** Grep `prefillNat`, `catalog-eligibility`, `AdminCatalogWorkspace`, `CatalogEligibilitySection`. Only Document rules table and pricing links to `/admin/catalog` should remain (those stay as hub links).

- [ ] **Step 3:** Delete the four dump components. Fix any leftover imports. `catalog/page.tsx` must not import `catalog-workspace`.

- [ ] **Step 4:** `rtk pnpm exec vitest run app/api/admin/catalog lib/admin/catalog`

- [ ] **Step 5: Suggested commit** `refactor(admin): remove catalog inline-edit dump and retarget eligibility links`

---

### Task 11: CI + browser verification

- [ ] **Step 1:** `pnpm run lint && pnpm run test:ci && pnpm run build`

Fix TypeScript from `next build` even if tests pass.

- [ ] **Step 2: Browser** (dev server, admin user with write, then a read-only user if available)

1. `/admin/catalog` defaults to Services tab. Switch to Nationalities; URL has `?tab=nationalities`.
2. Add service → lands on edit. Save fields. Add nationality via picker. Remove it.
3. Add nationality → lands on combined page. Save name. Add service via picker. Remove it.
4. Unpriced pair shows “No price — hidden on apply”.
5. Delete unused nationality/service succeeds. Delete one used by an application shows the 409 message.
6. Read-only: lists and detail visible; Add/Edit/Delete/Save/Remove/picker confirm hidden.
7. Document rules “Add eligibility” opens `/admin/catalog/nationalities/[code]`.
8. Light and dark, desktop width. No inputs in hub rows.

- [ ] **Step 3: Suggested commit** only if verification required fixes.

---

## Self-review (spec coverage)

| Spec requirement | Task |
|---|---|
| Hub tabs + default services | 6 |
| Read-only lists, badges, Add/Edit/Open/Delete | 6 |
| Dedicated create/edit pages | 7 |
| Combined nationality page | 7 + 8 |
| Bidirectional eligibility lists | 8 |
| Picker pages + `{ pairs }` | 3 + 9 |
| Nav/overview “Catalog” | 5 |
| Remove dump + `prefillNat` | 6 + 10 |
| Document rules redirect | 10 |
| DELETE + 409 + audit | 1 + 2 |
| Bulk POST + single-pair compat | 3 |
| nationalityName on list | 4 |
| Permissions | 6–9 |
| Unpriced warning | 8 |
| CI + browser | 11 |
| Do not touch document-rules table / pricing / public APIs | file map |

No TBD placeholders. Types: `CatalogEligibility.nationalityName` is added in Task 4 and consumed in Task 8. Delete helpers from Task 1 are what Task 2 routes call.
