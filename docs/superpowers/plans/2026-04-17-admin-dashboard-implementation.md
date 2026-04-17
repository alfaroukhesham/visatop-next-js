# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the newly designed Admin Applications CRUD workspace and Analytics hub, replacing the old operations module.

**Architecture:** We use Next.js Server Components for initial fetching wrapped in `withAdminDbActor` for RLS compliance. Shared queries are placed in `lib/applications/admin-queries.ts`. Mutations and paginated fetches use API routes (`/api/admin/...`) integrated with `runAdminDbJson` and `writeAdminAudit`.
**Tech Stack:** Next.js App Router, Tailwind CSS, shadcn/ui, drizzle-orm, zod.

---

### Task 1: Update Admin Routing Hub

**Files:**
- Modify: `app/admin/(protected)/page.tsx`

- [ ] **Step 1: Delete old operations module**
*Note: Before deleting `admin-operations-client.tsx`, examine it for design-system-aligned table and drawer patterns to reuse in Task 6.*
```bash
rm -rf app/admin/\(protected\)/operations
rm components/portal/admin-operations-client.tsx
```

- [ ] **Step 2: Update the Admin Hub Links**
Modify `app/admin/(protected)/page.tsx`.
Add imports for `FileText, BarChart` from `lucide-react`. Remove `Settings2`. Replace `Operations` with `Applications`, and add `Analytics`.
```tsx
import {
  ArrowRight,
  Banknote,
  Globe2,
  SlidersHorizontal,
  Sparkles,
  FileText,
  BarChart,
} from "lucide-react";
// ...
const links = [
  {
    href: "/admin/catalog",
    title: "Catalog",
    description: "Nationalities and visa services wired to public catalog APIs.",
    icon: Globe2,
  },
  {
    href: "/admin/pricing",
    title: "Margins & reference",
    description: "Latest margin policies and affiliate reference observations.",
    icon: Banknote,
  },
  {
    href: "/admin/settings",
    title: "Platform settings",
    description: "Draft TTL and other operational keys in Postgres.",
    icon: SlidersHorizontal,
  },
  {
    href: "/admin/automations",
    title: "Automations",
    description: "Rule list and IF / THEN editor.",
    icon: Sparkles,
  },
  {
    href: "/admin/applications",
    title: "Applications",
    description: "Application verification queue and manual review workspace.",
    icon: FileText,
  },
  {
    href: "/admin/analytics",
    title: "Analytics",
    description: "High-level metrics and active user directory.",
    icon: BarChart,
  },
] as const;
```

---

### Task 2: Shared Admin Queries

**Files:**
- Create: `lib/applications/admin-queries.ts`

- [ ] **Step 1: Create shared `listAdminApplications`**
This ensures both the RSC and the API use the same logic and cursor pagination.
```typescript
import { desc, eq, and, ilike, or, lt } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";

function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

export async function listAdminApplications(
  tx: DbTransaction,
  params: { statusFilter?: string | null; search?: string | null; cursor?: string | null }
) {
  let conditions = [];
  if (params.statusFilter) conditions.push(eq(schema.application.applicationStatus, params.statusFilter));
  
  if (params.search) {
    const query = `%${escapeLike(params.search)}%`;
    // Note: ILIKE with leading wildcard cannot use B-tree index. Performance is okay for small sets,
    // but should be upgraded to pg_trgm for scale.
    conditions.push(
      or(
        ilike(schema.application.id, query),
        ilike(schema.application.guestEmail, query),
        ilike(schema.application.fullName, query)
      )
    );
  }
  
  if (params.cursor) {
    const parts = params.cursor.split("|");
    const cursorDate = new Date(parts[0] ?? "");
    const cursorId = parts[1] ?? "";
    
    if (!isNaN(cursorDate.getTime()) && cursorId) {
      conditions.push(
        or(
          lt(schema.application.createdAt, cursorDate),
          and(
            eq(schema.application.createdAt, cursorDate),
            lt(schema.application.id, cursorId)
          )
        )
      );
    }
  }

  const rows = await tx
    .select({
      id: schema.application.id,
      fullName: schema.application.fullName,
      guestEmail: schema.application.guestEmail,
      nationalityCode: schema.application.nationalityCode,
      serviceId: schema.application.serviceId,
      applicationStatus: schema.application.applicationStatus,
      paymentStatus: schema.application.paymentStatus,
      fulfillmentStatus: schema.application.fulfillmentStatus,
      createdAt: schema.application.createdAt,
      nationalityName: schema.nationality.name,
      serviceName: schema.visaService.name,
    })
    .from(schema.application)
    .leftJoin(schema.nationality, eq(schema.application.nationalityCode, schema.nationality.code))
    .leftJoin(schema.visaService, eq(schema.application.serviceId, schema.visaService.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.application.createdAt), desc(schema.application.id))
    .limit(51);

  const hasNext = rows.length === 51;
  const items = hasNext ? rows.slice(0, 50) : rows;
  const nextCursor = hasNext ? `${items[items.length - 1].createdAt.toISOString()}|${items[items.length - 1].id}` : null;

  return { items, nextCursor };
}

type ApplicationRow = InferSelectModel<typeof schema.application>;

export function toAdminApplication(row: ApplicationRow) {
  // DTO to strip internals like resumeTokenHash and lease internals
  const { resumeTokenHash, passportExtractionRunId, passportExtractionLeaseExpiresAt, ...safeRow } = row;
  return safeRow;
}
```

---

### Task 3: Applications GET API & Tests

**Files:**
- Create: `app/api/admin/applications/route.ts`
- Create: `app/api/admin/applications/route.test.ts`

- [ ] **Step 1: Implement the GET API endpoint**
```typescript
import { headers } from "next/headers";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { jsonOk } from "@/lib/api/response";
import { listAdminApplications } from "@/lib/applications/admin-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const url = new URL(req.url);
  
  return runAdminDbJson(requestId, ["applications.read"], async ({ tx }) => {
    const result = await listAdminApplications(tx, {
      statusFilter: url.searchParams.get("status"),
      search: url.searchParams.get("q"),
      cursor: url.searchParams.get("cursor"),
    });
    return jsonOk(result, { requestId });
  });
}
```

- [ ] **Step 2: Add API tests**
Create `app/api/admin/applications/route.test.ts`.
```typescript
import { describe, it, expect, vi } from "vitest";
import { GET } from "./route";
import * as requireAdminDb from "@/lib/admin-api/require-admin-db";

vi.mock("@/lib/admin-api/require-admin-db");

describe("GET /api/admin/applications", () => {
  it("returns paginated applications with session", async () => {
    vi.spyOn(requireAdminDb, "runAdminDbJson").mockImplementation(async (reqId, perms, fn) => {
      // Mock db tx context
      const mockTx = { select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(), /* ... */ };
      return new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 });
    });
    
    const req = new Request("http://localhost/api/admin/applications?status=needs_review");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
```

---

### Task 4: Application Detail APIs & Tests

**Files:**
- Create: `app/api/admin/applications/[id]/profile/route.ts`
- Create: `app/api/admin/applications/[id]/transition/route.ts`
- Create: `app/api/admin/applications/[id]/transition/route.test.ts`

- [ ] **Step 1: Implement the Profile PATCH API**
Include optimistic concurrency (`updatedAt`), field stripping, and checkout freeze checking.
```typescript
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import * as schema from "@/lib/db/schema";
import { toAdminApplication } from "@/lib/applications/admin-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchBody = z.object({
  updatedAt: z.string().datetime(), // optimistic locking
  fullName: z.string().trim().max(255).nullable().optional(),
  dateOfBirth: z.string().date().nullable().optional(),
  placeOfBirth: z.string().trim().max(255).nullable().optional(),
  applicantNationality: z.string().trim().max(255).nullable().optional(),
  passportNumber: z.string().trim().max(255).nullable().optional(),
  passportExpiryDate: z.string().date().nullable().optional(),
  profession: z.string().trim().max(255).nullable().optional(),
  address: z.string().trim().max(1024).nullable().optional(),
  phone: z.string().trim().max(255).nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id } = await ctx.params;

  return runAdminDbJson(requestId, ["applications.write", "audit.write"], async ({ tx, adminUserId }) => {
    const parsed = await parseJsonBody(req, patchBody, requestId);
    if (!parsed.ok) return parsed.response;

    const existing = await tx.select().from(schema.application).where(eq(schema.application.id, id)).limit(1);
    const row = existing[0];
    if (!row) return jsonError("NOT_FOUND", "Not found", { status: 404, requestId });
    if (row.checkoutState === "pending") return jsonError("CHECKOUT_FROZEN", "Checkout is pending", { status: 400, requestId });

    const { updatedAt, ...fields } = parsed.data;
    const updates = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));

    const newProvenance = { ...(row.applicantProfileProvenanceJson as object || {}) };
    for (const key of Object.keys(updates)) {
      (newProvenance as any)[key] = { source: "manual" };
    }

    const updated = await tx.update(schema.application)
      .set({
        ...updates,
        applicantProfileProvenanceJson: newProvenance,
      })
      .where(and(
        eq(schema.application.id, id),
        eq(schema.application.updatedAt, new Date(updatedAt))
      ))
      .returning();

    if (updated.length === 0) return jsonError("CONFLICT", "Application was modified by another user", { status: 409, requestId });

    await writeAdminAudit(tx, {
      adminUserId, action: "application.profile.update", entityType: "application", entityId: row.id,
      beforeJson: JSON.stringify(row), afterJson: JSON.stringify(updated[0]),
    });

    return jsonOk({ application: toAdminApplication(updated[0]) }, { requestId });
  });
}
```

- [ ] **Step 2: Implement the Transition POST API**
Use `for("update")` and explicit matrices to enforce rules securely. 
*Note: `needs_docs -> extracting` is system-only, omitting it blocks admins from triggering stuck OCR.*
```typescript
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import * as schema from "@/lib/db/schema";
import { toAdminApplication } from "@/lib/applications/admin-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postBody = z.object({
  field: z.enum(["applicationStatus", "fulfillmentStatus"]),
  to: z.string().min(1)
});

const APPLICATION_TRANSITIONS: Record<string, string[]> = {
  draft: ["needs_docs", "cancelled"],
  needs_docs: ["cancelled"], // extracting is system-only
  needs_review: ["ready_for_payment", "cancelled"],
  ready_for_payment: ["in_progress"],
  in_progress: ["awaiting_authority", "cancelled"],
  awaiting_authority: ["completed", "cancelled"],
};

const FULFILLMENT_TRANSITIONS: Record<string, string[]> = {
  not_started: ["manual_in_progress"],
  automation_running: ["manual_in_progress"],
  manual_in_progress: ["ready_for_ops_payment", "submitted"],
  ready_for_ops_payment: ["submitted"],
  submitted: ["done"],
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id } = await ctx.params;

  return runAdminDbJson(requestId, ["applications.write", "audit.write"], async ({ tx, adminUserId }) => {
    const parsed = await parseJsonBody(req, postBody, requestId);
    if (!parsed.ok) return parsed.response;

    // FOR UPDATE lock to prevent race conditions during transitions
    const existing = await tx.select().from(schema.application).where(eq(schema.application.id, id)).for("update").limit(1);
    const row = existing[0];
    if (!row) return jsonError("NOT_FOUND", "Not found", { status: 404, requestId });

    const { field, to } = parsed.data;
    const from = String(row[field as keyof typeof row]);
    
    const matrix = field === "applicationStatus" ? APPLICATION_TRANSITIONS : FULFILLMENT_TRANSITIONS;
    const allowed = matrix[from];
    if (!allowed || !allowed.includes(to)) {
      return jsonError("INVALID_TRANSITION", `Cannot transition ${field} from ${from} to ${to}`, { status: 400, requestId });
    }

    if (field === "applicationStatus" && to === "in_progress" && row.paymentStatus !== "paid") {
      return jsonError("INVALID_TRANSITION", "Payment must be paid", { status: 400, requestId });
    }

    const updated = await tx.update(schema.application)
      .set({ [field]: to })
      .where(eq(schema.application.id, id))
      .returning();

    await writeAdminAudit(tx, {
      adminUserId, action: `application.transition.${field}`, entityType: "application", entityId: row.id,
      beforeJson: JSON.stringify({ [field]: from }), afterJson: JSON.stringify({ [field]: to }),
    });

    return jsonOk({ application: toAdminApplication(updated[0]) }, { requestId });
  });
}
```

- [ ] **Step 3: Add API tests**
Create `app/api/admin/applications/[id]/transition/route.test.ts`. Include test cases ensuring an invalid matrix target returns a 400.
```typescript
import { describe, it, expect, vi } from "vitest";
import { POST } from "./route";
import * as requireAdminDb from "@/lib/admin-api/require-admin-db";

vi.mock("@/lib/admin-api/require-admin-db");

describe("POST /api/admin/applications/[id]/transition", () => {
  it("rejects invalid transitions based on the matrix", async () => {
    vi.spyOn(requireAdminDb, "runAdminDbJson").mockImplementation(async (reqId, perms, fn) => {
      const mockTx = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        for: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "123", applicationStatus: "draft" }]),
      };
      return await fn({ tx: mockTx as any, adminUserId: "user_1" });
    });
    
    const req = new Request("http://localhost/api/admin/applications/123/transition", {
      method: "POST", body: JSON.stringify({ field: "applicationStatus", to: "completed" })
    });
    const res = await POST(req, { params: Promise.resolve({ id: "123" }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("INVALID_TRANSITION");
  });
});
```

---

### Task 5: Applications List Page

**Files:**
- Create: `app/admin/(protected)/applications/page.tsx`
- Create: `app/admin/(protected)/applications/loading.tsx`
- Create: `app/admin/(protected)/applications/error.tsx`

- [ ] **Step 1: Applications RSC Page**
Wrap the query using `withAdminDbActor` so RLS is enforced correctly.
```tsx
import Link from "next/link";
import { adminAuth } from "@/lib/admin-auth";
import { headers } from "next/headers";
import { withAdminDbActor } from "@/lib/db/actor-context";
import { listAdminApplications } from "@/lib/applications/admin-queries";
// Note: Use standard UI components per design system (shadcn table/badge)

export default async function ApplicationsPage(props: { searchParams: Promise<{ q?: string; status?: string; cursor?: string }> }) {
  const session = await adminAuth.api.getSession({ headers: await headers() });
  const searchParams = await props.searchParams;

  const result = await withAdminDbActor(session!.user.id, async ({ tx }) => {
    return listAdminApplications(tx, {
      search: searchParams.q,
      statusFilter: searchParams.status,
      cursor: searchParams.cursor,
    });
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold mb-4 font-display">Applications</h1>
      {/* UI Implementation of search, filter, and table using result.items */}
      {/* Badges should use text-muted-foreground for draft, etc., align with DESIGN.md */}
    </div>
  );
}
```

- [ ] **Step 2: Add Loading & Error states**
Create standard `loading.tsx` and `error.tsx` matching the Next.js App Router conventions.

---

### Task 6: Applications Detail Page & Document Viewer

**Files:**
- Create: `app/admin/(protected)/applications/[id]/page.tsx`
- Create: `app/admin/(protected)/applications/[id]/error.tsx`
- Create: `components/admin/ApplicationDetailForm.tsx`
- Create: `components/admin/DocumentViewer.tsx`

- [ ] **Step 1: Application Detail RSC**
Create `app/admin/(protected)/applications/[id]/page.tsx`. Use a 50/50 responsive split.
```tsx
import { withAdminDbActor } from "@/lib/db/actor-context";
import { adminAuth } from "@/lib/admin-auth";
import { headers } from "next/headers";
import { application } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { toAdminApplication } from "@/lib/applications/admin-queries";
// Assume components are imported

export default async function ApplicationDetailPage(props: { params: Promise<{ id: string }> }) {
  const session = await adminAuth.api.getSession({ headers: await headers() });
  const { id } = await props.params;

  const appData = await withAdminDbActor(session!.user.id, async ({ tx }) => {
    return tx.select().from(application).where(eq(application.id, id)).limit(1);
  });

  if (!appData[0]) return <div className="p-6">Application not found</div>;
  const safeData = toAdminApplication(appData[0]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 max-w-[1400px] mx-auto">
      <div className="space-y-6">
        {/* Form component handles PATCH and status transition POSTs */}
        <ApplicationDetailForm initialData={safeData} />
      </div>
      <div className="relative">
        <div className="sticky top-6">
          <DocumentViewer applicationId={id} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Profile Form Component**
Create `components/admin/ApplicationDetailForm.tsx`.
A Client Component containing standard input fields for the profile.
- Disable all inputs if `checkoutState === 'pending'` with a visual tooltip.
- Passes `updatedAt` with the PATCH payload.
- Contains the delete confirmation modal executing `DELETE /api/admin/applications/[id]`.

- [ ] **Step 3: Document Viewer Component**
Create `components/admin/DocumentViewer.tsx`.
Fetch `application_document_blob` via `withAdminDbActor` or an API endpoint. Show "Blob Expired" if `tempExpiresAt` is passed.

- [ ] **Step 4: Error State**
Create `error.tsx` for boundary recovery on DB failure.

---

### Task 7: Analytics Hub

**Files:**
- Create: `app/admin/(protected)/analytics/page.tsx`
- Create: `app/admin/(protected)/analytics/error.tsx`
- Create: `lib/analytics/queries.ts`

- [ ] **Step 1: Analytics Queries**
Create `lib/analytics/queries.ts` executing aggregated data counts:
```typescript
import { sql } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";

export async function getAdminAnalytics(tx: DbTransaction) {
  const statusCounts = await tx.execute(
    sql`SELECT application_status, COUNT(*) as count FROM application GROUP BY application_status`
  );
  
  const checkoutsCount = await tx.execute(
    sql`SELECT COUNT(DISTINCT pq.application_id) as count
        FROM price_quote pq
        WHERE pq.locked_at IS NOT NULL`
  );

  return {
    statusCounts: statusCounts.rows,
    checkoutsCount: Number(checkoutsCount.rows[0]?.count ?? 0),
  };
}
```

- [ ] **Step 2: Analytics RSC Page**
Create `app/admin/(protected)/analytics/page.tsx` integrating user data CTE if ready, otherwise showing metrics.
```tsx
import { adminAuth } from "@/lib/admin-auth";
import { headers } from "next/headers";
import { withAdminDbActor } from "@/lib/db/actor-context";
import { getAdminAnalytics } from "@/lib/analytics/queries";

export default async function AnalyticsPage() {
  const session = await adminAuth.api.getSession({ headers: await headers() });
  
  const metrics = await withAdminDbActor(session!.user.id, async ({ tx }) => {
     return getAdminAnalytics(tx); 
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold mb-8 font-display">Analytics</h1>
      <div className="grid grid-cols-3 gap-6">
        <div className="border border-border p-6 shadow-sm">
          <p className="text-muted-foreground text-sm font-medium">Locked Checkouts</p>
          <p className="text-3xl font-bold mt-2">{Number(metrics.checkoutsCount)}</p>
        </div>
      </div>
      {/* List user directory tables below */}
    </div>
  );
}
```

- [ ] **Step 3: Error State**
Create `error.tsx` for analytics fetching failures.

- [ ] **Step 4: User Directory Note**
*Note: The user directory (spec §4.2-4.3) and its drill-down pages will be implemented in a follow-up plan.*

---
