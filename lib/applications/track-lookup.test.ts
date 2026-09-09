import { describe, expect, it } from "vitest";
import { generateResumeToken } from "./resume-token";
import {
  canContinueTrackRow,
  isValidTrackContact,
  mapTrackLookupRow,
  parseTrackContact,
} from "./track-lookup";

describe("parseTrackContact", () => {
  it("parses email", () => {
    expect(parseTrackContact("  User@EXAMPLE.com ")).toEqual({ kind: "email", email: "user@example.com" });
  });

  it("parses phone digits", () => {
    expect(parseTrackContact("+971 50 123 4567")).toEqual({ kind: "phone", digits: "971501234567" });
  });

  it("parses tracking IDs", () => {
    expect(parseTrackContact("REF-1234")).toEqual({ kind: "trackingId", value: "REF-1234" });
    expect(parseTrackContact("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).toEqual({
      kind: "trackingId",
      value: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    });
  });
});

describe("isValidTrackContact", () => {
  it("accepts valid email", () => {
    expect(isValidTrackContact("a@b.co")).toBe(true);
  });

  it("accepts phone with enough digits", () => {
    expect(isValidTrackContact("+971501234567")).toBe(true);
  });

  it("rejects garbage", () => {
    expect(isValidTrackContact("abc")).toBe(false);
    expect(isValidTrackContact("123")).toBe(false);
    expect(isValidTrackContact("!!!")).toBe(false);
  });

  it("accepts a tracking ID", () => {
    expect(isValidTrackContact("REF-1234")).toBe(true);
  });
});

describe("canContinueTrackRow", () => {
  const { plainToken, hash } = generateResumeToken();

  it("returns true when cookie verifies and payment is unpaid", () => {
    expect(
      canContinueTrackRow({ cookiePlain: plainToken, rowHash: hash, paymentStatus: "unpaid" }),
    ).toBe(true);
  });

  it("returns true when cookie verifies and payment is checkout_created", () => {
    expect(
      canContinueTrackRow({
        cookiePlain: plainToken,
        rowHash: hash,
        paymentStatus: "checkout_created",
      }),
    ).toBe(true);
  });

  it("returns false when cookie is missing", () => {
    expect(
      canContinueTrackRow({ cookiePlain: null, rowHash: hash, paymentStatus: "unpaid" }),
    ).toBe(false);
  });

  it("returns false when row hash is missing", () => {
    expect(
      canContinueTrackRow({ cookiePlain: plainToken, rowHash: null, paymentStatus: "unpaid" }),
    ).toBe(false);
  });

  it("returns false when cookie does not verify", () => {
    expect(
      canContinueTrackRow({ cookiePlain: "wrong", rowHash: hash, paymentStatus: "unpaid" }),
    ).toBe(false);
  });

  it("returns false when payment is paid even with matching cookie", () => {
    expect(
      canContinueTrackRow({ cookiePlain: plainToken, rowHash: hash, paymentStatus: "paid" }),
    ).toBe(false);
  });

  it("returns false when payment is failed", () => {
    expect(
      canContinueTrackRow({ cookiePlain: plainToken, rowHash: hash, paymentStatus: "failed" }),
    ).toBe(false);
  });
});

describe("mapTrackLookupRow", () => {
  const { plainToken, hash } = generateResumeToken();

  const row = {
    id: "aaaaaaaa-bbbb-5ccc-dddd-eeeeeeeeeeee",
    referenceNumber: "REF-1",
    nationalityCode: "US",
    serviceId: "svc-1",
    applicationStatus: "in_progress",
    paymentStatus: "paid",
    fulfillmentStatus: "submitted",
    adminAttentionRequired: false,
    resumeTokenHash: hash,
  };

  it("resolves service and nationality names", () => {
    const mapped = mapTrackLookupRow(row, {
      serviceName: "Tourist Visa",
      nationalityName: "United States",
    });
    expect(mapped.serviceName).toBe("Tourist Visa");
    expect(mapped.nationalityName).toBe("United States");
    expect(mapped.applicationId).toBe(row.id);
    expect(mapped.clientTracking.headline).toBeTruthy();
  });

  it("falls back to a generic 'Visa' when service name is null, never the raw id", () => {
    const mapped = mapTrackLookupRow(row, { serviceName: null, nationalityName: "US" });
    expect(mapped.serviceName).toBe("Visa");
    expect(mapped.serviceName).not.toBe("svc-1");
    expect(mapped.serviceName).not.toContain("aaaaaaaa");
  });

  it("sets canContinue and continueHref when cookie matches an unpaid draft", () => {
    const mapped = mapTrackLookupRow(
      { ...row, paymentStatus: "unpaid" },
      { serviceName: "Tourist Visa", nationalityName: "United States" },
      { cookiePlain: plainToken },
    );
    expect(mapped.canContinue).toBe(true);
    expect(mapped.continueHref).toBe(`/apply/applications/${row.id}`);
  });

  it("sets canContinue false without a matching cookie", () => {
    const mapped = mapTrackLookupRow(
      { ...row, paymentStatus: "unpaid" },
      { serviceName: "Tourist Visa", nationalityName: "United States" },
      { cookiePlain: null },
    );
    expect(mapped.canContinue).toBe(false);
    expect(mapped.continueHref).toBeNull();
  });

  it("prefers party resume hash over the row hash", () => {
    const partyToken = generateResumeToken();
    const mapped = mapTrackLookupRow(
      { ...row, paymentStatus: "unpaid", resumeTokenHash: hash },
      { serviceName: "Tourist Visa", nationalityName: "United States" },
      { cookiePlain: partyToken.plainToken, partyResumeTokenHash: partyToken.hash },
    );
    expect(mapped.canContinue).toBe(true);
    expect(mapped.continueHref).toBe(`/apply/applications/${row.id}`);
  });

  it("does not set canContinue for paid rows even with a matching cookie", () => {
    const mapped = mapTrackLookupRow(
      row,
      { serviceName: "Tourist Visa", nationalityName: "United States" },
      { cookiePlain: plainToken },
    );
    expect(mapped.canContinue).toBe(false);
    expect(mapped.continueHref).toBeNull();
  });
});
