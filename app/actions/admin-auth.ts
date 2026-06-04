"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/admin-auth";

export async function adminSignOutAction() {
  const hdrs = await headers();
  const session = await adminAuth.api.getSession({ headers: hdrs });
  if (session) {
    await adminAuth.api.signOut({ headers: hdrs });
  }
  redirect("/admin/sign-in");
}

