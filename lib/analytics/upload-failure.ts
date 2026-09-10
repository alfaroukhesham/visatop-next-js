export type TUploadFailureReason =
  | "file_too_large"
  | "upload_rejected"
  | "server_error"
  | "network_error"
  | "upload_failed";

export const uploadFailureReason = (input: {
  oversized?: boolean;
  httpStatus?: number;
  network?: boolean;
}): TUploadFailureReason => {
  if (input.oversized || input.httpStatus === 413) return "file_too_large";
  if (input.network) return "network_error";
  if (input.httpStatus !== undefined && input.httpStatus >= 500) return "server_error";
  if (input.httpStatus !== undefined && input.httpStatus >= 400) return "upload_rejected";
  return "upload_failed";
};
