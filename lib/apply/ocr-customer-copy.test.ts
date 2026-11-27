import { describe, expect, it } from "vitest";
import { FALLBACK_CUSTOMER_LOCALE_SLUGS } from "@/lib/i18n/customer-locale";
import { lookupCustomerMessage } from "@/lib/i18n/customer-messages";
import { getCustomerMessages } from "@/lib/i18n/load-customer-catalog";
import {
  customerFacingOcrMessage,
  OCR_NEEDS_REVIEW_COPY,
  OCR_READING_COPY,
  OCR_SUCCEEDED_COPY,
  ocrStatusForDraftUi,
  passportOcrNoticeTone,
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
    expect(passportSlotOcrNotice("succeeded", false)).toBe(OCR_SUCCEEDED_COPY);
    expect(passportSlotOcrNotice("needs_manual", true)).toBe(OCR_READING_COPY);
  });

  it("uses a success tone only after a complete read", () => {
    expect(passportOcrNoticeTone(true, "succeeded")).toBe("status");
    expect(passportOcrNoticeTone(false, "succeeded")).toBe("success");
    expect(passportOcrNoticeTone(false, "needs_manual")).toBe("alert");
    expect(passportOcrNoticeTone(false, "failed")).toBe("alert");
  });

  it("has the succeeded copy in every customer locale", () => {
    for (const slug of FALLBACK_CUSTOMER_LOCALE_SLUGS) {
      const text = lookupCustomerMessage(getCustomerMessages(slug), "ocr.succeeded");
      expect(text, slug).toEqual(expect.any(String));
      expect(text!.trim().length, slug).toBeGreaterThan(0);
    }
  });

  it("prefers this-session extract status, then persisted application status", () => {
    expect(ocrStatusForDraftUi("needs_manual", "succeeded")).toBe("needs_manual");
    expect(ocrStatusForDraftUi(null, "needs_manual")).toBe("needs_manual");
    expect(ocrStatusForDraftUi(undefined, "failed")).toBe("failed");
    expect(ocrStatusForDraftUi(null, "not_started")).toBeNull();
  });
});
