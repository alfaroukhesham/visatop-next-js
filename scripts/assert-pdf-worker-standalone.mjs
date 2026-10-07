#!/usr/bin/env node
/**
 * Fail CI/build verification if pdfjs's Node worker is missing from standalone output.
 * Valid passport PDFs 400 CORRUPT_IMAGE when this file is absent from the Docker image.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const standalone = path.join(process.cwd(), ".next/standalone");
if (!existsSync(standalone)) {
  console.error("assert-pdf-worker-standalone: .next/standalone is missing. Run `pnpm run build` first.");
  process.exit(1);
}

const found = execFileSync("find", [standalone, "-name", "pdf.worker.mjs"], {
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .filter(Boolean);

if (found.length === 0) {
  console.error(
    "assert-pdf-worker-standalone: pdf.worker.mjs was not copied into .next/standalone.\n" +
      "Check next.config.ts outputFileTracingIncludes and the static import in lib/documents/passport-pdf.ts.",
  );
  process.exit(1);
}

const workerNextToPdf = found.find((worker) => existsSync(path.join(path.dirname(worker), "pdf.mjs")));
if (!workerNextToPdf) {
  console.error(
    "assert-pdf-worker-standalone: pdf.worker.mjs is present but not next to pdf.mjs.\n" +
      `workers:\n${found.join("\n")}`,
  );
  process.exit(1);
}

const buildDir = path.dirname(workerNextToPdf);
await import(pathToFileURL(path.join(buildDir, "pdf.worker.mjs")).href);
const pdfjs = await import(pathToFileURL(path.join(buildDir, "pdf.mjs")).href);
if (!globalThis.pdfjsWorker?.WorkerMessageHandler) {
  console.error("assert-pdf-worker-standalone: importing the worker did not set pdfjsWorker.WorkerMessageHandler");
  process.exit(1);
}

const pdf = Buffer.from(
  [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>endobj",
    "trailer<</Root 1 0 R>>",
    "%%EOF",
  ].join("\n"),
  "latin1",
);
const doc = await pdfjs.getDocument({
  data: new Uint8Array(pdf),
  disableFontFace: true,
  isEvalSupported: false,
  useSystemFonts: false,
}).promise;
if (doc.numPages !== 1) {
  console.error(`assert-pdf-worker-standalone: expected 1 page, got ${doc.numPages}`);
  process.exit(1);
}
await doc.destroy();

console.log(`assert-pdf-worker-standalone: parsed 1-page PDF using\n${workerNextToPdf}`);
