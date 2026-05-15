import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apply/apply-flow-config", () => ({
  APPLY_STEP3_VALIDATION_DISABLED: false,
}));

import {
  computeValidation,
  formatIsoDateAsDdMmYyyy,
  parseDobInputToIsoUtc,
  parseIsoDateUtc,
  SUBMISSION_REQUIRED_FIELDS,
  toUtcDateString,
} from "./validation-readiness";

const COMPLETE_PROFILE = {
  email: "a@b.co",
  phone: "+1-555-0101",
  fullName: "Ada Lovelace",
  dateOfBirth: "1990-01-02",
  placeOfBirth: "London",
  nationality: "British",
  passportNumber: "X1234567",
  passportExpiryDate: "2099-01-01",
  profession: "Analyst",
  address: "1 Byron St, London",
};

const UPLOADS_OK = { passportCopyPresent: true, personalPhotoPresent: true };

describe("parseIsoDateUtc", () => {
  it("parses valid dates as UTC", () => {
    const d = parseIsoDateUtc("2024-02-29");
    expect(d?.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it("rejects invalid calendar dates", () => {
    expect(parseIsoDateUtc("2023-02-29")).toBeNull();
    expect(parseIsoDateUtc("not-a-date")).toBeNull();
    expect(parseIsoDateUtc("2024-13-01")).toBeNull();
    expect(parseIsoDateUtc(null)).toBeNull();
  });
});

describe("toUtcDateString", () => {
  it("formats UTC date regardless of local TZ", () => {
    expect(toUtcDateString(new Date(Date.UTC(2026, 3, 16)))).toBe("2026-04-16");
  });
});

describe("formatIsoDateAsDdMmYyyy / parseDobInputToIsoUtc", () => {
  it("formats ISO to DD-MM-YYYY", () => {
    expect(formatIsoDateAsDdMmYyyy("1990-01-02")).toBe("02-01-1990");
    expect(formatIsoDateAsDdMmYyyy("2024-02-29")).toBe("29-02-2024");
    expect(formatIsoDateAsDdMmYyyy("2099-01-01")).toBe("01-01-2099");
  });

  it("parses DD-MM-YYYY to ISO", () => {
    expect(parseDobInputToIsoUtc("02-01-1990")).toBe("1990-01-02");
    expect(parseDobInputToIsoUtc("29-02-2024")).toBe("2024-02-29");
    expect(parseDobInputToIsoUtc("01-01-2099")).toBe("2099-01-01");
  });

  it("still accepts pasted YYYY-MM-DD", () => {
    expect(parseDobInputToIsoUtc("1990-01-02")).toBe("1990-01-02");
  });

  it("rejects invalid input", () => {
    expect(parseDobInputToIsoUtc("")).toBeNull();
    expect(parseDobInputToIsoUtc("32-01-2000")).toBeNull();
    expect(parseDobInputToIsoUtc("01-13-2000")).toBeNull();
    expect(parseDobInputToIsoUtc("not-a-date")).toBeNull();
  });
});

describe("computeValidation", () => {
  const NOW = new Date(Date.UTC(2026, 3, 16));

  it("returns ready when profile complete, uploads present, expiry > 180 days", () => {
    const v = computeValidation({
      profile: COMPLETE_PROFILE,
      uploads: UPLOADS_OK,
      now: NOW,
    });
    expect(v.readiness).toBe("ready");
    expect(v.paymentReadiness).toBe("ready");
    expect(v.requiredFieldsMissing).toEqual([]);
    expect(v.validationFailures).toEqual([]);
    expect(v.nowUtcDate).toBe("2026-04-16");
  });

  it("flags malformed passport expiry when a value is provided", () => {
    const v = computeValidation({
      profile: { ...COMPLETE_PROFILE, passportExpiryDate: "not-a-date" },
      uploads: UPLOADS_OK,
      now: NOW,
    });
    expect(v.readiness).toBe("blocked_validation");
    expect(v.paymentReadiness).toBe("blocked_validation");
    expect(v.validationFailures.map((f) => f.code)).toContain("passport_expiry_date_invalid");
  });

  it("accepts any future passport expiry without a minimum-validity check", () => {
    const expiry = new Date(NOW.getTime() + 10 * 24 * 3600 * 1000);
    const v = computeValidation({
      profile: {
        ...COMPLETE_PROFILE,
        passportExpiryDate: toUtcDateString(expiry),
      },
      uploads: UPLOADS_OK,
      now: NOW,
    });
    expect(v.validationFailures).toEqual([]);
    expect(v.readiness).toBe("ready");
    expect(v.paymentReadiness).toBe("ready");
  });

  it("flags future DOBs as invalid", () => {
    const v = computeValidation({
      profile: { ...COMPLETE_PROFILE, dateOfBirth: "2099-01-01" },
      uploads: UPLOADS_OK,
      now: NOW,
    });
    expect(v.validationFailures.map((f) => f.code)).toContain("dob_invalid");
    expect(v.readiness).toBe("blocked_validation");
    expect(v.paymentReadiness).toBe("blocked_validation");
  });

  it("flags DOB before 1900 as invalid", () => {
    const v = computeValidation({
      profile: { ...COMPLETE_PROFILE, dateOfBirth: "1899-12-31" },
      uploads: UPLOADS_OK,
      now: NOW,
    });
    expect(v.validationFailures.map((f) => f.code)).toContain("dob_invalid");
    expect(v.paymentReadiness).toBe("blocked_validation");
  });

  it("marks missing required fields without validation failures as blocked_missing_required_fields", () => {
    const v = computeValidation({
      profile: { ...COMPLETE_PROFILE, profession: "", address: null },
      uploads: UPLOADS_OK,
      now: NOW,
    });
    expect(v.readiness).toBe("blocked_missing_required_fields");
    expect(v.paymentReadiness).toBe("blocked_missing_required_fields");
    expect(v.requiredFieldsMissing.sort()).toEqual(["address", "profession"].sort());
    expect(v.validationFailures).toEqual([]);
  });

  it("prefers blocked_validation over blocked_missing_required_fields (spec §6.5 precedence)", () => {
    const v = computeValidation({
      profile: {
        ...COMPLETE_PROFILE,
        passportExpiryDate: "not-a-date",
        profession: null,
      },
      uploads: UPLOADS_OK,
      now: NOW,
    });
    expect(v.readiness).toBe("blocked_validation");
    expect(v.paymentReadiness).toBe("blocked_validation");
    expect(v.requiredFieldsMissing).toContain("profession");
    expect(v.validationFailures.map((f) => f.code)).toContain(
      "passport_expiry_date_invalid",
    );
  });

  it("blocks on missing upload even when profile complete", () => {
    const v = computeValidation({
      profile: COMPLETE_PROFILE,
      uploads: { passportCopyPresent: true, personalPhotoPresent: false },
      now: NOW,
    });
    expect(v.readiness).toBe("blocked_missing_required_fields");
    expect(v.paymentReadiness).toBe("ready");
  });

  it("paymentReadiness stays blocked when profile incomplete even if uploads are present", () => {
    const v = computeValidation({
      profile: { ...COMPLETE_PROFILE, fullName: "" },
      uploads: UPLOADS_OK,
      now: NOW,
    });
    expect(v.readiness).toBe("blocked_missing_required_fields");
    expect(v.paymentReadiness).toBe("blocked_missing_required_fields");
  });

  it("required field key list is the locked 10-field MVP set", () => {
    expect([...SUBMISSION_REQUIRED_FIELDS].sort()).toEqual(
      [
        "email",
        "phone",
        "fullName",
        "dateOfBirth",
        "placeOfBirth",
        "nationality",
        "passportNumber",
        "passportExpiryDate",
        "profession",
        "address",
      ].sort(),
    );
  });
});

describe("computeValidation when APPLY_STEP3_VALIDATION_DISABLED", () => {
  const NOW = new Date(Date.UTC(2026, 3, 16));

  it("returns payment ready when only email is present", async () => {
    vi.resetModules();
    vi.doMock("@/lib/apply/apply-flow-config", () => ({
      APPLY_STEP3_VALIDATION_DISABLED: true,
    }));
    const { computeValidation: computeWithFlag } = await import("./validation-readiness");
    const v = computeWithFlag({
      profile: { email: "guest@example.com" },
      uploads: { passportCopyPresent: false, personalPhotoPresent: false },
      now: NOW,
    });
    expect(v.paymentReadiness).toBe("ready");
    expect(v.requiredFieldsMissing).toEqual([]);
    expect(v.validationFailures).toEqual([]);
  });

  it("blocks payment when email is missing", async () => {
    vi.resetModules();
    vi.doMock("@/lib/apply/apply-flow-config", () => ({
      APPLY_STEP3_VALIDATION_DISABLED: true,
    }));
    const { computeValidation: computeWithFlag } = await import("./validation-readiness");
    const v = computeWithFlag({
      profile: {},
      uploads: { passportCopyPresent: false, personalPhotoPresent: false },
      now: NOW,
    });
    expect(v.paymentReadiness).toBe("blocked_missing_required_fields");
    expect(v.requiredFieldsMissing).toEqual(["email"]);
  });
});
