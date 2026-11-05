import {
  isResumeEmailLinkSecretConfigured,
  signResumeEmailLink,
} from "@/lib/applications/resume-email-link";
import { appHref } from "@/lib/app-href";
import { tryClaimTransactionalEmail } from "@/lib/email/claim-transactional-email";
import { isMailgunConfigured, mailgunSendText } from "@/lib/email/mailgun";
import { formatMinorUnitsAmount } from "@/lib/pricing/format-minor-units";
import { buildCheckoutRecoveryEmailBodies } from "./build-bodies";
import { CHECKOUT_RECOVERY_KIND } from "./decide";
import type { TCheckoutRecoveryLoaded } from "./load-candidates";

export const checkoutRecoveryCtaUrl = (input: {
  partyId: string | null;
  applicationId: string;
  draftExpiresAt: Date | null;
  isGuest: boolean;
  now?: Date;
}): string => {
  const paymentUrl = appHref(`/apply/applications/${input.applicationId}/payment`);
  if (!input.isGuest) return paymentUrl;
  if (!input.partyId || !input.draftExpiresAt || !isResumeEmailLinkSecretConfigured()) {
    return paymentUrl;
  }
  const now = input.now ?? new Date();
  if (input.draftExpiresAt.getTime() <= now.getTime()) return paymentUrl;
  const signed = signResumeEmailLink(input.partyId, input.applicationId, input.draftExpiresAt);
  return appHref(`/apply/resume?t=${encodeURIComponent(signed)}`);
};

export type TSendCheckoutRecoveryResult =
  | { ok: true; claimed: true }
  | { ok: true; claimed: false; skipped: "already_sent" }
  | { ok: false; error: string };

export const sendCheckoutRecoveryEmail = async (
  loaded: TCheckoutRecoveryLoaded,
  now: Date = new Date(),
): Promise<TSendCheckoutRecoveryResult> => {
  if (!isMailgunConfigured()) {
    return { ok: false, error: "mailgun_not_configured" };
  }

  const claimed = await tryClaimTransactionalEmail(loaded.applicationId, CHECKOUT_RECOVERY_KIND);
  if (!claimed) return { ok: true, claimed: false, skipped: "already_sent" };

  const ctaUrl = checkoutRecoveryCtaUrl({
    partyId: loaded.partyId,
    applicationId: loaded.applicationId,
    draftExpiresAt: loaded.draftExpiresAt,
    isGuest: loaded.isGuest,
    now,
  });
  const amountLine =
    loaded.amountMinor != null
      ? formatMinorUnitsAmount(loaded.amountMinor, loaded.currency, { locale: "en-US" })
      : "—";

  const bodies = buildCheckoutRecoveryEmailBodies({
    locale: loaded.locale,
    fullName: loaded.fullName,
    visaName: loaded.visaName,
    reference: loaded.reference,
    amountLine,
    provider: loaded.paymentProvider,
    ctaUrl,
  });

  const sent = await mailgunSendText({
    to: loaded.to,
    subject: bodies.subject,
    text: bodies.text,
    html: bodies.html,
  });
  if (!sent.ok) return { ok: false, error: sent.error };
  return { ok: true, claimed: true };
};
