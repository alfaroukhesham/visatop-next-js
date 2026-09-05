import { describe, expect, it } from "vitest";
import { classifyServiceKind, isChildService } from "./service-kind";

describe("classifyServiceKind", () => {
  it("marks 48h/96h and transit names as transit", () => {
    expect(classifyServiceKind({ name: "48 Hours Transit Visa", durationDays: 2 })).toBe("transit");
    expect(classifyServiceKind({ name: "96 Hours Transit", durationDays: 4 })).toBe("transit");
    expect(classifyServiceKind({ name: "Transit visa", durationDays: null })).toBe("transit");
  });

  it("marks 14/30/60 and 5-year as tourist (non-transit)", () => {
    expect(classifyServiceKind({ name: "30 Days Tourist", durationDays: 30 })).toBe("tourist");
    expect(classifyServiceKind({ name: "5 Years Multiple Entry", durationDays: 1825 })).toBe("tourist");
  });
});

describe("isChildService", () => {
  it("detects child SKUs from the catalog name", () => {
    expect(isChildService("30 Days Tourist Child")).toBe(true);
    expect(isChildService("30 Days Tourist")).toBe(false);
  });
});
