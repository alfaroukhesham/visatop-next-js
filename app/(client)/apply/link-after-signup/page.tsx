"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ClientCenteredStatus } from "@/components/client/client-loading";
import { AlertCircle } from "lucide-react";
import { useClientAuthStore } from "@/lib/stores/client-auth-store";
import {
  GUEST_LINK_EVENTS,
  mapLinkFailureDetailsCodeToReason,
  trackGuestLinkEvent,
} from "@/lib/analytics/guest-link-events";
import { buildPostLinkLocation } from "@/lib/applications/post-link-redirect";
import { ClientSurface } from "@/components/client/client-surface";

export default function LinkAfterSignupPage() {
  const router = useRouter();
  const userId = useClientAuthStore((s) => s.session?.user?.id);
  const isPending = useClientAuthStore((s) => s.isPending);
  const [message, setMessage] = useState<string | null>(null);
  const authLandFired = useRef(false);
  const linkStarted = useRef(false);

  useEffect(() => {
    if (isPending) return;
    if (!userId) return;
    if (authLandFired.current) return;
    authLandFired.current = true;
    trackGuestLinkEvent(GUEST_LINK_EVENTS.authCallbackLand);
  }, [isPending, userId]);

  useEffect(() => {
    if (isPending) return;
    if (!userId) return;
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
        setMessage(
          "We could not read your saved application id in this browser. Return to your submitted page and run “Create account” or “Sign in” again.",
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
      setMessage(
        "We could not attach this application to your account from this browser. Try again from the submitted page, or contact support with your reference number.",
      );
    })().catch(() => {
      trackGuestLinkEvent(GUEST_LINK_EVENTS.linkAfterAuthFail, {
        applicationId: applicationId ?? "",
        reason: "unknown",
      });
      setMessage("Something went wrong. Please try again.");
    });
  }, [isPending, router, userId]);

  if (isPending) {
    return (
      <ClientCenteredStatus
        label="Checking your session…"
        className="min-h-[min(60vh,520px)]"
      />
    );
  }

  if (!userId) {
    return (
      <div className="mx-auto flex min-h-[min(50vh,420px)] max-w-md flex-col justify-center px-6 py-16">
        <ClientSurface preset="panel" className="border-secondary/20 bg-white/90 p-8 text-center shadow-md">
          <AlertCircle className="text-secondary mx-auto mb-4 size-10" aria-hidden />
          <p className="text-muted-foreground text-sm leading-relaxed">
            You are not signed in. Return to your submitted confirmation page and choose{" "}
            <span className="text-foreground font-semibold">Create account</span> or{" "}
            <span className="text-foreground font-semibold">Sign in</span>.
          </p>
        </ClientSurface>
      </div>
    );
  }

  if (message) {
    return (
      <div className="mx-auto flex min-h-[min(50vh,420px)] max-w-lg flex-col justify-center px-6 py-16">
        <ClientSurface preset="highlight" className="border-error/25 bg-white/95 p-8 text-center shadow-md">
          <AlertCircle className="text-error mx-auto mb-4 size-10" aria-hidden />
          <p className="text-foreground text-sm leading-relaxed" role="alert">
            {message}
          </p>
        </ClientSurface>
      </div>
    );
  }

  return (
    <ClientCenteredStatus
      label="Linking your application…"
      className="min-h-[min(50vh,420px)]"
    />
  );
}
