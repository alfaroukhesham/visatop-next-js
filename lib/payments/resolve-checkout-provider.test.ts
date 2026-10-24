import { describe, expect, it } from "vitest";
import {
  decideCheckoutProviderFromContext,
  resolveCheckoutProviderDecision,
} from "./resolve-checkout-provider";
import { isFincraEnabled, parseFincraFeeBearer } from "./resolve-payment-provider";

describe("resolveCheckoutProviderDecision", () => {
  it("routes Nigerian applications with stored NGN prices to Fincra when NGN is selected", () => {
    const d = resolveCheckoutProviderDecision({
      nationalityCode: "NG",
      hasStoredNgnPriceForEveryMember: true,
      displayCurrency: "USD",
      selectedCurrency: "NGN",
      defaultProvider: "ziina",
      fincraEnabled: true,
    });
    expect(d).toEqual({
      provider: "fincra",
      quoteCurrency: "NGN",
      fincraSkippedMissingNgn: false,
    });
  });

  it("falls back to the default provider when NGN prices are missing", () => {
    const d = resolveCheckoutProviderDecision({
      nationalityCode: "ng",
      hasStoredNgnPriceForEveryMember: false,
      displayCurrency: "AED",
      selectedCurrency: "NGN",
      defaultProvider: "paddle",
      fincraEnabled: true,
    });
    expect(d).toEqual({
      provider: "paddle",
      quoteCurrency: "AED",
      fincraSkippedMissingNgn: true,
    });
  });

  it("keeps the default provider for non-NG nationality even when Fincra is on", () => {
    const d = resolveCheckoutProviderDecision({
      nationalityCode: "IN",
      hasStoredNgnPriceForEveryMember: true,
      displayCurrency: "USD",
      selectedCurrency: "NGN",
      defaultProvider: "ziina",
      fincraEnabled: true,
    });
    expect(d.provider).toBe("ziina");
    expect(d.quoteCurrency).toBe("USD");
    expect(d.fincraSkippedMissingNgn).toBe(false);
  });

  it("does not offer Fincra when the flag is off", () => {
    const d = resolveCheckoutProviderDecision({
      nationalityCode: "NG",
      hasStoredNgnPriceForEveryMember: true,
      displayCurrency: "USD",
      selectedCurrency: "NGN",
      defaultProvider: "ziina",
      fincraEnabled: false,
    });
    expect(d.provider).toBe("ziina");
    expect(d.quoteCurrency).toBe("USD");
  });

  it("keeps Paddle/Ziina when a Nigerian applicant selected a global currency", () => {
    const d = resolveCheckoutProviderDecision({
      nationalityCode: "NG",
      hasStoredNgnPriceForEveryMember: true,
      displayCurrency: "USD",
      selectedCurrency: "USD",
      defaultProvider: "paddle",
      fincraEnabled: true,
    });
    expect(d).toEqual({
      provider: "paddle",
      quoteCurrency: "USD",
      fincraSkippedMissingNgn: false,
    });
  });
});

describe("decideCheckoutProviderFromContext", () => {
  const ngVisible = [
    { code: "USD", kind: "global" as const },
    { code: "AED", kind: "global" as const },
    { code: "NGN", kind: "local" as const },
  ];

  it("selects Fincra when NGN is allowed and stored", () => {
    const r = decideCheckoutProviderFromContext({
      nationalityCode: "NG",
      selectedCurrency: "NGN",
      visible: ngVisible,
      hasStoredPriceForSelected: true,
      defaultProvider: "paddle",
      fincraEnabled: true,
    });
    expect(r).toEqual({
      ok: true,
      decision: { provider: "fincra", quoteCurrency: "NGN", fincraSkippedMissingNgn: false },
    });
  });

  it("rejects NGN for a nationality that cannot see it", () => {
    const r = decideCheckoutProviderFromContext({
      nationalityCode: "US",
      selectedCurrency: "NGN",
      visible: [
        { code: "USD", kind: "global" },
        { code: "AED", kind: "global" },
      ],
      hasStoredPriceForSelected: true,
      defaultProvider: "paddle",
      fincraEnabled: true,
    });
    expect(r).toEqual({ ok: false, reason: "not_visible" });
  });

  it("rejects a local currency without a stored price", () => {
    const r = decideCheckoutProviderFromContext({
      nationalityCode: "NG",
      selectedCurrency: "NGN",
      visible: ngVisible,
      hasStoredPriceForSelected: false,
      defaultProvider: "paddle",
      fincraEnabled: true,
    });
    expect(r).toEqual({ ok: false, reason: "missing_stored_price" });
  });
});

describe("Fincra env helpers", () => {
  it("defaults FINCRA_ENABLED to off", () => {
    const prev = process.env.FINCRA_ENABLED;
    delete process.env.FINCRA_ENABLED;
    expect(isFincraEnabled()).toBe(false);
    process.env.FINCRA_ENABLED = "true";
    expect(isFincraEnabled()).toBe(true);
    process.env.FINCRA_ENABLED = "false";
    expect(isFincraEnabled()).toBe(false);
    if (prev === undefined) delete process.env.FINCRA_ENABLED;
    else process.env.FINCRA_ENABLED = prev;
  });

  it("defaults fee bearer to business (VisaTop)", () => {
    expect(parseFincraFeeBearer(undefined)).toBe("business");
    expect(parseFincraFeeBearer("customer")).toBe("customer");
  });
});
