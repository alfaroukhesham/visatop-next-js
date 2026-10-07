import { describe, expect, it } from "vitest";
import { resolveUploadContentType } from "./upload-content-type";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

describe("resolveUploadContentType", () => {
  it("prefers magic bytes over an empty MIME", () => {
    expect(resolveUploadContentType(jpeg, "", "unknown")).toBe("image/jpeg");
    expect(resolveUploadContentType(png, "", null)).toBe("image/png");
    expect(resolveUploadContentType(pdf, "", "file")).toBe("application/pdf");
  });

  it("treats HEIC by filename when MIME is empty", () => {
    expect(resolveUploadContentType(new Uint8Array([0, 1, 2, 3]), "", "passport.heic")).toBe(
      "image/heic",
    );
  });

  it("maps image/heif to image/heic", () => {
    expect(resolveUploadContentType(new Uint8Array([0, 1]), "image/heif", "a.heif")).toBe("image/heic");
  });
});
