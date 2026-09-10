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
