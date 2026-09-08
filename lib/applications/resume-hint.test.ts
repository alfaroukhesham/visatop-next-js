import { describe, expect, it } from "vitest";
import { buildResumeHint } from "./resume-hint";

const now = new Date("2026-09-07T12:00:00.000Z");

const baseInput = {
  primaryApplicationId: "app-primary",
  partyId: "party-1" as string | null,
  paymentStatus: "unpaid",
  draftExpiresAt: new Date("2026-09-08T12:00:00.000Z"),
  nationalityName: "Nigeria",
  serviceName: "30 Days Single Entry",
  travelerCount: 2,
};

describe("buildResumeHint", () => {
  it("returns null when draftExpiresAt is in the past", () => {
    expect(
      buildResumeHint(
        {
          ...baseInput,
          draftExpiresAt: new Date("2026-09-06T12:00:00.000Z"),
        },
        now,
      ),
    ).toBeNull();
  });

  it("returns null when paymentStatus is paid", () => {
    expect(buildResumeHint({ ...baseInput, paymentStatus: "paid" }, now)).toBeNull();
  });

  it("returns null when paymentStatus is refund_pending", () => {
    expect(
      buildResumeHint({ ...baseInput, paymentStatus: "refund_pending" }, now),
    ).toBeNull();
  });

  it("returns hint for valid unpaid draft", () => {
    expect(buildResumeHint(baseInput, now)).toEqual({
      primaryApplicationId: "app-primary",
      partyId: "party-1",
      travelerCount: 2,
      nationalityName: "Nigeria",
      serviceName: "30 Days Single Entry",
      href: "/apply/applications/app-primary",
    });
  });

  it("returns hint for checkout_created", () => {
    expect(buildResumeHint({ ...baseInput, paymentStatus: "checkout_created" }, now)).toEqual({
      primaryApplicationId: "app-primary",
      partyId: "party-1",
      travelerCount: 2,
      nationalityName: "Nigeria",
      serviceName: "30 Days Single Entry",
      href: "/apply/applications/app-primary",
    });
  });

  it("allows null draftExpiresAt (not expired)", () => {
    expect(buildResumeHint({ ...baseInput, draftExpiresAt: null }, now)).toEqual({
      primaryApplicationId: "app-primary",
      partyId: "party-1",
      travelerCount: 2,
      nationalityName: "Nigeria",
      serviceName: "30 Days Single Entry",
      href: "/apply/applications/app-primary",
    });
  });

  it("supports legacy single-traveller with null partyId", () => {
    expect(
      buildResumeHint(
        {
          ...baseInput,
          partyId: null,
          travelerCount: 1,
        },
        now,
      ),
    ).toEqual({
      primaryApplicationId: "app-primary",
      partyId: null,
      travelerCount: 1,
      nationalityName: "Nigeria",
      serviceName: "30 Days Single Entry",
      href: "/apply/applications/app-primary",
    });
  });

  it("does not include PII fields", () => {
    const hint = buildResumeHint(baseInput, now);
    expect(hint).not.toBeNull();
    expect(Object.keys(hint!)).toEqual([
      "primaryApplicationId",
      "partyId",
      "travelerCount",
      "nationalityName",
      "serviceName",
      "href",
    ]);
  });
});
