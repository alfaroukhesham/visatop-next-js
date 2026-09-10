import { describe, expect, it } from "vitest";
import { buildOcrReviewParams } from "@/lib/analytics/ocr-review-params";

describe("buildOcrReviewParams", () => {
  it("sends field keys and counts without passport values", () => {
    expect(
      buildOcrReviewParams({
        applicationId: "app_1",
        documentId: "doc_9",
        status: "needs_manual",
        missingFields: ["fullName", "passportNumber", "SECRET_VALUE", "dateOfBirth"],
      }),
    ).toEqual({
      application_id: "app_1",
      document_id: "doc_9",
      ocr_status: "needs_manual",
      uncertain_field_count: 3,
      uncertain_fields: "fullName,passportNumber,dateOfBirth",
    });
  });

  it("returns null when nothing needs review", () => {
    expect(
      buildOcrReviewParams({
        applicationId: "app_1",
        status: "succeeded",
        missingFields: [],
      }),
    ).toBeNull();
  });
});
