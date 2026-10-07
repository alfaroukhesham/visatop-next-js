import { getAppOrigin } from "@/lib/app-url";

const joinUrl = (base: string, path: string): string => {
  const b = base.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
};

/** Matches `basePath` in `next.config.ts` when `NEXT_PUBLIC_BASE_PATH` is unset. */
const DEFAULT_NEXT_BASE_PATH = "/visa-processing";

const normalizeBasePath = (raw: string): string => {
  const t = raw.trim();
  if (!t || t === "/") return DEFAULT_NEXT_BASE_PATH;
  const withSlash = t.startsWith("/") ? t : `/${t}`;
  return withSlash.replace(/\/+$/, "") || DEFAULT_NEXT_BASE_PATH;
};

/**
 * Env-only base path. Same on server and client (no `window`), so `next/image`
 * `src` and other static public URLs cannot hydrate-mismatch.
 */
export const resolveConfiguredBasePath = (): string => {
  const env = process.env.NEXT_PUBLIC_BASE_PATH?.trim();
  if (env) return normalizeBasePath(env);
  return DEFAULT_NEXT_BASE_PATH;
};

const resolveClientBasePath = (): string => {
  const env = process.env.NEXT_PUBLIC_BASE_PATH?.trim();
  if (env) return normalizeBasePath(env);

  // Fallback: infer from current pathname (works for this project’s /visa-processing mount).
  if (typeof window !== "undefined") {
    const p = window.location.pathname || "";
    if (p === "/visa-processing" || p.startsWith("/visa-processing/")) return "/visa-processing";
  }
  // Server / build: same default as Next `basePath` so `appHref` / `apiHref` match real routes.
  return DEFAULT_NEXT_BASE_PATH;
};

const stripLeadingBasePath = (path: string, basePath: string): string => {
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
 * Next `router.push` already prepends `basePath`. Callback URLs and `appHref`
 * inputs must be router-relative (`/apply/...`), not `/visa-processing/apply/...`.
 */
export const stripAppBasePath = (path: string): string =>
  stripLeadingBasePath(path, resolveClientBasePath());

/**
 * Prefix a `/public` file path with Next `basePath`. Identical on server and
 * client — do not use `appHref` here (`appHref` is absolute on the server).
 * `next/image` does not add `basePath` to `src`.
 */
export const publicAsset = (path: string): string => {
  const basePath = resolveConfiguredBasePath();
  const stripped = stripLeadingBasePath(path, basePath);
  const suffix = stripped === "/" ? "" : stripped;
  return `${basePath}${suffix}`;
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

