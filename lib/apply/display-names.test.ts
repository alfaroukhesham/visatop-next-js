import { describe, expect, it } from "vitest";
import {
  iso2FlagEmoji,
  nationalityDisplayName,
  nationalityLabelWithFlag,
  serviceDisplayName,
} from "./display-names";

describe("iso2FlagEmoji", () => {
  it("maps an ISO code to a regional-indicator flag", () => {
    expect(iso2FlagEmoji("IN")).toBe("🇮🇳");
    expect(iso2FlagEmoji("us")).toBe("🇺🇸");
  });

  it("returns empty when the value is not a two-letter code", () => {
    expect(iso2FlagEmoji("")).toBe("");
    expect(iso2FlagEmoji("IND")).toBe("");
    expect(iso2FlagEmoji("1A")).toBe("");
  });

  it("maps catalog AB to the Antigua and Barbuda flag (ISO AG)", () => {
    expect(iso2FlagEmoji("AB")).toBe(iso2FlagEmoji("AG"));
    expect(iso2FlagEmoji("AB")).toBe("🇦🇬");
  });
});

describe("nationalityDisplayName", () => {
  it("resolves IN to India", () => {
    expect(nationalityDisplayName("IN", [{ code: "IN", name: "India" }])).toBe("India");
  });

  it("uses the English region name when the catalog has no row", () => {
    expect(nationalityDisplayName("IN", [])).toBe("India");
  });

  it("never falls back to a raw ISO code for unknown regions", () => {
    expect(nationalityDisplayName("ZZ", [])).not.toMatch(/^[A-Z]{2}$/);
  });
});

describe("nationalityLabelWithFlag", () => {
  it("prefixes the country name with a flag", () => {
    expect(nationalityLabelWithFlag("IN", "India")).toBe("🇮🇳 India");
  });
});

describe("serviceDisplayName", () => {
  it("resolves a service id to its name", () => {
    expect(serviceDisplayName("svc-1", [{ id: "svc-1", name: "Tourist Visa" }])).toBe("Tourist Visa");
  });

  it("returns null on a miss, never a UUID or 'Service ' string", () => {
    const name = serviceDisplayName("aaaaaaaa-bbbb-5ccc-dddd-eeeeeeeeeeee", []);
    expect(name).toBeNull();
    expect(name ?? "").not.toContain("aaaaaaaa");
    expect(name ?? "").not.toMatch(/^Service /);
  });
});
