import { describe, expect, it } from "vitest";
import { editTripReturnHrefs } from "@/lib/apply/edit-trip-return";

describe("editTripReturnHrefs", () => {
  it("returns to Pay from Pay, and Previous goes to the step before it", () => {
    const hrefs = editTripReturnHrefs({
      applicationId: "app-1",
      fromPayment: true,
      locked: false,
      extrasOffered: true,
    });
    expect(hrefs.backHref).toBe("/apply/applications/app-1/payment");
    expect(hrefs.previousHref).toBe("/apply/applications/app-1/extras");
    expect(hrefs.previousHref).not.toBe(hrefs.backHref);
  });

  it("returns to Extras when the trip was not opened from Pay", () => {
    const hrefs = editTripReturnHrefs({
      applicationId: "app-1",
      fromPayment: false,
      locked: false,
      extrasOffered: true,
    });
    expect(hrefs.backHref).toBe("/apply/applications/app-1/extras");
    expect(hrefs.previousHref).toBe("/apply/applications/app-1");
  });
});
