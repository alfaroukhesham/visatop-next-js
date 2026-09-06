import { describe, expect, it } from "vitest";
import { isValidTrackContact, mapTrackLookupRow, parseTrackContact } from "./track-lookup";

describe("parseTrackContact", () => {
  it("parses email", () => {
    expect(parseTrackContact("  User@EXAMPLE.com ")).toEqual({ kind: "email", email: "user@example.com" });
  });

  it("parses phone digits", () => {
    expect(parseTrackContact("+971 50 123 4567")).toEqual({ kind: "phone", digits: "971501234567" });
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
    expect(isValidTrackContact("nodigits")).toBe(false);
    expect(isValidTrackContact("123")).toBe(false);
  });
});

describe("mapTrackLookupRow", () => {
  const row = {
    id: "aaaaaaaa-bbbb-5ccc-dddd-eeeeeeeeeeee",
    referenceNumber: "REF-1",
    nationalityCode: "US",
    serviceId: "svc-1",
    applicationStatus: "in_progress",
    paymentStatus: "paid",
    fulfillmentStatus: "submitted",
    adminAttentionRequired: false,
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
});
