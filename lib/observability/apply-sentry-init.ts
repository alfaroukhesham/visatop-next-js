import type { TSharedSentryInitOptions } from "./sentry-options";
import type { TSentryEventLike } from "./sentry-scrub";

type TSentryInitFn = (options: Record<string, unknown>) => unknown;

/**
 * Apply shared GlitchTip options to the runtime-specific `Sentry.init`.
 * Hooks are wrapped so ErrorEvent / TransactionEvent stay assignable.
 */
export const applySentryInit = (
  init: TSentryInitFn,
  options: TSharedSentryInitOptions,
): void => {
  init({
    dsn: options.dsn,
    environment: options.environment,
    release: options.release,
    tracesSampleRate: options.tracesSampleRate,
    sendDefaultPii: options.sendDefaultPii,
    maxBreadcrumbs: options.maxBreadcrumbs,
    beforeSend: (event: TSentryEventLike) => options.beforeSend(event),
    beforeSendTransaction: (event: TSentryEventLike) =>
      options.beforeSendTransaction(event),
  });
};
