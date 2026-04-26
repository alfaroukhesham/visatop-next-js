import { describe, expect, it } from "vitest";
import { computeClientApplicationTracking } from "./user-facing-tracking";

describe("computeClientApplicationTracking", () => {
  it("maps draft unpaid to continue-your-application", () => {
    const t = computeClientApplicationTracking({
      applicationStatus: "draft",
      paymentStatus: "unpaid",
      fulfillmentStatus: "not_started",
      adminAttentionRequired: false,
    });
    expect(t.headline).toBe("Continue your application");
    expect(t.steps[0].state).toBe("current");
    expect(t.steps[1].state).toBe("upcoming");
  });

  it("maps checkout_created to confirming headline", () => {
    const t = computeClientApplicationTracking({
      applicationStatus: "ready_for_payment",
      paymentStatus: "checkout_created",
      fulfillmentStatus: "not_started",
      adminAttentionRequired: false,
    });
    expect(t.headline).toBe("Confirming payment");
    expect(t.steps[1].label).toBe("Confirm payment");
    expect(t.steps[1].state).toBe("current");
  });

  it("maps paid in progress without automation jargon", () => {
    const t = computeClientApplicationTracking({
      applicationStatus: "in_progress",
      paymentStatus: "paid",
      fulfillmentStatus: "automation_running",
      adminAttentionRequired: false,
    });
    expect(t.headline).toBe("We're working on your application");
    expect(t.detail).not.toMatch(/automation/i);
    expect(t.steps[2].state).toBe("current");
  });

  it("mentions team follow-up when adminAttentionRequired", () => {
    const t = computeClientApplicationTracking({
      applicationStatus: "in_progress",
      paymentStatus: "paid",
      fulfillmentStatus: "manual_in_progress",
      adminAttentionRequired: true,
    });
    expect(t.detail).toMatch(/team may reach out/i);
  });
});
