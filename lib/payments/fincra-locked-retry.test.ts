import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeTx, payRow } = vi.hoisted(() => {
  const payRow = {
    id: "pay_1",
    applicationId: "app_1",
    provider: "fincra",
    status: "checkout_created",
    amount: BigInt(1_000_000),
    currency: "NGN",
    providerOperationId: "pay_1-a1",
    providerCheckoutId: null,
    createdAt: new Date("2026-11-05T10:00:00.000Z"),
  };
  const fakeTx = {
    update: () => ({
      set: (set: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => [{ ...payRow, ...set }],
          then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve([])),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({ onConflictDoNothing: async () => undefined }),
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
  return { fakeTx, payRow };
});

vi.mock("@/lib/db/actor-context", () => ({
  withSystemDbActor: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(fakeTx)),
}));

vi.mock("@/lib/payments/fincra-attempt-store", () => ({
  listStoredFincraAttemptReferences: vi.fn(async () => ["pay_1-a1"]),
  listFincraMerchantReferencesForPayment: vi.fn(() => ["pay_1-a1"]),
  recordFincraAttemptReference: vi.fn(async () => undefined),
}));

vi.mock("@/lib/payments/fincra-attempt-verify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./fincra-attempt-verify")>();
  return {
    ...actual,
    verifyFincraMerchantReferences: vi.fn(),
  };
});

vi.mock("@/lib/payments/process-fincra-payment", () => ({
  processFincraVerifiedPaymentInTransaction: vi.fn(),
}));

vi.mock("@/lib/payments/meta-capi", () => ({
  persistMetaCapiAttribution: vi.fn(async () => undefined),
}));

vi.mock("@/lib/payments/fincra-payment-side-effects", () => ({
  scheduleFincraPaidSideEffects: vi.fn(),
}));

vi.mock("@/lib/email/resolve-applicant-email", () => ({
  resolveApplicantEmailTx: async () => "ada@mail.com",
}));

vi.mock("@/lib/payments/resolve-payment-provider", () => ({
  getFincraServerConfig: () => ({ publicKey: "pk_test", feeBearer: "business" }),
}));

import { verifyFincraMerchantReferences } from "@/lib/payments/fincra-attempt-verify";
import { processFincraVerifiedPaymentInTransaction } from "@/lib/payments/process-fincra-payment";
import { completeFincraLockedCheckoutRetry } from "@/lib/payments/fincra-checkout-session";
import type { FincraVerifiedPayment } from "@/lib/payments/fincra-client";

const verified = (status: string): FincraVerifiedPayment => ({
  id: "1",
  status,
  currency: "NGN",
  amountMinor: BigInt(1_000_000),
  amountReceivedMinor: BigInt(1_000_000),
  amountExpectedMinor: BigInt(1_000_000),
  amountToSettleMinor: BigInt(999_699),
  varianceType: null,
  message: null,
  merchantReference: "pay_1-a1",
  reference: "fcr-p-abc",
  feeMinor: BigInt(301),
  raw: {},
});

describe("completeFincraLockedCheckoutRetry", () => {
  beforeEach(() => {
    vi.mocked(verifyFincraMerchantReferences).mockReset();
    vi.mocked(processFincraVerifiedPaymentInTransaction).mockReset();
  });

  it("processes a paid prior reference instead of minting a new checkout", async () => {
    vi.mocked(verifyFincraMerchantReferences).mockResolvedValue([
      {
        merchantReference: "pay_1-a1",
        kind: "verified",
        verified: verified("success"),
        decision: {
          kind: "paid",
          amountReceivedMinor: BigInt(1_000_000),
          varianceType: "exact",
          feeMinor: BigInt(301),
        },
      },
    ]);
    vi.mocked(processFincraVerifiedPaymentInTransaction).mockResolvedValue({
      outcome: "applied",
      firstPaidApplicationId: "app_1",
      paymentId: "pay_1",
    });

    const result = await completeFincraLockedCheckoutRetry({
      retry: { kind: "fincra_locked_retry", action: "rotate", payRow: payRow as never, memberIds: ["app_1"] },
      requestId: "req_1",
      capiAttribution: {},
    });
    expect(result.kind).toBe("response");
    if (result.kind !== "response") return;
    const body = await result.response.json();
    expect(body.data).toEqual({ provider: "fincra", mode: "paid" });
    expect(processFincraVerifiedPaymentInTransaction).toHaveBeenCalledTimes(1);
  });

  it("rotates to a new reference when the current attempt is still pending", async () => {
    vi.mocked(verifyFincraMerchantReferences).mockResolvedValue([
      {
        merchantReference: "pay_1-a1",
        kind: "verified",
        verified: verified("pending"),
        decision: { kind: "pending", reason: "status:pending" },
      },
    ]);

    const result = await completeFincraLockedCheckoutRetry({
      retry: { kind: "fincra_locked_retry", action: "rotate", payRow: payRow as never, memberIds: ["app_1"] },
      requestId: "req_1",
      capiAttribution: {},
    });
    expect(result.kind).toBe("response");
    if (result.kind !== "response") return;
    const body = await result.response.json();
    expect(body.data.reference).toBe("pay_1-a2");
    expect(processFincraVerifiedPaymentInTransaction).not.toHaveBeenCalled();
  });
});
