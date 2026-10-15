import { beforeEach, describe, expect, it, vi } from "vitest";

const claim = vi.hoisted(() => ({
  tryClaimDocumentUploadFailure: vi.fn(),
  tryClaimDocumentUploadResolved: vi.fn(),
}));

const mailgun = vi.hoisted(() => ({
  isMailgunConfigured: vi.fn(() => true),
  mailgunSendText: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("./document-upload-failure-claim", () => ({
  tryClaimDocumentUploadFailure: (...args: unknown[]) =>
    claim.tryClaimDocumentUploadFailure(...args),
  tryClaimDocumentUploadResolved: (...args: unknown[]) =>
    claim.tryClaimDocumentUploadResolved(...args),
}));

vi.mock("./mailgun", () => ({
  isMailgunConfigured: () => mailgun.isMailgunConfigured(),
  mailgunSendText: (...args: unknown[]) => mailgun.mailgunSendText(...args),
}));

vi.mock("@/lib/db/actor-context", () => ({
  withSystemDbActor: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            leftJoin: () => ({
              where: () => ({
                limit: async () => [
                  {
                    app: {
                      id: "app-1",
                      fullName: "Ada Okonkwo",
                      guestEmail: "ada@example.com",
                      nationalityCode: "NG",
                      referenceNumber: "VT-1",
                      serviceId: "svc-1",
                      userId: null,
                    },
                    serviceName: "UAE 30-day tourist visa",
                    nationalityName: "Nigeria",
                  },
                ],
              }),
            }),
          }),
        }),
      }),
    };
    return fn(tx);
  }),
}));

vi.mock("./resolve-applicant-email", () => ({
  resolveApplicantEmailTx: vi.fn(async () => "ada@example.com"),
}));

import { ADMIN_NOTIFICATION_EMAIL } from "./admin-notification-constants";
import {
  buildAdminUploadFailedBodies,
  buildAdminUploadResolvedBodies,
  buildApplicantUploadFailedBodies,
  buildApplicantUploadResolvedBodies,
  sendDocumentUploadFailureEmails,
  sendDocumentUploadResolvedEmails,
} from "./send-document-upload-outcome-emails";
import { SUPPORT_WHATSAPP_URL } from "@/lib/support-contact";

const failureRecord = {
  id: "fail-1",
  applicationId: "app-1",
  documentType: "passport_copy",
  failureGroup: "session_auth",
  errorCode: "FORBIDDEN",
  httpStatus: 403,
  applicantNotified: true,
  locale: "en",
  createdAt: new Date("2026-10-15T08:11:42Z"),
  lastSentAt: new Date("2026-10-15T08:11:42Z"),
  resolvedAt: null as Date | null,
};

describe("document upload outcome email bodies", () => {
  it("builds the applicant failure copy with WhatsApp", () => {
    const { subject, text, html } = buildApplicantUploadFailedBodies({
      locale: "en",
      whatsappUrl: SUPPORT_WHATSAPP_URL,
    });
    expect(subject).toMatch(/problem uploading/i);
    expect(text).toContain("something went wrong");
    expect(text).toContain(SUPPORT_WHATSAPP_URL);
    expect(html).toContain(SUPPORT_WHATSAPP_URL);
    expect(html).toContain("visatop-logo.png");
  });

  it("builds the applicant resolved copy", () => {
    const { text } = buildApplicantUploadResolvedBodies({
      locale: "en",
      whatsappUrl: SUPPORT_WHATSAPP_URL,
    });
    expect(text).toContain("uploaded successfully");
    expect(text).toContain(SUPPORT_WHATSAPP_URL);
  });

  it("includes application details on the admin failure email", () => {
    const { subject, text } = buildAdminUploadFailedBodies({
      applicantLabel: "Ada Okonkwo",
      contactEmail: "ada@example.com",
      nationalityCode: "NG",
      applicationId: "app-1",
      applicationRef: "VT-1",
      documentType: "passport_copy",
      errorCode: "FORBIDDEN",
      httpStatus: 403,
      fileName: "passport.jpg",
      fileSize: 12000,
      fileMime: "image/jpeg",
      failedAt: new Date("2026-10-15T08:11:42Z"),
      adminUrl: "https://example.test/admin/applications/app-1",
    });
    expect(subject).toMatch(/Document upload failed/);
    expect(text).toContain("app-1");
    expect(text).toContain("passport.jpg");
    expect(text).toContain("FORBIDDEN");
    expect(text).toContain("403");
  });

  it("references the original failure on the admin resolved email", () => {
    const { text } = buildAdminUploadResolvedBodies({
      applicantLabel: "Ada Okonkwo",
      contactEmail: "ada@example.com",
      nationalityCode: "NG",
      applicationId: "app-1",
      applicationRef: "VT-1",
      documentType: "passport_copy",
      errorCode: "FORBIDDEN",
      httpStatus: 403,
      failedAt: new Date("2026-10-15T08:11:42Z"),
      resolvedAt: new Date("2026-10-15T08:20:00Z"),
      adminUrl: "https://example.test/admin/applications/app-1",
    });
    expect(text).toContain("FORBIDDEN");
    expect(text).toContain("15 Oct 2026");
  });
});

describe("sendDocumentUploadFailureEmails / resolved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mailgun.isMailgunConfigured.mockReturnValue(true);
    mailgun.mailgunSendText.mockResolvedValue({ ok: true });
  });

  it("no-ops without Mailgun", async () => {
    mailgun.isMailgunConfigured.mockReturnValue(false);
    await sendDocumentUploadFailureEmails({
      applicationId: "app-1",
      documentType: "passport_copy",
      errorCode: "FORBIDDEN",
      httpStatus: 403,
      requestId: "r1",
    });
    expect(claim.tryClaimDocumentUploadFailure).not.toHaveBeenCalled();
    expect(mailgun.mailgunSendText).not.toHaveBeenCalled();
  });

  it("sends admin and applicant on first failure", async () => {
    claim.tryClaimDocumentUploadFailure.mockResolvedValue(failureRecord);
    await sendDocumentUploadFailureEmails({
      applicationId: "app-1",
      documentType: "passport_copy",
      errorCode: "FORBIDDEN",
      httpStatus: 403,
      fileName: "passport.jpg",
      fileSize: 12,
      fileMime: "image/jpeg",
      requestId: "r1",
    });
    expect(mailgun.mailgunSendText).toHaveBeenCalledTimes(2);
    const tos = mailgun.mailgunSendText.mock.calls.map(
      (call: [{ to: string }]) => call[0].to,
    );
    expect(tos).toEqual([ADMIN_NOTIFICATION_EMAIL, "ada@example.com"]);
    expect(mailgun.mailgunSendText.mock.calls[1][0].replyTo).toBe(ADMIN_NOTIFICATION_EMAIL);
  });

  it("does not send a duplicate on retry of the same failure", async () => {
    claim.tryClaimDocumentUploadFailure.mockResolvedValue(null);
    await sendDocumentUploadFailureEmails({
      applicationId: "app-1",
      documentType: "passport_copy",
      errorCode: "FORBIDDEN",
      httpStatus: 403,
      requestId: "r2",
    });
    expect(mailgun.mailgunSendText).not.toHaveBeenCalled();
  });

  it("sends one admin and one applicant resolved email per claimed record", async () => {
    claim.tryClaimDocumentUploadResolved.mockResolvedValue([
      { ...failureRecord, resolvedAt: new Date("2026-10-15T08:20:00Z") },
    ]);
    await sendDocumentUploadResolvedEmails({
      applicationId: "app-1",
      documentType: "passport_copy",
      requestId: "r3",
    });
    expect(mailgun.mailgunSendText).toHaveBeenCalledTimes(2);
  });

  it("does not send resolved mail when nothing was claimed", async () => {
    claim.tryClaimDocumentUploadResolved.mockResolvedValue([]);
    await sendDocumentUploadResolvedEmails({
      applicationId: "app-1",
      documentType: "passport_copy",
      requestId: "r4",
    });
    expect(mailgun.mailgunSendText).not.toHaveBeenCalled();
  });

  it("skips the applicant resolved email when they were never notified", async () => {
    claim.tryClaimDocumentUploadResolved.mockResolvedValue([
      {
        ...failureRecord,
        applicantNotified: false,
        resolvedAt: new Date("2026-10-15T08:20:00Z"),
      },
    ]);
    await sendDocumentUploadResolvedEmails({
      applicationId: "app-1",
      documentType: "passport_copy",
      requestId: "r5",
    });
    expect(mailgun.mailgunSendText).toHaveBeenCalledTimes(1);
    expect(mailgun.mailgunSendText.mock.calls[0][0].to).toBe(ADMIN_NOTIFICATION_EMAIL);
  });
});
