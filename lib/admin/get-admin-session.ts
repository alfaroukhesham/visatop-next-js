import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/admin-auth";

/** One Better Auth session lookup per RSC request (dedupes layout + page). */
export const getAdminSession = cache(async () => {
  const hdrs = await headers();
  return adminAuth.api.getSession({ headers: hdrs });
});

/** Admin user id for server data loads under `(protected)` (layout already guards auth). */
export async function getAdminUserId(): Promise<string> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/sign-in?callbackUrl=%2Fadmin");
  }
  return session.user.id;
}
