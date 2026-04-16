import { describe, expect, it } from "vitest";
import {
  CorruptPdfError,
  PdfNotSinglePageError,
  renderSinglePagePdfToPng,
} from "./passport-pdf";

/**
 * Minimal hand-crafted single-page PDF. `pdfjs-dist` is forgiving enough to
 * parse this trivial structure for `numPages` checks and page 1 rendering of
 * a single-letter page, which is all these tests exercise.
 */
const TRIVIAL_PDF = Buffer.from(
  [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]/Contents 4 0 R/Resources<<>>>>endobj",
    "4 0 obj<</Length 23>>stream\nBT /F1 12 Tf (ok) Tj ET\nendstream endobj",
    "xref",
    "0 5",
    "0000000000 65535 f ",
    "0000000010 00000 n ",
    "0000000053 00000 n ",
    "0000000100 00000 n ",
    "0000000200 00000 n ",
    "trailer<</Root 1 0 R/Size 5>>startxref 300 %%EOF",
  ].join("\n"),
  "latin1",
);

/** Two-page PDF — identical structure but `Count 2` with two Kids. */
const TWO_PAGE_PDF = Buffer.from(
  [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R 5 0 R]/Count 2>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]/Contents 4 0 R/Resources<<>>>>endobj",
    "4 0 obj<</Length 23>>stream\nBT /F1 12 Tf (p1) Tj ET\nendstream endobj",
    "5 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]/Contents 6 0 R/Resources<<>>>>endobj",
    "6 0 obj<</Length 23>>stream\nBT /F1 12 Tf (p2) Tj ET\nendstream endobj",
    "xref",
    "0 7",
    "0000000000 65535 f ",
    "0000000010 00000 n ",
    "0000000053 00000 n ",
    "0000000100 00000 n ",
    "0000000200 00000 n ",
    "0000000240 00000 n ",
    "0000000330 00000 n ",
    "trailer<</Root 1 0 R/Size 7>>startxref 400 %%EOF",
  ].join("\n"),
  "latin1",
);

describe("renderSinglePagePdfToPng", () => {
  it("renders a single-page PDF to PNG bytes", async () => {
    const out = await renderSinglePagePdfToPng(TRIVIAL_PDF);
    expect(out.pageCount).toBe(1);
    expect(out.pngBytes.byteLength).toBeGreaterThan(0);
    // PNG file signature.
    expect(out.pngBytes.subarray(0, 8).toString("hex")).toBe(
      "89504e470d0a1a0a",
    );
  });

  it("rejects multi-page PDFs with PdfNotSinglePageError", async () => {
    await expect(renderSinglePagePdfToPng(TWO_PAGE_PDF)).rejects.toBeInstanceOf(
      PdfNotSinglePageError,
    );
  });

  it("throws CorruptPdfError on non-PDF bytes", async () => {
    await expect(
      renderSinglePagePdfToPng(Buffer.from("nope, not a pdf")),
    ).rejects.toBeInstanceOf(CorruptPdfError);
  });
});
