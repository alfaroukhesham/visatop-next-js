import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("home hero narrow layout", () => {
  it("keeps desktop type, padding, and spacing on the base classes", () => {
    expect(source).toContain("px-5 pb-16 pt-10");
    expect(source).toContain("md:pb-24 md:pt-14");
    expect(source).toContain("p-8 shadow-[0_28px_72px_rgba(1,32,49,0.16)] md:p-12 lg:p-14");
    expect(source).toContain("mt-6 text-center text-[2.25rem]! leading-[1.2]! font-semibold md:text-[2.25rem]!");
    expect(source).toContain("mt-6 text-center text-[1.25rem]! leading-[1.35]! font-semibold");
  });

  it("scopes tighter layout, wrapping, and min-width:0 to max-[414px]", () => {
    expect(source).toContain("max-[414px]:px-3");
    expect(source).toContain("max-[414px]:pt-4");
    expect(source).toContain("max-[414px]:p-4");
    expect(source).toContain("max-[414px]:min-w-0");
    expect(source).toContain("max-[414px]:max-w-full");
    expect(source).toContain("max-[414px]:text-[1.375rem]!");
    expect(source).toContain("max-[414px]:p-4");
    expect(source).toMatch(/\bp-8 shadow-/);
  });
});
