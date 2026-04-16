import { describe, expect, it } from "vitest";
import { APPLICATION_STATUS, FULFILLMENT_STATUS, PAYMENT_STATUS } from "./status";

describe("application status constants", () => {
  it("exports stable draft lifecycle defaults", () => {
    expect(APPLICATION_STATUS.DRAFT).toBe("draft");
    expect(PAYMENT_STATUS.UNPAID).toBe("unpaid");
    expect(FULFILLMENT_STATUS.NOT_STARTED).toBe("not_started");
  });
});
