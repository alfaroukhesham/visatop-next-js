import { parseCustomerLocale } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_WHATSAPP_URL } from "@/lib/support-contact";
import {
  appendTransactionalHtmlFooter,
  buildTransactionalEmailHtml,
  escapeHtml,
} from "@/lib/email/transactional-email-html";
import { transactionalSubjectPrefix, withTransactionalFooter } from "@/lib/email/transactional-footer";
import { firstNameFromFullName } from "./first-name";
import { paymentProviderLabel } from "./provider-label";

export type TCheckoutRecoveryCopyInput = {
  locale: string;
  fullName: string | null;
  visaName: string;
  reference: string;
  amountLine: string;
  provider: string | null;
  ctaUrl: string;
};

export type TCheckoutRecoveryBodies = {
  subject: string;
  text: string;
  html: string;
  ctaLabel: string;
};

const greetingLine = (
  firstName: string | null,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string => {
  if (firstName) return t("email.recovery.greetingWithName", { firstName });
  return t("email.recovery.greetingNoName");
};

export const buildCheckoutRecoveryEmailBodies = (
  input: TCheckoutRecoveryCopyInput,
): TCheckoutRecoveryBodies => {
  const locale = parseCustomerLocale(input.locale);
  const t = createCustomerT(locale);
  const greeting = greetingLine(firstNameFromFullName(input.fullName), t);
  const subject = t("email.recovery.checkout.subject", { visaName: input.visaName });
  const eyebrow = t("email.recovery.checkout.eyebrow");
  const body = t("email.recovery.checkout.body", {
    reference: input.reference,
    amount: input.amountLine,
  });
  const footer = t("email.recovery.checkout.footer", {
    provider: paymentProviderLabel(input.provider),
  });
  const ctaLabel = t("email.recovery.checkout.cta");
  const lead = `${greeting} ${body}`;

  const text = withTransactionalFooter(
    [lead, "", `${ctaLabel}: ${input.ctaUrl}`, "", footer, SUPPORT_PHONE_DISPLAY, SUPPORT_WHATSAPP_URL].join(
      "\n",
    ),
  );

  const bodyRowsHtml = `<tr>
      <td style="padding:16px 18px;">
        <p style="margin:0 0 12px;">${escapeHtml(lead)}</p>
        <p style="margin:20px 0 0;text-align:center;">
          <a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;padding:12px 24px;background:#111827;color:#ffffff;text-decoration:none;font-weight:600;border-radius:4px;">${escapeHtml(ctaLabel)}</a>
        </p>
        <p style="margin:16px 0 0;font-size:13px;">${escapeHtml(footer)} <a href="${escapeHtml(SUPPORT_WHATSAPP_URL)}" style="color:#2563eb;">${escapeHtml(SUPPORT_PHONE_DISPLAY)}</a></p>
      </td>
    </tr>`;

  const html = appendTransactionalHtmlFooter(
    buildTransactionalEmailHtml({
      eyebrow,
      bodyRowsHtml,
    }),
  );

  return {
    subject: `${transactionalSubjectPrefix()}${subject}`,
    text,
    html,
    ctaLabel,
  };
};
