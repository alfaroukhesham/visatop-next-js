import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string =>
  readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("customer font loading", () => {
  it("uses font-display swap on the tourist shell and does not preload the heading face", () => {
    const layout = read("app/(client)/layout.tsx");
    expect(layout).toContain('display: "swap"');
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
});
