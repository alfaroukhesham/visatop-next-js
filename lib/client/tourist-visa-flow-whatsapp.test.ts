import { describe, expect, it } from "vitest";
import { matchTouristVisaFlowWhatsAppStep } from "./tourist-visa-flow-whatsapp";

describe("matchTouristVisaFlowWhatsAppStep", () => {
  it("maps nationality selection (home and /apply redirect)", () => {
    expect(matchTouristVisaFlowWhatsAppStep("/")).toBe("nationality");
    expect(matchTouristVisaFlowWhatsAppStep("/apply")).toBe("nationality");
    expect(matchTouristVisaFlowWhatsAppStep("/visa-processing")).toBe("nationality");
    expect(matchTouristVisaFlowWhatsAppStep("/visa-processing/")).toBe("nationality");
  });

  it("maps visa / service selection", () => {
    expect(matchTouristVisaFlowWhatsAppStep("/apply/start")).toBe("visa");
    expect(matchTouristVisaFlowWhatsAppStep("/apply/start?nationality=IN")).toBe("visa");
    expect(matchTouristVisaFlowWhatsAppStep("/visa-processing/apply/start")).toBe("visa");
  });

  it("maps documents / details and checkout / payment", () => {
    expect(matchTouristVisaFlowWhatsAppStep("/apply/applications/app_1")).toBe("documents");
    expect(matchTouristVisaFlowWhatsAppStep("/apply/applications/app_1/payment")).toBe("checkout");
    expect(matchTouristVisaFlowWhatsAppStep("/apply/applications/app_1/checkout/return")).toBe(
      "checkoutReturn",
    );
    expect(matchTouristVisaFlowWhatsAppStep("/apply/applications/app_1/checkout/cancel")).toBe(
      "checkoutReturn",
    );
    expect(matchTouristVisaFlowWhatsAppStep("/apply/applications/app_1/submitted")).toBe(
      "submitted",
    );
  });

  it("maps resume and post-signup link, but not track or other client pages", () => {
    expect(matchTouristVisaFlowWhatsAppStep("/apply/resume")).toBe("resume");
    expect(matchTouristVisaFlowWhatsAppStep("/apply/link-after-signup")).toBe("linkAfterSignup");
    expect(matchTouristVisaFlowWhatsAppStep("/apply/track")).toBeNull();
    expect(matchTouristVisaFlowWhatsAppStep("/portal")).toBeNull();
    expect(matchTouristVisaFlowWhatsAppStep("/sign-in")).toBeNull();
    expect(matchTouristVisaFlowWhatsAppStep("/speak-with-an-expert")).toBeNull();
  });
});
