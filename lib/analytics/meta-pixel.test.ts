import { describe, expect, it } from "vitest";
import { isAnalyticsExcludedPath } from "@/lib/analytics/excluded-paths";
import { buildMetaPixelBootstrapScript } from "@/lib/analytics/meta-pixel-bootstrap";
import { buildMetaPixelNoscriptSrc, META_PIXEL_ID } from "@/lib/analytics/meta-pixel-id";

describe("META_PIXEL_ID", () => {
  it("is the Events Manager pixel id", () => {
    expect(META_PIXEL_ID).toBe("951709640813169");
  });
});

describe("buildMetaPixelBootstrapScript", () => {
  it("inits the hardcoded pixel and tracks PageView with the official fbevents loader", () => {
    const script = buildMetaPixelBootstrapScript();
    expect(script).toContain("https://connect.facebook.net/en_US/fbevents.js");
    expect(script).toContain(`fbq('init', ${JSON.stringify(META_PIXEL_ID)})`);
    expect(script).toContain("fbq('track', 'PageView')");
    expect(script).toContain("n.version='2.0'");
  });
});

describe("buildMetaPixelNoscriptSrc", () => {
  it("builds the noscript PageView image URL", () => {
    expect(buildMetaPixelNoscriptSrc()).toBe(
      "https://www.facebook.com/tr?id=951709640813169&ev=PageView&noscript=1",
    );
  });
});

describe("meta pixel SPA page views", () => {
  it("does not send hits on admin paths", () => {
    expect(isAnalyticsExcludedPath("/admin")).toBe(true);
    expect(isAnalyticsExcludedPath("/apply/start")).toBe(false);
  });
});
