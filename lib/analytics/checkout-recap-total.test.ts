import { afterEach, describe, expect, it } from "vitest";
import {
  checkoutRecapTotalFor,
  rememberCheckoutRecapTotal,
  resetCheckoutRecapTotal,
} from "@/lib/analytics/checkout-recap-total";

afterEach(() => {
  resetCheckoutRecapTotal();
});

describe("rememberCheckoutRecapTotal", () => {
  it("stores the recap total for the paying application", () => {
    rememberCheckoutRecapTotal({
      applicationId: "app_1",
      value: 169,
      currency: "aed",
      nationality: "in",
      serviceId: "svc_1",
    });
    expect(checkoutRecapTotalFor("app_1")).toEqual({
      applicationId: "app_1",
      value: 169,
      currency: "AED",
      nationality: "IN",
      serviceId: "svc_1",
    });
    expect(checkoutRecapTotalFor("app_other")).toBeNull();
  });
});
