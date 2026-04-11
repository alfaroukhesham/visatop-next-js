import { dashClient } from "@better-auth/infra/client";
import { createAuthClient } from "better-auth/react";

function resolveAdminClientBaseURL(): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
        process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.replace(/\/$/, "") ||
        "http://localhost:3000";

  return `${origin}/api/admin/auth`;
}

export const adminAuthClient = createAuthClient({
  baseURL: resolveAdminClientBaseURL(),
  plugins: [dashClient()],
});

