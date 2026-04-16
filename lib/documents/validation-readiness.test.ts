import { describe, expect, it } from "vitest";
import {
  computeValidation,
  parseIsoDateUtc,
  PASSPORT_MIN_VALIDITY_DAYS,
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

describe("computeValidation", () => {
  const NOW = new Date(Date.UTC(2026, 3, 16));

  it("returns ready when profile complete, uploads present, expiry > 180 days", () => {
    const v = computeValidation({
      profile: COMPLETE_PROFILE,
      uploads: UPLOADS_OK,
      now: NOW,
    });
    expect(v.readiness).toBe("ready");
    expect(v.requiredFieldsMissing).toEqual([]);
    expect(v.validationFailures).toEqual([]);
    expect(v.nowUtcDate).toBe("2026-04-16");
  });

  it("flags passport expiry exactly 179 days in the future as failure", () => {
    const expiry = new Date(NOW.getTime() + 179 * 24 * 3600 * 1000);
    const v = computeValidation({
      profile: {
        ...COMPLETE_PROFILE,
        passportExpiryDate: toUtcDateString(expiry),
      },
      uploads: UPLOADS_OK,
      now: NOW,
    });
    expect(v.readiness).toBe("blocked_validation");
    expect(v.validationFailures.map((f) => f.code)).toContain(
      "passport_expired_or_insufficient_validity",
    );
  });

  it("treats passport expiry exactly 180 days out as valid", () => {
    const expiry = new Date(NOW.getTime() + PASSPORT_MIN_VALIDITY_DAYS * 24 * 3600 * 1000);
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
  });

  it("flags future DOBs as invalid", () => {
    const v = computeValidation({
      profile: { ...COMPLETE_PROFILE, dateOfBirth: "2099-01-01" },
      uploads: UPLOADS_OK,
      now: NOW,
    });
    expect(v.validationFailures.map((f) => f.code)).toContain("dob_invalid");
    expect(v.readiness).toBe("blocked_validation");
  });

  it("flags DOB before 1900 as invalid", () => {
    const v = computeValidation({
      profile: { ...COMPLETE_PROFILE, dateOfBirth: "1899-12-31" },
      uploads: UPLOADS_OK,
      now: NOW,
    });
    expect(v.validationFailures.map((f) => f.code)).toContain("dob_invalid");
  });

  it("marks missing required fields without validation failures as blocked_missing_required_fields", () => {
    const v = computeValidation({
      profile: { ...COMPLETE_PROFILE, profession: "", address: null },
      uploads: UPLOADS_OK,
      now: NOW,
    });
    expect(v.readiness).toBe("blocked_missing_required_fields");
    expect(v.requiredFieldsMissing.sort()).toEqual(["address", "profession"].sort());
    expect(v.validationFailures).toEqual([]);
  });

  it("prefers blocked_validation over blocked_missing_required_fields (spec §6.5 precedence)", () => {
    const expiry = new Date(NOW.getTime() + 10 * 24 * 3600 * 1000);
    const v = computeValidation({
      profile: {
        ...COMPLETE_PROFILE,
        passportExpiryDate: toUtcDateString(expiry),
        profession: null,
      },
      uploads: UPLOADS_OK,
      now: NOW,
    });
    expect(v.readiness).toBe("blocked_validation");
    expect(v.requiredFieldsMissing).toContain("profession");
    expect(v.validationFailures.map((f) => f.code)).toContain(
      "passport_expired_or_insufficient_validity",
    );
  });

  it("blocks on missing upload even when profile complete", () => {
    const v = computeValidation({
      profile: COMPLETE_PROFILE,
      uploads: { passportCopyPresent: true, personalPhotoPresent: false },
      now: NOW,
    });
    expect(v.readiness).toBe("blocked_missing_required_fields");
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
