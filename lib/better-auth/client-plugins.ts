import { dashClient } from "@better-auth/infra/client";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { isBetterAuthDashEnabled } from "@/lib/better-auth/dash-enabled";

/** Client Better Auth plugins (keep in sync with server Dash enablement). */
export function betterAuthClientPlugins(): BetterAuthClientPlugin[] {
  if (!isBetterAuthDashEnabled()) return [];
  return [dashClient()];
}
