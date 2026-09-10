import { describe, expect, it } from "vitest";
import {
  CUSTOMER_LOCALE_COOKIE,
  buildCustomerLocaleSetCookieValue,
  parseCustomerLocale,
  planCustomerLocaleSwitch,
  resolveCustomerLocale,
  withCustomerLocaleQuery,
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

describe("withCustomerLocaleQuery", () => {
  it("replaces an existing locale query so the switcher can override the URL", () => {
    expect(
      withCustomerLocaleQuery("https://app-staging.visatop.com/visa-processing?locale=ar", "en"),
    ).toBe("/visa-processing?locale=en");
  });

  it("adds locale when the URL has none", () => {
    expect(
      withCustomerLocaleQuery("https://app-staging.visatop.com/visa-processing/apply/track", "ar"),
    ).toBe("/visa-processing/apply/track?locale=ar");
  });

  it("keeps other query params", () => {
    expect(
      withCustomerLocaleQuery(
        "https://app-staging.visatop.com/visa-processing/apply/start?nationality=IN&locale=ar",
        "fr",
      ),
    ).toBe("/visa-processing/apply/start?nationality=IN&locale=fr");
  });
});

describe("planCustomerLocaleSwitch", () => {
  it("navigates when the URL locale differs from the chosen slug", () => {
    expect(
      planCustomerLocaleSwitch({
        href: "https://app-staging.visatop.com/visa-processing?locale=ar",
        slug: "en",
      }),
    ).toEqual({
      slug: "en",
      nextPath: "/visa-processing?locale=en",
      sameUrl: false,
    });
  });

  it("stays on the same URL when locale is already set", () => {
    expect(
      planCustomerLocaleSwitch({
        href: "https://app-staging.visatop.com/visa-processing?locale=ar",
        slug: "ar",
      }),
    ).toEqual({
      slug: "ar",
      nextPath: "/visa-processing?locale=ar",
      sameUrl: true,
    });
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
