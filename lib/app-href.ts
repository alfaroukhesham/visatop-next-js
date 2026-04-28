import { getAppOrigin } from "@/lib/app-url";

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function resolveClientBasePath(): string {
  // Prefer explicit configuration (used by local/ngrok/prod consistently).
  const env = process.env.NEXT_PUBLIC_BASE_PATH?.trim();
  if (env) return env.startsWith("/") ? env : `/${env}`;

  // Fallback: infer from current pathname (works for this project’s /visa-processing mount).
  if (typeof window !== "undefined") {
    const p = window.location.pathname || "";
    if (p === "/visa-processing" || p.startsWith("/visa-processing/")) return "/visa-processing";
  }
  return "";
}

/**
 * Build a URL under the app's base path.
 * - In the browser: returns a same-origin path (avoids CORS / cookie issues).
 * - On the server: returns an absolute URL using NEXT_PUBLIC_APP_URL / BETTER_AUTH_URL.
 */
export function appHref(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const basePath = resolveClientBasePath();
  if (typeof window !== "undefined") {
    return `${basePath}${p}`;
  }
  return joinUrl(getAppOrigin(), `${basePath}${p}`);
}

/**
 * Build a URL for same-origin API routes under the app's base path.
 */
export function apiHref(path: string): string {
  const p = path.replace(/^\/+/, "");
  return appHref(`/api/${p}`);
}

