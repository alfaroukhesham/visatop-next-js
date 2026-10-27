import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string =>
  readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("customer font loading", () => {
  it("loads Inter and Noto with swap, size-adjust fallbacks, and preload", () => {
    const layout = read("app/(client)/layout.tsx");
    expect(layout).toContain("next/font/google");
    expect(layout).toContain("Inter");
    expect(layout).toContain("Noto_Serif");
    expect(layout).toContain('display: "swap"');
    expect(layout).toContain("adjustFontFallback: true");
    expect(layout).toContain("preload: true");
    expect(layout).not.toContain('display: "optional"');
  });

  it("preloads only Inter 400 and Noto 600, not UI weights", () => {
    const layout = read("app/(client)/layout.tsx");
    expect(layout).toContain('weight: ["400"]');
    expect(layout).toContain('weight: ["500", "600"]');
    expect(layout).toContain('weight: ["600"]');
    expect(layout).toContain("preload: false");
    expect(layout).toContain("interUi.variable");
    expect(layout).toContain("inter.className");
    expect(layout).toContain("notoSerif.className");
    expect(layout).toContain("readCriticalFontPreloadHrefs");
    expect(layout).toContain('preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" })');
  });

  it("inlines first-paint WP header padding so CLS does not wait on the CSS bundle", () => {
    const layout = read("app/(client)/layout.tsx");
    expect(layout).toContain("padding-top:118px!important");
    expect(layout).toContain("--wp-shell-header-height:118px");
    expect(layout).toContain("paddingTop: 118");
  });

  it("does not load Red Hat on every document including visa-processing", () => {
    const root = read("app/layout.tsx");
    expect(root).not.toContain("next/font/google");
    expect(root).not.toContain("Red_Hat");
  });

  it("keeps Red Hat on the admin shell only", () => {
    const admin = read("app/admin/layout.tsx");
    expect(admin).toContain("Red_Hat_Text");
    expect(admin).toContain('display: "swap"');
  });

  it("does not swap customer pages to system sans at max-width 414px", () => {
    const globals = read("app/globals.css");
    expect(globals).not.toContain("--font-body: ui-sans-serif, system-ui, sans-serif !important");
    expect(globals).not.toContain("--font-display: ui-sans-serif, system-ui, sans-serif !important");
    expect(globals).toContain("font-family: var(--font-body), ui-sans-serif, system-ui, sans-serif");
  });
});
