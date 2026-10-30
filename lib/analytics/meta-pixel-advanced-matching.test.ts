import { afterEach, describe, expect, it } from "vitest";
import {
  buildMetaAdvancedMatchingUserData,
  getMetaAdvancedMatchingPhone,
  resetMetaAdvancedMatchingPhone,
  setMetaAdvancedMatchingPhone,
} from "@/lib/analytics/meta-pixel-advanced-matching";

afterEach(() => {
  resetMetaAdvancedMatchingPhone();
});

describe("buildMetaAdvancedMatchingUserData", () => {
  it("trims and lowercases email, keeps phone digits with country code, and uses user id", () => {
    expect(
      buildMetaAdvancedMatchingUserData({
        email: "  Ada@Example.COM ",
        phone: "+971 50 123 4567",
        userId: " user_1 ",
      }),
    ).toEqual({
      em: "ada@example.com",
      ph: "971501234567",
      external_id: "user_1",
    });
  });

  it("omits empty fields and never invents values", () => {
    expect(buildMetaAdvancedMatchingUserData({ userId: "user_1" })).toEqual({
      external_id: "user_1",
    });
    expect(buildMetaAdvancedMatchingUserData({})).toBeNull();
  });
});

describe("setMetaAdvancedMatchingPhone", () => {
  it("stores digits only", () => {
    setMetaAdvancedMatchingPhone("+234 801 234 5678");
    expect(getMetaAdvancedMatchingPhone()).toBe("2348012345678");
    setMetaAdvancedMatchingPhone("   ");
    expect(getMetaAdvancedMatchingPhone()).toBeNull();
  });
});
