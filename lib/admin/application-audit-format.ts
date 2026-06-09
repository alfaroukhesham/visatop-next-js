export type AdminApplicationAuditRow = {
  id: string;
  action: string;
  actorId: string | null;
  actorType: string;
  createdAt: Date;
  _derived?: boolean;
  beforeJson?: string | null;
  afterJson?: string | null;
};

function tryParseJson(v: string | null | undefined): unknown {
  if (!v) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function titleCaseFromSnake(v: string): string {
  return v
    .split("_")
    .filter(Boolean)
    .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
    .join(" ");
}

function formatDocType(v: unknown): string {
  if (typeof v !== "string" || !v) return "unknown";
  switch (v) {
    case "passport_copy":
      return "Passport copy";
    case "personal_photo":
      return "Personal photo";
    case "admin_step_attachment":
      return "Admin step attachment";
    case "outcome_approval":
      return "Outcome (approval)";
    case "outcome_authority_rejection":
      return "Outcome (UAE rejection)";
    default:
      return titleCaseFromSnake(v);
  }
}

export function formatAuditActionTitle(action: string): string {
  switch (action) {
    case "payment_marked_paid":
      return "Payment confirmed (marked as paid)";
    case "payment_amount_mismatch_flagged":
      return "Payment amount mismatch (flagged for review)";
    case "payment_paid_docs_retain_failed_flagged":
      return "Post-payment document retention failed (flagged)";
    case "payment_paid_but_application_cancelled":
      return "Paid event received for a cancelled application (flagged)";
    case "payment_failed":
      return "Payment failed";
    case "guest_application_linked":
      return "Guest application linked to user account";
    case "application.attention.cleared":
      return "Admin cleared the attention flag";
    case "application.admin_ops_step":
      return "Admin ops step updated";
    case "application_document.admin_upload":
      return "Admin uploaded a document";
    default:
      if (action.startsWith("application.transition.")) return "Application status changed";
      if (action.startsWith("application.profile.")) return "Applicant profile updated";
      if (action.startsWith("catalog.")) return "Catalog updated";
      if (action.startsWith("pricing.")) return "Pricing updated";
      if (action.startsWith("settings.")) return "Settings updated";
      return action;
  }
}

export function formatAuditActionHint(log: AdminApplicationAuditRow): string | null {
  switch (log.action) {
    case "payment_marked_paid":
      return "Webhook confirmed payment; app moved into processing.";
    case "payment_amount_mismatch_flagged":
      return "Paid, but the amount didn’t match what we expected. Check pricing + payment records.";
    case "payment_paid_docs_retain_failed_flagged":
      return "Paid, but required docs could not be retained. Check document storage + required docs.";
    case "payment_paid_but_application_cancelled":
      return "Paid webhook arrived after cancellation. Validate intent and decide next steps.";
    case "payment_failed":
      return "Paddle reported payment failure. Customer may need to retry checkout.";
    case "guest_application_linked":
      return "User account now owns this previously-guest application.";
    default:
      return null;
  }
}

export function formatAuditInlineDetails(log: AdminApplicationAuditRow): string | null {
  const after = tryParseJson(log.afterJson) as Record<string, unknown> | null;
  if (!after) return null;

  if (log.action === "payment_amount_mismatch_flagged") {
    const expected = after.expectedAmountMinor ?? after.paymentAmountMinor;
    const received = after.receivedAmountMinor ?? after.eventAmountMinor;
    if (typeof expected === "number" && typeof received === "number") {
      return `Expected ${expected} (minor units), received ${received}.`;
    }
  }

  if (log.action === "payment_paid_docs_retain_failed_flagged") {
    const { retention } = after;
    if (retention && typeof retention === "object") {
      const r = retention as Record<string, unknown>;
      const { reason } = r;
      const missing = Array.isArray(r.missing) ? r.missing : null;

      if (reason === "MISSING_REQUIRED_DOCUMENT" && missing?.length) {
        return `Missing required: ${missing.map(formatDocType).join(", ")}.`;
      }
      if (reason === "BLOB_BYTES_MISSING" && missing?.length) {
        return `Uploaded, but bytes missing for: ${missing.map(formatDocType).join(", ")}.`;
      }
      if (typeof reason === "string" && reason) {
        return `Retention failed: ${titleCaseFromSnake(reason)}.`;
      }
    }

    const err = after.error;
    if (typeof err === "string" && err) return `Error: ${err}`;
    if (err && typeof err === "object") return "Error: see details JSON";
  }

  if (log.action === "payment_marked_paid") {
    const { transactionId: txn, providerEventId } = after;
    if (typeof txn === "string" && txn) {
      return `Transaction: ${txn}${typeof providerEventId === "string" ? ` · Event: ${providerEventId}` : ""}`;
    }
  }

  return null;
}
