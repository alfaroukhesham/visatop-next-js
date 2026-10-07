/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { CustomerI18nProvider } from "@/components/client/customer-i18n-provider";
import { getEnglishCustomerMessages } from "@/lib/i18n/load-customer-catalog";
import { DocumentUploadSlot } from "./document-upload-slot";
import type { PublicDocument } from "./types";

const en = getEnglishCustomerMessages();

const wrap = (ui: ReactElement) =>
  render(
    <CustomerI18nProvider locale="en" messages={en} fallback={en}>
      {ui}
    </CustomerI18nProvider>,
  );

const doc: PublicDocument = {
  id: "doc-1",
  documentType: "passport_copy",
  status: "uploaded_temp",
  contentType: "image/jpeg",
  byteLength: 12,
  originalFilename: "a.jpg",
  sha256: "abc",
  createdAt: "2026-10-07T00:00:00.000Z",
};

describe("DocumentUploadSlot", () => {
  it("renders an inline alert with retry and replaces the Uploaded badge after failure", () => {
    const onUpload = vi.fn();
    wrap(
      <DocumentUploadSlot
        label="Passport (bio page)"
        description="JPEG"
        currentDoc={doc}
        docType="passport_copy"
        applicationId="app-1"
        uploading={false}
        uploadPercent={null}
        lastError={{ code: "CORRUPT_IMAGE" }}
        showCaptureGuidance
        onUpload={onUpload}
        onCancelUpload={() => undefined}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert.textContent).toMatch(/couldn't read/i);
    expect(screen.getByText(/Previous file kept/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Uploaded$/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("retries with the same File after a failed choose-file attempt", () => {
    const onUpload = vi.fn();
    const { rerender } = wrap(
      <DocumentUploadSlot
        label="Passport (bio page)"
        description="JPEG"
        currentDoc={null}
        docType="passport_copy"
        applicationId="app-1"
        uploading={false}
        uploadPercent={null}
        lastError={null}
        onUpload={onUpload}
        onCancelUpload={() => undefined}
      />,
    );

    const file = new File(["abc"], "shot.jpg", { type: "image/jpeg" });
    const input = document.getElementById("file-passport_copy") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(onUpload).toHaveBeenCalledWith(file, "file");

    rerender(
      <CustomerI18nProvider locale="en" messages={en} fallback={en}>
        <DocumentUploadSlot
          label="Passport (bio page)"
          description="JPEG"
          currentDoc={null}
          docType="passport_copy"
          applicationId="app-1"
          uploading={false}
          uploadPercent={null}
          lastError={{ code: "NETWORK" }}
          onUpload={onUpload}
          onCancelUpload={() => undefined}
        />
      </CustomerI18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onUpload).toHaveBeenNthCalledWith(2, file, "file");
  });

  it("shows percent progress and a cancel control while uploading", () => {
    const onCancel = vi.fn();
    wrap(
      <DocumentUploadSlot
        label="Passport (bio page)"
        description="JPEG"
        currentDoc={null}
        docType="passport_copy"
        applicationId="app-1"
        uploading
        uploadPercent={42}
        lastError={null}
        onUpload={() => undefined}
        onCancelUpload={onCancel}
      />,
    );

    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "42");
    expect(screen.getByText(/42%/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("uses full-width 44px-tall actions and masks the passport example", () => {
    wrap(
      <DocumentUploadSlot
        label="Passport (bio page)"
        description="JPEG"
        currentDoc={doc}
        docType="passport_copy"
        applicationId="app-1"
        uploading={false}
        uploadPercent={null}
        lastError={null}
        showCaptureGuidance
        addLater={false}
        onUpload={() => undefined}
        onCancelUpload={() => undefined}
      />,
    );

    const takePhoto = screen.getByRole("button", { name: /Take a photo/i });
    const choose = screen.getByRole("button", { name: /Choose a file/i });
    expect(takePhoto.className).toMatch(/min-h-11/);
    expect(takePhoto.className).toMatch(/w-full/);
    expect(choose.className).toMatch(/min-h-11/);
    const specimen = screen.getByRole("img", { name: /fake passport/i });
    expect(specimen).toHaveAttribute("data-clarity-mask", "true");
    expect(specimen).toHaveAttribute("src", "/visa-processing/apply/passport-bio-specimen.svg");
  });

  it("shows a passport OCR notice in the slot and not as a duplicate upload error", () => {
    wrap(
      <DocumentUploadSlot
        label="Passport (bio page)"
        description="JPEG"
        currentDoc={doc}
        docType="passport_copy"
        applicationId="app-1"
        uploading={false}
        uploadPercent={null}
        lastError={null}
        showCaptureGuidance
        ocrNotice="We couldn't read everything. Please enter the remaining details manually."
        onUpload={() => undefined}
        onCancelUpload={() => undefined}
      />,
    );

    const notices = screen.getAllByText(/couldn't read everything/i);
    expect(notices).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(/couldn't read everything/i);
  });
});
