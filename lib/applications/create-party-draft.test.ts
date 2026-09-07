import { describe, expect, it } from "vitest";
import { assertCreateTravelers } from "./create-party-draft";
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
