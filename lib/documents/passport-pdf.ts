import {
  createCanvas,
  DOMMatrix as NapiDOMMatrix,
  DOMPoint as NapiDOMPoint,
  DOMRect as NapiDOMRect,
  Image as NapiImage,
  ImageData as NapiImageData,
  Path2D as NapiPath2D,
  type SKRSContext2D,
} from "@napi-rs/canvas";

// pdfjs-dist 5.x legacy build expects a browser-ish global env. Patch the
// symbols it reads at module-load time BEFORE importing pdfjs.
const g = globalThis as unknown as Record<string, unknown>;
if (!("DOMMatrix" in g)) g.DOMMatrix = NapiDOMMatrix;
if (!("DOMPoint" in g)) g.DOMPoint = NapiDOMPoint;
if (!("DOMRect" in g)) g.DOMRect = NapiDOMRect;
if (!("Path2D" in g)) g.Path2D = NapiPath2D;
if (!("ImageData" in g)) g.ImageData = NapiImageData;
if (!("Image" in g)) g.Image = NapiImage;

const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

import { MAX_RASTER_EDGE_PX } from "./normalize-image";

const DPI_SCALE_MAX = 4; // Cap scale factor; §5.6 controls final size downstream.

export class PdfNotSinglePageError extends Error {
  code = "PDF_NOT_SINGLE_PAGE" as const;
  constructor(message = "Passport PDF must be exactly one page.") {
    super(message);
    this.name = "PdfNotSinglePageError";
  }
}

export class CorruptPdfError extends Error {
  code = "CORRUPT_IMAGE" as const; // Routes map this to 400 CORRUPT_IMAGE per spec.
  constructor(message = "Unable to read the uploaded PDF.") {
    super(message);
    this.name = "CorruptPdfError";
  }
}

export type RenderedPdfPage = {
  /** Raw PNG bytes of the rendered page. */
  pngBytes: Buffer;
  width: number;
  height: number;
  pageCount: number;
};

/**
 * Render page 1 of a (single-page) PDF to a PNG buffer, targeting a long-edge
 * raster size bounded by {@link MAX_RASTER_EDGE_PX}. The caller (passport
 * normalize pipeline) then runs the PNG through `normalizeImageBuffer` to
 * produce the stored JPEG, hash, etc.
 */
export async function renderSinglePagePdfToPng(input: Buffer): Promise<RenderedPdfPage> {
  let doc: Awaited<ReturnType<typeof pdfjsLib.getDocument>["promise"]>;
  try {
    doc = await pdfjsLib.getDocument({
      data: new Uint8Array(input),
      disableFontFace: true,
      isEvalSupported: false,
      useSystemFonts: false,
    }).promise;
  } catch (err) {
    throw new CorruptPdfError(
      err instanceof Error ? `CORRUPT_PDF: ${err.message}` : "CORRUPT_PDF",
    );
  }

  try {
    if (doc.numPages !== 1) {
      throw new PdfNotSinglePageError();
    }

    const page = await doc.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const longEdge = Math.max(baseViewport.width, baseViewport.height);
    // Scale so the long edge lands near MAX_RASTER_EDGE_PX without upscaling past DPI_SCALE_MAX.
    const scale = Math.max(
      1,
      Math.min(DPI_SCALE_MAX, MAX_RASTER_EDGE_PX / Math.max(longEdge, 1)),
    );
    const viewport = page.getViewport({ scale });
    const width = Math.ceil(viewport.width);
    const height = Math.ceil(viewport.height);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d") as unknown as SKRSContext2D;

    // pdfjs expects a CanvasRenderingContext2D-like shape; @napi-rs/canvas matches.
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
      intent: "print",
    }).promise;

    const pngBytes = canvas.toBuffer("image/png");
    return { pngBytes, width, height, pageCount: 1 };
  } finally {
    try {
      await doc.destroy();
    } catch {
      /* best-effort cleanup */
    }
  }
}
