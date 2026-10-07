import { isHeicBytes, isHeicFilename, isHeicMime } from "@/lib/documents/heic-detect";

const isPdfBytes = (bytes: Uint8Array): boolean =>
  bytes.length >= 5 &&
  bytes[0] === 0x25 &&
  bytes[1] === 0x50 &&
  bytes[2] === 0x44 &&
  bytes[3] === 0x46 &&
  bytes[4] === 0x2d;

const isJpegBytes = (bytes: Uint8Array): boolean =>
  bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

const isPngBytes = (bytes: Uint8Array): boolean =>
  bytes.length >= 8 &&
  bytes[0] === 0x89 &&
  bytes[1] === 0x50 &&
  bytes[2] === 0x4e &&
  bytes[3] === 0x47 &&
  bytes[4] === 0x0d &&
  bytes[5] === 0x0a &&
  bytes[6] === 0x1a &&
  bytes[7] === 0x0a;

/**
 * Resolve a raster/PDF content type from magic bytes first, then MIME / filename.
 * Empty `File.type` (common on some mobile pickers) still works when bytes are valid.
 */
export const resolveUploadContentType = (
  bytes: Uint8Array,
  mime: string,
  filename?: string | null,
): string | null => {
  if (isPdfBytes(bytes)) return "application/pdf";
  if (isHeicBytes(bytes)) return "image/heic";
  if (isJpegBytes(bytes)) return "image/jpeg";
  if (isPngBytes(bytes)) return "image/png";

  const normalizedMime = mime.trim().toLowerCase();
  if (normalizedMime === "application/pdf") return "application/pdf";
  if (isHeicMime(normalizedMime)) return "image/heic";
  if (normalizedMime === "image/jpeg" || normalizedMime === "image/jpg") return "image/jpeg";
  if (normalizedMime === "image/png") return "image/png";

  const name = filename ?? "";
  if (/\.pdf$/i.test(name)) return "application/pdf";
  if (isHeicFilename(name)) return "image/heic";
  if (/\.jpe?g$/i.test(name)) return "image/jpeg";
  if (/\.png$/i.test(name)) return "image/png";

  return normalizedMime || null;
};
