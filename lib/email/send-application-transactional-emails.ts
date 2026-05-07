import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { withSystemDbActor } from "@/lib/db/actor-context";
import {
  application,
  applicationDocument,
  applicationDocumentBlob,
  DOCUMENT_STATUS,
  DOCUMENT_TYPE,
  payment,
  priceQuote,
  visaService,
} from "@/lib/db/schema";
import { tryClaimTransactionalEmail } from "./claim-transactional-email";
import { TRANSACTIONAL_EMAIL_KINDS } from "./transactional-email-kinds";
import { resolveApplicantEmailTx } from "./resolve-applicant-email";
import { isMailgunConfigured, mailgunSendText } from "./mailgun";
import {
  appendTransactionalHtmlFooter,
  buildTransactionalEmailHtml,
  escapeHtml,
  supportContactParagraphHtml,
  supportContactPlainText,
} from "./transactional-email-html";
import { transactionalSubjectPrefix, withTransactionalFooter } from "./transactional-footer";

function safeFilename(name: string | null, fallback: string) {
  const n = (name ?? "").replace(/[^\w.\-()+ ]/g, "_").slice(0, 120);
  return n.length > 0 ? n : fallback;
}

/** Minor units → display (USD/AED-style 2-decimal currencies). */
function formatMinorCurrency(minor: number | bigint, currency: string): string {
  const code = /^[A-Z]{3}$/i.test(currency) ? currency.toUpperCase() : "USD";
  try {
    const raw = typeof minor === "bigint" ? Number(minor) : minor;
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(
      raw / 100,
    );
  } catch {
    const raw = typeof minor === "bigint" ? Number(minor) : minor;
    return `${(raw / 100).toFixed(2)} ${code}`;
  }
}

function generateTempInvoiceNumber(): string {
  return `INV-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function formatInvoiceDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function buildPaymentInvoiceBodies(input: {
  customerName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  applicationRef: string;
  serviceName: string;
  paidLine: string;
}): { text: string; html: string } {
  const { customerName, invoiceNumber, invoiceDate, applicationRef, serviceName, paidLine } = input;
  const lineLabel = `Visa service — ${serviceName} (ref ${applicationRef})`;
  const contactText = supportContactPlainText();
  const text = [
    "================================================================",
    "                      PAYMENT RECEIPT",
    "================================================================",
    "",
    `Invoice number:     ${invoiceNumber}`,
    `Invoice date:       ${formatInvoiceDate(invoiceDate)}`,
    `Application ref:    ${applicationRef}`,
    "",
    "Bill to:",
    `  ${customerName}`,
    "",
    "----------------------------------------------------------------",
    "Description",
    `  ${lineLabel}`,
    "",
    `Amount (line item):  ${paidLine}`,
    `TOTAL PAID:          ${paidLine}`,
    "================================================================",
    "",
    "Thank you. Your application is now in progress.",
    "",
    "This message is a payment summary for your records. It is not a tax invoice.",
    contactText,
  ].join("\n");

  const headerDetailsHtml = `<div><strong>Invoice no.</strong> ${escapeHtml(invoiceNumber)}</div>
          <div><strong>Date</strong> ${escapeHtml(formatInvoiceDate(invoiceDate))}</div>
          <div><strong>Application ref</strong> ${escapeHtml(applicationRef)}</div>`;

  const bodyRowsHtml = `<tr>
      <td style="padding:16px 18px;">
        <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">Bill to</div>
        <div style="font-weight:600;">${escapeHtml(customerName)}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:0 18px 16px;">
        <table role="presentation" width="100%" style="border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="border-bottom:1px solid #e5e7eb;">
              <th align="left" style="padding:8px 0;text-align:left;color:#6b7280;font-weight:600;">Description</th>
              <th align="right" style="padding:8px 0;text-align:right;color:#6b7280;font-weight:600;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:10px 0;vertical-align:top;">${escapeHtml(lineLabel)}</td>
              <td align="right" style="padding:10px 0;white-space:nowrap;font-weight:600;">${escapeHtml(paidLine)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="border-top:2px solid #111827;">
              <td style="padding:12px 0 4px;font-weight:700;">Total paid</td>
              <td align="right" style="padding:12px 0 4px;font-weight:700;white-space:nowrap;">${escapeHtml(paidLine)}</td>
            </tr>
          </tfoot>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">This message is a payment summary for your records. It is not a tax invoice.</p>
        <p style="margin:12px 0 0;">Thank you. Your application is now in progress.</p>
        ${supportContactParagraphHtml()}
      </td>
    </tr>`;

  const html = buildTransactionalEmailHtml({
    eyebrow: "Payment receipt (informal)",
    headerDetailsHtml,
    bodyRowsHtml,
  });

  return { text, html };
}

function buildOutcomeApprovedBodies(applicationRef: string): { text: string; html: string } {
  const contact = supportContactPlainText();
  const text = [
    "Hello,",
    "",
    `Good news: your visa application ${applicationRef} has been completed successfully.`,
    "",
    "Please find your document attached to this message.",
    "",
    contact,
  ].join("\n");

  const headerDetailsHtml = `<div><strong>Application ref</strong> ${escapeHtml(applicationRef)}</div>`;
  const bodyRowsHtml = `<tr>
      <td style="padding:16px 18px;">
        <p style="margin:0;">Good news: your visa application has been completed successfully.</p>
        <p style="margin:12px 0 0;">Please find your document attached to this message.</p>
        ${supportContactParagraphHtml()}
      </td>
    </tr>`;

  const html = buildTransactionalEmailHtml({
    eyebrow: "Decision ready",
    headerDetailsHtml,
    bodyRowsHtml,
  });

  return { text, html };
}

function buildOutcomeUaeAuthorityRejectionBodies(applicationRef: string): { text: string; html: string } {
  const contact = supportContactPlainText();
  const text = [
    "Hello,",
    "",
    `Regarding application ${applicationRef}: the UAE authorities did not approve this visa request.`,
    "",
    "We have attached the official documentation we received for your records.",
    "",
    contact,
  ].join("\n");

  const headerDetailsHtml = `<div><strong>Application ref</strong> ${escapeHtml(applicationRef)}</div>`;
  const bodyRowsHtml = `<tr>
      <td style="padding:16px 18px;">
        <p style="margin:0;">The UAE authorities did not approve this visa request.</p>
        <p style="margin:12px 0 0;">We have attached the official documentation we received for your records.</p>
        ${supportContactParagraphHtml()}
      </td>
    </tr>`;

  const html = buildTransactionalEmailHtml({
    eyebrow: "Application update",
    headerDetailsHtml,
    bodyRowsHtml,
  });

  return { text, html };
}

export async function sendPaymentReceivedInProgressEmail(
  applicationId: string,
  requestId: string | null,
): Promise<void> {
  if (!isMailgunConfigured()) {
    console.warn("[email] Mailgun not configured; skipping payment_received_in_progress", {
      applicationId,
      requestId,
    });
    return;
  }

  const payload = await withSystemDbActor(async (tx) => {
    const [row] = await tx
      .select({ app: application, serviceName: visaService.name })
      .from(application)
      .innerJoin(visaService, eq(application.serviceId, visaService.id))
      .where(eq(application.id, applicationId))
      .limit(1);
    if (!row) return null;
    const to = await resolveApplicantEmailTx(tx, row.app);
    const [paid] = await tx
      .select()
      .from(payment)
      .where(and(eq(payment.applicationId, applicationId), eq(payment.status, "paid")))
      .orderBy(desc(payment.updatedAt))
      .limit(1);
    let amountMinor: number | bigint | null = paid?.amount ?? null;
    let currency = paid?.currency ?? row.app.catalogCurrency;
    let invoiceDate: Date = paid?.updatedAt ?? new Date();
    if (!paid) {
      const [quote] = await tx
        .select()
        .from(priceQuote)
        .where(eq(priceQuote.applicationId, applicationId))
        .orderBy(desc(priceQuote.lockedAt))
        .limit(1);
      if (quote) {
        amountMinor = quote.totalAmount;
        currency = quote.currency;
        invoiceDate = quote.lockedAt ?? quote.createdAt;
      }
    }
    return { ...row, to, amountMinor, currency, invoiceDate };
  });

  if (!payload?.to) {
    console.warn("[email] No recipient for payment_received_in_progress", { applicationId, requestId });
    return;
  }

  const claimed = await tryClaimTransactionalEmail(
    applicationId,
    TRANSACTIONAL_EMAIL_KINDS.PAYMENT_RECEIVED_IN_PROGRESS,
  );
  if (!claimed) {
    console.info("[email] payment_received_in_progress already recorded (skip duplicate)", { applicationId, requestId });
    return;
  }

  const ref = payload.app.referenceNumber ?? payload.app.id.slice(0, 8);
  const customerName = payload.app.fullName?.trim() || "Valued customer";
  const paidLine =
    payload.amountMinor != null
      ? formatMinorCurrency(payload.amountMinor, payload.currency)
      : "— (see your checkout confirmation)";
  const { text: invoiceText, html: invoiceHtml } = buildPaymentInvoiceBodies({
    customerName,
    invoiceNumber: generateTempInvoiceNumber(),
    invoiceDate: payload.invoiceDate,
    applicationRef: ref,
    serviceName: payload.serviceName,
    paidLine,
  });
  const subject = `${transactionalSubjectPrefix()}Payment received — receipt for application ${ref}`;
  const text = withTransactionalFooter(invoiceText);
  const htmlWithFooter = appendTransactionalHtmlFooter(invoiceHtml);

  const sent = await mailgunSendText({ to: payload.to, subject, text, html: htmlWithFooter });
  if (!sent.ok) {
    console.error("[email] Mailgun send failed", { applicationId, requestId, error: sent.error });
  }
}

export async function sendOutcomeApprovedEmail(
  applicationId: string,
  outcomeDocumentId: string,
  requestId: string | null,
): Promise<void> {
  if (!isMailgunConfigured()) {
    console.warn("[email] Mailgun not configured; skipping outcome_approved", { applicationId, requestId });
    return;
  }

  const payload = await withSystemDbActor(async (tx) => {
    const [app] = await tx.select().from(application).where(eq(application.id, applicationId)).limit(1);
    if (!app) return null;
    const to = await resolveApplicantEmailTx(tx, app);
    const [doc] = await tx
      .select({
        id: applicationDocument.id,
        documentType: applicationDocument.documentType,
        status: applicationDocument.status,
        contentType: applicationDocument.contentType,
        originalFilename: applicationDocument.originalFilename,
        bytes: applicationDocumentBlob.bytes,
      })
      .from(applicationDocument)
      .innerJoin(applicationDocumentBlob, eq(applicationDocumentBlob.documentId, applicationDocument.id))
      .where(
        and(
          eq(applicationDocument.id, outcomeDocumentId),
          eq(applicationDocument.applicationId, applicationId),
          eq(applicationDocument.documentType, DOCUMENT_TYPE.OUTCOME_APPROVAL),
          eq(applicationDocument.status, DOCUMENT_STATUS.RETAINED),
        ),
      )
      .limit(1);
    if (!doc?.bytes) return null;
    return { app, to, doc };
  });

  if (!payload?.to || !payload.doc) {
    console.warn("[email] Missing recipient or outcome document for outcome_approved", {
      applicationId,
      outcomeDocumentId,
      requestId,
    });
    return;
  }

  const claimed = await tryClaimTransactionalEmail(applicationId, TRANSACTIONAL_EMAIL_KINDS.OUTCOME_APPROVED);
  if (!claimed) {
    console.info("[email] outcome_approved already recorded (skip duplicate)", { applicationId, requestId });
    return;
  }

  const ref = payload.app.referenceNumber ?? payload.app.id.slice(0, 8);
  const subject = `${transactionalSubjectPrefix()}Your visa application decision`;
  const { text: bodyText, html: bodyHtml } = buildOutcomeApprovedBodies(ref);
  const text = withTransactionalFooter(bodyText);
  const html = appendTransactionalHtmlFooter(bodyHtml);

  const filename = safeFilename(payload.doc.originalFilename, "visa-document.pdf");
  const sent = await mailgunSendText({
    to: payload.to,
    subject,
    text,
    html,
    attachments: [
      {
        filename,
        contentType: payload.doc.contentType || "application/pdf",
        bytes: Buffer.isBuffer(payload.doc.bytes) ? payload.doc.bytes : Buffer.from(payload.doc.bytes),
      },
    ],
  });
  if (!sent.ok) {
    console.error("[email] Mailgun send failed", { applicationId, requestId, error: sent.error });
  }
}

export async function sendOutcomeUaeAuthorityRejectionEmail(
  applicationId: string,
  outcomeDocumentId: string,
  requestId: string | null,
): Promise<void> {
  if (!isMailgunConfigured()) {
    console.warn("[email] Mailgun not configured; skipping outcome_uae_authority_rejection", {
      applicationId,
      requestId,
    });
    return;
  }

  const payload = await withSystemDbActor(async (tx) => {
    const [app] = await tx.select().from(application).where(eq(application.id, applicationId)).limit(1);
    if (!app) return null;
    const to = await resolveApplicantEmailTx(tx, app);
    const [doc] = await tx
      .select({
        id: applicationDocument.id,
        documentType: applicationDocument.documentType,
        status: applicationDocument.status,
        contentType: applicationDocument.contentType,
        originalFilename: applicationDocument.originalFilename,
        bytes: applicationDocumentBlob.bytes,
      })
      .from(applicationDocument)
      .innerJoin(applicationDocumentBlob, eq(applicationDocumentBlob.documentId, applicationDocument.id))
      .where(
        and(
          eq(applicationDocument.id, outcomeDocumentId),
          eq(applicationDocument.applicationId, applicationId),
          eq(applicationDocument.documentType, DOCUMENT_TYPE.OUTCOME_AUTHORITY_REJECTION),
          eq(applicationDocument.status, DOCUMENT_STATUS.RETAINED),
        ),
      )
      .limit(1);
    if (!doc?.bytes) return null;
    return { app, to, doc };
  });

  if (!payload?.to || !payload.doc) {
    console.warn("[email] Missing recipient or outcome document for UAE authority rejection", {
      applicationId,
      outcomeDocumentId,
      requestId,
    });
    return;
  }

  const claimed = await tryClaimTransactionalEmail(
    applicationId,
    TRANSACTIONAL_EMAIL_KINDS.OUTCOME_UAE_AUTHORITY_REJECTION,
  );
  if (!claimed) {
    console.info("[email] outcome_uae_authority_rejection already recorded (skip duplicate)", {
      applicationId,
      requestId,
    });
    return;
  }

  const ref = payload.app.referenceNumber ?? payload.app.id.slice(0, 8);
  const subject = `${transactionalSubjectPrefix()}Update on your visa application`;
  const { text: bodyText, html: bodyHtml } = buildOutcomeUaeAuthorityRejectionBodies(ref);
  const text = withTransactionalFooter(bodyText);
  const html = appendTransactionalHtmlFooter(bodyHtml);

  const filename = safeFilename(payload.doc.originalFilename, "authority-decision.pdf");
  const sent = await mailgunSendText({
    to: payload.to,
    subject,
    text,
    html,
    attachments: [
      {
        filename,
        contentType: payload.doc.contentType || "application/pdf",
        bytes: Buffer.isBuffer(payload.doc.bytes) ? payload.doc.bytes : Buffer.from(payload.doc.bytes),
      },
    ],
  });
  if (!sent.ok) {
    console.error("[email] Mailgun send failed", { applicationId, requestId, error: sent.error });
  }
}
