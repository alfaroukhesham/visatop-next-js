import { describe, expect, it } from "vitest";
import { isHeicBytes, isHeicFilename, isHeicMime, looksLikeHeic } from "./heic-detect";

const ftypBox = (brands: string[]): Uint8Array => {
  const payload = Buffer.from(`ftyp${brands.join("")}`, "ascii");
  const size = 4 + payload.length;
  const out = Buffer.alloc(size);
  out.writeUInt32BE(size, 0);
  payload.copy(out, 4);
  return new Uint8Array(out);
};

describe("heic-detect", () => {
  it("recognises HEIC MIME, HEIF MIME, and extensions", () => {
    expect(isHeicMime("image/heic")).toBe(true);
    expect(isHeicMime("image/heif")).toBe(true);
    expect(isHeicMime("image/jpeg")).toBe(false);
    expect(isHeicFilename("passport.HEIC")).toBe(true);
    expect(isHeicFilename("scan.heif")).toBe(true);
    expect(isHeicFilename("photo.jpg")).toBe(false);
  });

  it("detects ftyp brands including compatible-brand mif1/heic", () => {
    expect(isHeicBytes(ftypBox(["heic"]))).toBe(true);
    expect(isHeicBytes(ftypBox(["mif1", "heic"]))).toBe(true);
    expect(isHeicBytes(ftypBox(["isom", "mp41"]))).toBe(false);
    expect(isHeicBytes(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(false);
  });

  it("looksLikeHeic is true when only the filename is HEIC", () => {
    expect(looksLikeHeic(new Uint8Array([1, 2, 3]), "", "IMG_0001.heic")).toBe(true);
    expect(looksLikeHeic(new Uint8Array([1, 2, 3]), "image/jpeg", "a.jpg")).toBe(false);
  });
});
