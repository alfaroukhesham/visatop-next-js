import { describe, expect, it } from "vitest";
import {
  pickCanonicalAffiliateSiteId,
  pickEffectiveMarginPolicy,
  pickLatestReferenceRow,
} from "./resolve-catalog-pricing";

describe("pickEffectiveMarginPolicy", () => {
  it("prefers enabled service-scoped policy over global", () => {
    const t0 = new Date("2020-01-01");
    const t1 = new Date("2020-01-02");
    const picked = pickEffectiveMarginPolicy("svc-1", [
      {
        scope: "global",
        serviceId: null,
        mode: "percent",
        value: "10",
        currency: "USD",
        enabled: true,
        updatedAt: t1,
      },
      {
        scope: "service",
        serviceId: "svc-1",
        mode: "fixed",
        value: "500",
        currency: "USD",
        enabled: true,
        updatedAt: t0,
      },
    ]);
    expect(picked?.mode).toBe("fixed");
    expect(picked?.value).toBe("500");
  });

  it("falls back to global when no service policy", () => {
    const picked = pickEffectiveMarginPolicy("svc-1", [
      {
        scope: "global",
        serviceId: null,
        mode: "percent",
        value: "12",
        currency: "USD",
        enabled: true,
        updatedAt: new Date(),
      },
    ]);
    expect(picked?.mode).toBe("percent");
    expect(picked?.value).toBe("12");
  });

  it("ignores disabled rows", () => {
    const picked = pickEffectiveMarginPolicy("svc-1", [
      {
        scope: "service",
        serviceId: "svc-1",
        mode: "percent",
        value: "99",
        currency: "USD",
        enabled: false,
        updatedAt: new Date(),
      },
      {
        scope: "global",
        serviceId: null,
        mode: "percent",
        value: "5",
        currency: "USD",
        enabled: true,
        updatedAt: new Date(),
      },
    ]);
    expect(picked?.value).toBe("5");
  });

  it("picks newest global by updatedAt when multiple enabled globals", () => {
    const older = new Date("2019-01-01");
    const newer = new Date("2020-06-01");
    const picked = pickEffectiveMarginPolicy("svc-1", [
      {
        scope: "global",
        serviceId: null,
        mode: "percent",
        value: "1",
        currency: "USD",
        enabled: true,
        updatedAt: older,
      },
      {
        scope: "global",
        serviceId: null,
        mode: "percent",
        value: "2",
        currency: "USD",
        enabled: true,
        updatedAt: newer,
      },
    ]);
    expect(picked?.value).toBe("2");
  });
});

describe("pickLatestReferenceRow", () => {
  it("returns row with greatest observedAt", () => {
    const a = {
      amountMinor: BigInt(1000),
      currency: "USD",
      observedAt: new Date("2020-01-01"),
    };
    const b = {
      amountMinor: BigInt(2000),
      currency: "USD",
      observedAt: new Date("2021-01-01"),
    };
    expect(pickLatestReferenceRow([a, b])?.amountMinor).toBe(BigInt(2000));
  });
});

describe("pickCanonicalAffiliateSiteId", () => {
  it("uses env id when present and enabled", () => {
    expect(
      pickCanonicalAffiliateSiteId(
        [
          { id: "a", enabled: true },
          { id: "b", enabled: true },
        ],
        "b",
      ),
    ).toBe("b");
  });

  it("ignores env id when site disabled", () => {
    expect(
      pickCanonicalAffiliateSiteId(
        [
          { id: "a", enabled: true },
          { id: "b", enabled: false },
        ],
        "b",
      ),
    ).toBe("a");
  });

  it("returns first enabled id when env unset", () => {
    expect(
      pickCanonicalAffiliateSiteId(
        [
          { id: "x", enabled: false },
          { id: "y", enabled: true },
        ],
        undefined,
      ),
    ).toBe("y");
  });
});
