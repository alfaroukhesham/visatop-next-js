import { describe, expect, it } from "vitest";
import {
  CUSTOMER_LOCALE_COOKIE,
  buildCustomerLocaleSetCookieValue,
  parseCustomerLocale,
  resolveCustomerLocale,
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

describe("resolveCustomerLocale", () => {
  it("prefers the proxy request header over the cookie", () => {
    expect(
      resolveCustomerLocale({
        headerValue: "ar",
        cookieValue: "en",
      }),
    ).toBe("ar");
  });

  it("falls back to the cookie when the header is missing", () => {
    expect(
      resolveCustomerLocale({
        headerValue: null,
        cookieValue: "fr",
      }),
    ).toBe("fr");
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
