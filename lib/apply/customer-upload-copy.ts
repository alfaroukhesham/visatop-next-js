import { createCustomerT } from "@/lib/i18n/load-customer-catalog";
import type { TCustomerMessageVars } from "@/lib/i18n/customer-messages";

type TTranslate = (key: string, vars?: TCustomerMessageVars) => string;

const englishT = createCustomerT("en");

export const FILE_EXCEEDS_LIMIT_MESSAGE = "File exceeds 8MB limit.";

export const UPLOAD_ERROR_MESSAGE_KEYS: Record<string, string> = {
  CORRUPT_IMAGE: "upload.errors.corruptImage",
  UNSUPPORTED_TYPE: "upload.errors.unsupportedType",
  FILE_TOO_LARGE: "upload.errors.fileTooLarge",
  PDF_NOT_SINGLE_PAGE: "upload.errors.pdfNotSinglePage",
  RATE_LIMITED: "upload.errors.rateLimited",
  NETWORK: "upload.errors.network",
  TIMEOUT: "upload.errors.timeout",
  UPLOAD_FAILED: "upload.errors.generic",
};

export const customerUploadStateLabel = (hasDoc: boolean, t: TTranslate = englishT): string =>
  hasDoc ? t("upload.uploaded") : t("upload.notUploadedYet");

export const customerUploadErrorMessage = (code: string, t: TTranslate = englishT): string =>
  t(UPLOAD_ERROR_MESSAGE_KEYS[code] ?? UPLOAD_ERROR_MESSAGE_KEYS.UPLOAD_FAILED);

export const oversizedUploadMessage = (
  byteLength: number,
  maxBytes: number,
  t: TTranslate = englishT,
): string | null => (byteLength > maxBytes ? t("upload.fileExceedsLimit") : null);
