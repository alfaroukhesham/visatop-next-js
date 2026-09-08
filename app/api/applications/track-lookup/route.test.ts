import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateResumeToken } from "@/lib/applications/resume-token";
import { RESUME_COOKIE_NAME } from "@/lib/applications/resume-cookie";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "track-lookup-test" }),
}));

vi.mock("@/lib/db/actor-context", () => ({
  withSystemDbActor: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
}));

vi.mock("@/lib/applications/track-lookup", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/applications/track-lookup")>();
  return {
    ...actual,
    findApplicationsForContactTrackLookupPaginated: vi.fn(),
    isValidTrackContact: vi.fn(),
  };
});

import { nationality, visaService } from "@/lib/db/schema";
import * as actor from "@/lib/db/actor-context";
import * as trackLookup from "@/lib/applications/track-lookup";
import { POST } from "./route";

const txMock = {
  select: () => ({
    from: (table: unknown) => ({
      where: async () => {
        if (table === visaService) return [{ id: "svc-1", name: "Tourist Visa" }];
        if (table === nationality) return [{ code: "US", name: "United States" }];
        return [];
      },
    }),
  }),
};

const { plainToken, hash } = generateResumeToken();

const row = {
  id: "aaaaaaaa-bbbb-5ccc-dddd-eeeeeeeeeeee",
  referenceNumber: "REF-1",
  applicationStatus: "in_progress",
  paymentStatus: "unpaid",
  fulfillmentStatus: "not_started",
  adminAttentionRequired: false,
  nationalityCode: "US",
  serviceId: "svc-1",
  guestEmail: "guest@example.com",
  phone: null,
  partyId: null,
  resumeTokenHash: hash,
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
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
    expect(body.data.applications[0].serviceName).toBe("Tourist Visa");
    expect(body.data.applications[0].nationalityName).toBe("United States");
    expect(body.data.applications[0].serviceName).not.toBe("svc-1");
    expect(body.data.applications[0].clientTracking.headline).toBeTruthy();
    expect(body.data.applications[0].canContinue).toBe(false);
    expect(body.data.applications[0].continueHref).toBeNull();
    expect(body.data.nextCursor).toBeNull();
    expect(actor.withSystemDbActor).toHaveBeenCalledTimes(1);
  });

  it("sets canContinue when vt_resume cookie matches an unpaid draft", async () => {
    vi.mocked(trackLookup.isValidTrackContact).mockReturnValue(true);
    vi.mocked(trackLookup.findApplicationsForContactTrackLookupPaginated).mockResolvedValue({
      items: [row as never],
      hasMore: false,
    } as never);

    const res = await POST(
      new Request("http://localhost/api/applications/track-lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${RESUME_COOKIE_NAME}=${encodeURIComponent(plainToken)}`,
        },
        body: JSON.stringify({ contact: "guest@example.com" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.applications[0].canContinue).toBe(true);
    expect(body.data.applications[0].continueHref).toBe(
      `/apply/applications/${row.id}`,
    );
  });

  it("does not set canContinue for paid rows even with a matching cookie", async () => {
    vi.mocked(trackLookup.isValidTrackContact).mockReturnValue(true);
    vi.mocked(trackLookup.findApplicationsForContactTrackLookupPaginated).mockResolvedValue({
      items: [{ ...row, paymentStatus: "paid", fulfillmentStatus: "submitted" } as never],
      hasMore: false,
    } as never);

    const res = await POST(
      new Request("http://localhost/api/applications/track-lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${RESUME_COOKIE_NAME}=${encodeURIComponent(plainToken)}`,
        },
        body: JSON.stringify({ contact: "guest@example.com" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.applications[0].canContinue).toBe(false);
    expect(body.data.applications[0].continueHref).toBeNull();
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
