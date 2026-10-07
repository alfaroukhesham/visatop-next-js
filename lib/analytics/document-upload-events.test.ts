/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackDocumentUploadAnalytics } from "@/lib/analytics/document-upload-events";

const fetchMock = vi.fn().mockResolvedValue({ ok: true });

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      hostname: "app-staging.visatop.com",
      pathname: "/visa-processing/apply/applications/app-1",
      origin: "https://app-staging.visatop.com",
      protocol: "https:",
      search: "",
    },
  });
  document.cookie = "vt_sid=sid_test_session_01";
  window.gtag = vi.fn();
  window.dataLayer = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const beaconBodies = (): Array<Record<string, unknown>> =>
  fetchMock.mock.calls
    .map((call) => {
      const init = call[1] as { body?: string } | undefined;
      if (!init?.body) return null;
      return JSON.parse(init.body) as Record<string, unknown>;
    })
    .filter((body): body is Record<string, unknown> => body !== null);

describe("trackDocumentUploadAnalytics first-party funnel", () => {
  it("beacons error_code, http_status, and reason on document_upload_failed", () => {
    trackDocumentUploadAnalytics({
      docType: "passport_copy",
      applicationId: "app-1",
      success: false,
      source: "file",
      failureReason: "timeout",
      httpStatus: 0,
      errorCode: "TIMEOUT",
    });
    const failed = beaconBodies().find((b) => b.eventName === "document_upload_failed");
    expect(failed).toMatchObject({
      applicationId: "app-1",
      errorCode: "TIMEOUT",
      reason: "timeout",
    });
    expect(failed).not.toHaveProperty("originalFilename");
    expect(failed).not.toHaveProperty("fileName");
  });

  it("beacons cancelled reason on document_upload_cancelled", () => {
    trackDocumentUploadAnalytics({
      docType: "passport_copy",
      applicationId: "app-1",
      success: false,
      cancelled: true,
      source: "camera",
      failureReason: "cancelled",
      errorCode: "CANCELLED",
    });
    const cancelled = beaconBodies().find((b) => b.eventName === "document_upload_cancelled");
    expect(cancelled).toMatchObject({
      applicationId: "app-1",
      errorCode: "CANCELLED",
      reason: "cancelled",
    });
  });
});
