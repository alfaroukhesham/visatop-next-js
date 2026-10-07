import { describe, expect, it } from "vitest";
import {
  CLIENT_IMAGE_MAX_EDGE_PX,
  looksLikeHeicFile,
  looksLikePdfFile,
  prepareClientUploadFile,
  scaleToMaxEdge,
} from "./client-image-prep";

describe("scaleToMaxEdge", () => {
  it("keeps aspect ratio when shrinking", () => {
    expect(scaleToMaxEdge(4000, 3000, 2400)).toEqual({ width: 2400, height: 1800 });
    expect(scaleToMaxEdge(3000, 4000, 2400)).toEqual({ width: 1800, height: 2400 });
  });

  it("does not upscale smaller images", () => {
    expect(scaleToMaxEdge(1200, 800, CLIENT_IMAGE_MAX_EDGE_PX)).toEqual({
      width: 1200,
      height: 800,
    });
  });
});

describe("looksLikePdfFile / looksLikeHeicFile", () => {
  it("lets PDFs pass through untouched by type or extension", () => {
    expect(looksLikePdfFile(new File(["%PDF"], "scan.pdf", { type: "application/pdf" }))).toBe(true);
    expect(looksLikePdfFile(new File(["%PDF"], "scan.PDF", { type: "" }))).toBe(true);
    expect(looksLikePdfFile(new File(["x"], "a.jpg", { type: "image/jpeg" }))).toBe(false);
  });

  it("detects HEIC from MIME or extension", () => {
    expect(looksLikeHeicFile(new File(["x"], "IMG.heic", { type: "" }))).toBe(true);
    expect(looksLikeHeicFile(new File(["x"], "a.jpg", { type: "image/heif" }))).toBe(true);
    expect(looksLikeHeicFile(new File(["x"], "a.jpg", { type: "image/jpeg" }))).toBe(false);
  });
});

describe("prepareClientUploadFile", () => {
  it("returns PDFs unchanged", async () => {
    const pdf = new File(["%PDF-1.4"], "scan.pdf", { type: "application/pdf" });
    expect(await prepareClientUploadFile(pdf)).toBe(pdf);
  });

  it("returns already-small JPEGs unchanged", async () => {
    const jpeg = new File([new Uint8Array(800)], "shot.jpg", { type: "image/jpeg" });
    expect(await prepareClientUploadFile(jpeg)).toBe(jpeg);
  });
});
