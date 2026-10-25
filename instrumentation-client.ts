import * as Sentry from "@sentry/nextjs";
import { applySentryInit } from "@/lib/observability/apply-sentry-init";
import { isSentryEnabled } from "@/lib/observability/sentry-env";
import { buildSharedSentryInitOptions } from "@/lib/observability/sentry-options";
import {
  extractApplicationIdFromPath,
  resolvePaymentProviderTag,
} from "@/lib/observability/sentry-tags";

const options = buildSharedSentryInitOptions();
if (options) {
  applySentryInit(Sentry.init as Parameters<typeof applySentryInit>[0], options);
}

export const onRouterTransitionStart = (href: string, navigationType: string): void => {
  if (!isSentryEnabled()) return;
  Sentry.captureRouterTransitionStart(href, navigationType);
  const applicationId = extractApplicationIdFromPath(href);
  if (applicationId) Sentry.setTag("applicationId", applicationId);
  Sentry.setTag("payment_provider", resolvePaymentProviderTag());
};
