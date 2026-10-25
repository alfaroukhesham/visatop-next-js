const present = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const clampRate = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
};

export const resolveSentryDsn = (): string | undefined => {
  if (typeof window !== "undefined") {
    return present(process.env.NEXT_PUBLIC_SENTRY_DSN);
  }
  return present(process.env.SENTRY_DSN) ?? present(process.env.NEXT_PUBLIC_SENTRY_DSN);
};

export const isSentryEnabled = (): boolean => Boolean(resolveSentryDsn());

/**
 * Staging Docker images run with NODE_ENV=production. Use APP_ENV so GlitchTip
 * can distinguish staging vs production.
 */
export const resolveAppEnv = (): string =>
  present(process.env.APP_ENV) ?? present(process.env.NEXT_PUBLIC_APP_ENV) ?? "development";

export const resolveSentryRelease = (): string | undefined =>
  present(process.env.SENTRY_RELEASE) ??
  present(process.env.NEXT_PUBLIC_SENTRY_RELEASE) ??
  present(process.env.GIT_SHA) ??
  present(process.env.NEXT_PUBLIC_GIT_SHA);

export const resolveTracesSampleRate = (): number => {
  const raw =
    present(process.env.SENTRY_TRACES_SAMPLE_RATE) ??
    present(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE);
  if (!raw) return 0.1;
  return clampRate(Number(raw), 0.1);
};

/** Source-map upload to self-hosted GlitchTip only — never sentry.io by default. */
export const shouldUploadGlitchTipSourceMaps = (): boolean =>
  Boolean(present(process.env.SENTRY_AUTH_TOKEN) && present(process.env.SENTRY_URL));
