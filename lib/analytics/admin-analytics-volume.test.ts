import { describe, expect, it } from "vitest";
import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import {
  abandonedPaymentStatusSqlValue,
  paidApplicationIdsForCheckoutPayments,
  paidKpiApplicationIds,
  uniquePaidApplicationCount,
} from "@/lib/analytics/admin-analytics-volume";

describe("uniquePaidApplicationCount", () => {
  it("counts each paid traveller, not checkout payment rows", () => {
    expect(
      uniquePaidApplicationCount([
        { eventName: APPLY_FUNNEL_EVENTS.paymentSucceeded, applicationId: "a1" },
        { eventName: APPLY_FUNNEL_EVENTS.paymentSucceeded, applicationId: "a2" },
        { eventName: APPLY_FUNNEL_EVENTS.paymentSucceeded, applicationId: "a3" },
      ]),
    ).toBe(3);
  });

  it("ignores rows without an application id", () => {
    expect(
      uniquePaidApplicationCount([
        { eventName: APPLY_FUNNEL_EVENTS.paymentSucceeded, applicationId: null },
        { eventName: APPLY_FUNNEL_EVENTS.visaSelected, applicationId: "a1" },
      ]),
    ).toBe(0);
  });
});

describe("paidApplicationIdsForCheckoutPayments", () => {
  it("counts party members from a checkout payment even with no funnel events", () => {
    const ids = paidApplicationIdsForCheckoutPayments(
      [
        { id: "primary", partyId: "party-1", paymentStatus: "paid" },
        { id: "child-a", partyId: "party-1", paymentStatus: "paid" },
        { id: "child-b", partyId: "party-1", paymentStatus: "paid" },
      ],
      [{ applicationId: "primary" }],
    );
    expect(ids).toHaveLength(3);
  });

  it("still counts a solo paid application with no party", () => {
    expect(
      paidApplicationIdsForCheckoutPayments(
        [{ id: "solo", partyId: null, paymentStatus: "paid" }],
        [{ applicationId: "solo" }],
      ),
    ).toEqual(["solo"]);
  });

  it("does not invent paid volume from funnel-less unpaid drafts", () => {
    expect(
      paidApplicationIdsForCheckoutPayments(
        [{ id: "draft", partyId: null, paymentStatus: "unpaid" }],
        [],
      ),
    ).toEqual([]);
  });
});

describe("paidKpiApplicationIds", () => {
  it("counts a historical paid application with no payment_succeeded event", () => {
    expect(
      paidKpiApplicationIds({
        checkoutPaidIds: ["legacy-paid"],
        paymentSucceededApplicationIds: [],
      }),
    ).toEqual(["legacy-paid"]);
  });

  it("counts payment_succeeded when the application row is not yet paid", () => {
    expect(
      paidKpiApplicationIds({
        checkoutPaidIds: [],
        paymentSucceededApplicationIds: ["funnel-paid"],
      }),
    ).toEqual(["funnel-paid"]);
  });

  it("does not double-count the same application from both sources", () => {
    expect(
      paidKpiApplicationIds({
        checkoutPaidIds: ["a1"],
        paymentSucceededApplicationIds: ["a1", null],
      }),
    ).toEqual(["a1"]);
  });
});

describe("abandonedPaymentStatusSqlValue", () => {
  it("treats checkout_created as abandoned and paid as not abandoned", () => {
    expect(abandonedPaymentStatusSqlValue("unpaid")).toBe(true);
    expect(abandonedPaymentStatusSqlValue("checkout_created")).toBe(true);
    expect(abandonedPaymentStatusSqlValue("failed")).toBe(true);
    expect(abandonedPaymentStatusSqlValue("paid")).toBe(false);
  });
});
