import { describe, expect, it } from "vitest";
import {
  reconcileFincraPaymentRowsSequentially,
  type ReconcileFincraAttemptResult,
  type ReconcileFincraPaymentRow,
} from "./reconcile-fincra-payments";

const row = (id: string): ReconcileFincraPaymentRow =>
  ({
    id,
    applicationId: `app_${id}`,
    provider: "fincra",
    status: "checkout_created",
    amount: BigInt(18500000),
    currency: "NGN",
    providerOperationId: `${id}-a1`,
    createdAt: new Date("2026-11-05T10:00:00.000Z"),
  }) as ReconcileFincraPaymentRow;

describe("reconcileFincraPaymentRowsSequentially", () => {
  it("continues after one row throws so a failure cannot roll back others", async () => {
    const calls: string[] = [];
    const attempts = await reconcileFincraPaymentRowsSequentially(
      [row("pay_1"), row("pay_2")],
      async (payRow) => {
        calls.push(payRow.id);
        if (payRow.id === "pay_1") throw new Error("verify exploded");
        return {
          paymentId: payRow.id,
          applicationId: payRow.applicationId,
          slot: "5m",
          fincraStatus: "success",
          outcome: "applied",
        } satisfies ReconcileFincraAttemptResult;
      },
    );
    expect(calls).toEqual(["pay_1", "pay_2"]);
    expect(attempts[0]?.outcome).toBe("error_unhandled");
    expect(attempts[0]?.error).toBe("verify exploded");
    expect(attempts[1]?.outcome).toBe("applied");
  });
});
