import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const FACE_RE = /@font-face\{[^}]+\}/g;
const MEDIA_RE = /url\((?:\.\.\/media\/)([^)]+\.p\.[^)]+\.woff2)\)/;

const isInterLatin400 = (face: string): boolean =>
  face.includes("font-family:Inter") &&
  !face.includes("Fallback") &&
  face.includes("font-weight:400") &&
  face.includes(".p.");

const isNotoLatin600 = (face: string): boolean =>
  face.includes("font-family:Noto Serif") &&
  !face.includes("Fallback") &&
  face.includes("font-weight:600") &&
  face.includes(".p.");

export const criticalFontHrefsFromCss = (css: string): string[] => {
  const hrefs: string[] = [];
  const seen = new Set<string>();
  for (const face of css.match(FACE_RE) ?? []) {
    if (!isInterLatin400(face) && !isNotoLatin600(face)) continue;
    const media = face.match(MEDIA_RE)?.[1];
    if (!media || seen.has(media)) continue;
    seen.add(media);
    hrefs.push(`/visa-processing/_next/static/media/${media}`);
  }
  return hrefs;
};

let cached: string[] | null = null;
let cachedNotoInlineCss: string | null | undefined;

const notoLatin600MediaFromCss = (css: string): string | null => {
  for (const face of css.match(FACE_RE) ?? []) {
    if (!isNotoLatin600(face)) continue;
    const media = face.match(MEDIA_RE)?.[1];
    if (media) return media;
  }
  return null;
};

export const notoInlineCssFromWoff2 = (bytes: Buffer): string => {
  const b64 = bytes.toString("base64");
  return (
    `@font-face{font-family:"Noto Serif";font-style:normal;font-weight:600;` +
    `font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2")}`
  );
};

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

export const readCriticalNotoInlineCss = (): string => {
  if (cachedNotoInlineCss !== undefined) return cachedNotoInlineCss ?? "";
  const dir = path.join(process.cwd(), ".next/static/chunks");
  const mediaDir = path.join(process.cwd(), ".next/static/media");
  try {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".css")) continue;
      const media = notoLatin600MediaFromCss(readFileSync(path.join(dir, file), "utf8"));
      if (!media) continue;
      cachedNotoInlineCss = notoInlineCssFromWoff2(readFileSync(path.join(mediaDir, media)));
      return cachedNotoInlineCss;
    }
  } catch {
    cachedNotoInlineCss = "";
    return "";
  }
  cachedNotoInlineCss = "";
  return "";
};
