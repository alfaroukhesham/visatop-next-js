"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  mapLinkFailureDetailsCodeToReason,
  type LinkAfterAuthFailReason,
} from "@/lib/analytics/guest-link-events";
import { buildPostLinkLocation } from "@/lib/applications/post-link-redirect";
import { appHref } from "@/lib/app-href";
import { auth } from "@/lib/auth";

type LinkAfterAuthJson = {
  ok?: boolean;
  data?: { linked?: boolean; alreadyLinked?: boolean };
  error?: { details?: { code?: string } };
};

export type LinkAfterSignupFailure = { kind: "failed"; reason: LinkAfterAuthFailReason };

export async function linkAfterSignupAndRedirect(
  applicationId: string,
): Promise<LinkAfterSignupFailure | void> {
  const hdrs = await headers();
  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) {
    redirect("/sign-in");
  }

  const cookie = hdrs.get("cookie") ?? "";
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const res = await fetch(appHref("/api/applications/link-after-auth"), {
    method: "POST",
    headers: {
      cookie,
      "Content-Type": "application/json",
      Origin: origin,
    },
    cache: "no-store",
  });

  const json = (await res.json()) as LinkAfterAuthJson;
  if (json.ok && (json.data?.linked || json.data?.alreadyLinked)) {
    redirect(buildPostLinkLocation(applicationId));
  }

  const code =
    json.error && typeof json.error.details === "object" && json.error.details
      ? (json.error.details as { code?: string }).code
      : undefined;

  return { kind: "failed", reason: mapLinkFailureDetailsCodeToReason(code) };
}
