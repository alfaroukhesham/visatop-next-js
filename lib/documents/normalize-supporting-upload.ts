import { createHash } from "node:crypto";
import {
  normalizeImageBuffer,
  type NormalizedImage,
} from "./normalize-image";

export const SUPPORTING_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const);

/** PDFs are stored as-is for `supporting` (spec §5.7). */
export type SupportingResult =
  | (NormalizedImage & { sourceContentType: string; storedAsIs: false })
  | {
      bytes: Buffer;
      sha256: string;
      contentType: "application/pdf";
      byteLength: number;
      sourceContentType: string;
      storedAsIs: true;
    };

export async function normalizeSupportingUpload(input: {
  bytes: Buffer;
  contentType: string;
}): Promise<SupportingResult> {
  if (!SUPPORTING_ALLOWED_MIME.has(input.contentType as never)) {
    throw new Error(`Unsupported supporting content type: ${input.contentType}`);
  }

  if (input.contentType === "application/pdf") {
    const sha256 = createHash("sha256").update(input.bytes).digest("hex");
    return {
      bytes: input.bytes,
      sha256,
      contentType: "application/pdf",
      byteLength: input.bytes.byteLength,
      sourceContentType: "application/pdf",
      storedAsIs: true,
    };
  }

  const normalized = await normalizeImageBuffer(input.bytes);
  return {
    ...normalized,
    sourceContentType: input.contentType,
    storedAsIs: false,
  };
}
