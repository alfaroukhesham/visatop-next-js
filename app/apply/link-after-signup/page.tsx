"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  GUEST_LINK_EVENTS,
  mapLinkFailureDetailsCodeToReason,
  trackGuestLinkEvent,
} from "@/lib/analytics/guest-link-events";
import { buildPostLinkLocation } from "@/lib/applications/post-link-redirect";

export default function LinkAfterSignupPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [message, setMessage] = useState<string | null>(null);
  const authLandFired = useRef(false);
  const linkStarted = useRef(false);

  useEffect(() => {
    if (isPending) return;
    const uid = session?.user?.id;
    if (!uid) return;
    if (authLandFired.current) return;
    authLandFired.current = true;
    trackGuestLinkEvent(GUEST_LINK_EVENTS.authCallbackLand);
  }, [isPending, session?.user?.id]);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user?.id) return;
    if (linkStarted.current) return;
    linkStarted.current = true;

    let applicationId: string | null = null;
    try {
      applicationId = sessionStorage.getItem("guest_link_application_id");
    } catch {
      applicationId = null;
    }

    const origin = window.location.origin;

    void (async () => {
      if (!applicationId) {
        queueMicrotask(() =>
          setMessage(
            "We could not read your saved application id in this browser. Return to your submitted page and run “Create account” or “Sign in” again.",
          ),
        );
        return;
      }

      const res = await fetch(`${origin}/api/applications/link-after-auth`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
        },
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { linked?: boolean; alreadyLinked?: boolean };
        error?: { details?: { code?: string } };
      };

      if (json.ok && json.data?.linked) {
        trackGuestLinkEvent(GUEST_LINK_EVENTS.linkAfterAuthSuccess, { applicationId });
        router.replace(buildPostLinkLocation(applicationId));
        return;
      }
      if (json.ok && json.data?.alreadyLinked) {
        trackGuestLinkEvent(GUEST_LINK_EVENTS.linkAfterAuthSuccess, { applicationId, alreadyLinked: true });
        router.replace(buildPostLinkLocation(applicationId));
        return;
      }

      const code =
        json.error && typeof json.error.details === "object" && json.error.details
          ? (json.error.details as { code?: string }).code
          : undefined;
      const reason = mapLinkFailureDetailsCodeToReason(code);
      trackGuestLinkEvent(GUEST_LINK_EVENTS.linkAfterAuthFail, { applicationId, reason });
      queueMicrotask(() =>
        setMessage(
          "We could not attach this application to your account from this browser. Try again from the submitted page, or contact support with your reference number.",
        ),
      );
    })().catch(() => {
      trackGuestLinkEvent(GUEST_LINK_EVENTS.linkAfterAuthFail, {
        applicationId: applicationId ?? "",
        reason: "unknown",
      });
      queueMicrotask(() => setMessage("Something went wrong. Please try again."));
    });
  }, [isPending, router, session?.user?.id]);

  if (isPending) {
    return (
      <div className="bg-background text-muted-foreground flex min-h-[40vh] items-center justify-center px-6 text-sm">
        Checking your session…
      </div>
    );
  }

  if (!session?.user?.id) {
    return (
      <div className="bg-background mx-auto max-w-md px-6 py-16 text-center text-sm">
        <p className="text-muted-foreground">You are not signed in. Start from your submitted page.</p>
      </div>
    );
  }

  if (message) {
    return (
      <div className="bg-background mx-auto max-w-md px-6 py-16 text-center text-sm">
        <p className="text-muted-foreground">{message}</p>
      </div>
    );
  }

  return (
    <div className="bg-background text-muted-foreground flex min-h-[40vh] items-center justify-center px-6 text-sm">
      Linking your application…
    </div>
  );
}
