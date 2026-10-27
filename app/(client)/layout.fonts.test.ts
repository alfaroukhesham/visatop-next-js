import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string =>
  readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("customer font loading", () => {
  it("uses font-display optional so webfonts cannot recast LCP", () => {
    const layout = read("app/(client)/layout.tsx");
    expect(layout).toContain('display: "optional"');
    expect(layout).not.toContain('display: "swap"');
    expect(layout).toContain("preload: true");
    expect(layout).toContain("preload: false");
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

  it("uses the body face for customer headings at max-width 414px", () => {
    const globals = read("app/globals.css");
    expect(globals).toContain("@media (max-width: 414px)");
    expect(globals).toContain("--font-body: ui-sans-serif, system-ui, sans-serif !important");
    expect(globals).toContain("--font-display: ui-sans-serif, system-ui, sans-serif !important");
  });
});
