import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(process.cwd(), ".browserslistrc"), "utf8");

describe("browserslist target", () => {
  it("drops the legacy defaults query that pulled ES2015 polyfills", () => {
    expect(source).not.toMatch(/^defaults$/m);
    expect(source).not.toMatch(/Safari >= 14/);
    expect(source).not.toMatch(/Firefox >= 78/);
    expect(source).not.toMatch(/iOS >= 14/);
  });

  it("targets the Next.js 16 modern baseline", () => {
    expect(source).toContain("chrome >= 111");
    expect(source).toContain("edge >= 111");
    expect(source).toContain("firefox >= 111");
    expect(source).toContain("safari >= 16.4");
    expect(source).toContain("ios >= 16.4");
  });
});
