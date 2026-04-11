import { describe, expect, it } from "vitest";
import { zIso4217Alpha3 } from "./currency";

describe("zIso4217Alpha3", () => {
  it("normalizes to uppercase", () => {
    expect(zIso4217Alpha3.parse("usd")).toBe("USD");
  });

  it("rejects non-letters", () => {
    expect(() => zIso4217Alpha3.parse("US1")).toThrow();
  });
});
