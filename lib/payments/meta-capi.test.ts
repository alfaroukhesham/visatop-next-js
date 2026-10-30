import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMetaCapiPurchaseEvent,
  buildMetaFbc,
  getMetaCapiConfig,
  hashMetaCapiField,
  isRetryableMetaCapiPurchase,
  META_CAPI_DEFAULT_PIXEL_ID,
  META_CAPI_GRAPH_API_VERSION,
  minorUnitsToMetaValue,
  normalizeMetaCapiCountry,
  normalizeMetaCapiEmail,
  normalizeMetaCapiPhone,
  readMetaCapiAttribution,
  sendMetaCapiPurchaseEvent,
  shouldSendMetaCapiPurchaseForApplication,
} from "./meta-capi";

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

const baseAttribution = {
  fbp: "fb.1.1710000000000.1234567890",
  fbc: "fb.1.1710000000000.IwAR0click",
  clientIp: "203.0.113.10",
  clientUserAgent: "Mozilla/5.0 Test",
  eventSourceUrl: "https://visatop.com/visa-processing/apply/applications/app_pay/payment",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("hashMetaCapiField", () => {
  it("SHA-256 hex-hashes normalized email, E.164 phone digits, external_id, and lowercase country", () => {
    expect(hashMetaCapiField("ada@example.com")).toBe(sha256("ada@example.com"));
    expect(normalizeMetaCapiEmail("  Ada@Example.COM ")).toBe("ada@example.com");
    expect(hashMetaCapiField(normalizeMetaCapiEmail("  Ada@Example.COM ")!)).toBe(
      sha256("ada@example.com"),
    );

    expect(normalizeMetaCapiPhone("+971 50 000 0000")).toBe("971500000000");
    expect(hashMetaCapiField(normalizeMetaCapiPhone("+971 50 000 0000")!)).toBe(sha256("971500000000"));

    expect(normalizeMetaCapiCountry("IN")).toBe("in");
    expect(hashMetaCapiField(normalizeMetaCapiCountry("IN")!)).toBe(sha256("in"));

    expect(hashMetaCapiField("user_42")).toBe(sha256("user_42"));
  });

  it("drops empty email, non-digit phones, and invalid country codes", () => {
    expect(normalizeMetaCapiEmail("   ")).toBeNull();
    expect(normalizeMetaCapiPhone("abc")).toBeNull();
    expect(normalizeMetaCapiCountry("India")).toBeNull();
    expect(normalizeMetaCapiCountry("")).toBeNull();
  });
});

describe("buildMetaCapiPurchaseEvent", () => {
  it("builds a website Purchase with event_id equal to the paying application id", () => {
    const event = buildMetaCapiPurchaseEvent({
      applicationId: "app_pay",
      amountMinor: BigInt(14900),
      currency: "usd",
      email: "Ada@Example.COM",
      phone: "+971500000000",
      userId: "user_42",
      nationalityCode: "IN",
      attribution: baseAttribution,
      eventTimeUnix: 1_710_000_000,
    });

    expect(event.event_name).toBe("Purchase");
    expect(event.event_id).toBe("app_pay");
    expect(event.action_source).toBe("website");
    expect(event.event_source_url).toBe(baseAttribution.eventSourceUrl);
    expect(event.event_time).toBe(1_710_000_000);
    expect(event.custom_data).toEqual({ value: 149, currency: "USD" });
    expect(event.user_data).toEqual({
      em: [sha256("ada@example.com")],
      ph: [sha256("971500000000")],
      external_id: [sha256("user_42")],
      country: [sha256("in")],
      client_ip_address: "203.0.113.10",
      client_user_agent: "Mozilla/5.0 Test",
      fbp: baseAttribution.fbp,
      fbc: baseAttribution.fbc,
    });
  });

  it("uses the actual paid amount in major units and omits empty user fields", () => {
    const event = buildMetaCapiPurchaseEvent({
      applicationId: "app_pay",
      amountMinor: BigInt(18500000),
      currency: "NGN",
      attribution: {
        fbp: null,
        fbc: null,
        clientIp: "unknown",
        clientUserAgent: null,
        eventSourceUrl: null,
      },
    });
    expect(event.custom_data).toEqual({ value: 185000, currency: "NGN" });
    expect(event.user_data).toEqual({});
    expect(event.event_source_url).toBeUndefined();
  });
});

describe("minorUnitsToMetaValue", () => {
  it("converts catalog minor units to a two-decimal major value", () => {
    expect(minorUnitsToMetaValue(BigInt(1999))).toBe(19.99);
    expect(minorUnitsToMetaValue(BigInt(0))).toBe(0);
  });
});

describe("buildMetaFbc / readMetaCapiAttribution", () => {
  it("prefers the _fbc cookie and otherwise builds fbc from fbclid", () => {
    expect(
      buildMetaFbc({
        fbcCookie: "fb.1.1.cookie",
        fbclid: "from-query",
        nowMs: 1_710_000_000_000,
      }),
    ).toBe("fb.1.1.cookie");
    expect(
      buildMetaFbc({
        fbcCookie: null,
        fbclid: "IwAR0click",
        nowMs: 1_710_000_000_000,
      }),
    ).toBe("fb.1.1710000000000.IwAR0click");
    expect(buildMetaFbc({ fbcCookie: "  ", fbclid: "  ", nowMs: 1 })).toBeNull();
  });

  it("reads _fbp/_fbc, client IP, user agent, page URL, and fbclid from the Pay request", () => {
    const headers = new Headers({
      cookie: "_fbp=fb.1.1.abc; vt_resume=secret; _fbc=fb.1.1.def",
      "user-agent": "Mozilla/5.0 VisaTop",
      referer: "https://visatop.com/visa-processing/apply/applications/app_pay/payment?fbclid=unused",
      "x-forwarded-for": "198.51.100.20, 10.0.0.1",
    });
    expect(readMetaCapiAttribution(headers, 99)).toEqual({
      fbp: "fb.1.1.abc",
      fbc: "fb.1.1.def",
      clientIp: "198.51.100.20",
      clientUserAgent: "Mozilla/5.0 VisaTop",
      eventSourceUrl: "https://visatop.com/visa-processing/apply/applications/app_pay/payment?fbclid=unused",
    });
  });

  it("builds fbc from the referer fbclid when the _fbc cookie is missing", () => {
    const headers = new Headers({
      cookie: "_fbp=fb.1.1.abc",
      referer: "https://visatop.com/apply/start?nationality=IN&fbclid=IwAR0fromAd",
      "user-agent": "Mozilla/5.0",
      "x-real-ip": "192.0.2.9",
    });
    expect(readMetaCapiAttribution(headers, 1_710_000_000_000).fbc).toBe(
      "fb.1.1710000000000.IwAR0fromAd",
    );
  });
});

describe("group booking and retry selection", () => {
  it("sends one Purchase for the paying application, not per traveller", () => {
    expect(
      shouldSendMetaCapiPurchaseForApplication({
        applicationId: "app_primary",
        paymentApplicationId: "app_primary",
        paymentStatus: "paid",
      }),
    ).toBe(true);
    expect(
      shouldSendMetaCapiPurchaseForApplication({
        applicationId: "app_child",
        paymentApplicationId: "app_primary",
        paymentStatus: "paid",
      }),
    ).toBe(false);
    expect(
      shouldSendMetaCapiPurchaseForApplication({
        applicationId: "app_primary",
        paymentApplicationId: null,
        paymentStatus: "paid",
      }),
    ).toBe(false);
  });

  it("retries only unpaid-marker paying applications from the last 7 days", () => {
    const now = new Date("2026-10-30T12:00:00.000Z");
    const sixDaysAgo = new Date("2026-10-24T12:00:00.000Z");
    const eightDaysAgo = new Date("2026-10-22T12:00:00.000Z");
    expect(
      isRetryableMetaCapiPurchase({
        paymentStatus: "paid",
        capiPurchaseSentAt: null,
        paidAt: sixDaysAgo,
        paymentProvider: "ziina",
        isPaymentOwner: true,
        now,
      }),
    ).toBe(true);
    expect(
      isRetryableMetaCapiPurchase({
        paymentStatus: "paid",
        capiPurchaseSentAt: null,
        paidAt: sixDaysAgo,
        paymentProvider: "ziina",
        isPaymentOwner: false,
        now,
      }),
    ).toBe(false);
    expect(
      isRetryableMetaCapiPurchase({
        paymentStatus: "paid",
        capiPurchaseSentAt: new Date(now),
        paidAt: sixDaysAgo,
        paymentProvider: "fincra",
        isPaymentOwner: true,
        now,
      }),
    ).toBe(false);
    expect(
      isRetryableMetaCapiPurchase({
        paymentStatus: "paid",
        capiPurchaseSentAt: null,
        paidAt: eightDaysAgo,
        paymentProvider: "ziina",
        isPaymentOwner: true,
        now,
      }),
    ).toBe(false);
    expect(
      isRetryableMetaCapiPurchase({
        paymentStatus: "paid",
        capiPurchaseSentAt: null,
        paidAt: sixDaysAgo,
        paymentProvider: "paddle",
        isPaymentOwner: true,
        now,
      }),
    ).toBe(false);
  });
});

describe("getMetaCapiConfig", () => {
  it("defaults the CAPI pixel to WebisteVisa and reads the test event code", () => {
    vi.stubEnv("META_CAPI_TOKEN", "secret-token");
    vi.stubEnv("META_PIXEL_ID_CAPI", "");
    vi.stubEnv("META_TEST_EVENT_CODE", "TEST12345");
    expect(getMetaCapiConfig()).toEqual({
      token: "secret-token",
      pixelId: META_CAPI_DEFAULT_PIXEL_ID,
      testEventCode: "TEST12345",
    });
    expect(META_CAPI_DEFAULT_PIXEL_ID).toBe("1098702859698634");
    expect(META_CAPI_GRAPH_API_VERSION).toBe("v21.0");
  });
});

describe("sendMetaCapiPurchaseEvent", () => {
  const context = {
    applicationId: "app_pay",
    paymentApplicationId: "app_pay",
    paymentStatus: "paid" as const,
    amountMinor: BigInt(14900),
    currency: "USD",
    email: "ada@example.com",
    phone: "+971500000000",
    userId: "user_42",
    nationalityCode: "IN",
    attribution: baseAttribution,
    eventTimeUnix: 1_710_000_000,
  };

  it("skips quietly when META_CAPI_TOKEN is missing and does not claim or fetch", async () => {
    const fetchFn = vi.fn();
    const claim = vi.fn();
    const info = vi.fn();
    const result = await sendMetaCapiPurchaseEvent("app_pay", {
      env: { META_CAPI_TOKEN: "  " },
      loadContext: async () => context,
      claim,
      release: vi.fn(),
      fetchFn,
      log: { info, warn: vi.fn(), error: vi.fn() },
    });
    expect(result).toEqual({ ok: false, reason: "missing_token" });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(claim).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
    const msg = String(info.mock.calls[0]?.[1] ?? info.mock.calls[0]?.[0] ?? "");
    expect(msg).toMatch(/META_CAPI_TOKEN/i);
    expect(JSON.stringify(info.mock.calls)).not.toMatch(/secret/i);
  });

  it("claims once, posts Purchase to the pinned Graph API, and keeps the marker on success", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toBe(
        `https://graph.facebook.com/${META_CAPI_GRAPH_API_VERSION}/${META_CAPI_DEFAULT_PIXEL_ID}/events`,
      );
      expect(String(url)).not.toContain("access_token");
      const body = JSON.parse(String(init?.body)) as {
        access_token: string;
        test_event_code?: string;
        data: Array<{ event_name: string; event_id: string }>;
      };
      expect(body.access_token).toBe("capi-secret");
      expect(body.test_event_code).toBe("TEST999");
      expect(body.data).toHaveLength(1);
      expect(body.data[0]?.event_name).toBe("Purchase");
      expect(body.data[0]?.event_id).toBe("app_pay");
      return new Response(JSON.stringify({ events_received: 1, fbtrace_id: "trace" }), { status: 200 });
    });
    const claim = vi.fn(async () => true);
    const release = vi.fn();
    const result = await sendMetaCapiPurchaseEvent("app_pay", {
      env: {
        META_CAPI_TOKEN: "capi-secret",
        META_TEST_EVENT_CODE: "TEST999",
      },
      loadContext: async () => context,
      claim,
      release,
      fetchFn,
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
    expect(result).toEqual({ ok: true });
    expect(claim).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
  });

  it("does not send a second time when the sent marker is already claimed", async () => {
    const fetchFn = vi.fn();
    const result = await sendMetaCapiPurchaseEvent("app_pay", {
      env: { META_CAPI_TOKEN: "capi-secret" },
      loadContext: async () => context,
      claim: async () => false,
      release: vi.fn(),
      fetchFn,
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
    expect(result).toEqual({ ok: false, reason: "already_sent" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("releases the marker when Graph API fails so a retry can send", async () => {
    const fetchFn = vi.fn(
      async () => new Response(JSON.stringify({ error: { message: "temporarily unavailable", code: 1 } }), { status: 500 }),
    );
    const release = vi.fn();
    const error = vi.fn();
    const result = await sendMetaCapiPurchaseEvent("app_pay", {
      env: { META_CAPI_TOKEN: "capi-secret" },
      loadContext: async () => context,
      claim: async () => true,
      release,
      fetchFn,
      log: { info: vi.fn(), warn: vi.fn(), error },
    });
    expect(result).toEqual({ ok: false, reason: "graph_error" });
    expect(release).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(error.mock.calls)).not.toContain("capi-secret");
  });

  it("does not send for a group companion application", async () => {
    const fetchFn = vi.fn();
    const claim = vi.fn();
    const result = await sendMetaCapiPurchaseEvent("app_child", {
      env: { META_CAPI_TOKEN: "capi-secret" },
      loadContext: async () => ({ ...context, applicationId: "app_child", paymentApplicationId: "app_pay" }),
      claim,
      release: vi.fn(),
      fetchFn,
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
    expect(result).toEqual({ ok: false, reason: "not_paying_application" });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(claim).not.toHaveBeenCalled();
  });
});
