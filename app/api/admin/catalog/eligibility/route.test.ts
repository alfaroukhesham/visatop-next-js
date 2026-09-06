import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "admin-test-req" }),
}));

vi.mock("@/lib/admin-auth", () => ({
  adminAuth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/actor-context", () => ({
  withAdminDbActor: vi.fn(),
}));

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { GET, POST } from "./route";
import { LinkEligibilityValidationError } from "@/lib/admin/catalog/link-eligibility-pairs";

vi.mock("@/lib/admin/catalog/link-eligibility-pairs", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/catalog/link-eligibility-pairs")>(
    "@/lib/admin/catalog/link-eligibility-pairs",
  );
  return { ...actual, linkEligibilityPairs: vi.fn() };
});

vi.mock("@/lib/admin-api/write-admin-audit", () => ({
  writeAdminAudit: vi.fn(),
}));

import { linkEligibilityPairs } from "@/lib/admin/catalog/link-eligibility-pairs";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";

const jsonRequest = (url: string, method: string, body: unknown) =>
  new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const authed = () => {
  vi.mocked(adminAuth.api.getSession).mockResolvedValue({
    user: { id: "admin-1" },
  } as never);
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
    fn({
      tx: {} as never,
      permissions: ["catalog.read", "catalog.write", "audit.write"],
    }),
  );
};

describe("GET /api/admin/catalog/eligibility", () => {
  it("returns 401 when there is no admin session", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await GET(new Request("http://localhost/api/admin/catalog/eligibility?page=0"));
    expect(res.status).toBe(401);
  });

  it("returns paged eligibility rows", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({
      user: { id: "admin-1" },
    } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) => {
      const tx = {} as never;
      return fn({
        tx,
        permissions: ["catalog.read"],
      });
    });

    const listMod = await import("@/lib/admin/catalog/list-catalog-eligibility");
    const spy = vi.spyOn(listMod, "listCatalogEligibility").mockResolvedValue({
      items: [
        {
          serviceId: "svc-1",
          nationalityCode: "US",
          serviceName: "Tourist",
          nationalityName: "United States",
          hasPrice: true,
        },
      ],
      total: 1743,
    });

    const res = await GET(
      new Request("http://localhost/api/admin/catalog/eligibility?page=1&pageSize=25"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.total).toBe(1743);
    expect(body.data.page).toBe(1);
    expect(body.data.pageSize).toBe(25);
    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ limit: 25, offset: 25 }),
    );
    spy.mockRestore();
  });
});

describe("POST /api/admin/catalog/eligibility", () => {
  it("accepts pairs and returns created + deduped counts", async () => {
    authed();
    vi.mocked(linkEligibilityPairs).mockResolvedValue({
      created: [
        { serviceId: "s1", nationalityCode: "IN" },
        { serviceId: "s1", nationalityCode: "US" },
      ],
      deduped: 0,
    });
    const res = await POST(
      jsonRequest("http://localhost/api/admin/catalog/eligibility", "POST", {
        pairs: [
          { serviceId: "s1", nationalityCode: "in" },
          { serviceId: "s1", nationalityCode: "US" },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.createdCount).toBe(2);
  });

  it("rejects empty pairs", async () => {
    authed();
    const res = await POST(
      jsonRequest("http://localhost/api/admin/catalog/eligibility", "POST", { pairs: [] }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 without a session", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await POST(
      jsonRequest("http://localhost/api/admin/catalog/eligibility", "POST", {
        pairs: [{ serviceId: "s1", nationalityCode: "IN" }],
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when catalog.write is missing", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({
      user: { id: "admin-1" },
    } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({
        tx: {} as never,
        permissions: ["catalog.read"],
      }),
    );
    const res = await POST(
      jsonRequest("http://localhost/api/admin/catalog/eligibility", "POST", {
        pairs: [{ serviceId: "s1", nationalityCode: "IN" }],
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 400 and rolls back when a pair references a missing parent", async () => {
    authed();
    vi.mocked(linkEligibilityPairs).mockRejectedValue(
      new LinkEligibilityValidationError("Service not found: missing"),
    );
    const res = await POST(
      jsonRequest("http://localhost/api/admin/catalog/eligibility", "POST", {
        pairs: [
          { serviceId: "missing", nationalityCode: "IN" },
          { serviceId: "s1", nationalityCode: "US" },
        ],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toMatch(/Service not found/);
  });

  it("returns 400 when a single-pair body references a missing parent", async () => {
    authed();
    vi.mocked(linkEligibilityPairs).mockRejectedValue(
      new LinkEligibilityValidationError("Service not found: missing"),
    );
    const res = await POST(
      jsonRequest("http://localhost/api/admin/catalog/eligibility", "POST", {
        serviceId: "missing",
        nationalityCode: "IN",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toMatch(/Service not found/);
  });

  it("accepts a single-pair body (legacy shape)", async () => {
    authed();
    vi.mocked(linkEligibilityPairs).mockImplementation(async (_tx, pairs, opts) => {
      const created = pairs.map((pair) => ({
        serviceId: pair.serviceId,
        nationalityCode: pair.nationalityCode,
      }));
      for (const pair of created) {
        await opts.writeAudit(pair);
      }
      return { created, deduped: 0 };
    });
    const res = await POST(
      jsonRequest("http://localhost/api/admin/catalog/eligibility", "POST", {
        serviceId: "s1",
        nationalityCode: "in",
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.eligibility).toEqual({ serviceId: "s1", nationalityCode: "IN" });
    expect(linkEligibilityPairs).toHaveBeenCalledWith(
      expect.anything(),
      [{ serviceId: "s1", nationalityCode: "IN" }],
      expect.objectContaining({ writeAudit: expect.any(Function) }),
    );
    expect(writeAdminAudit).toHaveBeenCalledTimes(1);
  });
});
