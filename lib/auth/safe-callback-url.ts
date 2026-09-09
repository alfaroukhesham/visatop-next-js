import { stripAppBasePath } from "@/lib/app-href";

/** Same-origin relative paths only; prevents open redirects. */
export const safeCallbackUrl = (raw: string | null, fallback = "/portal/track"): string => {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  // `router.push` prepends Next `basePath`. Strip it so callers that passed
  // `appHref(...)` (a browser path) do not become `/visa-processing/visa-processing/...`.
  const nextPath = stripAppBasePath(raw);
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return fallback;
  }
  return nextPath;
};
