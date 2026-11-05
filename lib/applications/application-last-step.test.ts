import { describe, expect, it } from "vitest";
import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import { ADMIN_FUNNEL_STEPS } from "@/lib/analytics/funnel-metrics";
import { lastApplicantStepLabel } from "@/lib/analytics/admin-analytics-applicants";
import {
  APPLY_STOP_LABELS,
  APPLY_STOP_SCREENS,
  formatAdminWhen,
  furthestAdminFunnelStep,
  isApplicantProfileStarted,
  resolveAnalyticsStopScreen,
  resolveApplicationLastStep,
} from "./application-last-step";

const NOW = new Date("2026-11-05T18:00:00.000Z");
const HOUR = 60 * 60 * 1000;

const at = (hoursAgo: number): Date => new Date(NOW.getTime() - hoursAgo * HOUR);

const baseInput = {
  applicationPaymentStatus: "unpaid",
  applicationCreatedAt: at(10),
  applicationUpdatedAt: at(10),
  now: NOW,
};

describe("APPLY_STOP_SCREENS / APPLY_STOP_LABELS", () => {
  it("keeps the analytics unpaid-stop vocabulary", () => {
    expect([...APPLY_STOP_SCREENS]).toEqual(["ready", "passport", "other", "details", "pay"]);
    expect(APPLY_STOP_LABELS.ready).toBe("What you'll need");
    expect(APPLY_STOP_LABELS.passport).toBe("Passport");
    expect(APPLY_STOP_LABELS.other).toBe("Other documents");
    expect(APPLY_STOP_LABELS.details).toBe("Check your details");
    expect(APPLY_STOP_LABELS.pay).toBe("Payment");
  });
});

describe("furthestAdminFunnelStep", () => {
  it("is the same furthest linear step lastApplicantStepLabel uses", () => {
    const names = ["application_started", "passport_uploaded", "visa_selected"];
    expect(furthestAdminFunnelStep(names)?.label).toBe(lastApplicantStepLabel(names));
    expect(furthestAdminFunnelStep(names)?.label).toBe("Passport uploaded");
    expect(furthestAdminFunnelStep(["apply_step_view"])).toBeNull();
    expect(lastApplicantStepLabel(["apply_step_view"])).toBe("N/A");
  });

  it("aliases legacy passport_uploaded onto the linear passport step", () => {
    const step = furthestAdminFunnelStep([APPLY_FUNNEL_EVENTS.passportUploaded]);
    expect(step?.eventName).toBe(APPLY_FUNNEL_EVENTS.passportUploadSucceeded);
    expect(ADMIN_FUNNEL_STEPS[step!.index]!.label).toBe("Passport uploaded");
  });
});

describe("resolveAnalyticsStopScreen", () => {
  it("matches abandonStopFromCursor for unpaid analytics stops", () => {
    expect(
      resolveAnalyticsStopScreen({
        cursorScreen: null,
        cursorTravellerId: null,
        lastTravellerId: "b",
      }),
    ).toBe("ready");
    expect(
      resolveAnalyticsStopScreen({
        cursorScreen: "ready",
        cursorTravellerId: null,
        lastTravellerId: "b",
      }),
    ).toBe("passport");
    expect(
      resolveAnalyticsStopScreen({
        cursorScreen: "details",
        cursorTravellerId: "a",
        lastTravellerId: "b",
      }),
    ).toBe("passport");
    expect(
      resolveAnalyticsStopScreen({
        cursorScreen: "details",
        cursorTravellerId: "b",
        lastTravellerId: "b",
      }),
    ).toBe("pay");
  });
});

describe("isApplicantProfileStarted", () => {
  it("is true when a name, passport number, or date of birth is present", () => {
    expect(isApplicantProfileStarted({ fullName: "Demo Traveller" })).toBe(true);
    expect(isApplicantProfileStarted({ passportNumber: "X123" })).toBe(true);
    expect(isApplicantProfileStarted({ dateOfBirth: "1990-01-01" })).toBe(true);
    expect(isApplicantProfileStarted({})).toBe(false);
  });
});

describe("formatAdminWhen", () => {
  it("pairs a relative phrase with the same absolute string CREATED uses", () => {
    const date = at(2);
    expect(formatAdminWhen(date, NOW)).toBe(`2 hours ago · ${date.toLocaleString()}`);
  });
});

describe("resolveApplicationLastStep", () => {
  it("treats a paid application as last step reached", () => {
    const paidAt = at(1);
    const result = resolveApplicationLastStep({
      ...baseInput,
      applicationPaymentStatus: "paid",
      applicationPaidAt: paidAt,
      applicationUpdatedAt: paidAt,
      latestPayment: {
        status: "paid",
        provider: "ziina",
        createdAt: at(2),
        updatedAt: paidAt,
      },
    });
    expect(result.id).toBe("paid");
    expect(result.label).toBe("Paid");
    expect(result.fieldLabel).toBe("Last step reached");
    expect(result.reachedAt).toEqual(paidAt);
    expect(result.displayValue).toBe("Paid");
  });

  it("keeps refunded/refund_pending on Paid (they already settled)", () => {
    expect(
      resolveApplicationLastStep({
        ...baseInput,
        applicationPaymentStatus: "refunded",
        applicationPaidAt: at(3),
      }).id,
    ).toBe("paid");
    expect(
      resolveApplicationLastStep({
        ...baseInput,
        applicationPaymentStatus: "refund_pending",
        applicationPaidAt: at(3),
      }).fieldLabel,
    ).toBe("Last step reached");
  });

  it("uses resolveAdminListPaymentStatus for a card decline", () => {
    const updatedAt = at(0.5);
    const result = resolveApplicationLastStep({
      ...baseInput,
      latestPayment: {
        status: "failed",
        failureCode: "card_declined",
        provider: "fincra",
        createdAt: at(1),
        updatedAt,
      },
    });
    expect(result.id).toBe("payment_failed");
    expect(result.label).toBe("Payment failed");
    expect(result.fieldLabel).toBe("Stopped at");
    expect(result.provider).toBe("fincra");
    expect(result.displayValue).toBe("Payment failed · Fincra");
    expect(result.reachedAt).toEqual(updatedAt);
  });

  it("overlays checkout_created the same way the admin list does (open + expired-abandon)", () => {
    const createdAt = at(1);
    const open = resolveApplicationLastStep({
      ...baseInput,
      latestPayment: {
        status: "checkout_created",
        provider: "ziina",
        createdAt,
        updatedAt: createdAt,
      },
    });
    expect(open.id).toBe("checkout_started");
    expect(open.displayValue).toBe("Checkout started · Ziina");
    expect(open.reachedAt).toEqual(createdAt);
    expect(open.fieldLabel).toBe("Stopped at");

    const expired = resolveApplicationLastStep({
      ...baseInput,
      latestPayment: {
        status: "failed",
        failureCode: "expired",
        provider: "fincra",
        createdAt,
        updatedAt: at(0.25),
      },
    });
    expect(expired.id).toBe("checkout_started");
    expect(expired.displayValue).toBe("Checkout started · Fincra");
  });

  it("stops at What you'll need when the wizard cursor is empty", () => {
    const result = resolveApplicationLastStep({
      ...baseInput,
      wizardCursor: null,
      lastTravellerId: "a",
    });
    expect(result.id).toBe("docs_ready");
    expect(result.label).toBe("What you'll need");
    expect(result.fieldLabel).toBe("Stopped at");
    expect(result.reachedAt).toEqual(baseInput.applicationCreatedAt);
  });

  it("refines a passport stop into photo upload when the furthest-behind traveller has a passport only", () => {
    const passportAt = at(3);
    const result = resolveApplicationLastStep({
      ...baseInput,
      wizardCursor: { screen: "ready", travellerId: null },
      lastTravellerId: "a",
      partyUpdatedAt: at(4),
      travellers: [{ applicationId: "a", travelerIndex: 0, profileStarted: false }],
      documents: [
        {
          applicationId: "a",
          documentType: "passport_copy",
          status: "uploaded_temp",
          createdAt: passportAt,
        },
      ],
    });
    expect(result.id).toBe("photo_upload");
    expect(result.label).toBe("Photo upload");
    expect(result.reachedAt).toEqual(passportAt);
  });

  it("stays on passport upload when that traveller has no passport yet", () => {
    const result = resolveApplicationLastStep({
      ...baseInput,
      wizardCursor: { screen: "ready", travellerId: null },
      lastTravellerId: "a",
      partyUpdatedAt: at(2),
      travellers: [{ applicationId: "a", travelerIndex: 0, profileStarted: false }],
      documents: [],
    });
    expect(result.id).toBe("passport_upload");
    expect(result.label).toBe("Passport upload");
    expect(result.reachedAt).toEqual(at(2));
  });

  it("maps other / details / pay stops from the same cursor rule as analytics", () => {
    expect(
      resolveApplicationLastStep({
        ...baseInput,
        wizardCursor: { screen: "passport", travellerId: "a" },
        lastTravellerId: "a",
      }).id,
    ).toBe("supporting_documents");
    expect(
      resolveApplicationLastStep({
        ...baseInput,
        wizardCursor: { screen: "other", travellerId: "a" },
        lastTravellerId: "a",
        profileStarted: false,
      }).id,
    ).toBe("traveller_details");
    expect(
      resolveApplicationLastStep({
        ...baseInput,
        wizardCursor: { screen: "other", travellerId: "a" },
        lastTravellerId: "a",
        profileStarted: true,
      }).id,
    ).toBe("review");
    expect(
      resolveApplicationLastStep({
        ...baseInput,
        wizardCursor: { screen: "details", travellerId: "a" },
        lastTravellerId: "a",
      }).id,
    ).toBe("payment");
  });

  it("uses the furthest-behind incomplete traveller on a party, not the one who finished", () => {
    const result = resolveApplicationLastStep({
      ...baseInput,
      wizardCursor: { screen: "details", travellerId: "a" },
      lastTravellerId: "b",
      travellers: [
        { applicationId: "a", travelerIndex: 0, profileStarted: true },
        { applicationId: "b", travelerIndex: 1, profileStarted: false },
      ],
      documents: [
        {
          applicationId: "a",
          documentType: "passport_copy",
          status: "retained",
          createdAt: at(5),
        },
        {
          applicationId: "a",
          documentType: "personal_photo",
          status: "retained",
          createdAt: at(5),
        },
      ],
    });
    expect(result.id).toBe("passport_upload");
    expect(result.travellerId).toBe("b");
    expect(result.travellerIndex).toBe(1);
    expect(result.displayValue).toBe("Passport upload · Traveller 2");
  });

  it("falls back to the furthest funnel event when there is no wizard cursor (legacy)", () => {
    const occurredAt = at(6);
    const result = resolveApplicationLastStep({
      ...baseInput,
      wizardCursor: undefined,
      events: [
        { eventName: APPLY_FUNNEL_EVENTS.applicationStarted, occurredAt: at(9) },
        { eventName: APPLY_FUNNEL_EVENTS.visaSelected, occurredAt: at(8) },
        { eventName: APPLY_FUNNEL_EVENTS.docsReadyViewed, occurredAt },
      ],
    });
    expect(result.id).toBe("docs_ready");
    expect(result.label).toBe("What you'll need");
    expect(result.reachedAt).toEqual(occurredAt);
  });

  it("falls back to visa selected when an application exists with no cursor and no events", () => {
    const result = resolveApplicationLastStep({
      ...baseInput,
    });
    expect(result.id).toBe("service_selection");
    expect(result.label).toBe("Visa selected / created");
  });

  it("reports last activity as the newest known timestamp", () => {
    const result = resolveApplicationLastStep({
      ...baseInput,
      applicationUpdatedAt: at(1),
      partyUpdatedAt: at(2),
      latestPayment: {
        status: "checkout_created",
        provider: "ziina",
        createdAt: at(3),
        updatedAt: at(0.5),
      },
    });
    expect(result.lastActivityAt).toEqual(at(0.5));
    expect(result.whenDisplay).toContain("Last activity");
  });
});
