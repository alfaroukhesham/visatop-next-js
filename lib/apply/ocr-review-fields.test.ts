import { describe, expect, it } from "vitest";
import { emptyOcrReviewFields, reviewHighlightFields } from "./ocr-review-fields";

describe("emptyOcrReviewFields", () => {
  it("returns only missing OCR keys that are still empty on the form", () => {
    expect(
      emptyOcrReviewFields(["dateOfBirth", "passportExpiryDate", "fullName"], {
        fullName: "Ada Lovelace",
        dateOfBirth: "",
        passportExpiryDate: "  ",
        nationality: "Indian",
      }),
    ).toEqual(["dateOfBirth", "passportExpiryDate"]);
  });

  it("returns nothing when OCR did not report a usable missing-field list", () => {
    expect(emptyOcrReviewFields([], { dateOfBirth: "" })).toEqual([]);
    expect(emptyOcrReviewFields(null, { dateOfBirth: "" })).toEqual([]);
    expect(emptyOcrReviewFields(["unknown_field"], { dateOfBirth: "" })).toEqual([]);
  });
});

describe("reviewHighlightFields", () => {
  it("keeps OCR-filled fields highlighted from persisted provenance after reload", () => {
    expect(
      reviewHighlightFields({
        ocrMissingFields: [],
        fieldMeta: {
          fullName: { source: "ocr", needsReview: true },
          nationality: { source: "ocr", needsReview: true },
        },
        valuesByApplicantKey: { fullName: "Ada", nationality: "British" },
      }),
    ).toEqual(expect.arrayContaining(["fullName", "nationality"]));
  });
});
