import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("pdfjs worker packaging", () => {
  it("imports the legacy worker from passport-pdf so file tracing can see it", () => {
    const src = readFileSync(path.join(root, "lib/documents/passport-pdf.ts"), "utf8");
    expect(src).toMatch(/pdfjs-dist\/legacy\/build\/pdf\.worker\.mjs/);
  });

  it("lists the worker in Next standalone tracing includes", () => {
    const src = readFileSync(path.join(root, "next.config.ts"), "utf8");
    expect(src).toMatch(/outputFileTracingIncludes/);
    expect(src).toMatch(/pdfjs-dist\/legacy\/build\/pdf\.worker\.mjs/);
  });

  it.skipIf(!existsSync(path.join(root, ".next/standalone")))(
    "copies pdf.worker.mjs into the production standalone output",
    () => {
      const found = execFileSync(
        "find",
        [path.join(root, ".next/standalone"), "-name", "pdf.worker.mjs"],
        { encoding: "utf8" },
      ).trim();
      expect(found.length).toBeGreaterThan(0);
    },
  );
});
