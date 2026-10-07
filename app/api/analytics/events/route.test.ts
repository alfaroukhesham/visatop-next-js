import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ "x-request-id": "analytics-events-test", "x-forwarded-for": "127.0.0.1" }),
}));

vi.mock("@/lib/db/actor-context", () => ({
  withAnalyticsBeaconDbActor: vi.fn(),
}));

import * as actorContext from "@/lib/db/actor-context";
import { __resetBeaconRateLimitForTests } from "@/lib/analytics/beacon-rate-limit";
import { POST } from "./route";

const post = (body: unknown) =>
  new Request("http://localhost/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/analytics/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetBeaconRateLimitForTests();
    vi.mocked(actorContext.withAnalyticsBeaconDbActor).mockImplementation(async (fn) =>
      fn({
        insert: () => ({
          values: async () => undefined,
        }),
      } as never),
    );
  });

  it("rejects unknown event names", async () => {
    const res = await POST(
      post({
        eventId: "11111111-1111-4111-8111-111111111111",
        eventName: "page_view",
        sessionId: "22222222-2222-4222-8222-222222222222",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects PII fields", async () => {
    const res = await POST(
      post({
        eventId: "11111111-1111-4111-8111-111111111111",
        eventName: "visa_list_viewed",
        sessionId: "22222222-2222-4222-8222-222222222222",
        email: "a@b.co",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("accepts an allowlisted funnel event", async () => {
    const res = await POST(
      post({
        eventId: "11111111-1111-4111-8111-111111111111",
        eventName: "visa_list_viewed",
        sessionId: "22222222-2222-4222-8222-222222222222",
        nationalityCode: "IN",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(actorContext.withAnalyticsBeaconDbActor).toHaveBeenCalled();
  });

  it("returns JSON 2xx when the actor/db layer throws instead of crashing", async () => {
    vi.mocked(actorContext.withAnalyticsBeaconDbActor).mockRejectedValueOnce(new Error("db blip"));
    const res = await POST(
      post({
        eventId: "11111111-1111-4111-8111-111111111111",
        eventName: "visa_list_viewed",
        sessionId: "22222222-2222-4222-8222-222222222222",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({ accepted: false });
  });

  it("accepts document_upload_failed as a first-party funnel event", async () => {
    const res = await POST(
      post({
        eventId: "11111111-1111-4111-8111-111111111111",
        eventName: "document_upload_failed",
        sessionId: "22222222-2222-4222-8222-222222222222",
        applicationId: "app-1",
      }),
    );
    expect(res.status).toBe(200);
  });
});
