import { eq } from "drizzle-orm";
import { appHref } from "@/lib/app-href";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { application, nationality, visaService } from "@/lib/db/schema";
import { parseCustomerLocale } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";
import { SUPPORT_WHATSAPP_URL } from "@/lib/support-contact";
import { ADMIN_NOTIFICATION_EMAIL } from "./admin-notification-constants";
import {
  tryClaimDocumentUploadFailure,
  tryClaimDocumentUploadResolved,
  type TDocumentUploadFailureRecord,
} from "./document-upload-failure-claim";
import { isMailgunConfigured, mailgunSendText } from "./mailgun";
import { resolveApplicantEmailTx } from "./resolve-applicant-email";
import { adminApplicantLabel } from "./send-admin-notification-emails";
import {
  appendTransactionalHtmlFooter,
  buildTransactionalEmailHtml,
  escapeHtml,
} from "./transactional-email-html";
import { transactionalSubjectPrefix, withTransactionalFooter } from "./transactional-footer";
import { sanitizeUploadFailureKey, uploadFailureGroup } from "./upload-failure-group";

type TAdminDetailRow = { label: string; value: string };

const supportReplyTo = (): string =>
  process.env.MAILGUN_REPLY_TO?.trim() || ADMIN_NOTIFICATION_EMAIL;

const formatAdminTimestamp = (d: Date): string =>
  d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });

const adminDetailRowsHtml = (rows: TAdminDetailRow[]): string => {
  const trs = rows
    .map(
      (r) => `<tr>
        <td style="padding:5px 12px 5px 0;color:#6b7280;width:36%;vertical-align:top;font-size:13px;">${escapeHtml(r.label)}</td>
        <td style="padding:5px 0;font-size:13px;font-weight:600;color:#111827;">${escapeHtml(r.value)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" style="border-collapse:collapse;margin-top:12px;">${trs}</table>`;
};

const buildAdminBodies = (input: {
  eyebrow: string;
  headline: string;
  footerNote: string;
  headerRef: string;
  detailRows: TAdminDetailRow[];
  subject: string;
}): { subject: string; text: string; html: string } => {
  const text = withTransactionalFooter(
    [input.headline, "", ...input.detailRows.map((r) => `${r.label}: ${r.value}`), "", input.footerNote].join(
      "\n",
    ),
  );
  const headerDetailsHtml = `<div><strong>Ref</strong> ${escapeHtml(input.headerRef)}</div>`;
  const bodyRowsHtml = `<tr>
      <td style="padding:18px 18px 20px;background:#ffffff;">
        <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${escapeHtml(input.headline)}</p>
        ${adminDetailRowsHtml(input.detailRows)}
        <p style="margin:16px 0 0;font-size:12px;color:#6b7280;line-height:1.5;">${escapeHtml(input.footerNote)}</p>
      </td>
    </tr>`;
  const html = appendTransactionalHtmlFooter(
    buildTransactionalEmailHtml({
      eyebrow: input.eyebrow,
      headerDetailsHtml,
      bodyRowsHtml,
    }),
  );
  return { subject: input.subject, text, html };
};

export const buildApplicantUploadFailedBodies = (input: {
  locale: string;
  whatsappUrl: string;
}): { subject: string; text: string; html: string } => {
  const t = createCustomerT(input.locale);
  const subject = `${transactionalSubjectPrefix()}${t("email.uploadFailed.subject")}`;
  const body = t("email.uploadFailed.body");
  const whatsappLabel = t("email.uploadFailed.whatsappCta");
  const text = withTransactionalFooter(
    [t("email.uploadFailed.greeting"), "", body, "", `${whatsappLabel}: ${input.whatsappUrl}`].join("\n"),
  );
  const bodyRowsHtml = `<tr>
      <td style="padding:16px 18px;">
        <p style="margin:0;">${escapeHtml(body)}</p>
        <p style="margin:20px 0 0;text-align:center;">
          <a href="${escapeHtml(input.whatsappUrl)}" style="display:inline-block;padding:12px 24px;background:#111827;color:#ffffff;text-decoration:none;font-weight:600;border-radius:4px;">${escapeHtml(whatsappLabel)}</a>
        </p>
      </td>
    </tr>`;
  const html = appendTransactionalHtmlFooter(
    buildTransactionalEmailHtml({
      eyebrow: t("email.uploadFailed.eyebrow"),
      bodyRowsHtml,
    }),
  );
  return { subject, text, html };
};

export const buildApplicantUploadResolvedBodies = (input: {
  locale: string;
  whatsappUrl: string;
}): { subject: string; text: string; html: string } => {
  const t = createCustomerT(input.locale);
  const subject = `${transactionalSubjectPrefix()}${t("email.uploadResolved.subject")}`;
  const body = t("email.uploadResolved.body");
  const whatsappLabel = t("email.uploadFailed.whatsappCta");
  const text = withTransactionalFooter(
    [t("email.uploadResolved.greeting"), "", body, "", `${whatsappLabel}: ${input.whatsappUrl}`].join("\n"),
  );
  const bodyRowsHtml = `<tr>
      <td style="padding:16px 18px;">
        <p style="margin:0;">${escapeHtml(body)}</p>
        <p style="margin:20px 0 0;text-align:center;">
          <a href="${escapeHtml(input.whatsappUrl)}" style="display:inline-block;padding:12px 24px;background:#111827;color:#ffffff;text-decoration:none;font-weight:600;border-radius:4px;">${escapeHtml(whatsappLabel)}</a>
        </p>
      </td>
    </tr>`;
  const html = appendTransactionalHtmlFooter(
    buildTransactionalEmailHtml({
      eyebrow: t("email.uploadResolved.eyebrow"),
      bodyRowsHtml,
    }),
  );
  return { subject, text, html };
};

export const buildAdminUploadFailedBodies = (input: {
  applicantLabel: string;
  contactEmail: string | null;
  nationalityCode: string;
  applicationId: string;
  applicationRef: string;
  documentType: string;
  errorCode: string;
  httpStatus: number;
  fileName: string | null;
  fileSize: number | null;
  fileMime: string | null;
  failedAt: Date;
  adminUrl: string;
}): { subject: string; text: string; html: string } => {
  const detailRows: TAdminDetailRow[] = [
    { label: "Application id", value: input.applicationId },
    { label: "Applicant", value: input.applicantLabel },
    ...(input.contactEmail && input.contactEmail !== input.applicantLabel
      ? [{ label: "Contact email", value: input.contactEmail }]
      : []),
    { label: "Nationality", value: input.nationalityCode },
    { label: "Document type", value: input.documentType },
    { label: "Error code", value: input.errorCode },
    { label: "HTTP status", value: String(input.httpStatus) },
    ...(input.fileName ? [{ label: "File name", value: input.fileName }] : []),
    ...(input.fileSize !== null ? [{ label: "File size", value: `${input.fileSize} bytes` }] : []),
    ...(input.fileMime ? [{ label: "File MIME", value: input.fileMime }] : []),
    { label: "Failed at", value: formatAdminTimestamp(input.failedAt) },
    { label: "Admin link", value: input.adminUrl },
  ];
  return buildAdminBodies({
    eyebrow: "Admin · Document upload failed",
    headline: "A customer document upload failed",
    footerNote: "This alert is sent once per application, document type, and failure group.",
    headerRef: input.applicationRef,
    detailRows,
    subject: `${transactionalSubjectPrefix()}Document upload failed — ${input.documentType} — ${input.applicationRef}`,
  });
};

export const buildAdminUploadResolvedBodies = (input: {
  applicantLabel: string;
  contactEmail: string | null;
  nationalityCode: string;
  applicationId: string;
  applicationRef: string;
  documentType: string;
  errorCode: string;
  httpStatus: number;
  failedAt: Date;
  resolvedAt: Date;
  adminUrl: string;
}): { subject: string; text: string; html: string } => {
  const detailRows: TAdminDetailRow[] = [
    { label: "Application id", value: input.applicationId },
    { label: "Applicant", value: input.applicantLabel },
    ...(input.contactEmail && input.contactEmail !== input.applicantLabel
      ? [{ label: "Contact email", value: input.contactEmail }]
      : []),
    { label: "Nationality", value: input.nationalityCode },
    { label: "Document type", value: input.documentType },
    { label: "Original error", value: `${input.errorCode} (HTTP ${input.httpStatus})` },
    { label: "Failed at", value: formatAdminTimestamp(input.failedAt) },
    { label: "Resolved at", value: formatAdminTimestamp(input.resolvedAt) },
    { label: "Admin link", value: input.adminUrl },
  ];
  return buildAdminBodies({
    eyebrow: "Admin · Document upload resolved",
    headline: "A previously failed document uploaded successfully",
    footerNote: "This recovery notice is sent once per failure record.",
    headerRef: input.applicationRef,
    detailRows,
    subject: `${transactionalSubjectPrefix()}Document upload resolved — ${input.documentType} — ${input.applicationRef}`,
  });
};

const loadApplicationEmailContext = async (applicationId: string) => {
  return withSystemDbActor(async (tx) => {
    const [row] = await tx
      .select({
        app: application,
        serviceName: visaService.name,
        nationalityName: nationality.name,
      })
      .from(application)
      .innerJoin(visaService, eq(application.serviceId, visaService.id))
      .leftJoin(nationality, eq(application.nationalityCode, nationality.code))
      .where(eq(application.id, applicationId))
      .limit(1);
    if (!row) return null;
    const contactEmail = await resolveApplicantEmailTx(tx, row.app);
    return { ...row, contactEmail };
  });
};

export type TDocumentUploadFailureEmailInput = {
  applicationId: string;
  documentType: string | null;
  errorCode: string;
  httpStatus: number;
  fileName?: string | null;
  fileSize?: number | null;
  fileMime?: string | null;
  locale?: string | null;
  requestId: string | null;
};

export const sendDocumentUploadFailureEmails = async (
  input: TDocumentUploadFailureEmailInput,
): Promise<void> => {
  if (!isMailgunConfigured()) {
    console.warn("[email] Mailgun not configured; skipping document_upload_failed", {
      applicationId: input.applicationId,
      requestId: input.requestId,
    });
    return;
  }

  const documentType = sanitizeUploadFailureKey(input.documentType ?? "", "unknown");
  const failureGroup = uploadFailureGroup({
    errorCode: input.errorCode,
    httpStatus: input.httpStatus,
  });
  const locale = parseCustomerLocale(input.locale);
  const payload = await loadApplicationEmailContext(input.applicationId);
  const contactEmail = payload?.contactEmail ?? null;
  const applicantNotified = Boolean(contactEmail);

  const claimed = await tryClaimDocumentUploadFailure({
    applicationId: input.applicationId,
    documentType,
    failureGroup,
    errorCode: input.errorCode,
    httpStatus: input.httpStatus,
    applicantNotified,
    locale,
  });
  if (!claimed) {
    console.info("[email] document_upload_failed already recorded", {
      applicationId: input.applicationId,
      documentType,
      failureGroup,
      requestId: input.requestId,
    });
    return;
  }

  const applicationRef = payload?.app.referenceNumber ?? input.applicationId.slice(0, 8);
  const applicantLabel = payload
    ? adminApplicantLabel(payload.app, contactEmail)
    : contactEmail ?? "Guest applicant";
  const nationalityCode = payload?.app.nationalityCode ?? payload?.nationalityName ?? "unknown";
  const adminUrl = appHref(`/admin/applications/${input.applicationId}`);
  const replyTo = supportReplyTo();

  const adminBodies = buildAdminUploadFailedBodies({
    applicantLabel,
    contactEmail,
    nationalityCode,
    applicationId: input.applicationId,
    applicationRef,
    documentType,
    errorCode: input.errorCode,
    httpStatus: input.httpStatus,
    fileName: input.fileName ?? null,
    fileSize: input.fileSize ?? null,
    fileMime: input.fileMime ?? null,
    failedAt: claimed.createdAt,
    adminUrl,
  });

  const adminSent = await mailgunSendText({
    to: ADMIN_NOTIFICATION_EMAIL,
    subject: adminBodies.subject,
    text: adminBodies.text,
    html: adminBodies.html,
    replyTo,
  });
  if (!adminSent.ok) {
    console.error("[email] document_upload_failed admin Mailgun failed", {
      applicationId: input.applicationId,
      requestId: input.requestId,
      error: adminSent.error,
    });
  }

  if (!contactEmail) return;

  const applicantBodies = buildApplicantUploadFailedBodies({
    locale,
    whatsappUrl: SUPPORT_WHATSAPP_URL,
  });
  const applicantSent = await mailgunSendText({
    to: contactEmail,
    subject: applicantBodies.subject,
    text: applicantBodies.text,
    html: applicantBodies.html,
    replyTo,
  });
  if (!applicantSent.ok) {
    console.error("[email] document_upload_failed applicant Mailgun failed", {
      applicationId: input.applicationId,
      requestId: input.requestId,
      error: applicantSent.error,
    });
  }
};

export type TDocumentUploadResolvedEmailInput = {
  applicationId: string;
  documentType: string;
  locale?: string | null;
  requestId: string | null;
};

const sendResolvedForRecord = async (
  record: TDocumentUploadFailureRecord,
  payload: Awaited<ReturnType<typeof loadApplicationEmailContext>>,
  requestId: string | null,
): Promise<void> => {
  const contactEmail = payload?.contactEmail ?? null;
  const applicationRef = payload?.app.referenceNumber ?? record.applicationId.slice(0, 8);
  const applicantLabel = payload
    ? adminApplicantLabel(payload.app, contactEmail)
    : contactEmail ?? "Guest applicant";
  const nationalityCode = payload?.app.nationalityCode ?? "unknown";
  const adminUrl = appHref(`/admin/applications/${record.applicationId}`);
  const replyTo = supportReplyTo();
  const resolvedAt = record.resolvedAt ?? new Date();

  const adminBodies = buildAdminUploadResolvedBodies({
    applicantLabel,
    contactEmail,
    nationalityCode,
    applicationId: record.applicationId,
    applicationRef,
    documentType: record.documentType,
    errorCode: record.errorCode,
    httpStatus: record.httpStatus,
    failedAt: record.createdAt,
    resolvedAt,
    adminUrl,
  });

  const adminSent = await mailgunSendText({
    to: ADMIN_NOTIFICATION_EMAIL,
    subject: adminBodies.subject,
    text: adminBodies.text,
    html: adminBodies.html,
    replyTo,
  });
  if (!adminSent.ok) {
    console.error("[email] document_upload_resolved admin Mailgun failed", {
      applicationId: record.applicationId,
      requestId,
      error: adminSent.error,
    });
  }

  if (!record.applicantNotified || !contactEmail) return;

  const applicantBodies = buildApplicantUploadResolvedBodies({
    locale: record.locale || parseCustomerLocale(null),
    whatsappUrl: SUPPORT_WHATSAPP_URL,
  });
  const applicantSent = await mailgunSendText({
    to: contactEmail,
    subject: applicantBodies.subject,
    text: applicantBodies.text,
    html: applicantBodies.html,
    replyTo,
  });
  if (!applicantSent.ok) {
    console.error("[email] document_upload_resolved applicant Mailgun failed", {
      applicationId: record.applicationId,
      requestId,
      error: applicantSent.error,
    });
  }
};

export const sendDocumentUploadResolvedEmails = async (
  input: TDocumentUploadResolvedEmailInput,
): Promise<void> => {
  if (!isMailgunConfigured()) {
    console.warn("[email] Mailgun not configured; skipping document_upload_resolved", {
      applicationId: input.applicationId,
      requestId: input.requestId,
    });
    return;
  }

  const documentType = sanitizeUploadFailureKey(input.documentType, "unknown");
  const claimed = await tryClaimDocumentUploadResolved(input.applicationId, documentType);
  if (claimed.length === 0) {
    return;
  }

  const payload = await loadApplicationEmailContext(input.applicationId);
  for (const record of claimed) {
    await sendResolvedForRecord(record, payload, input.requestId);
  }
};
