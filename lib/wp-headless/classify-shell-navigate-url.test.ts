import { describe, expect, it } from "vitest";
import { classifyWpShellNavigateUrl } from "./classify-shell-navigate-url";

describe("classifyWpShellNavigateUrl", () => {
  const appOrigin = "https://visatop.com";
  const appBasePath = "/visa-processing";
  const wpBaseHref = "https://visatop.com";

  it("routes /visa-processing/* to internal Next paths", () => {
    const out = classifyWpShellNavigateUrl({
      href: "/visa-processing/apply/track",
      wpBaseHref,
      appBasePath,
      appOrigin,
    });

    expect(out).toEqual({ mode: "internal", path: "/apply/track" });
  });

  it("resolves relative paths against wpBaseHref before classifying", () => {
    const out = classifyWpShellNavigateUrl({
      href: "visa-processing/portal",
      wpBaseHref,
      appBasePath,
      appOrigin,
    });

    expect(out).toEqual({ mode: "internal", path: "/portal" });
  });

  it("treats same-origin WP pages outside the app mount as external", () => {
    const out = classifyWpShellNavigateUrl({
      href: "https://visatop.com/blog/uae-visa-guide",
      wpBaseHref,
      appBasePath,
      appOrigin,
    });

    expect(out).toEqual({
      mode: "external",
      url: "https://visatop.com/blog/uae-visa-guide",
    });
  });

  it("treats other origins as external", () => {
    const out = classifyWpShellNavigateUrl({
      href: "https://example.com/pricing",
      wpBaseHref,
      appBasePath,
      appOrigin,
    });

    expect(out).toEqual({ mode: "external", url: "https://example.com/pricing" });
  });
});
