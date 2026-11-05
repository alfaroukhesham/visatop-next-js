/**
 * Checkout-opened-not-paid recovery email. Default off.
 *
 * TODO: generic same-day continue email (abandoned draft after last activity).
 * TODO: next-day tips email.
 * TODO: travel reminder email.
 * TODO: unsubscribe / suppression, /apply/email-reminders, List-Unsubscribe.
 * TODO: Mailgun bounce/complaint webhook.
 * TODO: persist applicant locale so this cron can send AR/FR (catalogs already have copy; cron defaults to EN).
 */

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
};

/** Default off until the owner sets RECOVERY_EMAILS_ENABLED=true. */
export const isRecoveryEmailsEnabled = (): boolean =>
  process.env.RECOVERY_EMAILS_ENABLED === "true";

/** Minutes after checkout_created before the unpaid reminder. Default 60. */
export const getCheckoutRecoveryDelayMs = (): number =>
  parsePositiveInt(process.env.RECOVERY_EMAIL_CHECKOUT_DELAY_MINUTES, 60) * 60_000;

/**
 * Ignore checkouts older than this (hours). Default 24 so the first enable
 * does not mail a multi-day backlog.
 */
export const getCheckoutRecoveryMaxAgeMs = (): number =>
  parsePositiveInt(process.env.RECOVERY_EMAIL_CHECKOUT_MAX_AGE_HOURS, 24) * 60 * 60_000;

export const CHECKOUT_RECOVERY_BATCH_SIZE = 100;
