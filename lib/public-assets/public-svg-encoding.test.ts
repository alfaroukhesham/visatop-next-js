import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import sharp from "sharp";

const PUBLIC_DIR = join(process.cwd(), "public");

const listSvgFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSvgFiles(full));
      continue;
    }
    if (name.endsWith(".svg")) out.push(full);
  }
  return out.sort();
};

describe("public SVG assets", () => {
  const files = listSvgFiles(PUBLIC_DIR);

  it("finds the passport specimen and other public SVGs", () => {
    expect(files.some((f) => f.endsWith("apply/passport-bio-specimen.svg"))).toBe(true);
    expect(files.length).toBeGreaterThan(0);
  });

  it("decodes as UTF-8, parses as XML, and rasterises", async () => {
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const bytes = readFileSync(file);
      const label = relative(PUBLIC_DIR, file);
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const xml = new JSDOM(text, { contentType: "image/svg+xml" });
      const root = xml.window.document.documentElement;
      expect(root?.localName, `${label} root`).toBe("svg");
      expect(xml.window.document.querySelector("parsererror"), `${label} xml`).toBeNull();

      const png = await sharp(bytes).png().toBuffer();
      const meta = await sharp(png).metadata();
      expect(meta.format, `${label} raster format`).toBe("png");
      expect(meta.width ?? 0, `${label} width`).toBeGreaterThan(0);
      expect(meta.height ?? 0, `${label} height`).toBeGreaterThan(0);
    }
  });
});
