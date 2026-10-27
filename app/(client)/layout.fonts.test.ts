import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string =>
  readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("customer font loading", () => {
  it("loads Red Hat Text and Noto to match prod, with size-adjust fallbacks", () => {
    const layout = read("app/(client)/layout.tsx");
    expect(layout).toContain("next/font/google");
    expect(layout).toContain("Red_Hat_Text");
    expect(layout).toContain("Noto_Serif");
    expect(layout).not.toContain("Inter");
    expect(layout).toContain('display: "swap"');
    expect(layout).toContain('display: "optional"');
    expect(layout).toContain("adjustFontFallback: true");
    expect(layout).toContain("preload: true");
  });

  it("preloads Noto 600 for LCP; Red Hat Text still swap-loads from CSS", () => {
    const layout = read("app/(client)/layout.tsx");
    expect(layout).toContain('weight: ["400", "600"]');
    expect(layout).toContain('weight: ["600"]');
    expect(layout).toContain("redHatText.variable");
    expect(layout).toContain("redHatText.className");
    expect(layout).toContain("notoSerif.className");
    expect(layout).toContain("preload: false");
    expect(layout).toContain("readCriticalFontPreloadHrefs");
    expect(layout).toContain('preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" })');
    expect(layout).toContain('rel="preload"');
    expect(layout).toContain('as="font"');
    const preloads = read("lib/client/critical-font-preloads.ts");
    expect(preloads).toContain("isNotoLatin600");
    expect(preloads).not.toContain("isRedHatTextLatin400");
  });

  it("inlines first-paint WP header padding so CLS does not wait on the CSS bundle", () => {
    const layout = read("app/(client)/layout.tsx");
    expect(layout).toContain("padding-top:118px!important");
    expect(layout).toContain("--wp-shell-header-height:118px");
    expect(layout).toContain("paddingTop: 118");
  });

  it("does not load customer fonts from the root layout", () => {
    const root = read("app/layout.tsx");
    expect(root).not.toContain("next/font/google");
    expect(root).toContain("readCriticalFontPreloadHrefs");
    expect(root).toContain('as="font"');
  });

  it("keeps Red Hat on the admin shell", () => {
    const admin = read("app/admin/layout.tsx");
    expect(admin).toContain("Red_Hat_Text");
    expect(admin).toContain("Red_Hat_Display");
    expect(admin).toContain('display: "swap"');
  });

  it("does not swap customer pages to system sans at max-width 414px", () => {
    const globals = read("app/globals.css");
    expect(globals).not.toContain("--font-body: ui-sans-serif, system-ui, sans-serif !important");
    expect(globals).not.toContain("--font-display: ui-sans-serif, system-ui, sans-serif !important");
    expect(globals).toContain("font-family: var(--font-body), ui-sans-serif, system-ui, sans-serif");
  });
});
