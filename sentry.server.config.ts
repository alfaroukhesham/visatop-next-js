import * as Sentry from "@sentry/nextjs";
import { applySentryInit } from "@/lib/observability/apply-sentry-init";
import { buildSharedSentryInitOptions } from "@/lib/observability/sentry-options";

const options = buildSharedSentryInitOptions();
if (options) {
  applySentryInit(Sentry.init as Parameters<typeof applySentryInit>[0], options);
}
