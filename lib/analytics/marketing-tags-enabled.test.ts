import { afterEach, describe, expect, it } from "vitest";
import {
  CHECKOUT_LOADS_GTM_CONTAINER,
  PRODUCTION_MARKETING_HOSTS,
  areMarketingTagsEnabled,
  areMarketingTagsEnabledFromHeaders,
  isInternalHostname,
  isMarketingTagsKillSwitchOff,
  isProductionMarketingHost,
  parseRequestHostname,
} from "@/lib/analytics/marketing-tags-enabled";

const originalKillSwitch = process.env.ENABLE_MARKETING_TAGS;

afterEach(() => {
  if (originalKillSwitch === undefined) {
    delete process.env.ENABLE_MARKETING_TAGS;
  } else {
    process.env.ENABLE_MARKETING_TAGS = originalKillSwitch;
  }
});

const headersOf = (init: Record<string, string>): { get: (name: string) => string | null } => ({
  get: (name) => init[name.toLowerCase()] ?? null,
});

describe("CHECKOUT_LOADS_GTM_CONTAINER", () => {
  it("stays false until GTM can reproduce checkout Ads conversions", () => {
    expect(CHECKOUT_LOADS_GTM_CONTAINER).toBe(false);
  });
});

describe("parseRequestHostname", () => {
  it("lowercases, strips port, and uses the first forwarded value", () => {
    expect(parseRequestHostname("VisaTop.com:443")).toBe("visatop.com");
    expect(parseRequestHostname("app-staging.visatop.com, visatop.com")).toBe(
      "app-staging.visatop.com",
    );
    expect(parseRequestHostname("visatop.com.")).toBe("visatop.com");
    expect(parseRequestHostname("[::1]:3000")).toBe("::1");
    expect(parseRequestHostname(null)).toBe("");
  });
});

describe("isProductionMarketingHost", () => {
  it("allowlists only the public production hosts", () => {
    expect(PRODUCTION_MARKETING_HOSTS).toEqual(["visatop.com", "www.visatop.com"]);
    expect(isProductionMarketingHost("visatop.com")).toBe(true);
    expect(isProductionMarketingHost("www.visatop.com")).toBe(true);
    expect(isProductionMarketingHost("app-staging.visatop.com")).toBe(false);
    expect(isProductionMarketingHost("staging.visatop.com")).toBe(false);
    expect(isProductionMarketingHost("visatop.com.evil.com")).toBe(false);
    expect(isProductionMarketingHost("localhost")).toBe(false);
  });
});

describe("isInternalHostname", () => {
  it("treats loopback and .local names as non-public", () => {
    expect(isInternalHostname("localhost")).toBe(true);
    expect(isInternalHostname("127.0.0.1")).toBe(true);
    expect(isInternalHostname("::1")).toBe(true);
    expect(isInternalHostname("0.0.0.0")).toBe(true);
    expect(isInternalHostname("host.docker.internal")).toBe(true);
    expect(isInternalHostname("app.local")).toBe(true);
    expect(isInternalHostname("app-staging.visatop.com")).toBe(false);
  });
});

describe("isMarketingTagsKillSwitchOff", () => {
  it("is off only for explicit falsey strings", () => {
    expect(isMarketingTagsKillSwitchOff(undefined)).toBe(false);
    expect(isMarketingTagsKillSwitchOff("")).toBe(false);
    expect(isMarketingTagsKillSwitchOff("true")).toBe(false);
    expect(isMarketingTagsKillSwitchOff("false")).toBe(true);
    expect(isMarketingTagsKillSwitchOff("OFF")).toBe(true);
    expect(isMarketingTagsKillSwitchOff("0")).toBe(true);
    expect(isMarketingTagsKillSwitchOff("no")).toBe(true);
  });
});

describe("areMarketingTagsEnabled", () => {
  it("enables on production hosts even when the env flag is unset", () => {
    expect(areMarketingTagsEnabled({ hostname: "visatop.com" })).toBe(true);
    expect(areMarketingTagsEnabled({ hostname: "www.visatop.com:443" })).toBe(true);
  });

  it("stays off on staging, local, previews, and IPs", () => {
    expect(areMarketingTagsEnabled({ hostname: "app-staging.visatop.com" })).toBe(false);
    expect(areMarketingTagsEnabled({ hostname: "localhost:3000" })).toBe(false);
    expect(areMarketingTagsEnabled({ hostname: "127.0.0.1" })).toBe(false);
    expect(areMarketingTagsEnabled({ hostname: "something.netlify.app" })).toBe(false);
    expect(areMarketingTagsEnabled({ hostname: "138.68.184.84" })).toBe(false);
    expect(areMarketingTagsEnabled({ hostname: "" })).toBe(false);
  });

  it("does not let ENABLE_MARKETING_TAGS=true turn on a non-prod host", () => {
    expect(
      areMarketingTagsEnabled({
        hostname: "app-staging.visatop.com",
        envFlag: "true",
      }),
    ).toBe(false);
    expect(areMarketingTagsEnabled({ hostname: "localhost", envFlag: "true" })).toBe(false);
  });

  it("honors the runtime kill switch on production", () => {
    expect(areMarketingTagsEnabled({ hostname: "visatop.com", envFlag: "false" })).toBe(false);
  });

  it("uses X-Forwarded-Host when Host is an internal bind address", () => {
    expect(
      areMarketingTagsEnabled({
        hostname: "localhost:3000",
        forwardedHostname: "visatop.com",
      }),
    ).toBe(true);
  });

  it("ignores a spoofed X-Forwarded-Host when Host is a public non-prod host", () => {
    expect(
      areMarketingTagsEnabled({
        hostname: "app-staging.visatop.com",
        forwardedHostname: "visatop.com",
      }),
    ).toBe(false);
  });
});

describe("areMarketingTagsEnabledFromHeaders", () => {
  it("reads Host and X-Forwarded-Host", () => {
    expect(
      areMarketingTagsEnabledFromHeaders(
        headersOf({ host: "visatop.com" }),
        undefined,
      ),
    ).toBe(true);
    expect(
      areMarketingTagsEnabledFromHeaders(
        headersOf({
          host: "127.0.0.1:3000",
          "x-forwarded-host": "www.visatop.com",
        }),
        undefined,
      ),
    ).toBe(true);
    expect(
      areMarketingTagsEnabledFromHeaders(
        headersOf({ host: "app-staging.visatop.com" }),
        "true",
      ),
    ).toBe(false);
  });

  it("uses ENABLE_MARKETING_TAGS from the process env by default", () => {
    process.env.ENABLE_MARKETING_TAGS = "false";
    expect(areMarketingTagsEnabledFromHeaders(headersOf({ host: "visatop.com" }))).toBe(
      false,
    );
  });
});
