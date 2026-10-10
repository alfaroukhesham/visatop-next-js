export const PASSPORT_FAILURE_CODES = [
  "timeout",
  "cancelled",
  "file_type",
  "too_large",
  "network",
  "server",
  "corrupt_file",
  "pdf_not_single_page",
  "rate_limited",
] as const;

export type TPassportFailureCode = (typeof PASSPORT_FAILURE_CODES)[number];

export type TUploadFailureReason =
  | "file_too_large"
  | "file_type"
  | "corrupt_file"
  | "pdf_not_single_page"
  | "rate_limited"
  | "upload_rejected"
  | "server_error"
  | "network_error"
  | "timeout"
  | "cancelled"
  | "upload_failed";

export const passportFailureCode = (reason: TUploadFailureReason): TPassportFailureCode => {
  if (reason === "file_too_large") return "too_large";
  if (reason === "file_type" || reason === "upload_rejected") return "file_type";
  if (reason === "corrupt_file") return "corrupt_file";
  if (reason === "pdf_not_single_page") return "pdf_not_single_page";
  if (reason === "rate_limited") return "rate_limited";
  if (reason === "network_error") return "network";
  if (reason === "timeout") return "timeout";
  if (reason === "cancelled") return "cancelled";
  return "server";
};

export const uploadFailureReason = (input: {
  oversized?: boolean;
  httpStatus?: number;
  network?: boolean;
  timeout?: boolean;
  cancelled?: boolean;
  code?: string;
  errorCode?: string;
}): TUploadFailureReason => {
  const code = input.code ?? input.errorCode;
  if (input.cancelled || code === "CANCELLED") return "cancelled";
  if (input.timeout || code === "TIMEOUT") return "timeout";
  if (input.oversized || input.httpStatus === 413 || code === "FILE_TOO_LARGE") return "file_too_large";
  if (input.network || code === "NETWORK") return "network_error";
  if (code === "CORRUPT_IMAGE") return "corrupt_file";
  if (code === "PDF_NOT_SINGLE_PAGE") return "pdf_not_single_page";
  if (code === "RATE_LIMITED" || input.httpStatus === 429) return "rate_limited";
  if (code === "UNSUPPORTED_TYPE" || input.httpStatus === 415) return "file_type";
  if (input.httpStatus !== undefined && input.httpStatus >= 500) return "server_error";
  if (input.httpStatus !== undefined && input.httpStatus >= 400) return "upload_rejected";
  return "upload_failed";
};
