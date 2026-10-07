#!/usr/bin/env node
/**
 * Fail CI/build verification if pdfjs's Node worker is missing from standalone output.
 * Valid passport PDFs 400 CORRUPT_IMAGE when this file is absent from the Docker image.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const standalone = path.join(process.cwd(), ".next/standalone");
if (!existsSync(standalone)) {
  console.error("assert-pdf-worker-standalone: .next/standalone is missing. Run `pnpm run build` first.");
  process.exit(1);
}

const found = execFileSync("find", [standalone, "-name", "pdf.worker.mjs"], {
  encoding: "utf8",
}).trim();

if (!found) {
  console.error(
    "assert-pdf-worker-standalone: pdf.worker.mjs was not copied into .next/standalone.\n" +
      "Check next.config.ts outputFileTracingIncludes and the static import in lib/documents/passport-pdf.ts.",
  );
  process.exit(1);
}

console.log(`assert-pdf-worker-standalone: found\n${found}`);
