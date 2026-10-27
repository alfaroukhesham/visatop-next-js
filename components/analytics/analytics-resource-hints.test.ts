import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AnalyticsResourceHints } from "@/components/analytics/analytics-resource-hints";

const read = (relativePath: string): string =>
  readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("AnalyticsResourceHints", () => {
  it("always emits Clarity preconnects", () => {
    const tree = AnalyticsResourceHints({});
    const html = JSON.stringify(tree);
    expect(html).toContain("https://www.clarity.ms");
    expect(html).toContain("https://scripts.clarity.ms");
    expect(html).not.toContain("https://www.googletagmanager.com");
  });

  it("adds marketing preconnects only when enabled", () => {
    const tree = AnalyticsResourceHints({ includeMarketing: true });
    const html = JSON.stringify(tree);
    expect(html).toContain("https://www.googletagmanager.com");
    expect(html).toContain("https://connect.facebook.net");
    expect(html).toContain("dns-prefetch");
  });

  it("is mounted from the customer layout", () => {
    const layout = read("app/(client)/layout.tsx");
    expect(layout).toContain("AnalyticsResourceHints");
    expect(layout).toContain("includeMarketing={marketingTagsEnabled}");
  });
});
