import { describe, expect, it } from "vitest";
import {
  CUSTOMER_LOCALE_COOKIE,
  buildCustomerLocaleSetCookieValue,
  parseCustomerLocale,
} from "./customer-locale";

describe("parseCustomerLocale", () => {
  it("returns ar for Arabic slug", () => {
    expect(parseCustomerLocale("ar")).toBe("ar");
  });

  it("normalizes FR to fr", () => {
    expect(parseCustomerLocale("FR")).toBe("fr");
  });

  it("falls back to en for junk", () => {
    expect(parseCustomerLocale("not-a-locale")).toBe("en");
    expect(parseCustomerLocale("xx")).toBe("en");
  });

  it("falls back to en for empty or null", () => {
    expect(parseCustomerLocale("")).toBe("en");
    expect(parseCustomerLocale(null)).toBe("en");
    expect(parseCustomerLocale(undefined)).toBe("en");
    expect(parseCustomerLocale("   ")).toBe("en");
  });

  it("respects a runtime slug list", () => {
    expect(parseCustomerLocale("de", ["de", "fr"])).toBe("de");
    expect(parseCustomerLocale("en", ["de", "fr"])).toBe("en");
  });
});

describe("buildCustomerLocaleSetCookieValue", () => {
  it("sets vt_locale with Path, SameSite, and no HttpOnly", () => {
    const v = buildCustomerLocaleSetCookieValue("ar", { secure: false });
    expect(v).toContain(`${CUSTOMER_LOCALE_COOKIE}=ar`);
    expect(v).toContain("Path=/");
    expect(v).toContain("SameSite=Lax");
    expect(v).not.toContain("HttpOnly");
  });
});
