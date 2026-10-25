const TRUSTED_GEO_HEADERS = [
  "cf-ipcountry",
  "cf-ip-country",
  "x-vercel-ip-country",
  "cloudfront-viewer-country",
  "x-country-code",
  "x-geo-country-code",
  "x-appengine-country",
] as const;

/** Cloudflare / CDN placeholders that are not a real ISO country. */
const UNTRUSTED_COUNTRY_CODES = new Set(["XX", "T1", "A1", "A2", "O1"]);

export const sanitizeAnalyticsCountryCode = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  if (UNTRUSTED_COUNTRY_CODES.has(code)) return null;
  return code;
};

/** Country from a trusted edge/geo header. Never derived from the client body. */
export const analyticsCountryFromHeaders = (hdrs: Headers): string | null => {
  for (const name of TRUSTED_GEO_HEADERS) {
    const code = sanitizeAnalyticsCountryCode(hdrs.get(name));
    if (code) return code;
  }
  return null;
};

export const analyticsCountryForFunnelEvent = (input: {
  geoCountry?: string | null;
  nationalityCode?: string | null;
}): string | null =>
  sanitizeAnalyticsCountryCode(input.geoCountry) ??
  sanitizeAnalyticsCountryCode(input.nationalityCode);
