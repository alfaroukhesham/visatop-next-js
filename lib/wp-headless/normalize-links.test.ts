import { describe, expect, it } from "vitest";
import { normalizeWpMenuUrl } from "./normalize-links";

describe("normalizeWpMenuUrl", () => {
  it("treats /visa-processing/* as internal and strips the basePath", () => {
    const out = normalizeWpMenuUrl({
      url: "/visa-processing/apply/start",
      label: "Apply",
      appBasePath: "/visa-processing",
      appOrigin: "https://visatop.com",
    });

    expect(out.kind).toBe("internal");
    expect(out.href).toBe("/apply/start");
  });

  it("treats same-origin absolute /visa-processing/* as internal and strips it", () => {
    const out = normalizeWpMenuUrl({
      url: "https://visatop.com/visa-processing/portal",
      label: "Portal",
      appBasePath: "/visa-processing",
      appOrigin: "https://visatop.com",
    });

    expect(out.kind).toBe("internal");
    expect(out.href).toBe("/portal");
  });

  it("treats same-origin links outside /visa-processing as external", () => {
    const out = normalizeWpMenuUrl({
      url: "https://visatop.com/blog",
      label: "Blog",
      appBasePath: "/visa-processing",
      appOrigin: "https://visatop.com",
    });

    expect(out.kind).toBe("external");
    expect(out.href).toBe("https://visatop.com/blog");
  });

  it("treats other origins as external", () => {
    const out = normalizeWpMenuUrl({
      url: "https://example.com/pricing",
      label: "Pricing",
      appBasePath: "/visa-processing",
      appOrigin: "https://visatop.com",
    });

    expect(out.kind).toBe("external");
    expect(out.href).toBe("https://example.com/pricing");
  });

  it("falls back to external for empty/invalid urls", () => {
    const out = normalizeWpMenuUrl({
      url: "",
      label: "Empty",
      appBasePath: "/visa-processing",
      appOrigin: "https://visatop.com",
    });

    expect(out.kind).toBe("external");
    expect(out.href).toBe("#");
  });
});

