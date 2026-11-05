import { describe, expect, it } from "vitest";
import { firstNameFromFullName } from "./first-name";

describe("firstNameFromFullName", () => {
  it("returns the first token", () => {
    expect(firstNameFromFullName("Sara Ahmed")).toBe("Sara");
  });

  it("returns null when missing", () => {
    expect(firstNameFromFullName(null)).toBeNull();
    expect(firstNameFromFullName("   ")).toBeNull();
  });
});
