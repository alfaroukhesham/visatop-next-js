import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalKillSwitch = process.env.ENABLE_MARKETING_TAGS;

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("next/headers");
  if (originalKillSwitch === undefined) {
    delete process.env.ENABLE_MARKETING_TAGS;
  } else {
    process.env.ENABLE_MARKETING_TAGS = originalKillSwitch;
  }
});

const read = (relativePath: string): string =>
  readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("MarketingTags wiring", () => {
  it("is mounted from the customer layout instead of always-on GoogleTag/MetaPixel", () => {
    const layout = read("app/(client)/layout.tsx");
    expect(layout).toContain("MarketingTags");
    expect(layout).not.toContain('from "@/components/analytics/google-tag"');
    expect(layout).not.toContain('from "@/components/analytics/meta-pixel"');
  });

  it("does not load a GTM container script", () => {
    const src = read("components/analytics/marketing-tags.tsx");
    expect(src).toContain("GoogleTag");
    expect(src).toContain("MetaPixel");
    expect(src).not.toContain("googletagmanager.com/gtm.js");
  });
});

describe("MarketingTags", () => {
  it("returns null on a non-production host", async () => {
    vi.resetModules();
    vi.doMock("next/headers", () => ({
      headers: async () => new Headers({ host: "app-staging.visatop.com" }),
    }));
    const { MarketingTags } = await import("@/components/analytics/marketing-tags");
    expect(await MarketingTags()).toBeNull();
  });

  it("returns a tree on visatop.com", async () => {
    vi.resetModules();
    vi.doMock("next/headers", () => ({
      headers: async () => new Headers({ host: "visatop.com" }),
    }));
    const { MarketingTags } = await import("@/components/analytics/marketing-tags");
    const tree = await MarketingTags();
    expect(tree).not.toBeNull();
  });
});
