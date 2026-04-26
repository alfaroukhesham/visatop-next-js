import { and, eq } from "drizzle-orm";
import { withSystemDbActor } from "@/lib/db/actor-context";
import {
  application,
  applicationDocument,
  applicationDocumentBlob,
  DOCUMENT_STATUS,
  DOCUMENT_TYPE,
} from "@/lib/db/schema";
import { tryClaimTransactionalEmail } from "./claim-transactional-email";
import { TRANSACTIONAL_EMAIL_KINDS } from "./transactional-email-kinds";
import { resolveApplicantEmailTx } from "./resolve-applicant-email";
import { isMailgunConfigured, mailgunSendText } from "./mailgun";
import { transactionalSubjectPrefix, withTransactionalFooter } from "./transactional-footer";

function safeFilename(name: string | null, fallback: string) {
  const n = (name ?? "").replace(/[^\w.\-()+ ]/g, "_").slice(0, 120);
  return n.length > 0 ? n : fallback;
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
    const [app] = await tx.select().from(application).where(eq(application.id, applicationId)).limit(1);
    if (!app) return null;
    const to = await resolveApplicantEmailTx(tx, app);
    return { app, to };
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
  const subject = `${transactionalSubjectPrefix()}Payment received — we are processing your application`;
  const text = withTransactionalFooter(
    `Hello,\n\nWe have received your payment for visa application ${ref}. Your application is now in progress.\n\nIf you did not expect this message, please contact us.`,
  );

  const sent = await mailgunSendText({ to: payload.to, subject, text });
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
  const text = withTransactionalFooter(
    `Hello,\n\nGood news: your visa application ${ref} has been completed successfully.\n\nPlease find your document attached to this message.\n\nIf you have questions, reply to this email or contact support.`,
  );

  const filename = safeFilename(payload.doc.originalFilename, "visa-document.pdf");
  const sent = await mailgunSendText({
    to: payload.to,
    subject,
    text,
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
  const text = withTransactionalFooter(
    `Hello,\n\nRegarding application ${ref}: the UAE authorities did not approve this visa request.\n\nWe have attached the official documentation we received for your records.\n\nIf you have questions, reply to this email or contact support.`,
  );

  const filename = safeFilename(payload.doc.originalFilename, "authority-decision.pdf");
  const sent = await mailgunSendText({
    to: payload.to,
    subject,
    text,
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
