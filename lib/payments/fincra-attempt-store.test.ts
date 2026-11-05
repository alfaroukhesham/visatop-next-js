import { describe, expect, it } from "vitest";
import { listFincraMerchantReferencesForPayment } from "./fincra-attempt-store";

describe("listFincraMerchantReferencesForPayment", () => {
  it("includes the current operation id, stored prior refs, and the payment id", () => {
    expect(
      listFincraMerchantReferencesForPayment(
        { id: "pay_1", providerOperationId: "pay_1-a3" },
        ["pay_1-a1", "pay_1-a2", "pay_1-a3"],
      ),
    ).toEqual(["pay_1-a3", "pay_1-a1", "pay_1-a2", "pay_1"]);
  });

  it("falls back to the payment id when no attempts are stored yet", () => {
    expect(listFincraMerchantReferencesForPayment({ id: "pay_1" })).toEqual(["pay_1"]);
  });
});
