import { getAppOrigin } from "@/lib/app-url";

/**
 * Full canonical URL for GA4 event params (`https://visatop.com/visa-processing/...`).
 * Prefer the live browser location when available so SPA navigations stay accurate.
 */
export function getCanonicalPageLocation(pathname?: string, search?: string): string {
  if (typeof window !== "undefined") {
    const path = pathname ?? window.location.pathname;
    const q = search ?? window.location.search;
    return `${window.location.origin}${path}${q}`;
  }
  const path = pathname ?? "/";
  const q = search ?? "";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getAppOrigin()}${normalized}${q}`;
}

/** Path under the public site including basePath, e.g. `/visa-processing/apply/start`. */
export function getCanonicalPagePath(pathname?: string, search?: string): string {
  if (typeof window !== "undefined") {
    const path = pathname ?? window.location.pathname;
    const q = search ?? window.location.search;
    return `${path}${q}`;
  }
  const path = pathname ?? "/";
  const q = search ?? "";
  return `${path.startsWith("/") ? path : `/${path}`}${q}`;
}
