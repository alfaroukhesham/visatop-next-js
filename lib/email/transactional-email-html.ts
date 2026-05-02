import { appHref } from "@/lib/app-href";
import { getTransactionalEmailFooter } from "./transactional-footer";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** UAE support line; digits only for wa.me. */
export const SUPPORT_PHONE_E164_DIGITS = "971503156105";
export const SUPPORT_PHONE_DISPLAY = "+971 50 3156 105";
export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_PHONE_E164_DIGITS}`;

export function supportContactPlainText(): string {
  return `If you require any assistance, please contact us by replying to this email, or WhatsApp / call us at ${SUPPORT_PHONE_DISPLAY} (WhatsApp: ${SUPPORT_WHATSAPP_URL}).`;
}

/** Shared support line for HTML bodies (matches plain-text wording). */
export function supportContactParagraphHtml(): string {
  return `<p style="margin:12px 0 0;font-size:12px;">If you require any assistance, please contact us by replying to this email, or WhatsApp / call us at <a href="${SUPPORT_WHATSAPP_URL}" style="color:#2563eb;">${escapeHtml(SUPPORT_PHONE_DISPLAY)}</a> (opens WhatsApp).</p>`;
}

export type TransactionalEmailHtmlLayout = {
  /** Small uppercase label above the card (e.g. “Payment receipt”). */
  eyebrow: string;
  /** Optional lines under the logo in the black header (use <div><strong>…</strong> …</div>); values must be safe / pre-escaped. */
  headerDetailsHtml?: string;
  /** One or more <tr>…</tr> rows after the logo row inside the bordered table. */
  bodyRowsHtml: string;
};

/**
 * Shared transactional email shell: eyebrow, black header + logo, optional header meta, body rows.
 * Caller appends legal/footer via {@link appendTransactionalHtmlFooter}.
 */
export function buildTransactionalEmailHtml(layout: TransactionalEmailHtmlLayout): string {
  const logoUrl = appHref("/visatop-logo.png");
  const headerDetails = layout.headerDetailsHtml?.trim()
    ? `<div style="margin-top:14px;font-size:13px;color:#e5e7eb;text-align:left;">${layout.headerDetailsHtml}</div>`
    : "";

  return `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
  <p style="margin:0 0 16px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(layout.eyebrow)}</p>
  <table role="presentation" width="100%" style="max-width:520px;border-collapse:collapse;border:1px solid #e5e7eb;">
    <tr>
      <td style="padding:20px 18px;background:#000000;border-bottom:1px solid #e5e7eb;text-align:center;">
        <img src="${logoUrl}" width="220" alt="VisaTop.com logo" style="display:block;margin:0 auto;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
        ${headerDetails}
      </td>
    </tr>
    ${layout.bodyRowsHtml}
  </table>
</body>
</html>`;
}

export function appendTransactionalHtmlFooter(html: string): string {
  return html.replace(
    "</body>",
    `<p style="margin-top:24px;font-size:11px;color:#9ca3af;">${escapeHtml(getTransactionalEmailFooter())}</p></body>`,
  );
}
