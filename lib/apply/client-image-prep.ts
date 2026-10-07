import { isHeicFilename, isHeicMime } from "@/lib/documents/heic-detect";

export const CLIENT_IMAGE_MAX_EDGE_PX = 2400;
export const CLIENT_JPEG_QUALITY = 0.85;
export const CLIENT_SKIP_COMPRESS_BELOW_BYTES = Math.round(1.5 * 1024 * 1024);

export const scaleToMaxEdge = (
  width: number,
  height: number,
  maxEdge = CLIENT_IMAGE_MAX_EDGE_PX,
): { width: number; height: number } => {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
};

export const looksLikePdfFile = (file: File): boolean =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

export const looksLikeHeicFile = (file: File): boolean =>
  isHeicMime(file.type) || isHeicFilename(file.name);

/** Swap the last extension; never append when it already matches (`photo.jpg` stays `photo.jpg`). */
export const replaceUploadExtension = (filename: string, ext: string): string => {
  const trimmed = filename.trim() || "upload";
  const cleanExt = ext.replace(/^\./, "");
  if (/\.[^.]+$/.test(trimmed)) {
    return trimmed.replace(/\.[^.]+$/, `.${cleanExt}`);
  }
  return `${trimmed}.${cleanExt}`;
};

/** PDFs are not compressed — apply the 8MB cap to the original. Photos compress first. */
export const shouldApplyUploadLimitBeforePrepare = (file: File): boolean => looksLikePdfFile(file);

const blobToFile = (blob: Blob, filename: string, type: string): File =>
  new File([blob], filename, { type, lastModified: Date.now() });

const canvasToJpegBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not encode JPEG."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });

const bitmapToJpegBlob = async (
  bitmap: ImageBitmap,
  quality: number,
  maxEdge = CLIENT_IMAGE_MAX_EDGE_PX,
): Promise<Blob> => {
  const { width, height } = scaleToMaxEdge(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not draw image.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvasToJpegBlob(canvas, quality);
};

const decodeBlobToBitmap = async (blob: Blob): Promise<ImageBitmap> => {
  if (typeof createImageBitmap !== "function") {
    throw new Error("Image decoder is unavailable.");
  }
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" } as ImageBitmapOptions);
  } catch {
    return createImageBitmap(blob);
  }
};

const convertHeicBlobToJpeg = async (blob: Blob): Promise<Blob> => {
  try {
    const bitmap = await decodeBlobToBitmap(blob);
    return bitmapToJpegBlob(bitmap, 0.9);
  } catch {
    const loaded = (await import("heic2any")) as { default?: typeof import("heic2any") } & typeof import("heic2any");
    const heic2any = typeof loaded === "function" ? loaded : loaded.default;
    if (typeof heic2any !== "function") {
      throw new Error("HEIC converter is unavailable.");
    }
    const result = await heic2any({ blob, toType: "image/jpeg", quality: 0.9 });
    const jpeg = Array.isArray(result) ? result[0] : result;
    if (!(jpeg instanceof Blob)) {
      throw new Error("HEIC converter returned an empty result.");
    }
    return jpeg;
  }
};

const compressImageBlob = async (blob: Blob): Promise<Blob> => {
  const bitmap = await decodeBlobToBitmap(blob);
  return bitmapToJpegBlob(bitmap, CLIENT_JPEG_QUALITY);
};

/**
 * Convert HEIC when needed, then downscale + JPEG-encode large photos before upload.
 * PDFs and already-small JPEGs pass through. Failures throw so the caller can fall back.
 */
export const prepareClientUploadFile = async (file: File): Promise<File> => {
  if (looksLikePdfFile(file)) return file;

  let working: Blob = file;
  let filename = file.name;
  const wasHeic = looksLikeHeicFile(file);

  if (wasHeic) {
    working = await convertHeicBlobToJpeg(file);
    filename = replaceUploadExtension(filename, "jpg");
  }

  const skipCompress =
    working.size <= CLIENT_SKIP_COMPRESS_BELOW_BYTES &&
    (working.type === "image/jpeg" || filename.toLowerCase().endsWith(".jpg") || filename.toLowerCase().endsWith(".jpeg"));

  if (skipCompress && !wasHeic && working === file) {
    return file;
  }

  if (skipCompress) {
    return blobToFile(working, filename, "image/jpeg");
  }

  try {
    const compressed = await compressImageBlob(working);
    if (compressed.size >= working.size && working.type === "image/jpeg") {
      return working === file ? file : blobToFile(working, filename, "image/jpeg");
    }
    return blobToFile(compressed, replaceUploadExtension(filename, "jpg"), "image/jpeg");
  } catch {
    if (working !== file) {
      return blobToFile(working, filename, working.type || "image/jpeg");
    }
    return file;
  }
};
