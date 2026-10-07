export type TUploadFailureReason =
  | "file_too_large"
  | "upload_rejected"
  | "server_error"
  | "network_error"
  | "timeout"
  | "cancelled"
  | "upload_failed";

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
  if (input.httpStatus !== undefined && input.httpStatus >= 500) return "server_error";
  if (input.httpStatus !== undefined && input.httpStatus >= 400) return "upload_rejected";
  return "upload_failed";
};
