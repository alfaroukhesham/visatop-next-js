import { dashClient } from "@better-auth/infra/client";
import { createAuthClient } from "better-auth/react";
import { getAppOrigin } from "@/lib/app-url";

function resolveAdminClientBaseURL(): string {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "/visa-processing").replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.origin}${basePath}/api/admin/auth`;
  }
  return `${getAppOrigin()}${basePath}/api/admin/auth`;
}

export const adminAuthClient = createAuthClient({
  baseURL: resolveAdminClientBaseURL(),
  plugins: [dashClient()],
});

