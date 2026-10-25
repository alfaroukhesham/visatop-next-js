export type TAnalyticsDeviceType = "mobile" | "tablet" | "desktop";

export const analyticsDeviceType = (
  ua = typeof navigator !== "undefined" ? navigator.userAgent : "",
): TAnalyticsDeviceType => {
  if (/iPad|Tablet|PlayBook/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  return "desktop";
};

/** Server ingest: empty UA is unknown rather than assumed desktop. */
export const analyticsDeviceTypeFromUserAgent = (
  ua: string | null | undefined,
): TAnalyticsDeviceType | null => {
  const value = ua?.trim() ?? "";
  if (!value) return null;
  return analyticsDeviceType(value);
};

export const sanitizeAnalyticsDeviceType = (raw: unknown): TAnalyticsDeviceType | null => {
  if (raw === "mobile" || raw === "tablet" || raw === "desktop") return raw;
  return null;
};
