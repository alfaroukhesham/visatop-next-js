import { describe, expect, it } from "vitest";
import {
  customerFacingOcrMessage,
  OCR_NEEDS_REVIEW_COPY,
  OCR_READING_COPY,
  OCR_SUCCEEDED_COPY,
} from "./ocr-customer-copy";

describe("ocr-customer-copy", () => {
  it("maps running to reading copy", () => {
    expect(customerFacingOcrMessage("running")).toBe(OCR_READING_COPY);
  });

  it("does not claim reading when extraction has not started", () => {
    expect(customerFacingOcrMessage("not_started")).toBeNull();
  });

  it("maps succeeded to success copy", () => {
    expect(customerFacingOcrMessage("succeeded")).toBe(OCR_SUCCEEDED_COPY);
  });

  it("maps needs_manual and failed to review copy without exposing status labels", () => {
    expect(customerFacingOcrMessage("needs_manual")).toBe(OCR_NEEDS_REVIEW_COPY);
    expect(customerFacingOcrMessage("failed")).toBe(OCR_NEEDS_REVIEW_COPY);
  });

  it("returns null for unknown status", () => {
    expect(customerFacingOcrMessage(null)).toBeNull();
    expect(customerFacingOcrMessage("blocked")).toBeNull();
  });
});
