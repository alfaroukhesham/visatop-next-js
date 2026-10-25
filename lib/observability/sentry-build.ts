import {
  resolveSentryRelease,
  shouldUploadGlitchTipSourceMaps,
} from "./sentry-env";

export type TSentryWebpackPluginOptions = {
  org: string;
  project: string;
  sentryUrl?: string;
  authToken?: string;
  sourcemaps: { disable: boolean };
  release: {
    name?: string;
    create: boolean;
    finalize: boolean;
  };
  silent: boolean;
  telemetry: false;
  automaticVercelMonitors: false;
};

export const buildSentryWebpackPluginOptions = (): TSentryWebpackPluginOptions => {
  const upload = shouldUploadGlitchTipSourceMaps();
  const sentryUrl = process.env.SENTRY_URL?.trim() || undefined;
  return {
    org: process.env.SENTRY_ORG?.trim() || "visatop",
    project: process.env.SENTRY_PROJECT?.trim() || "visatop-next",
    sentryUrl,
    authToken: upload ? process.env.SENTRY_AUTH_TOKEN?.trim() : undefined,
    sourcemaps: { disable: !upload },
    release: {
      name: resolveSentryRelease(),
      create: upload,
      finalize: upload,
    },
    silent: true,
    telemetry: false,
    automaticVercelMonitors: false,
  };
};
