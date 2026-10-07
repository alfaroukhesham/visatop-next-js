import { describe, expect, it } from "vitest";
import {
  customerFacingOcrMessage,
  OCR_NEEDS_REVIEW_COPY,
  OCR_READING_COPY,
  OCR_SUCCEEDED_COPY,
  passportSlotOcrNotice,
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

  it("maps extract outcomes onto the passport-slot notice copy", () => {
    expect(passportSlotOcrNotice("needs_manual", false)).toMatch(/couldn't read everything/i);
    expect(passportSlotOcrNotice("failed", false)).toMatch(/couldn't read your passport/i);
    expect(passportSlotOcrNotice("succeeded", false)).toMatch(/filled in what we could/i);
    expect(passportSlotOcrNotice("needs_manual", true)).toBe(OCR_READING_COPY);
  });
});
