/** WordPress visatop.com Clarity project — same id as the marketing site. */
export const DEFAULT_CLARITY_PROJECT_ID = "waxpllatey";

/**
 * Public Clarity project id.
 * Unset → WordPress default. Explicit empty (or whitespace) → do not load.
 */
export const getClarityProjectId = (): string => {
  const raw = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  if (raw === undefined) return DEFAULT_CLARITY_PROJECT_ID;
  return raw.trim();
};
