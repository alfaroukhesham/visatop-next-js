import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Server-only session guard for App Router (single pages outside `/portal`).
 * The `/portal` layout performs the same check with `callbackUrl` support.
 *
 * @see https://github.com/better-auth/better-auth/blob/canary/docs/content/docs/integrations/next.mdx
 */
export async function requireSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return session;
}
