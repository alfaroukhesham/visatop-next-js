/** ISO-BMFF `ftyp` brands used by HEIC/HEIF stills. */
const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]);

export const HEIC_MIME_TYPES = ["image/heic", "image/heif", "image/heic-sequence"] as const;

export const isHeicMime = (mime: string | null | undefined): boolean => {
  const t = (mime ?? "").trim().toLowerCase();
  return (HEIC_MIME_TYPES as readonly string[]).includes(t);
};

export const isHeicFilename = (filename: string | null | undefined): boolean => {
  const name = (filename ?? "").trim().toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif") || name.endsWith(".hif");
};

/** True when the ISO BMFF `ftyp` box lists a HEIC/HEIF brand. */
export const isHeicBytes = (bytes: Uint8Array): boolean => {
  if (bytes.length < 12) return false;
  if (bytes[4] !== 0x66 || bytes[5] !== 0x74 || bytes[6] !== 0x79 || bytes[7] !== 0x70) {
    return false;
  }
  const boxSize = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  const end = Math.min(bytes.length, boxSize >= 16 ? boxSize : 32);
  for (let i = 8; i + 4 <= end; i += 4) {
    const brand = String.fromCharCode(bytes[i]!, bytes[i + 1]!, bytes[i + 2]!, bytes[i + 3]!);
    if (HEIC_BRANDS.has(brand)) return true;
  }
  return false;
};

export const looksLikeHeic = (
  bytes: Uint8Array,
  mime?: string | null,
  filename?: string | null,
): boolean => isHeicBytes(bytes) || isHeicMime(mime) || isHeicFilename(filename);
