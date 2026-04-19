import {
  CorruptImageError,
  normalizeImageBuffer,
  NORMALIZED_CONTENT_TYPE,
  type NormalizedImage,
} from "./normalize-image";
import { CorruptPdfError, renderSinglePagePdfToPng } from "./passport-pdf";

export const PASSPORT_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const);

export type PassportUploadInput = {
  bytes: Buffer;
  contentType: string;
};

export type NormalizedPassportUpload = NormalizedImage & {
  /** Original content type supplied by the client (MIME). */
  sourceContentType: string;
  /** True when the input was a single-page PDF rendered to JPEG. */
  renderedFromPdf: boolean;
};

/**
 * Normalize a passport upload to JPEG + hash, following spec §5.6/§5.7.
 *
 * - `image/jpeg` / `image/png` → run through {@link normalizeImageBuffer}.
 * - `application/pdf` → verify single-page, render page 1, then JPEG-normalize.
 * - Any other content type is rejected upstream (route maps to 415).
 */
export async function normalizePassportUpload(
  input: PassportUploadInput,
): Promise<NormalizedPassportUpload> {
  if (!PASSPORT_ALLOWED_MIME.has(input.contentType as never)) {
    // Route-level guard should have caught this; defensive throw.
    throw new Error(`Unsupported passport content type: ${input.contentType}`);
  }

  if (input.contentType === "application/pdf") {
    try {
      const rendered = await renderSinglePagePdfToPng(input.bytes);
      const normalized = await normalizeImageBuffer(rendered.pngBytes);
      return {
        ...normalized,
        contentType: NORMALIZED_CONTENT_TYPE,
        sourceContentType: "application/pdf",
        renderedFromPdf: true,
      };
    } catch (err) {
      if (err instanceof CorruptPdfError || err instanceof CorruptImageError) {
        throw err;
      }
      throw err;
    }
  }

  const normalized = await normalizeImageBuffer(input.bytes);
  return {
    ...normalized,
    sourceContentType: input.contentType,
    renderedFromPdf: false,
  };
}
