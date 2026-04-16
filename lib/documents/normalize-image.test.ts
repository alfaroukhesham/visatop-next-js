import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  CorruptImageError,
  JPEG_QUALITY,
  MAX_RASTER_EDGE_PX,
  NORMALIZED_CONTENT_TYPE,
  normalizeImageBuffer,
} from "./normalize-image";

async function makeTinyPng(width: number, height: number, color = "#ff8800"): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  })
    .png()
    .toBuffer();
}

async function makeTinyJpeg(width: number, height: number, color = "#3366cc"): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

describe("normalizeImageBuffer", () => {
  it("converts small PNG input to JPEG with stable sha256", async () => {
    const input = await makeTinyPng(16, 16, "#abcdef");
    const a = await normalizeImageBuffer(input);
    const b = await normalizeImageBuffer(input);

    expect(a.contentType).toBe(NORMALIZED_CONTENT_TYPE);
    expect(a.byteLength).toBe(a.bytes.byteLength);
    expect(a.sha256).toHaveLength(64);
    expect(a.sha256).toBe(b.sha256);
  });

  it("does not upscale images smaller than MAX_RASTER_EDGE_PX", async () => {
    const input = await makeTinyJpeg(320, 200);
    const out = await normalizeImageBuffer(input);
    expect(out.width).toBe(320);
    expect(out.height).toBe(200);
  });

  it("downscales oversized images so long edge is <= MAX_RASTER_EDGE_PX", async () => {
    const bigEdge = MAX_RASTER_EDGE_PX + 500;
    const input = await makeTinyJpeg(bigEdge, Math.round(bigEdge / 2));
    const out = await normalizeImageBuffer(input);
    const longestEdge = Math.max(out.width, out.height);
    expect(longestEdge).toBeLessThanOrEqual(MAX_RASTER_EDGE_PX);
    expect(out.contentType).toBe(NORMALIZED_CONTENT_TYPE);
  });

  it("throws CorruptImageError on bogus bytes", async () => {
    await expect(
      normalizeImageBuffer(Buffer.from([0x00, 0x01, 0x02, 0x03])),
    ).rejects.toBeInstanceOf(CorruptImageError);
  });

  it("uses the expected JPEG quality", () => {
    expect(JPEG_QUALITY).toBe(85);
  });
});
