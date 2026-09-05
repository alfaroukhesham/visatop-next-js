import { describe, expect, it } from "vitest";
import { nationalityDisplayName, serviceDisplayName } from "./display-names";

describe("nationalityDisplayName", () => {
  it("resolves IN to India", () => {
    expect(nationalityDisplayName("IN", [{ code: "IN", name: "India" }])).toBe("India");
  });

  it("falls back to the code when unknown or catalog empty", () => {
    expect(nationalityDisplayName("ZZ", [])).toBe("ZZ");
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
