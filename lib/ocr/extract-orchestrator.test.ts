import { describe, expect, it } from "vitest";
import {
  mergeOcrIntoProfile,
  type ApplicantProfileSnapshot,
  type ApplicantProfileProvenance,
} from "./extract-orchestrator";
import type { OcrResult } from "./schema";

const EMPTY_PROFILE: ApplicantProfileSnapshot = {
  fullName: null,
  dateOfBirth: null,
  placeOfBirth: null,
  applicantNationality: null,
  passportNumber: null,
  passportExpiryDate: null,
  profession: null,
  address: null,
};

function ocr(fields: Partial<OcrResult>): OcrResult {
  return {
    schemaVersion: 1,
    fullName: null,
    dateOfBirth: null,
    placeOfBirth: null,
    nationality: null,
    passportNumber: null,
    passportExpiryDate: null,
    profession: null,
    address: null,
    ...fields,
  };
}

describe("mergeOcrIntoProfile", () => {
  it("writes OCR values into empty profile and marks source=ocr", () => {
    const delta = mergeOcrIntoProfile(
      EMPTY_PROFILE,
      {},
      ocr({
        fullName: "Ada Lovelace",
        dateOfBirth: "1815-12-10",
        nationality: "British",
        passportNumber: "X1",
        passportExpiryDate: "2030-01-01",
      }),
    );
    expect(delta.updates.fullName).toBe("Ada Lovelace");
    expect(delta.updates.applicantNationality).toBe("British");
    expect(delta.provenance.fullName).toEqual({ source: "ocr" });
    expect(delta.provenance.applicantNationality).toEqual({ source: "ocr" });
  });

  it("does NOT overwrite fields marked manual (spec §6.4)", () => {
    const currentProfile: ApplicantProfileSnapshot = {
      ...EMPTY_PROFILE,
      fullName: "User Entered",
    };
    const provenance: ApplicantProfileProvenance = {
      fullName: { source: "manual" },
    };
    const delta = mergeOcrIntoProfile(
      currentProfile,
      provenance,
      ocr({ fullName: "OCR Guess", passportNumber: "P1" }),
    );
    expect(delta.updates.fullName).toBeUndefined();
    expect(delta.updates.passportNumber).toBe("P1");
    expect(delta.provenance.fullName).toEqual({ source: "manual" });
    expect(delta.provenance.passportNumber).toEqual({ source: "ocr" });
  });

  it("skips null/empty OCR values without downgrading provenance", () => {
    const provenance: ApplicantProfileProvenance = {
      fullName: { source: "manual" },
      passportNumber: { source: "ocr" },
    };
    const delta = mergeOcrIntoProfile(
      { ...EMPTY_PROFILE, fullName: "User", passportNumber: "OLD" },
      provenance,
      ocr({ fullName: "   ", passportNumber: null }),
    );
    expect(delta.updates.fullName).toBeUndefined();
    expect(delta.updates.passportNumber).toBeUndefined();
    expect(delta.provenance.fullName).toEqual({ source: "manual" });
    expect(delta.provenance.passportNumber).toEqual({ source: "ocr" });
  });

  it("can re-apply OCR on top of prior OCR-sourced values (second run overwrites)", () => {
    const provenance: ApplicantProfileProvenance = {
      fullName: { source: "ocr" },
    };
    const delta = mergeOcrIntoProfile(
      { ...EMPTY_PROFILE, fullName: "First Guess" },
      provenance,
      ocr({ fullName: "Second Guess" }),
    );
    expect(delta.updates.fullName).toBe("Second Guess");
    expect(delta.provenance.fullName).toEqual({ source: "ocr" });
  });

  it("returns no updates when ocr result is null", () => {
    const delta = mergeOcrIntoProfile(EMPTY_PROFILE, { fullName: { source: "manual" } }, null);
    expect(delta.updates).toEqual({});
    expect(delta.provenance.fullName).toEqual({ source: "manual" });
  });
});
