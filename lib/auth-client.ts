import { dashClient } from "@better-auth/infra/client";
import { createAuthClient } from "better-auth/react";

/**
 * Must match the browser's actual origin (e.g. ngrok / preview URL).
 * A hard-coded NEXT_PUBLIC_APP_URL of localhost breaks sign-in when the app
 * is opened on another host — requests would miss Set-Cookie / CSRF checks.
 */
function resolveClientBaseURL(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.replace(/\/$/, "");
  return fromEnv || "http://localhost:3000";
}

export const authClient = createAuthClient({
  baseURL: resolveClientBaseURL(),
  plugins: [dashClient()],
});
