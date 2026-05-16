import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "admin-export-app" }),
}));

vi.mock("@/lib/admin-auth", () => ({
  adminAuth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/lib/db/actor-context", () => ({
  withAdminDbActor: vi.fn(),
}));

vi.mock("@/lib/applications/customer-export", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/applications/customer-export")>();
  return {
    ...actual,
    loadCustomerExportPayload: vi.fn(),
    buildCustomerExportZip: vi.fn(),
  };
});

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import {
  buildCustomerExportZip,
  loadCustomerExportPayload,
} from "@/lib/applications/customer-export";
import { GET } from "./route";

function setupAdmin(permissions: string[]) {
  vi.mocked(adminAuth.api.getSession).mockResolvedValue({
    user: { id: "admin-1" },
  } as never);
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(
    async (_id, fn) => fn({ tx: {} as never, permissions }),
  );
}

describe("GET /api/admin/applications/[id]/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await GET(new Request("http://localhost/api/admin/applications/app-1/export"), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when audit.write is missing", async () => {
    setupAdmin(["applications.read"]);
    const res = await GET(new Request("http://localhost/api/admin/applications/app-1/export"), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when application does not exist", async () => {
    setupAdmin(["applications.read", "audit.write"]);
    vi.mocked(loadCustomerExportPayload).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/admin/applications/app-1/export"), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns a zip attachment when export succeeds", async () => {
    setupAdmin(["applications.read", "audit.write"]);
    vi.mocked(loadCustomerExportPayload).mockResolvedValue({
      applicationId: "app-1",
      referenceNumber: "REF-9",
      profileRows: [{ label: "Full name", value: "Jane" }],
      documents: [],
    });
    vi.mocked(buildCustomerExportZip).mockResolvedValue(Buffer.from("PK\x03\x04"));
    const tx = {
      insert: () => ({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({
        tx: tx as never,
        permissions: ["applications.read", "audit.write"],
      }),
    );

    const res = await GET(new Request("http://localhost/api/admin/applications/app-1/export"), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(res.headers.get("Content-Disposition")).toContain("REF-9-customer-export.zip");
    const body = await res.arrayBuffer();
    expect(body.byteLength).toBeGreaterThan(0);
  });
});
