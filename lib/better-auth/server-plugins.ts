import { dash } from "@better-auth/infra";
import { nextCookies } from "better-auth/next-js";
import type { BetterAuthPlugin } from "better-auth";
import { isBetterAuthDashEnabled } from "@/lib/better-auth/dash-enabled";

/** Server-only Better Auth plugins (skip Dash when no API key). */
export function betterAuthServerPlugins(): BetterAuthPlugin[] {
  const plugins: BetterAuthPlugin[] = [nextCookies()];
  if (isBetterAuthDashEnabled()) plugins.push(dash());
  return plugins;
}
