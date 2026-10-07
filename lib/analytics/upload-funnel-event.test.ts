import { describe, expect, it } from "vitest";
import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import {
  DOCUMENT_UPLOAD_CANCELLED,
  DOCUMENT_UPLOAD_FAILED,
  persistableUploadFunnelEventName,
  uploadAnalyticsEventName,
} from "./upload-funnel-event";

describe("uploadAnalyticsEventName", () => {
  it("maps passport/photo success to persistable funnel events", () => {
    expect(uploadAnalyticsEventName({ docType: "passport_copy", outcome: "success" })).toBe(
      APPLY_FUNNEL_EVENTS.passportUploaded,
    );
    expect(uploadAnalyticsEventName({ docType: "personal_photo", outcome: "success" })).toBe(
      APPLY_FUNNEL_EVENTS.photoUploaded,
    );
  });

  it("maps passport/photo failure and cancel to distinct first-party events", () => {
    expect(uploadAnalyticsEventName({ docType: "passport_copy", outcome: "failed" })).toBe(
      DOCUMENT_UPLOAD_FAILED,
    );
    expect(uploadAnalyticsEventName({ docType: "personal_photo", outcome: "cancelled" })).toBe(
      DOCUMENT_UPLOAD_CANCELLED,
    );
  });

  it("does not emit upload analytics for supporting slots", () => {
    expect(uploadAnalyticsEventName({ docType: "supporting", outcome: "failed" })).toBeNull();
    expect(persistableUploadFunnelEventName("bank_statement_6m", true)).toBeNull();
  });
});
