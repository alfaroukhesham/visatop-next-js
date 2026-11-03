import { describe, expect, it } from "vitest";
import { abandonZiinaCheckoutLock } from "./ziina-checkout-lock";

describe("abandonZiinaCheckoutLock", () => {
  it("releases the application lock, marks the payment failed, and writes an audit row", async () => {
    const updates: Array<{ set: Record<string, unknown> }> = [];
    const inserts: Array<{ values: Record<string, unknown> }> = [];
    const tx = {
      update: () => ({
        set: (set: Record<string, unknown>) => {
          updates.push({ set });
          return { where: async () => undefined };
        },
      }),
      insert: () => ({
        values: async (values: Record<string, unknown>) => {
          inserts.push({ values });
        },
      }),
    };

    await abandonZiinaCheckoutLock(tx as never, {
      memberIds: ["app_1"],
      paymentId: "pay_1",
      reason: "below_minimum",
      failureCode: "below_minimum",
      failureMessage: "Amount is below Ziina's 2 AED minimum",
      requestId: "req_1",
    });

    expect(updates.some((u) => u.set.checkoutState === "none" && u.set.paymentStatus === "unpaid")).toBe(
      true,
    );
    expect(updates.some((u) => u.set.status === "failed" && u.set.failureCode === "below_minimum")).toBe(
      true,
    );
    expect(inserts[0]?.values).toMatchObject({
      action: "payment_ziina_checkout_abandoned",
      entityId: "pay_1",
    });
    expect(String(inserts[0]?.values.afterJson)).toContain("below_minimum");
    expect(String(inserts[0]?.values.afterJson)).not.toMatch(/sk_|secret/i);
  });
});
