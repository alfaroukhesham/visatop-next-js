import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/payments/resolve-payment-provider", () => ({
  getFincraServerConfig: () => ({
    publicKey: "pk_test",
    feeBearer: "business",
  }),
}));

vi.mock("@/lib/email/resolve-applicant-email", () => ({
  resolveApplicantEmailTx: async () => "ada@mail.com",
}));

import { rotateOpenFincraInlineAttempt } from "./fincra-checkout-session";

const payRow = {
  id: "pay_1",
  applicationId: "app_1",
  provider: "fincra",
  status: "checkout_created",
  amount: BigInt(1_000_000),
  currency: "NGN",
  providerOperationId: "pay_1-a1",
  providerCheckoutId: null,
};

const makeTx = (opts?: { paymentUpdated?: boolean }) => {
  const paymentSets: Array<Record<string, unknown>> = [];
  const inserts: Array<Record<string, unknown>> = [];
  const tx = {
    update: () => ({
      set: (set: Record<string, unknown>) => {
        if ("providerOperationId" in set) paymentSets.push(set);
        return {
          where: () => ({
            returning: async () => (opts?.paymentUpdated === false ? [] : [{ ...payRow, ...set }]),
            then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve([])),
          }),
        };
      },
    }),
    insert: () => ({
      values: async (values: Record<string, unknown>) => {
        inserts.push(values);
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: "app_1",
              serviceId: "svc",
              isGuest: true,
              partyId: null,
              userId: null,
              fullName: "Ada",
              phone: null,
            },
          ],
        }),
      }),
    }),
  };
  return { tx: tx as never, paymentSets, inserts };
};

describe("rotateOpenFincraInlineAttempt", () => {
  it("issues the next attempt on the same row without changing amount, currency, or status", async () => {
    const { tx, paymentSets, inserts } = makeTx();
    const result = await rotateOpenFincraInlineAttempt(tx, {
      payRow: payRow as never,
      memberIds: ["app_1"],
      requestId: "req_1",
    });
    expect(result?.reference).toBe("pay_1-a2");
    expect(result?.currency).toBe("NGN");
    expect(paymentSets).toEqual([{ providerOperationId: "pay_1-a2" }]);
    expect(inserts[0]).toMatchObject({
      action: "payment_fincra_attempt_rotated",
      entityId: "pay_1",
    });
    expect(String(inserts[0]?.afterJson)).toContain("pay_1-a1");
    expect(String(inserts[0]?.afterJson)).toContain("1000000");
  });

  it("does not rotate a row that is no longer checkout_created", async () => {
    const { tx, inserts } = makeTx({ paymentUpdated: false });
    const result = await rotateOpenFincraInlineAttempt(tx, {
      payRow: payRow as never,
      memberIds: ["app_1"],
      requestId: "req_1",
    });
    expect(result).toBeNull();
    expect(inserts).toHaveLength(0);
  });
});
