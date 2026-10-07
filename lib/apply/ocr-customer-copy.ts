import { createCustomerT } from "@/lib/i18n/load-customer-catalog";
import type { TCustomerMessageVars } from "@/lib/i18n/customer-messages";

type TTranslate = (key: string, vars?: TCustomerMessageVars) => string;

const englishT = createCustomerT("en");

export const OCR_READING_COPY = "Reading your passport…";

export const OCR_SUCCEEDED_COPY =
  "Details filled in — please check they are correct.";

export const OCR_NEEDS_REVIEW_COPY =
  "We could not read some details clearly. Review the highlighted fields.";

export const customerFacingOcrMessage = (
  status: string | null | undefined,
  t: TTranslate = englishT,
): string | null => {
  switch (status) {
    case "running":
      return t("ocr.reading");
    case "succeeded":
      return t("ocr.succeeded");
    case "needs_manual":
    case "failed":
      return t("ocr.needsReview");
    default:
      return null;
  }
};

/** Passport-slot OCR notice (replaces the leftover banner above Documents). */
export const passportSlotOcrNotice = (
  status: string | null | undefined,
  extracting: boolean,
  t: TTranslate = englishT,
): string | null => {
  if (extracting) return t("ocr.reading");
  switch (status) {
    case "succeeded":
      return t("draft.actionMessages.ocrPartial");
    case "needs_manual":
      return t("draft.actionMessages.ocrManual");
    case "failed":
      return t("draft.actionMessages.ocrFailed");
    default:
      return null;
  }
};
