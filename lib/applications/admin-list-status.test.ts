import { describe, expect, it } from "vitest";
import {
  formatAdminListStatus,
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
  it("keeps paid even if an older checkout_created payment exists", () => {
    expect(
      resolveAdminListPaymentStatus({
        applicationPaymentStatus: "paid",
        latestPaymentStatus: "checkout_created",
      }),
    ).toBe("paid");
  });

  it("surfaces unpaid Fincra checkouts as checkout_created from the payment row", () => {
    expect(
      resolveAdminListPaymentStatus({
        applicationPaymentStatus: "unpaid",
        latestPaymentStatus: "checkout_created",
      }),
    ).toBe("checkout_created");
  });

  it("uses the application payment status when no open checkout exists", () => {
    expect(
      resolveAdminListPaymentStatus({
        applicationPaymentStatus: "unpaid",
        latestPaymentStatus: "failed",
      }),
    ).toBe("unpaid");
    expect(
      resolveAdminListPaymentStatus({
        applicationPaymentStatus: "unpaid",
        latestPaymentStatus: null,
      }),
    ).toBe("unpaid");
  });

  it("keeps checkout_created when both rows already agree", () => {
    expect(
      resolveAdminListPaymentStatus({
        applicationPaymentStatus: "checkout_created",
        latestPaymentStatus: "checkout_created",
      }),
    ).toBe("checkout_created");
  });
});
