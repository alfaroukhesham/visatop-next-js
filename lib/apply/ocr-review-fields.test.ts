import { describe, expect, it } from "vitest";
import { emptyOcrReviewFields } from "./ocr-review-fields";

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
