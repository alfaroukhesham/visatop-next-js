import { describe, expect, it } from "vitest";
import { funnelIdsFromTrackParams } from "@/lib/analytics/funnel-beacon-params";
import { persistableUploadFunnelEventName } from "@/lib/analytics/upload-funnel-event";

describe("funnelIdsFromTrackParams", () => {
  it("reads snake_case GA4 params", () => {
    expect(
      funnelIdsFromTrackParams({
        application_id: "app-1",
        nationality: "IN",
        service_id: "svc-1",
      }),
    ).toEqual({
      applicationId: "app-1",
      nationalityCode: "IN",
      serviceId: "svc-1",
    });
  });

  it("reads camelCase guest-link params", () => {
    expect(
      funnelIdsFromTrackParams({
        applicationId: "app-9",
        nationalityCode: "PK",
        serviceId: "svc-9",
      }),
    ).toEqual({
      applicationId: "app-9",
      nationalityCode: "PK",
      serviceId: "svc-9",
    });
  });
});

describe("persistableUploadFunnelEventName", () => {
  it("returns passport_uploaded only when the upload succeeded", () => {
    expect(persistableUploadFunnelEventName("passport_copy", true)).toBe("passport_uploaded");
    expect(persistableUploadFunnelEventName("passport_copy", false)).toBeNull();
    expect(persistableUploadFunnelEventName("personal_photo", true)).toBe("photo_uploaded");
    expect(persistableUploadFunnelEventName("personal_photo", false)).toBeNull();
    expect(persistableUploadFunnelEventName("supporting", true)).toBeNull();
  });
});
