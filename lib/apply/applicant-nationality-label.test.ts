import { describe, expect, it } from "vitest";
import {
  applicantNationalityPrefill,
  applicantNationalityUsesCountryNamePrefill,
  isAcceptedApplicantNationality,
  isApplicantNationalityValidForReview,
} from "./applicant-nationality-label";

describe("applicantNationalityPrefill", () => {
  it("maps catalog country names to demonyms for common passport codes", () => {
    expect(applicantNationalityPrefill("ZA", "South Africa")).toBe("South African");
    expect(applicantNationalityPrefill("NG", "Nigeria")).toBe("Nigerian");
    expect(applicantNationalityPrefill("IN", "India")).toBe("Indian");
  });

  it("keeps non-country catalog labels unchanged", () => {
    expect(applicantNationalityPrefill("IN", "Indian")).toBe("Indian");
  });
});

describe("isAcceptedApplicantNationality", () => {
  it("accepts demonym and catalog country name for the same code", () => {
    expect(isAcceptedApplicantNationality("South African", "ZA", "South Africa")).toBe(true);
    expect(isAcceptedApplicantNationality("South Africa", "ZA", "South Africa")).toBe(true);
    expect(isAcceptedApplicantNationality("Nigerian", "NG", "Nigeria")).toBe(true);
    expect(isAcceptedApplicantNationality("Nigeria", "NG", "Nigeria")).toBe(true);
  });

  it("rejects unrelated labels", () => {
    expect(isAcceptedApplicantNationality("British", "ZA", "South Africa")).toBe(false);
  });
});

describe("unmapped ISO codes", () => {
  it("uses country-name prefill and keeps that value valid for review highlighting", () => {
    expect(applicantNationalityUsesCountryNamePrefill("AD")).toBe(true);
    expect(applicantNationalityPrefill("AD", "Andorra")).toBe("Andorra");
    expect(isApplicantNationalityValidForReview("Andorra", "AD", "Andorra")).toBe(true);
  });
});