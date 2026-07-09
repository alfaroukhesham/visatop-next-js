/**
 * Paths that must never send GA4 / Ads hits (admin console).
 * Accepts basePath-stripped (`/admin`) or public (`/visa-processing/admin`) paths.
 */
export function isAnalyticsExcludedPath(pathname: string): boolean {
  const p = (pathname.split("?")[0] || "/").replace(/\/$/, "") || "/";
  const withoutBase = p.replace(/^\/visa-processing(?=\/|$)/, "") || "/";
  return withoutBase === "/admin" || withoutBase.startsWith("/admin/");
}
