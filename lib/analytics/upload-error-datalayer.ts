export type TUploadErrorFileType = "jpeg" | "png" | "pdf" | "heic" | "other";

export type TUploadErrorSizeBucket = "<1MB" | "1–3MB" | "3–8MB" | ">8MB";

export type TUploadErrorDataLayerPayload = {
  event: "upload_error";
  error_type: string;
  file_type: TUploadErrorFileType;
  size_bucket: TUploadErrorSizeBucket;
};

const ERROR_TYPE_BY_CODE: Record<string, string> = {
  CORRUPT_IMAGE: "corrupt_image",
  UNSUPPORTED_TYPE: "unsupported_type",
  PDF_NOT_SINGLE_PAGE: "pdf_not_single_page",
  FILE_TOO_LARGE: "file_too_large",
  RATE_LIMITED: "rate_limited",
  NETWORK: "network",
  TIMEOUT: "timeout",
  CANCELLED: "cancelled",
  UPLOAD_FAILED: "upload_failed",
};

export const dataLayerErrorType = (code: string): string =>
  ERROR_TYPE_BY_CODE[code] ?? "upload_failed";

export const fileTypeFromUpload = (file: { name: string; type: string }): TUploadErrorFileType => {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (mime.includes("heic") || mime.includes("heif") || /\.(heic|heif|hif)$/.test(name)) {
    return "heic";
  }
  if (mime.includes("jpeg") || mime.includes("jpg") || /\.jpe?g$/.test(name)) return "jpeg";
  if (mime.includes("png") || name.endsWith(".png")) return "png";
  return "other";
};

export const sizeBucketFromBytes = (byteLength: number): TUploadErrorSizeBucket => {
  const mb = byteLength / (1024 * 1024);
  if (mb < 1) return "<1MB";
  if (mb < 3) return "1–3MB";
  if (mb <= 8) return "3–8MB";
  return ">8MB";
};

export const buildUploadErrorDataLayerPayload = (input: {
  code: string;
  file: { name: string; type: string; size: number };
}): TUploadErrorDataLayerPayload => ({
  event: "upload_error",
  error_type: dataLayerErrorType(input.code),
  file_type: fileTypeFromUpload(input.file),
  size_bucket: sizeBucketFromBytes(input.file.size),
});

/** No-op when `window.dataLayer` is missing. Never writes PII. */
export const pushUploadErrorDataLayer = (payload: TUploadErrorDataLayerPayload): void => {
  if (typeof window === "undefined") return;
  const dataLayer = window.dataLayer;
  if (!Array.isArray(dataLayer)) return;
  dataLayer.push(payload);
};
