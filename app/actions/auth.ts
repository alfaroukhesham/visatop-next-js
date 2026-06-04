"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function signOutAction() {
  const hdrs = await headers();
  const session = await auth.api.getSession({ headers: hdrs });
  if (session) {
    await auth.api.signOut({ headers: hdrs });
  }
  redirect("/sign-in");
}
