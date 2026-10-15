export const UPLOAD_FAILURE_GROUPS = [
  "session_auth",
  "file_type",
  "too_large",
  "corrupt_file",
  "pdf_not_single_page",
  "rate_limited",
  "validation",
  "conflict",
  "not_found",
  "server",
] as const;

export type TUploadFailureGroup = (typeof UPLOAD_FAILURE_GROUPS)[number];

export const sanitizeUploadFailureKey = (raw: string, fallback: string): string => {
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  const sliced = cleaned.slice(0, 64);
  return sliced || fallback;
};

export const uploadFailureGroup = (input: {
  errorCode: string;
  httpStatus: number;
}): TUploadFailureGroup => {
  const code = input.errorCode.toUpperCase();
  if (
    code === "FORBIDDEN" ||
    code === "UNAUTHORIZED" ||
    input.httpStatus === 401 ||
    input.httpStatus === 403
  ) {
    return "session_auth";
  }
  if (code === "UNSUPPORTED_TYPE" || input.httpStatus === 415) return "file_type";
  if (code === "FILE_TOO_LARGE" || input.httpStatus === 413) return "too_large";
  if (code === "CORRUPT_IMAGE") return "corrupt_file";
  if (code === "PDF_NOT_SINGLE_PAGE") return "pdf_not_single_page";
  if (code === "RATE_LIMITED" || input.httpStatus === 429) return "rate_limited";
  if (code === "VALIDATION_ERROR") return "validation";
  if (code === "CONFLICT" || code === "CHECKOUT_FROZEN" || input.httpStatus === 409) {
    return "conflict";
  }
  if (code === "NOT_FOUND" || input.httpStatus === 404) return "not_found";
  if (input.httpStatus >= 500 || code === "INTERNAL_ERROR") return "server";
  return "server";
};
