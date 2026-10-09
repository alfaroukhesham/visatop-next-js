import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { assessPassportImageQuality } from "./image-quality";

const jpeg = async (opts: {
  width: number;
  height: number;
  blur?: number;
  noise?: boolean;
}): Promise<Buffer> => {
  let img = sharp({
    create: {
      width: opts.width,
      height: opts.height,
      channels: 3,
      background: { r: 180, g: 180, b: 180 },
    },
  });
  if (opts.noise) {
    const raw = Buffer.alloc(opts.width * opts.height * 3);
    for (let i = 0; i < raw.length; i += 1) raw[i] = (i * 37 + (i % 251)) % 256;
    img = sharp(raw, { raw: { width: opts.width, height: opts.height, channels: 3 } });
  }
  if (opts.blur) img = img.blur(opts.blur);
  return img.jpeg({ quality: 40 }).toBuffer();
};

describe("assessPassportImageQuality", () => {
  it("rejects a tiny 200x140 image before OCR", async () => {
    const bytes = await jpeg({ width: 200, height: 140, blur: 8 });
    const result = await assessPassportImageQuality(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("IMAGE_TOO_SMALL");
  });

  it("rejects a large but near-uniform blurry plate", async () => {
    const bytes = await jpeg({ width: 800, height: 500, blur: 20 });
    const result = await assessPassportImageQuality(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("IMAGE_TOO_BLURRY");
  });

  it("accepts a reasonably large detailed image", async () => {
    const bytes = await jpeg({ width: 800, height: 500, noise: true });
    const result = await assessPassportImageQuality(bytes);
    expect(result).toEqual({ ok: true });
  });
});
