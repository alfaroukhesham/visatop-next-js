import { createCustomerT } from "@/lib/i18n/load-customer-catalog";
import type { TCustomerMessageVars } from "@/lib/i18n/customer-messages";

type TTranslate = (key: string, vars?: TCustomerMessageVars) => string;

const englishT = createCustomerT("en");

export const FILE_EXCEEDS_LIMIT_MESSAGE = "File exceeds 8MB limit.";

export const customerUploadStateLabel = (hasDoc: boolean, t: TTranslate = englishT): string =>
  hasDoc ? t("upload.uploaded") : t("upload.notUploadedYet");

export const oversizedUploadMessage = (
  byteLength: number,
  maxBytes: number,
  t: TTranslate = englishT,
): string | null => (byteLength > maxBytes ? t("upload.fileExceedsLimit") : null);
