import { eq } from "drizzle-orm";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { application, visaService } from "@/lib/db/schema";
import { ADMIN_NOTIFICATION_EMAIL } from "./admin-notification-constants";
import { tryClaimTransactionalEmail } from "./claim-transactional-email";
import { isMailgunConfigured, mailgunSendText } from "./mailgun";
import { resolveApplicantEmailTx } from "./resolve-applicant-email";
import {
  appendTransactionalHtmlFooter,
  buildTransactionalEmailHtml,
  escapeHtml,
} from "./transactional-email-html";
import { TRANSACTIONAL_EMAIL_KINDS } from "./transactional-email-kinds";
import { transactionalSubjectPrefix, withTransactionalFooter } from "./transactional-footer";

type ApplicationRow = typeof application.$inferSelect;

function applicationRef(app: ApplicationRow): string {
  return app.referenceNumber ?? app.id.slice(0, 8);
}

/** Name shown to admins: full name when known, otherwise contact email. */
export function adminApplicantLabel(
  app: Pick<ApplicationRow, "fullName" | "guestEmail">,
  contactEmail: string | null,
): string {
  const name = app.fullName?.trim();
  if (name) return name;
  const email = app.guestEmail?.trim() || contactEmail?.trim();
  if (email) return email;
  return "Guest applicant";
}

type AdminDetailRow = { label: string; value: string };

function adminDetailRowsHtml(rows: AdminDetailRow[]): string {
  const trs = rows
    .map(
      (r) => `<tr>
        <td style="padding:5px 12px 5px 0;color:#6b7280;width:36%;vertical-align:top;font-size:13px;">${escapeHtml(r.label)}</td>
        <td style="padding:5px 0;font-size:13px;font-weight:600;color:#111827;">${escapeHtml(r.value)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" style="border-collapse:collapse;margin-top:12px;">${trs}</table>`;
}

function buildAdminEmailBodies(input: {
  eyebrow: string;
  headline: string;
  footerNote: string;
  headerRef: string;
  detailRows: AdminDetailRow[];
  subject: string;
}): { subject: string; text: string; html: string } {
  const textLines = [
    input.headline,
    "",
    ...input.detailRows.map((r) => `${r.label}: ${r.value}`),
    "",
    input.footerNote,
  ];
  const text = withTransactionalFooter(textLines.join("\n"));

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
}

export function buildAdminStep2ServiceSelectedBodies(input: {
  applicantLabel: string;
  contactEmail: string | null;
  serviceName: string;
  nationalityCode: string;
  applicationRef: string;
}): { subject: string; text: string; html: string } {
  const { applicantLabel, contactEmail, serviceName, nationalityCode, applicationRef } = input;
  const detailRows: AdminDetailRow[] = [
    { label: "Applicant", value: applicantLabel },
    ...(contactEmail && contactEmail !== applicantLabel
      ? [{ label: "Contact email", value: contactEmail }]
      : []),
    { label: "Service", value: serviceName },
    { label: "Nationality", value: nationalityCode },
  ];

  return buildAdminEmailBodies({
    eyebrow: "Admin · New application",
    headline: "Step 2 completed — visa and email captured",
    footerNote: "The applicant can continue with documents and payment in the apply flow.",
    headerRef: applicationRef,
    detailRows,
    subject: `${transactionalSubjectPrefix()}New application — ${serviceName}`,
  });
}

export function buildAdminPaymentCompletedBodies(input: {
  contactEmail: string;
  serviceName: string;
  applicationRef: string;
}): { subject: string; text: string; html: string } {
  const { contactEmail, serviceName, applicationRef } = input;

  return buildAdminEmailBodies({
    eyebrow: "Admin · Payment received",
    headline: "Payment completed",
    footerNote: "The application is now in progress. Review it in the admin console when ready.",
    headerRef: applicationRef,
    detailRows: [
      { label: "Customer email", value: contactEmail },
      { label: "Service", value: serviceName },
    ],
    subject: `${transactionalSubjectPrefix()}Payment received — ${serviceName}`,
  });
}

async function loadApplicationWithService(applicationId: string) {
  return withSystemDbActor(async (tx) => {
    const [row] = await tx
      .select({ app: application, serviceName: visaService.name })
      .from(application)
      .innerJoin(visaService, eq(application.serviceId, visaService.id))
      .where(eq(application.id, applicationId))
      .limit(1);
    if (!row) return null;
    const contactEmail = await resolveApplicantEmailTx(tx, row.app);
    return { ...row, contactEmail };
  });
}

/**
 * Notify ops when step 2 completes (visa + email chosen, draft created).
 */
export async function sendAdminStep2ServiceSelectedEmail(
  applicationId: string,
  requestId: string | null,
): Promise<void> {
  if (!isMailgunConfigured()) {
    console.warn("[email] Mailgun not configured; skipping admin_step2_service_selected", {
      applicationId,
      requestId,
    });
    return;
  }

  const claimed = await tryClaimTransactionalEmail(
    applicationId,
    TRANSACTIONAL_EMAIL_KINDS.ADMIN_STEP2_SERVICE_SELECTED,
  );
  if (!claimed) {
    console.info("[email] admin_step2_service_selected already sent", { applicationId, requestId });
    return;
  }

  const payload = await loadApplicationWithService(applicationId);
  if (!payload) {
    console.warn("[email] Application not found for admin_step2_service_selected", { applicationId, requestId });
    return;
  }

  const { subject, text, html } = buildAdminStep2ServiceSelectedBodies({
    applicantLabel: adminApplicantLabel(payload.app, payload.contactEmail),
    contactEmail: payload.contactEmail,
    serviceName: payload.serviceName,
    nationalityCode: payload.app.nationalityCode,
    applicationRef: applicationRef(payload.app),
  });

  const sent = await mailgunSendText({ to: ADMIN_NOTIFICATION_EMAIL, subject, text, html });
  if (!sent.ok) {
    console.error("[email] admin_step2_service_selected Mailgun failed", {
      applicationId,
      requestId,
      error: sent.error,
    });
  }
}

/**
 * Notify ops when payment webhook confirms first paid transition.
 */
export async function sendAdminPaymentCompletedEmail(
  applicationId: string,
  requestId: string | null,
): Promise<void> {
  if (!isMailgunConfigured()) {
    console.warn("[email] Mailgun not configured; skipping admin_payment_completed", {
      applicationId,
      requestId,
    });
    return;
  }

  const claimed = await tryClaimTransactionalEmail(
    applicationId,
    TRANSACTIONAL_EMAIL_KINDS.ADMIN_PAYMENT_COMPLETED,
  );
  if (!claimed) {
    console.info("[email] admin_payment_completed already sent", { applicationId, requestId });
    return;
  }

  const payload = await loadApplicationWithService(applicationId);
  if (!payload?.contactEmail) {
    console.warn("[email] No contact email for admin_payment_completed", { applicationId, requestId });
    return;
  }

  const { subject, text, html } = buildAdminPaymentCompletedBodies({
    contactEmail: payload.contactEmail,
    serviceName: payload.serviceName,
    applicationRef: applicationRef(payload.app),
  });

  const sent = await mailgunSendText({ to: ADMIN_NOTIFICATION_EMAIL, subject, text, html });
  if (!sent.ok) {
    console.error("[email] admin_payment_completed Mailgun failed", {
      applicationId,
      requestId,
      error: sent.error,
    });
  }
}
