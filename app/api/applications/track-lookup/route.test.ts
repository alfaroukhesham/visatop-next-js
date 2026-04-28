import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "track-lookup-test" }),
}));

vi.mock("@/lib/db/actor-context", () => ({
  withSystemDbActor: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
}));

vi.mock("@/lib/applications/track-lookup", () => ({
  findApplicationsForContactTrackLookupPaginated: vi.fn(),
  isValidTrackContact: vi.fn(),
}));

import * as actor from "@/lib/db/actor-context";
import * as trackLookup from "@/lib/applications/track-lookup";
import { POST } from "./route";

const row = {
  id: "aaaaaaaa-bbbb-5ccc-dddd-eeeeeeeeeeee",
  referenceNumber: "REF-1",
  applicationStatus: "in_progress",
  paymentStatus: "paid",
  fulfillmentStatus: "submitted",
  adminAttentionRequired: false,
  nationalityCode: "US",
  serviceId: "svc-1",
  guestEmail: "guest@example.com",
  phone: null,
};

describe("POST /api/applications/track-lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns applications when contact matches", async () => {
    vi.mocked(trackLookup.isValidTrackContact).mockReturnValue(true);
    vi.mocked(trackLookup.findApplicationsForContactTrackLookupPaginated).mockResolvedValue({
      items: [row as never],
      hasMore: false,
    } as never);

    const res = await POST(
      new Request("http://localhost/api/applications/track-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: "guest@example.com" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.applications).toHaveLength(1);
    expect(body.data.applications[0].applicationId).toBe(row.id);
    expect(body.data.applications[0].referenceDisplay).toBe("REF-1");
    expect(body.data.applications[0].clientTracking.headline).toBeTruthy();
    expect(body.data.nextCursor).toBeNull();
    expect(actor.withSystemDbActor).toHaveBeenCalledTimes(1);
  });

  it("returns empty list when none match", async () => {
    vi.mocked(trackLookup.isValidTrackContact).mockReturnValue(true);
    vi.mocked(trackLookup.findApplicationsForContactTrackLookupPaginated).mockResolvedValue({
      items: [],
      hasMore: false,
    } as never);

    const res = await POST(
      new Request("http://localhost/api/applications/track-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: "nobody@example.com" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.applications).toEqual([]);
    expect(body.data.nextCursor).toBeNull();
  });

  it("returns 400 when contact is not a valid email or phone", async () => {
    vi.mocked(trackLookup.isValidTrackContact).mockReturnValue(false);

    const res = await POST(
      new Request("http://localhost/api/applications/track-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: "x" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
