import { describe, expect, it } from "vitest";
import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import { GUEST_LINK_EVENTS } from "@/lib/analytics/guest-link-events";
import {
  FUNNEL_CHECKOUT_CREATED,
  isPersistableFunnelEvent,
  parseBeaconPayload,
  serverFunnelEventId,
  shouldSkipClientFunnelPersist,
} from "@/lib/analytics/funnel-event-names";

describe("isPersistableFunnelEvent", () => {
  it("allows apply funnel names except purchase", () => {
    expect(isPersistableFunnelEvent(APPLY_FUNNEL_EVENTS.visaListViewed)).toBe(true);
    expect(isPersistableFunnelEvent(APPLY_FUNNEL_EVENTS.purchase)).toBe(false);
    expect(isPersistableFunnelEvent("page_view")).toBe(false);
    expect(isPersistableFunnelEvent("document_upload_failed")).toBe(true);
    expect(isPersistableFunnelEvent("document_upload_cancelled")).toBe(true);
    expect(isPersistableFunnelEvent(FUNNEL_CHECKOUT_CREATED)).toBe(true);
    expect(isPersistableFunnelEvent(GUEST_LINK_EVENTS.submittedView)).toBe(true);
  });
});

describe("shouldSkipClientFunnelPersist", () => {
  it("skips client visa_selected because server create is the source of truth", () => {
    expect(shouldSkipClientFunnelPersist(APPLY_FUNNEL_EVENTS.visaSelected)).toBe(true);
    expect(shouldSkipClientFunnelPersist(APPLY_FUNNEL_EVENTS.visaListViewed)).toBe(false);
  });
});

describe("parseBeaconPayload", () => {
  it("accepts an allowlisted event without PII fields", () => {
    const parsed = parseBeaconPayload({
      eventId: "11111111-1111-4111-8111-111111111111",
      eventName: "visa_list_viewed",
      sessionId: "22222222-2222-4222-8222-222222222222",
      applicationId: "app-1",
      nationalityCode: "IN",
      serviceId: "svc-1",
    });
    expect(parsed.ok).toBe(true);
  });

  it("keeps upload failure fields on document_upload_failed", () => {
    const parsed = parseBeaconPayload({
      eventId: "11111111-1111-4111-8111-111111111111",
      eventName: "document_upload_failed",
      sessionId: "22222222-2222-4222-8222-222222222222",
      applicationId: "app-1",
      errorCode: "TIMEOUT",
      httpStatus: 0,
      reason: "timeout",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data).toMatchObject({
      eventId: "11111111-1111-4111-8111-111111111111",
      eventName: "document_upload_failed",
      sessionId: "22222222-2222-4222-8222-222222222222",
      applicationId: "app-1",
      errorCode: "TIMEOUT",
      reason: "timeout",
    });
    expect(parsed.data.httpStatus).toBeUndefined();
  });

  it("keeps cancel reason on document_upload_cancelled", () => {
    const parsed = parseBeaconPayload({
      eventId: "11111111-1111-4111-8111-111111111111",
      eventName: "document_upload_cancelled",
      sessionId: "22222222-2222-4222-8222-222222222222",
      applicationId: "app-1",
      errorCode: "CANCELLED",
      reason: "cancelled",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.errorCode).toBe("CANCELLED");
    expect(parsed.data.reason).toBe("cancelled");
  });

  it("rejects file names on funnel beacons", () => {
    expect(
      parseBeaconPayload({
        eventId: "11111111-1111-4111-8111-111111111111",
        eventName: "document_upload_failed",
        sessionId: "22222222-2222-4222-8222-222222222222",
        originalFilename: "IMG_1234.HEIC",
      }).ok,
    ).toBe(false);
  });

  it("rejects unknown events and emails", () => {
    expect(
      parseBeaconPayload({
        eventId: "11111111-1111-4111-8111-111111111111",
        eventName: "page_view",
        sessionId: "22222222-2222-4222-8222-222222222222",
      }).ok,
    ).toBe(false);
    expect(
      parseBeaconPayload({
        eventId: "11111111-1111-4111-8111-111111111111",
        eventName: "visa_list_viewed",
        sessionId: "22222222-2222-4222-8222-222222222222",
        email: "a@b.co",
      }).ok,
    ).toBe(false);
  });
});

describe("serverFunnelEventId", () => {
  it("is deterministic per application and event", () => {
    expect(serverFunnelEventId("app-1", "payment_succeeded")).toBe(
      "server:app-1:payment_succeeded",
    );
  });
});
