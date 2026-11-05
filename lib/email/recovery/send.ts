import {
  isResumeEmailLinkSecretConfigured,
  signResumeEmailLink,
} from "@/lib/applications/resume-email-link";
import { appHref } from "@/lib/app-href";
import {
  releaseTransactionalEmailClaim,
  tryClaimTransactionalEmail,
} from "@/lib/email/claim-transactional-email";
import { isMailgunConfigured, mailgunSendText } from "@/lib/email/mailgun";
import { formatMinorUnitsAmount } from "@/lib/pricing/format-minor-units";
import { buildCheckoutRecoveryEmailBodies } from "./build-bodies";
import { CHECKOUT_RECOVERY_KIND } from "./decide";
import { guestCheckoutResumeReady } from "./load-candidates";
import type { TCheckoutRecoveryLoaded } from "./load-candidates";

/**
 * Claim is inserted before Mailgun so overlapping crons cannot double-send.
 * If Mailgun rejects or throws, the claim is deleted so the next cron retries.
 * Crash after insert and before Mailgun accept leaves the claim; that edge is
 * accepted (no sent-flag column without a migration) and the application is
 * skipped until the row is removed by hand.
 */
export const checkoutRecoveryCtaUrl = (input: {
  partyId: string | null;
  applicationId: string;
  draftExpiresAt: Date | null;
  isGuest: boolean;
  now?: Date;
}): string | null => {
  if (!input.isGuest) {
    return appHref(`/apply/applications/${input.applicationId}/payment`);
  }
  const now = input.now ?? new Date();
  const { partyId, draftExpiresAt } = input;
  if (
    !partyId ||
    !draftExpiresAt ||
    !guestCheckoutResumeReady({
      isGuest: true,
      partyId,
      draftExpiresAt,
      now,
    })
  ) {
    return null;
  }
  const signed = signResumeEmailLink(partyId, input.applicationId, draftExpiresAt);
  return appHref(`/apply/resume?t=${encodeURIComponent(signed)}`);
};

export type TSendCheckoutRecoveryResult =
  | { ok: true; claimed: true }
  | { ok: true; claimed: false; skipped: "already_sent" | "guest_resume_unavailable" }
  | { ok: false; error: string };

export const sendCheckoutRecoveryEmail = async (
  loaded: TCheckoutRecoveryLoaded,
  now: Date = new Date(),
): Promise<TSendCheckoutRecoveryResult> => {
  if (!isMailgunConfigured()) {
    return { ok: false, error: "mailgun_not_configured" };
  }

  if (loaded.isGuest && !isResumeEmailLinkSecretConfigured()) {
    return { ok: true, claimed: false, skipped: "guest_resume_unavailable" };
  }

  const ctaUrl = checkoutRecoveryCtaUrl({
    partyId: loaded.partyId,
    applicationId: loaded.applicationId,
    draftExpiresAt: loaded.draftExpiresAt,
    isGuest: loaded.isGuest,
    now,
  });
  if (!ctaUrl) {
    return { ok: true, claimed: false, skipped: "guest_resume_unavailable" };
  }

  const claimed = await tryClaimTransactionalEmail(loaded.applicationId, CHECKOUT_RECOVERY_KIND);
  if (!claimed) return { ok: true, claimed: false, skipped: "already_sent" };

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

  try {
    const sent = await mailgunSendText({
      to: loaded.to,
      subject: bodies.subject,
      text: bodies.text,
      html: bodies.html,
    });
    if (!sent.ok) {
      await releaseTransactionalEmailClaim(loaded.applicationId, CHECKOUT_RECOVERY_KIND);
      return { ok: false, error: sent.error };
    }
    return { ok: true, claimed: true };
  } catch (err) {
    await releaseTransactionalEmailClaim(loaded.applicationId, CHECKOUT_RECOVERY_KIND);
    return { ok: false, error: err instanceof Error ? err.message : "mailgun_throw" };
  }
};
