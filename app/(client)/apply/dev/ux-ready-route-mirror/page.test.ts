import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const realRoute = readFileSync(
  path.join(__dirname, "../../applications/[id]/page.tsx"),
  "utf8",
);

describe("ux-ready-route-mirror fixture", () => {
  it("wraps with the same theme-client-rise class as applications/[id]", () => {
    const riseClass = 'contentClassName="theme-client-rise mx-auto w-full max-w-4xl space-y-8"';
    expect(source).toContain(riseClass);
    expect(realRoute).toContain(riseClass);
    expect(source).toContain("contentFirstOnMobile");
    expect(source).toContain('phase="documents"');
  });
});
