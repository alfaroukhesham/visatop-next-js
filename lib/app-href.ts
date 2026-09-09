import { getAppOrigin } from "@/lib/app-url";

const joinUrl = (base: string, path: string): string => {
  const b = base.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
};

/** Matches `basePath` in `next.config.ts` when `NEXT_PUBLIC_BASE_PATH` is unset. */
const DEFAULT_NEXT_BASE_PATH = "/visa-processing";

const resolveClientBasePath = (): string => {
  // Prefer explicit configuration (used by local/ngrok/prod consistently).
  const env = process.env.NEXT_PUBLIC_BASE_PATH?.trim();
  if (env) return env.startsWith("/") ? env : `/${env}`;

  // Fallback: infer from current pathname (works for this project’s /visa-processing mount).
  if (typeof window !== "undefined") {
    const p = window.location.pathname || "";
    if (p === "/visa-processing" || p.startsWith("/visa-processing/")) return "/visa-processing";
  }
  // Server / build: same default as Next `basePath` so `appHref` / `apiHref` match real routes.
  return DEFAULT_NEXT_BASE_PATH;
};

/**
 * Next `router.push` already prepends `basePath`. Callback URLs and `appHref`
 * inputs must be router-relative (`/apply/...`), not `/visa-processing/apply/...`.
 */
export const stripAppBasePath = (path: string): string => {
  const basePath = resolveClientBasePath();
  const raw = path.startsWith("/") ? path : `/${path}`;
  if (!basePath || basePath === "/") return raw;

  const queryAt = raw.indexOf("?");
  const hashAt = raw.indexOf("#");
  let cut = raw.length;
  if (queryAt >= 0) cut = Math.min(cut, queryAt);
  if (hashAt >= 0) cut = Math.min(cut, hashAt);
  const pathname = raw.slice(0, cut);
  const rest = raw.slice(cut);

  let stripped = pathname;
  if (pathname === basePath) {
    stripped = "/";
  } else if (pathname.startsWith(`${basePath}/`)) {
    stripped = pathname.slice(basePath.length) || "/";
  }
  return `${stripped}${rest}`;
};

/**
 * Build a URL under the app's base path.
 * - In the browser: returns a same-origin path (avoids CORS / cookie issues).
 * - On the server: returns an absolute URL using NEXT_PUBLIC_APP_URL / BETTER_AUTH_URL.
 * Idempotent: a path that already includes `basePath` is not prefixed again.
 */
export const appHref = (path: string): string => {
  const p = stripAppBasePath(path);
  const basePath = resolveClientBasePath();
  const suffix = p === "/" ? "" : p;
  if (typeof window !== "undefined") {
    return `${basePath}${suffix}`;
  }
  return joinUrl(getAppOrigin(), `${basePath}${suffix}`);
};

/**
 * Build a URL for same-origin API routes under the app's base path.
 */
export const apiHref = (path: string): string => {
  const p = path.replace(/^\/+/, "");
  return appHref(`/api/${p}`);
};

