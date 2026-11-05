import { describe, expect, it } from "vitest";
import {
  formatAdminListStatus,
  isAdminListCheckoutCreatedAttempt,
  resolveAdminListPaymentStatus,
} from "./admin-list-status";

describe("formatAdminListStatus", () => {
  it("renders snake_case as Title Case with spaces", () => {
    expect(formatAdminListStatus("checkout_created")).toBe("Checkout Created");
    expect(formatAdminListStatus("ready_for_payment")).toBe("Ready For Payment");
    expect(formatAdminListStatus("rejection_by_uae_authorities")).toBe(
      "Rejection By Uae Authorities",
    );
    expect(formatAdminListStatus("not_started")).toBe("Not Started");
  });

  it("leaves already-plain words unchanged besides casing", () => {
    expect(formatAdminListStatus("paid")).toBe("Paid");
    expect(formatAdminListStatus("draft")).toBe("Draft");
  });
});

describe("resolveAdminListPaymentStatus", () => {
  it("Ziina open: still checkout_created", () => {
    expect(
      resolveAdminListPaymentStatus({
        applicationPaymentStatus: "checkout_created",
        latestPaymentStatus: "checkout_created",
      }),
    ).toBe("checkout_created");
  });

  it("Fincra open: latest payment checkout_created overlays unpaid app", () => {
    expect(
      resolveAdminListPaymentStatus({
        applicationPaymentStatus: "unpaid",
        latestPaymentStatus: "checkout_created",
      }),
    ).toBe("checkout_created");
  });

  it("Fincra expired-abandoned: app unpaid, payment failed/expired → checkout_created", () => {
    expect(
      resolveAdminListPaymentStatus({
        applicationPaymentStatus: "unpaid",
        latestPaymentStatus: "failed",
        latestPaymentFailureCode: "expired",
      }),
    ).toBe("checkout_created");
  });

  it("no payment: Unpaid", () => {
    expect(
      resolveAdminListPaymentStatus({
        applicationPaymentStatus: "unpaid",
        latestPaymentStatus: null,
      }),
    ).toBe("unpaid");
  });

  it("paid stays paid even if an open checkout payment exists", () => {
    expect(
      resolveAdminListPaymentStatus({
        applicationPaymentStatus: "paid",
        latestPaymentStatus: "checkout_created",
      }),
    ).toBe("paid");
  });

  it("paid stays paid even if an older expired payment exists", () => {
    expect(
      resolveAdminListPaymentStatus({
        applicationPaymentStatus: "paid",
        latestPaymentStatus: "failed",
        latestPaymentFailureCode: "expired",
      }),
    ).toBe("paid");
  });

  it("keeps a distinguishable card decline as failed", () => {
    expect(
      resolveAdminListPaymentStatus({
        applicationPaymentStatus: "unpaid",
        latestPaymentStatus: "failed",
        latestPaymentFailureCode: "card_declined",
      }),
    ).toBe("failed");
  });

  it("treats a generic failed checkout attempt as checkout_created", () => {
    expect(
      resolveAdminListPaymentStatus({
        applicationPaymentStatus: "unpaid",
        latestPaymentStatus: "failed",
        latestPaymentFailureCode: "failed",
      }),
    ).toBe("checkout_created");
  });
});

describe("isAdminListCheckoutCreatedAttempt (Payment status filter)", () => {
  it("includes Ziina open, Fincra open, and Fincra expired-abandoned", () => {
    expect(
      isAdminListCheckoutCreatedAttempt({
        applicationPaymentStatus: "checkout_created",
        latestPaymentStatus: "checkout_created",
      }),
    ).toBe(true);
    expect(
      isAdminListCheckoutCreatedAttempt({
        applicationPaymentStatus: "unpaid",
        latestPaymentStatus: "checkout_created",
      }),
    ).toBe(true);
    expect(
      isAdminListCheckoutCreatedAttempt({
        applicationPaymentStatus: "unpaid",
        latestPaymentStatus: "failed",
        latestPaymentFailureCode: "expired",
      }),
    ).toBe(true);
  });

  it("excludes unpaid with no payment and paid applications", () => {
    expect(
      isAdminListCheckoutCreatedAttempt({
        applicationPaymentStatus: "unpaid",
        latestPaymentStatus: null,
      }),
    ).toBe(false);
    expect(
      isAdminListCheckoutCreatedAttempt({
        applicationPaymentStatus: "paid",
        latestPaymentStatus: "paid",
      }),
    ).toBe(false);
  });
});
