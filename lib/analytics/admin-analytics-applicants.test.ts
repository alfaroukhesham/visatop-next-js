import { describe, expect, it } from "vitest";
import {
  applicantAmountPaidCell,
  applicantEmail,
  applicantPaidAmountMinor,
  applicantPaidCurrency,
  indexApplicantPayments,
  lastApplicantStepLabel,
  toApplicantExportRow,
} from "@/lib/analytics/admin-analytics-applicants";
import { applicantsToCsv } from "@/lib/analytics/admin-analytics-csv";

describe("lastApplicantStepLabel", () => {
  it("uses the furthest funnel step the applicant reached", () => {
    expect(
      lastApplicantStepLabel(["application_started", "passport_uploaded", "visa_selected"]),
    ).toBe("Passport uploaded");
  });

  it("returns N/A when there are no first-party funnel events", () => {
    expect(lastApplicantStepLabel([])).toBe("N/A");
  });

  it("returns N/A for extra-only events such as apply_step_view", () => {
    expect(lastApplicantStepLabel(["apply_step_view", "ocr_review_required"])).toBe("N/A");
  });
});

describe("applicantAmountPaidCell", () => {
  it("formats major units with currency, not minor units", () => {
    expect(applicantAmountPaidCell({ isPaid: true, amountMinor: BigInt(100), currency: "AED" })).toBe(
      "1.00 AED",
    );
  });

  it("is 0.00 in the application currency when unpaid", () => {
    expect(applicantAmountPaidCell({ isPaid: false, amountMinor: BigInt(19900), currency: "USD" })).toBe(
      "0.00 USD",
    );
  });
});

describe("applicantEmail", () => {
  it("skips whitespace-only guest email and uses the signed-in user email", () => {
    expect(
      applicantEmail({
        guestEmail: "   ",
        userEmail: "ada@example.com",
        partyGuestEmail: "party@example.com",
      }),
    ).toBe("ada@example.com");
  });

  it("falls back to party email, then empty", () => {
    expect(
      applicantEmail({
        guestEmail: null,
        userEmail: null,
        partyGuestEmail: "booker@example.com",
      }),
    ).toBe("booker@example.com");
    expect(
      applicantEmail({
        guestEmail: null,
        userEmail: null,
        partyGuestEmail: null,
      }),
    ).toBe("");
  });
});

describe("applicantPaidAmountMinor", () => {
  const indexed = indexApplicantPayments([
    {
      applicationId: "primary",
      partyId: "party-1",
      amountMinor: BigInt(19900),
      currency: "USD",
    },
  ]);

  it("attributes the party checkout total to each paid member", () => {
    expect(
      applicantPaidAmountMinor({
        isPaid: true,
        applicationId: "child",
        partyId: "party-1",
        indexed,
      }),
    ).toBe(BigInt(19900));
  });

  it("is zero for an unpaid party sibling", () => {
    expect(
      applicantPaidAmountMinor({
        isPaid: false,
        applicationId: "child",
        partyId: "party-1",
        indexed,
      }),
    ).toBe(BigInt(0));
  });

  it("sums a solo paid application", () => {
    expect(
      applicantPaidAmountMinor({
        isPaid: true,
        applicationId: "primary",
        partyId: null,
        indexed: indexApplicantPayments([
          {
            applicationId: "primary",
            partyId: null,
            amountMinor: BigInt(100),
            currency: "AED",
          },
        ]),
      }),
    ).toBe(BigInt(100));
  });
});

describe("applicantPaidCurrency", () => {
  it("keeps catalog currency when unpaid even if a sibling payment exists", () => {
    expect(
      applicantPaidCurrency({
        isPaid: false,
        catalogCurrency: "AED",
        applicationId: "child",
        partyId: "party-1",
        indexed: indexApplicantPayments([
          {
            applicationId: "primary",
            partyId: "party-1",
            amountMinor: BigInt(19900),
            currency: "USD",
          },
        ]),
      }),
    ).toBe("AED");
  });
});

describe("toApplicantExportRow", () => {
  it("keeps last_step as N/A for a paid historical application with no events", () => {
    const row = toApplicantExportRow({
      email: "old@example.com",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      isPaid: true,
      amountMinor: BigInt(19900),
      currency: "USD",
      visaType: "5 Years",
      eventNames: [],
    });
    expect(row.paid).toBe("yes");
    expect(row.lastStep).toBe("N/A");
  });
});

describe("applicantsToCsv", () => {
  it("writes one applicant row with email, paid flag, amount, visa, and last step", () => {
    const csv = applicantsToCsv([
      {
        email: "ada@example.com",
        createdAt: "2026-09-14T10:00:00.000Z",
        paid: "yes",
        amountPaid: "1.00 AED",
        visaType: "30 Days",
        lastStep: "Passport uploaded",
      },
    ]);
    expect(csv).toContain("email,created_at,paid,amount_paid,visa_type,last_step");
    expect(csv).toContain("ada@example.com,2026-09-14T10:00:00.000Z,yes,1.00 AED,30 Days,Passport uploaded");
    expect(csv).not.toContain("100");
  });

  it("marks historical applications without events as N/A", () => {
    const csv = applicantsToCsv([
      {
        email: "old@example.com",
        createdAt: "2026-08-01T00:00:00.000Z",
        paid: "yes",
        amountPaid: "199.00 USD",
        visaType: "5 Years",
        lastStep: "N/A",
      },
    ]);
    expect(csv).toContain("N/A");
  });

  it("includes a truncation meta row like the events export", () => {
    const csv = applicantsToCsv([], { truncated: true, maxRows: 20000 });
    expect(csv).toContain("truncated,true");
    expect(csv).toContain("20000");
  });

  it("keeps an empty email cell so the applicant row is still present", () => {
    const csv = applicantsToCsv([
      {
        email: "",
        createdAt: "2026-09-14T10:00:00.000Z",
        paid: "no",
        amountPaid: "0.00 USD",
        visaType: "30 Days",
        lastStep: "N/A",
      },
    ]);
    expect(csv).toContain(",2026-09-14T10:00:00.000Z,no,0.00 USD,30 Days,N/A");
  });

  it("prefixes formula-like emails so Excel does not execute them", () => {
    const csv = applicantsToCsv([
      {
        email: "=cmd|'/c calc'!A0",
        createdAt: "2026-09-14T10:00:00.000Z",
        paid: "no",
        amountPaid: "0.00 USD",
        visaType: "30 Days",
        lastStep: "N/A",
      },
    ]);
    expect(csv).toContain("'=cmd|'/c calc'!A0");
  });
});
