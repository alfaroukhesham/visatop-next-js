/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
import { CustomerI18nProvider } from "@/components/client/customer-i18n-provider";
import { getEnglishCustomerMessages } from "@/lib/i18n/load-customer-catalog";
import { ApplicantReview } from "./applicant-review";
import type { ApplicantProfile, ExtractResponse } from "./types";

const en = getEnglishCustomerMessages();

const applicant: ApplicantProfile = {
  fullName: "Ada Lovelace",
  dateOfBirth: null,
  placeOfBirth: null,
  nationality: "Indian",
  passportNumber: "A1234567",
  passportExpiryDate: null,
  profession: null,
  address: null,
  phone: null,
};

const extraction = (missing: string[]): ExtractResponse["extraction"] => ({
  status: "needs_manual",
  attemptsUsed: 1,
  documentId: "doc-1",
  prefill: { fullName: "Ada Lovelace", nationality: "Indian", passportNumber: "A1234567" },
  ocrMissingFields: missing,
  submissionMissingFields: missing,
});

const renderReview = (ocrMissingFields: string[]) =>
  render(
    <CustomerI18nProvider locale="en" messages={en} fallback={en}>
      <ApplicantReview
        applicationId="app-1"
        nationalityCode="IN"
        nationalityName="Indian"
        nationalities={[{ code: "IN", name: "Indian", dialCode: "91" }]}
        applicant={applicant}
        guestEmail={null}
        extraction={extraction(ocrMissingFields)}
        readiness="blocked_validation"
        paymentReadiness="ready"
        missing={["dateOfBirth", "passportExpiryDate"]}
        documentsReady
        passportUploaded
        extractPending={false}
        waitForPassportExtract={async () => undefined}
        locked={false}
        onSaved={() => undefined}
      />
    </CustomerI18nProvider>,
  );

describe("ApplicantReview OCR highlight", () => {
  it("masks the personal-detail container for Clarity", () => {
    const { container } = renderReview(["dateOfBirth"]);
    expect(container.querySelector("section")).toHaveAttribute("data-clarity-mask", "true");
    expect(container.querySelector("dl")).toHaveAttribute("data-clarity-mask", "true");
  });

  it("highlights empty OCR-missing fields after blur, not on first open", async () => {
    const user = userEvent.setup();
    renderReview(["dateOfBirth", "passportExpiryDate"]);
    const [dob, expiry] = screen.getAllByPlaceholderText("DD-MM-YYYY");
    expect(screen.queryByText(/Please fill these in/i)).not.toBeInTheDocument();
    expect(dob).not.toHaveAttribute("aria-invalid", "true");
    expect(expiry).not.toHaveAttribute("aria-invalid", "true");
    await user.click(dob);
    await user.tab();
    expect(screen.getByText(/Please fill these in/i)).toBeInTheDocument();
    expect(dob).toHaveAttribute("aria-invalid", "true");
    expect(dob).toHaveAttribute("aria-describedby", "ocr-review-hint");
    expect(expiry).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByPlaceholderText("e.g. John Smith")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("drops the review line when OCR did not name fields to highlight", () => {
    renderReview([]);
    expect(screen.queryByText(/Please fill these in/i)).not.toBeInTheDocument();
  });

  it("prefills nationality with a demonym when the catalog name is a country", () => {
    render(
      <CustomerI18nProvider locale="en" messages={en} fallback={en}>
        <ApplicantReview
          applicationId="app-1"
          nationalityCode="ZA"
          nationalityName="South Africa"
          nationalities={[{ code: "ZA", name: "South Africa", dialCode: "27" }]}
          applicant={{ ...applicant, nationality: null }}
          guestEmail={null}
          extraction={extraction([])}
          readiness="blocked_validation"
          paymentReadiness="ready"
          missing={[]}
          documentsReady
          passportUploaded
          extractPending={false}
          waitForPassportExtract={async () => undefined}
          locked={false}
          onSaved={() => undefined}
        />
      </CustomerI18nProvider>,
    );
    expect(screen.getByDisplayValue("South African")).toBeInTheDocument();
  });

  it("highlights reader-filled fields from persisted provenance after the field is blurred", async () => {
    const user = userEvent.setup();
    render(
      <CustomerI18nProvider locale="en" messages={en} fallback={en}>
        <ApplicantReview
          applicationId="app-1"
          nationalityCode="IN"
          nationalityName="Indian"
          nationalities={[{ code: "IN", name: "Indian", dialCode: "91" }]}
          applicant={applicant}
          guestEmail={null}
          extraction={extraction([])}
          fieldMeta={{
            fullName: { source: "ocr", needsReview: true },
            nationality: { source: "ocr", needsReview: true },
            passportNumber: { source: "ocr", needsReview: true },
          }}
          readiness="blocked_validation"
          paymentReadiness="ready"
          missing={["dateOfBirth", "passportExpiryDate"]}
          documentsReady
          passportUploaded
          extractPending={false}
          waitForPassportExtract={async () => undefined}
          locked={false}
          onSaved={() => undefined}
        />
      </CustomerI18nProvider>,
    );
    const name = screen.getByPlaceholderText("e.g. John Smith");
    expect(name).not.toHaveAttribute("aria-invalid", "true");
    await user.click(name);
    await user.tab();
    expect(screen.getByText(/Please fill these in/i)).toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "true");
  });
});
