export type TAnalyticsDeviceType = "mobile" | "tablet" | "desktop";

export const analyticsDeviceType = (
  ua = typeof navigator !== "undefined" ? navigator.userAgent : "",
): TAnalyticsDeviceType => {
  if (/iPad|Tablet|PlayBook/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  return "desktop";
};
