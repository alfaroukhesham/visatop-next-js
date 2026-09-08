import { describe, expect, it } from "vitest";
import {
  createCustomerT,
  customerInLanguageTag,
  getCustomerMessages,
  getEnglishCustomerMessages,
} from "./load-customer-catalog";
import { FALLBACK_CUSTOMER_LOCALE_SLUGS } from "./customer-locale";

const leafKeys = (tree: unknown, prefix = ""): string[] => {
  if (typeof tree !== "object" || tree === null || Array.isArray(tree)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(tree as Record<string, unknown>).flatMap(([key, value]) =>
    leafKeys(value, prefix ? `${prefix}.${key}` : key),
  );
};

describe("getCustomerMessages", () => {
  it("returns English for unknown locales", () => {
    expect(getCustomerMessages("xx")).toBe(getEnglishCustomerMessages());
    expect(createCustomerT("xx")("home.headlineLine1")).toBe("Traveling to Dubai?");
  });

  it("returns French copy for fr", () => {
    expect(createCustomerT("fr")("home.headlineLine1")).not.toBe("Traveling to Dubai?");
    expect(createCustomerT("fr")("home.headlineLine1").length).toBeGreaterThan(0);
  });

  it("keeps the same leaf keys as English for every catalog locale", () => {
    const enKeys = leafKeys(getEnglishCustomerMessages()).sort();
    for (const locale of FALLBACK_CUSTOMER_LOCALE_SLUGS) {
      expect(leafKeys(getCustomerMessages(locale)).sort(), locale).toEqual(enKeys);
    }
  });

  it("maps English to en-GB for JSON-LD", () => {
    expect(customerInLanguageTag("en")).toBe("en-GB");
    expect(customerInLanguageTag("ar")).toBe("ar");
  });
});
