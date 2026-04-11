"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/admin-auth";

export async function adminSignOutAction() {
  await adminAuth.api.signOut({ headers: await headers() });
  redirect("/admin/sign-in");
}

