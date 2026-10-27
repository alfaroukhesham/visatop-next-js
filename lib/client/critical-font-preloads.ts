import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const FACE_RE = /@font-face\{[^}]+\}/g;
const MEDIA_RE = /url\((?:\.\.\/media\/)([^)]+\.p\.[^)]+\.woff2)\)/;

const isNotoLatin600 = (face: string): boolean =>
  face.includes("font-family:Noto Serif") &&
  !face.includes("Fallback") &&
  face.includes("font-weight:600") &&
  face.includes(".p.");

export const criticalFontHrefsFromCss = (css: string): string[] => {
  const hrefs: string[] = [];
  const seen = new Set<string>();
  for (const face of css.match(FACE_RE) ?? []) {
    // Preload only the LCP heading face. Red Hat Text still loads via CSS
    // (display:swap) so the body matches prod without stealing Slow 4G from Noto.
    if (!isNotoLatin600(face)) continue;
    const media = face.match(MEDIA_RE)?.[1];
    if (!media || seen.has(media)) continue;
    seen.add(media);
    hrefs.push(`/visa-processing/_next/static/media/${media}`);
  }
  return hrefs;
};

let cached: string[] | null = null;

export const readCriticalFontPreloadHrefs = (): string[] => {
  if (cached) return cached;
  const dir = path.join(process.cwd(), ".next/static/chunks");
  try {
    const hrefs = new Set<string>();
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".css")) continue;
      for (const href of criticalFontHrefsFromCss(readFileSync(path.join(dir, file), "utf8"))) {
        hrefs.add(href);
      }
    }
    cached = [...hrefs];
  } catch {
    cached = [];
  }
  return cached;
};
