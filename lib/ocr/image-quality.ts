import sharp from "sharp";

/** Landscape bio-page floor. A 200×140 thumbnail fails this before OCR. */
export const OCR_MIN_WIDTH = 400;
export const OCR_MIN_HEIGHT = 250;
export const OCR_MIN_PIXELS = OCR_MIN_WIDTH * OCR_MIN_HEIGHT;
export const OCR_MIN_BYTES = 12_000;
/** Laplacian variance on a 128px greyscale. Solid/blurred plates fall well below. */
export const OCR_MIN_LAPLACIAN_VARIANCE = 18;

export type TPassportImageQualityCode =
  | "IMAGE_TOO_SMALL"
  | "IMAGE_TOO_BLURRY"
  | "IMAGE_UNREADABLE";

export type TPassportImageQuality =
  | { ok: true }
  | { ok: false; code: TPassportImageQualityCode };

const laplacianVariance = async (bytes: Buffer): Promise<number | null> => {
  try {
    const { data } = await sharp(bytes, { failOn: "error" })
      .greyscale()
      .resize(128, 128, { fit: "inside", withoutEnlargement: false })
      .convolve({
        width: 3,
        height: 3,
        kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
      })
      .raw()
      .toBuffer({ resolveWithObject: true });
    let sum = 0;
    let sumSq = 0;
    for (const v of data) {
      sum += v;
      sumSq += v * v;
    }
    const n = data.length;
    if (n === 0) return null;
    const mean = sum / n;
    return sumSq / n - mean * mean;
  } catch {
    return null;
  }
};

export async function assessPassportImageQuality(bytes: Buffer): Promise<TPassportImageQuality> {
  if (!bytes || bytes.length < 32) {
    return { ok: false, code: "IMAGE_UNREADABLE" };
  }
  let width = 0;
  let height = 0;
  try {
    const meta = await sharp(bytes, { failOn: "error" }).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  } catch {
    return { ok: false, code: "IMAGE_UNREADABLE" };
  }
  if (width < OCR_MIN_WIDTH || height < OCR_MIN_HEIGHT || width * height < OCR_MIN_PIXELS) {
    return { ok: false, code: "IMAGE_TOO_SMALL" };
  }
  if (bytes.length < OCR_MIN_BYTES && width * height < OCR_MIN_PIXELS * 2) {
    return { ok: false, code: "IMAGE_TOO_SMALL" };
  }
  const variance = await laplacianVariance(bytes);
  if (variance === null) return { ok: false, code: "IMAGE_UNREADABLE" };
  if (variance < OCR_MIN_LAPLACIAN_VARIANCE) {
    return { ok: false, code: "IMAGE_TOO_BLURRY" };
  }
  return { ok: true };
}
