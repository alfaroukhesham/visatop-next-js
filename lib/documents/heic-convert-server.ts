import { CorruptImageError } from "@/lib/documents/normalize-image";

type THeicConvertFn = (input: {
  buffer: Buffer | Uint8Array;
  format: "JPEG" | "PNG";
  quality?: number;
}) => Promise<ArrayBuffer | Buffer | Uint8Array>;

const loadHeicConvert = async (): Promise<THeicConvertFn> => {
  const loaded: unknown = await import("heic-convert");
  const convert =
    typeof loaded === "function"
      ? loaded
      : typeof loaded === "object" &&
          loaded !== null &&
          "default" in loaded &&
          typeof loaded.default === "function"
        ? loaded.default
        : null;
  if (typeof convert !== "function") {
    throw new CorruptImageError("HEIC decoder is unavailable.");
  }
  return convert as THeicConvertFn;
};

/** Decode HEIC/HEIF to JPEG using a WASM decoder (no libvips HEIF build required). */
export const convertHeicToJpegBuffer = async (input: Buffer): Promise<Buffer> => {
  try {
    const convert = await loadHeicConvert();
    const output = await convert({
      buffer: input,
      format: "JPEG",
      quality: 0.85,
    });
    const jpeg = Buffer.from(new Uint8Array(output));
    return jpeg;
  } catch (err) {
    if (err instanceof CorruptImageError) throw err;
    throw new CorruptImageError(
      err instanceof Error ? `Unable to decode HEIC: ${err.message}` : "Unable to decode HEIC.",
    );
  }
};
