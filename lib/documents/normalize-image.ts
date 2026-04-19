import { createHash } from "node:crypto";
import sharp from "sharp";

/**
 * MVP image normalization (spec §5.6).
 *
 * - Decode; if decode fails → throw `CorruptImageError` (route maps to 400 CORRUPT_IMAGE).
 * - EXIF-orient so pixels are upright.
 * - Strip non-essential metadata (EXIF / ICC comments where safe).
 * - Downscale so max edge ≤ {@link MAX_RASTER_EDGE_PX}; no upscaling.
 * - Re-encode as JPEG q=85 before sha256 + persist (stable hash + predictable size).
 */
export const MAX_RASTER_EDGE_PX = 4096;
export const JPEG_QUALITY = 85;

export const NORMALIZED_CONTENT_TYPE = "image/jpeg" as const;

export class CorruptImageError extends Error {
  code = "CORRUPT_IMAGE" as const;
  constructor(message = "Unable to decode uploaded image.") {
    super(message);
    this.name = "CorruptImageError";
  }
}

export type NormalizedImage = {
  /** Final bytes to persist (JPEG). */
  bytes: Buffer;
  /** `sha256` hex of `bytes` (post-encode). */
  sha256: string;
  contentType: typeof NORMALIZED_CONTENT_TYPE;
  byteLength: number;
  width: number;
  height: number;
};

/** Normalize any supported image input to JPEG + hash. */
export async function normalizeImageBuffer(input: Buffer): Promise<NormalizedImage> {
  let pipeline: sharp.Sharp;
  try {
    pipeline = sharp(input, { failOn: "error" });
  } catch (err) {
    throw new CorruptImageError(
      err instanceof Error ? `CORRUPT_IMAGE: ${err.message}` : "CORRUPT_IMAGE",
    );
  }

  let meta: sharp.Metadata;
  try {
    meta = await pipeline.metadata();
  } catch (err) {
    throw new CorruptImageError(
      err instanceof Error ? `CORRUPT_IMAGE: ${err.message}` : "CORRUPT_IMAGE",
    );
  }

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width <= 0 || height <= 0) {
    throw new CorruptImageError("CORRUPT_IMAGE: zero-dimension image.");
  }

  const shouldResize = width > MAX_RASTER_EDGE_PX || height > MAX_RASTER_EDGE_PX;

  const { data: bytes, info } = await pipeline
    .rotate()
    .resize(
      shouldResize
        ? {
            width: MAX_RASTER_EDGE_PX,
            height: MAX_RASTER_EDGE_PX,
            fit: "inside",
            withoutEnlargement: true,
          }
        : undefined,
    )
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: false })
    .toBuffer({ resolveWithObject: true });

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return {
    bytes,
    sha256,
    contentType: NORMALIZED_CONTENT_TYPE,
    byteLength: bytes.byteLength,
    width: info.width ?? 0,
    height: info.height ?? 0,
  };
}
