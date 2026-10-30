import { describe, expect, it } from "vitest";
import { isAnalyticsExcludedPath } from "@/lib/analytics/excluded-paths";
import { buildMetaPixelBootstrapScript } from "@/lib/analytics/meta-pixel-bootstrap";
import {
  buildMetaPixelNoscriptSrc,
  META_PIXEL_ID,
  WEBISTE_VISA_PIXEL_ID,
} from "@/lib/analytics/meta-pixel-id";

describe("pixel ids", () => {
  it("keeps the existing Events Manager pixel and adds WebisteVisa", () => {
    expect(META_PIXEL_ID).toBe("951709640813169");
    expect(WEBISTE_VISA_PIXEL_ID).toBe("1098702859698634");
  });
});

describe("buildMetaPixelBootstrapScript", () => {
  it("inits both pixels from a single fbevents.js load and tracks one PageView", () => {
    const script = buildMetaPixelBootstrapScript();
    expect(script).toContain("https://connect.facebook.net/en_US/fbevents.js");
    expect(script.split("https://connect.facebook.net/en_US/fbevents.js")).toHaveLength(2);
    expect(script).toContain(`fbq('init', ${JSON.stringify(META_PIXEL_ID)})`);
    expect(script).toContain(`fbq('init', ${JSON.stringify(WEBISTE_VISA_PIXEL_ID)})`);
    expect(script).toContain("fbq('track', 'PageView')");
    expect(script).not.toContain("trackSingle");
    expect(script).toContain("n.version='2.0'");
    expect(script).toContain("visatop:meta-pixel-ready");
  });
});

describe("buildMetaPixelNoscriptSrc", () => {
  it("builds the noscript PageView image URL for each pixel", () => {
    expect(buildMetaPixelNoscriptSrc()).toBe(
      "https://www.facebook.com/tr?id=951709640813169&ev=PageView&noscript=1",
    );
    expect(buildMetaPixelNoscriptSrc(WEBISTE_VISA_PIXEL_ID)).toBe(
      "https://www.facebook.com/tr?id=1098702859698634&ev=PageView&noscript=1",
    );
  });
});

describe("meta pixel SPA page views", () => {
  it("does not send hits on admin paths", () => {
    expect(isAnalyticsExcludedPath("/admin")).toBe(true);
    expect(isAnalyticsExcludedPath("/apply/start")).toBe(false);
  });
});
