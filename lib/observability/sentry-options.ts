import {
  isSentryEnabled,
  resolveAppEnv,
  resolveSentryDsn,
  resolveSentryRelease,
  resolveTracesSampleRate,
} from "./sentry-env";
import { applyObservabilityTags } from "./sentry-tags";
import { scrubSentryEvent, type TSentryEventLike } from "./sentry-scrub";

export type TSharedSentryInitOptions = {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
  sendDefaultPii: false;
  maxBreadcrumbs: number;
  beforeSend: (event: TSentryEventLike) => TSentryEventLike | null;
  beforeSendTransaction: (event: TSentryEventLike) => TSentryEventLike | null;
};

const prepareEvent = (event: TSentryEventLike): TSentryEventLike =>
  applyObservabilityTags(scrubSentryEvent(event));

export const buildSharedSentryInitOptions = (): TSharedSentryInitOptions | null => {
  if (!isSentryEnabled()) return null;
  const dsn = resolveSentryDsn();
  if (!dsn) return null;
  return {
    dsn,
    environment: resolveAppEnv(),
    release: resolveSentryRelease(),
    tracesSampleRate: resolveTracesSampleRate(),
    sendDefaultPii: false,
    maxBreadcrumbs: 20,
    beforeSend: prepareEvent,
    beforeSendTransaction: prepareEvent,
  };
};
