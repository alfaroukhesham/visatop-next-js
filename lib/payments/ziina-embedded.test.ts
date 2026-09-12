import { describe, expect, it } from "vitest";
import {
  buildZiinaEmbeddedCheckoutSrc,
  isTrustedZiinaEmbeddedUrl,
  isZiinaIntentOpen,
  parseZiinaCheckoutMessage,
  ZIINA_CHECKOUT_ORIGIN,
} from "./ziina-embedded";

describe("isTrustedZiinaEmbeddedUrl", () => {
  it("accepts https pay.ziina.com URLs", () => {
    expect(isTrustedZiinaEmbeddedUrl("https://pay.ziina.com/checkout/abc")).toBe(true);
  });

  it("rejects http, other hosts, and invalid URLs", () => {
    expect(isTrustedZiinaEmbeddedUrl("http://pay.ziina.com/checkout/abc")).toBe(false);
    expect(isTrustedZiinaEmbeddedUrl("https://evil.example/checkout")).toBe(false);
    expect(isTrustedZiinaEmbeddedUrl("not-a-url")).toBe(false);
  });
});

describe("buildZiinaEmbeddedCheckoutSrc", () => {
  it("pins version=v1 and adds locale=ar", () => {
    const src = buildZiinaEmbeddedCheckoutSrc("https://pay.ziina.com/embed/abc", "ar");
    const url = new URL(src);
    expect(url.searchParams.get("version")).toBe("v1");
    expect(url.searchParams.get("locale")).toBe("ar");
  });

  it("does not add locale for English", () => {
    const src = buildZiinaEmbeddedCheckoutSrc("https://pay.ziina.com/embed/abc", "en");
    const url = new URL(src);
    expect(url.searchParams.get("locale")).toBeNull();
  });
});

describe("isZiinaIntentOpen", () => {
  it("treats pending-style statuses as open", () => {
    expect(isZiinaIntentOpen("requires_payment_instrument")).toBe(true);
    expect(isZiinaIntentOpen("pending")).toBe(true);
    expect(isZiinaIntentOpen("completed")).toBe(false);
    expect(isZiinaIntentOpen("canceled")).toBe(false);
  });
});

describe("parseZiinaCheckoutMessage", () => {
  const source = { id: "iframe" } as unknown as MessageEventSource;

  it("accepts COMPLETED from the Ziina origin and iframe source", () => {
    const status = parseZiinaCheckoutMessage({
      expectedSource: source,
      event: {
        origin: ZIINA_CHECKOUT_ORIGIN,
        source,
        data: { type: "ZIINA_PAYMENT_STATUS_CHANGE", data: { status: "COMPLETED" } },
      },
    });
    expect(status).toBe("COMPLETED");
  });

  it("ignores other origins, sources, and event types", () => {
    expect(
      parseZiinaCheckoutMessage({
        expectedSource: source,
        event: {
          origin: "https://evil.example",
          source,
          data: { type: "ZIINA_PAYMENT_STATUS_CHANGE", data: { status: "COMPLETED" } },
        },
      }),
    ).toBeNull();

    const other = { id: "other" } as unknown as MessageEventSource;
    expect(
      parseZiinaCheckoutMessage({
        expectedSource: source,
        event: {
          origin: ZIINA_CHECKOUT_ORIGIN,
          source: other,
          data: { type: "ZIINA_PAYMENT_STATUS_CHANGE", data: { status: "COMPLETED" } },
        },
      }),
    ).toBeNull();

    expect(
      parseZiinaCheckoutMessage({
        expectedSource: source,
        event: {
          origin: ZIINA_CHECKOUT_ORIGIN,
          source,
          data: { type: "OTHER", data: { status: "COMPLETED" } },
        },
      }),
    ).toBeNull();
  });
});
