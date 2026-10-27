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
    expect(layout).not.toContain("preload: false");
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
  });
});
