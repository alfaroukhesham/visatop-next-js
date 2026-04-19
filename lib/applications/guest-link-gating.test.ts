import { describe, expect, it } from "vitest";
import { canMintGuestLinkIntent, guestLinkMatrixAllowsLink } from "./guest-link-gating";

describe("guest-link-gating", () => {
  it("denies prepare when not paid", () => {
    expect(
      canMintGuestLinkIntent({
        paymentStatus: "unpaid",
        applicationStatus: "draft",
        userId: null,
        isGuest: true,
      }).ok,
    ).toBe(false);
  });

  it("denies prepare when isGuest is false", () => {
    expect(
      canMintGuestLinkIntent({
        paymentStatus: "paid",
        applicationStatus: "needs_review",
        userId: null,
        isGuest: false,
      }).ok,
    ).toBe(false);
  });

  it("allows prepare when paid guest unclaimed", () => {
    expect(
      canMintGuestLinkIntent({
        paymentStatus: "paid",
        applicationStatus: "needs_review",
        userId: null,
        isGuest: true,
      }).ok,
    ).toBe(true);
  });

  it("matrix denies refund_pending", () => {
    expect(
      guestLinkMatrixAllowsLink({
        paymentStatus: "refund_pending",
        applicationStatus: "needs_review",
        userId: null,
      }).ok,
    ).toBe(false);
  });

  it("matrix denies unpaid (link path must not pass without paid)", () => {
    expect(
      guestLinkMatrixAllowsLink({
        paymentStatus: "unpaid",
        applicationStatus: "needs_review",
        userId: null,
      }).ok,
    ).toBe(false);
  });

  it("matrix denies checkout_created", () => {
    expect(
      guestLinkMatrixAllowsLink({
        paymentStatus: "checkout_created",
        applicationStatus: "needs_review",
        userId: null,
      }).ok,
    ).toBe(false);
  });

  it("matrix denies cancelled", () => {
    expect(
      guestLinkMatrixAllowsLink({
        paymentStatus: "paid",
        applicationStatus: "cancelled",
        userId: null,
      }).ok,
    ).toBe(false);
  });

  it("matrix allows paid + admin_attention_required on unclaimed row", () => {
    expect(
      guestLinkMatrixAllowsLink({
        paymentStatus: "paid",
        applicationStatus: "needs_review",
        userId: null,
        adminAttentionRequired: true,
      }).ok,
    ).toBe(true);
  });

  it("matrix rejects non-null userId (caller must handle D3 before matrix)", () => {
    expect(
      guestLinkMatrixAllowsLink({
        paymentStatus: "paid",
        applicationStatus: "needs_review",
        userId: "user-1",
      }).ok,
    ).toBe(false);
  });
});
