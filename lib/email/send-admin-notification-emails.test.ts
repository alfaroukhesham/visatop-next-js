import { describe, expect, it } from "vitest";
import {
  adminApplicantLabel,
  buildAdminPaymentCompletedBodies,
  buildAdminStep2ServiceSelectedBodies,
} from "./send-admin-notification-emails";
import { ADMIN_NOTIFICATION_EMAIL } from "./admin-notification-constants";

describe("admin notification email bodies", () => {
  it("uses email as applicant label when full name is missing", () => {
    expect(adminApplicantLabel({ fullName: null, guestEmail: "guest@example.com" }, null)).toBe(
      "guest@example.com",
    );
  });

  it("builds step 2 admin notification with branded HTML", () => {
    const { subject, text, html } = buildAdminStep2ServiceSelectedBodies({
      applicantLabel: "guest@example.com",
      contactEmail: "guest@example.com",
      serviceName: "UAE 30-day tourist visa",
      nationalityCode: "US",
      applicationRef: "VT-ABC123",
    });
    expect(subject).toMatch(/New application/);
    expect(text).toContain("guest@example.com");
    expect(text).toContain("UAE 30-day tourist visa");
    expect(html).toContain("visatop-logo.png");
    expect(html).toContain("Step 2 completed");
    expect(html).toContain("VT-ABC123");
  });

  it("builds payment admin notification with branded HTML", () => {
    const { subject, text, html } = buildAdminPaymentCompletedBodies({
      contactEmail: "payer@example.com",
      serviceName: "UAE 30-day tourist visa",
      applicationRef: "VT-ABC123",
    });
    expect(subject).toMatch(/Payment received/);
    expect(text).toContain("payer@example.com");
    expect(html).toContain("visatop-logo.png");
    expect(html).toContain("Payment completed");
  });

  it("uses static admin inbox constant", () => {
    expect(ADMIN_NOTIFICATION_EMAIL).toBe("info@visatop.com");
  });
});
