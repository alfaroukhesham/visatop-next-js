/**
 * Staging-only idle skip so `weathered-resonance` can scale to zero.
 *
 * `APP_ENV=staging` (droplet staging) skips scheduled/probe DB work unless
 * `STAGING_ALLOW_IDLE_DB_WAKE` is true/1. Production is never affected.
 * Real tester traffic (apply, catalog, admin) still hits Neon and wakes it.
 */
export const shouldSkipStagingIdleDbWake = (
  env: NodeJS.Dict<string> = process.env,
): boolean => {
  if (env.APP_ENV?.trim() !== "staging") return false;
  const allow = env.STAGING_ALLOW_IDLE_DB_WAKE?.trim().toLowerCase();
  return allow !== "true" && allow !== "1";
};
