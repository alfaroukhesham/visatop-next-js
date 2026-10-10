/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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
  it("highlights empty OCR-missing fields and describes them", () => {
    renderReview(["dateOfBirth", "passportExpiryDate"]);
    expect(screen.getByText(/Please fill these in/i)).toBeInTheDocument();
    const [dob, expiry] = screen.getAllByPlaceholderText("DD-MM-YYYY");
    expect(dob).toHaveAttribute("aria-invalid", "true");
    expect(expiry).toHaveAttribute("aria-invalid", "true");
    expect(dob).toHaveAttribute("aria-describedby", "ocr-review-hint");
    expect(screen.getByPlaceholderText("e.g. John Smith")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("drops the review line when OCR did not name fields to highlight", () => {
    renderReview([]);
    expect(screen.queryByText(/Please fill these in/i)).not.toBeInTheDocument();
  });

  it("highlights reader-filled fields from persisted provenance after reload", () => {
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
    expect(screen.getByText(/Please fill these in/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. John Smith")).toHaveAttribute("aria-invalid", "true");
  });
});
