import { describe, expect, it } from "vitest";
import { APPLICATION_STATUSES, FULFILLMENT_STATUSES, PAYMENT_STATUSES } from "./status";

describe("application status constants", () => {
  it("exports stable draft lifecycle defaults", () => {
    expect(APPLICATION_STATUSES.includes("draft")).toBe(true);
    expect(APPLICATION_STATUSES.includes("rejection_by_uae_authorities")).toBe(true);
    expect(PAYMENT_STATUSES.includes("unpaid")).toBe(true);
    expect(FULFILLMENT_STATUSES.includes("not_started")).toBe(true);
  });
});
