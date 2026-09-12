import { describe, expect, it } from "vitest";
import { findOpenZiinaPaymentForApplication } from "./ziina-checkout-session";

const thenableSelect = (result: unknown[]) => {
  const p = Promise.resolve(result);
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: p.then.bind(p),
  };
  return chain;
};

describe("findOpenZiinaPaymentForApplication", () => {
  it("returns the party primary checkout when the requested app is a secondary traveller", async () => {
    const responses = [
      [{ id: "secondary", partyId: "party_1", paymentStatus: "unpaid" }],
      [{ id: "primary" }, { id: "secondary" }],
      [{ id: "pay_1", applicationId: "primary", provider: "ziina", status: "checkout_created" }],
    ];
    let i = 0;
    const tx = {
      select: () => thenableSelect(responses[i++] ?? []),
    };

    const row = await findOpenZiinaPaymentForApplication(tx as never, "secondary");
    expect(row?.id).toBe("pay_1");
    expect(row?.applicationId).toBe("primary");
  });

  it("returns null when the application does not exist", async () => {
    const tx = {
      select: () => thenableSelect([]),
    };

    const row = await findOpenZiinaPaymentForApplication(tx as never, "missing");
    expect(row).toBeNull();
  });
});
