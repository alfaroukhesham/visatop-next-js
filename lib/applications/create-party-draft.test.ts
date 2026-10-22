import { describe, expect, it } from "vitest";
import { assertCreateTravelers, assertDraftCatalogCurrency } from "./create-party-draft";
import { normalizeCreateDraftBody } from "./create-draft-body";

const catalog = [
  { id: "svc-adult", travelerKind: "adult" as const },
  { id: "svc-child", travelerKind: "child" as const },
];

const config = { partyEnabled: true, partyMaxTravelers: 8 };

describe("normalizeCreateDraftBody", () => {
  it("normalizes { serviceId } to a single adult traveler", () => {
    const body = {
      nationalityCode: "US",
      serviceId: "svc-adult",
      catalogCurrency: "USD" as const,
    };
    expect(normalizeCreateDraftBody(body)).toEqual({
      travelers: [{ serviceId: "svc-adult", kind: "adult" }],
    });
  });

  it("keeps explicit travelers", () => {
    const body = {
      nationalityCode: "US",
      travelers: [
        { serviceId: "svc-adult", kind: "adult" },
        { serviceId: "svc-child", kind: "child" },
      ],
      catalogCurrency: "USD" as const,
    };
    expect(normalizeCreateDraftBody(body).travelers).toHaveLength(2);
  });
});

describe("assertCreateTravelers", () => {
  it("accepts one valid traveler", () => {
    expect(
      assertCreateTravelers([{ serviceId: "svc-adult", kind: "adult" }], config, catalog),
    ).toEqual({ ok: true });
  });

  it("rejects 9 travelers when max is 8", () => {
    const travelers = Array.from({ length: 9 }, () => ({
      serviceId: "svc-adult",
      kind: "adult" as const,
    }));
    expect(assertCreateTravelers(travelers, config, catalog)).toEqual({
      ok: false,
      message: "Maximum 8 travellers per checkout.",
    });
  });

  it("rejects two travelers when party_enabled is false", () => {
    const disabled = { ...config, partyEnabled: false };
    expect(
      assertCreateTravelers(
        [
          { serviceId: "svc-adult", kind: "adult" },
          { serviceId: "svc-adult", kind: "adult" },
        ],
        disabled,
        catalog,
      ),
    ).toEqual({ ok: false, message: "This checkout is for one traveller only." });
  });

  it("rejects a child serviceId with adult kind", () => {
    expect(
      assertCreateTravelers([{ serviceId: "svc-child", kind: "adult" }], config, catalog),
    ).toEqual({ ok: false, message: "Invalid nationality or service." });
  });

  it("rejects an unpriced / unknown serviceId", () => {
    expect(
      assertCreateTravelers([{ serviceId: "svc-missing", kind: "adult" }], config, catalog),
    ).toEqual({ ok: false, message: "Invalid nationality or service." });
  });
});

describe("assertDraftCatalogCurrency", () => {
  const visible = [
    { code: "USD", kind: "global" as const },
    { code: "AED", kind: "global" as const },
    { code: "NGN", kind: "local" as const },
  ];
  const priced = [{ id: "svc-adult", displayPriceMinor: "18500000" }];
  const travelers = [{ serviceId: "svc-adult", kind: "adult" as const }];

  it("allows NGN when the nationality can see it and a stored price exists", () => {
    expect(assertDraftCatalogCurrency("NGN", visible, priced, travelers)).toEqual({ ok: true });
  });

  it("rejects NGN when the service has no stored local price", () => {
    expect(
      assertDraftCatalogCurrency(
        "NGN",
        visible,
        [{ id: "svc-adult", displayPriceMinor: null }],
        travelers,
      ),
    ).toEqual({
      ok: false,
      message: "Pricing unavailable for this nationality/service/currency combination.",
    });
  });

  it("rejects NGN when it is not visible for the nationality", () => {
    expect(
      assertDraftCatalogCurrency(
        "NGN",
        [
          { code: "USD", kind: "global" },
          { code: "AED", kind: "global" },
        ],
        priced,
        travelers,
      ),
    ).toEqual({
      ok: false,
      message: "This currency is not available for the selected nationality.",
    });
  });
});
