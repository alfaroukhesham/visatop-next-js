import { describe, expect, it } from "vitest";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_WHATSAPP_URL } from "@/lib/support-contact";
import { buildCheckoutRecoveryEmailBodies } from "./build-bodies";

const input = {
  locale: "en",
  fullName: "Sara Ahmed",
  visaName: "30-day tourist visa",
  reference: "VT-123",
  amountLine: "$149.00",
  provider: "ziina",
  ctaUrl: "https://visatop.com/visa-processing/apply/applications/app-1/payment",
};

describe("buildCheckoutRecoveryEmailBodies", () => {
  it("uses the approved English copy, existing shell, and WhatsApp helper", () => {
    const bodies = buildCheckoutRecoveryEmailBodies(input);
    expect(bodies.subject).toContain("Your 30-day tourist visa application is one step from done");
    expect(bodies.ctaLabel).toBe("Complete payment");
    expect(bodies.text).toContain("Hello Sara, your application VT-123 is complete, and only the payment of $149.00 is left.");
    expect(bodies.text).toContain("Once it's paid, we start right away.");
    expect(bodies.text).toContain("Processing usually takes 2 to 3 working days, subject to authority approvals.");
    expect(bodies.text).toContain("Payments are processed securely by Ziina.");
    expect(bodies.text).toContain("Trouble paying? Message us on WhatsApp and a real person will help.");
    expect(bodies.text).toContain(SUPPORT_PHONE_DISPLAY);
    expect(bodies.text).toContain(SUPPORT_WHATSAPP_URL);
    expect(bodies.html).toContain("visatop-logo.png");
    expect(bodies.html).toContain(input.ctaUrl);
    expect(bodies.html).toContain("Complete payment");
    expect(bodies.html).toContain(SUPPORT_WHATSAPP_URL);
    expect(bodies.html).not.toContain("Unsubscribe");
    expect(bodies.html).not.toContain("dir=\"rtl\"");
  });

  it("falls back to Hello, when there is no first name", () => {
    const bodies = buildCheckoutRecoveryEmailBodies({ ...input, fullName: null });
    expect(bodies.text).toContain("Hello, your application VT-123 is complete");
  });

  it("keeps Arabic checkout copy", () => {
    const bodies = buildCheckoutRecoveryEmailBodies({ ...input, locale: "ar" });
    expect(bodies.subject).toContain("طلبك لـ 30-day tourist visa على بُعد خطوة واحدة من الإتمام");
    expect(bodies.ctaLabel).toBe("إتمام الدفع");
    expect(bodies.text).toContain("مرحباً Sara،");
    expect(bodies.text).toContain("يومين إلى 3 أيام عمل");
  });

  it("keeps French checkout copy", () => {
    const bodies = buildCheckoutRecoveryEmailBodies({ ...input, locale: "fr" });
    expect(bodies.subject).toContain("Votre demande de 30-day tourist visa n'est plus qu'à une étape");
    expect(bodies.ctaLabel).toBe("Finaliser le paiement");
    expect(bodies.text).toContain("Bonjour Sara,");
  });
});
