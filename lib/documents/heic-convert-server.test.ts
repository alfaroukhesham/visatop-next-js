import { beforeEach, describe, expect, it, vi } from "vitest";

const convert = vi.fn();

vi.mock("heic-convert", () => ({
  default: (...args: unknown[]) => convert(...args),
}));

describe("convertHeicToJpegBuffer", () => {
  beforeEach(() => {
    convert.mockReset();
  });

  it("returns JPEG bytes from the WASM decoder", async () => {
    convert.mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff, 0xee]));
    const { convertHeicToJpegBuffer } = await import("./heic-convert-server");
    const out = await convertHeicToJpegBuffer(Buffer.from("heic"));
    expect(out[0]).toBe(0xff);
    expect(convert).toHaveBeenCalledWith({
      buffer: expect.any(Buffer),
      format: "JPEG",
      quality: 0.85,
    });
  });

  it("maps decoder failures to CorruptImageError", async () => {
    convert.mockRejectedValue(new Error("not heic"));
    const { convertHeicToJpegBuffer } = await import("./heic-convert-server");
    const { CorruptImageError } = await import("./normalize-image");
    await expect(convertHeicToJpegBuffer(Buffer.from("nope"))).rejects.toBeInstanceOf(
      CorruptImageError,
    );
  });
});
