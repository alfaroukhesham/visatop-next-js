import { dashClient } from "@better-auth/infra/client";
import { createAuthClient } from "better-auth/react";
import { getAppOrigin } from "@/lib/app-url";

/**
 * Must match the browser's actual origin (e.g. ngrok / preview URL).
 * A hard-coded NEXT_PUBLIC_APP_URL of localhost breaks sign-in when the app
 * is opened on another host — requests would miss Set-Cookie / CSRF checks.
 */
function resolveClientBaseURL(): string {
  // Better Auth client expects the base URL of the auth handler.
  // In the browser we must stay same-origin (absolute URL) for cookies/CSRF.
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "/visa-processing").replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.origin}${basePath}/api/auth`;
  }
  return `${getAppOrigin()}${basePath}/api/auth`;
}

export const authClient = createAuthClient({
  baseURL: resolveClientBaseURL(),
  plugins: [dashClient()],
});
