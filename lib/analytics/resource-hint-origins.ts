/** Origins Microsoft Clarity requests after the bootstrap snippet runs. */
export const CLARITY_PRECONNECT_ORIGINS = [
  "https://www.clarity.ms",
  "https://scripts.clarity.ms",
] as const;

/** Origins Google tag / Ads / Meta Pixel request on production customer pages. */
export const MARKETING_PRECONNECT_ORIGINS = [
  "https://www.googletagmanager.com",
  "https://connect.facebook.net",
  "https://analytics.google.com",
] as const;

export const MARKETING_DNS_PREFETCH_ORIGINS = [
  "https://googleads.g.doubleclick.net",
  "https://ad.doubleclick.net",
  "https://stats.g.doubleclick.net",
  "https://www.google.com",
] as const;
