"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";

export async function redirectToSubmittedApplication(applicationId: string) {
  const hdrs = await headers();
  const session = await auth.api.getSession({ headers: hdrs });
  const row = await loadApplicationRowForRequest(applicationId, hdrs.get("cookie"));
  if (!row) {
    redirect(session ? "/portal/track" : "/sign-in");
  }
  if (row.paymentStatus !== "paid") {
    return;
  }
  redirect(`/apply/applications/${encodeURIComponent(applicationId)}/submitted`);
}
