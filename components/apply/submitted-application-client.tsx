"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ClientButton, ClientButtonLink } from "@/components/client/client-button";
import { authClient } from "@/lib/auth-client";
import { GUEST_LINK_EVENTS, trackGuestLinkEvent } from "@/lib/analytics/guest-link-events";
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";
import { buildPostLinkLocation } from "@/lib/applications/post-link-redirect";
import type { PublicApplication } from "@/lib/applications/public-application";
import { ApplicationClientTracking } from "@/components/apply/application-client-tracking";

type Props = {
  applicationId: string;
  initialApplication: PublicApplication;
};

type ApiErrBody = {
  ok?: boolean;
  data?: { prepared?: boolean; applicationId?: string; linked?: boolean; alreadyLinked?: boolean };
  error?: { message?: string; code?: string; details?: { code?: string } };
};

function pollIntervalMs(elapsedMs: number): number {
  if (elapsedMs < 60_000) return 2000;
  return 5000;
}

export function SubmittedApplicationClient({ applicationId, initialApplication }: Props) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [app, setApp] = useState(initialApplication);
  const [pollMsg, setPollMsg] = useState<string | null>(null);
  const [terminal, setTerminal] = useState(false);
  const [linkActionError, setLinkActionError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const firedView = useRef(false);

  useEffect(() => {
    if (firedView.current) return;
    firedView.current = true;
    trackGuestLinkEvent(GUEST_LINK_EVENTS.submittedView, { applicationId });
  }, [applicationId]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/applications/${encodeURIComponent(applicationId)}`, {
      credentials: "include",
    });
    const json = (await res.json()) as { ok?: boolean; data?: { application: PublicApplication } };
    if (json.ok && json.data?.application) {
      setApp(json.data.application);
    }
  }, [applicationId]);

  useEffect(() => {
    if (app.paymentStatus !== "checkout_created") return;

    const t0 = Date.now();
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (cancelled) return;
      const elapsed = Date.now() - t0;
      if (elapsed > 180_000) {
        setTerminal(true);
        setPollMsg("We’re still confirming your payment. You can refresh to check the latest status.");
        return;
      }
      await load();
      timeout = setTimeout(tick, pollIntervalMs(elapsed));
    };

    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [app.paymentStatus, load]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const linkAfterPath = "/apply/link-after-signup";

  async function prepareGuestIntent(): Promise<{ ok: true } | { ok: false; message: string }> {
    const res = await fetch(`${origin}/api/apply/prepare-guest-link-intent`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({ applicationId }),
    });
    const json = (await res.json()) as ApiErrBody;
    if (!res.ok || !json.ok || !json.data?.applicationId) {
      const detail =
        json.error?.details && typeof json.error.details === "object" && "code" in json.error.details
          ? String((json.error.details as { code?: string }).code ?? "")
          : "";
      const base = json.error?.message ?? `Could not prepare linking (HTTP ${res.status}).`;
      const notCfg =
        detail === "GUEST_LINK_INTENT_NOT_CONFIGURED" ||
        (json.error?.message ?? "").includes("GUEST_LINK_INTENT_SECRET");
      const msg =
        notCfg
          ? "This server is missing GUEST_LINK_INTENT_SECRET (32+ bytes). Add it to .env and restart the dev server."
          : res.status === 503
            ? "Account linking is temporarily unavailable. Try again later."
            : res.status === 404
              ? "We could not verify this application on this device. Use the same browser where you paid, or check your connection."
              : detail === "INTENT_REQUIRES_PAID" || detail === "LINK_NOT_ALLOWED"
                ? "This application cannot be linked in its current state. Refresh the page or contact support."
                : base;
      return { ok: false, message: msg };
    }
    const idToStore = json.data.applicationId;
    try {
      sessionStorage.setItem("guest_link_application_id", idToStore);
      if (sessionStorage.getItem("guest_link_application_id") !== idToStore) {
        return {
          ok: false,
          message:
            "This browser blocked saving your application id (private mode or storage disabled). Allow storage for this site, or try another browser.",
        };
      }
    } catch {
      return {
        ok: false,
        message:
          "This browser blocked saving your application id. Allow storage for this site, or try another browser.",
      };
    }
    trackGuestLinkEvent(GUEST_LINK_EVENTS.guestLinkIntentPrepared, { applicationId });
    return { ok: true };
  }

  async function goAuth(target: "sign-up" | "sign-in") {
    setLinkActionError(null);
    setAuthBusy(true);
    const prep = await prepareGuestIntent();
    setAuthBusy(false);
    if (!prep.ok) {
      setLinkActionError(prep.message);
      return;
    }
    const cb = encodeURIComponent(safeCallbackUrl(linkAfterPath));
    window.location.assign(
      target === "sign-up" ? `/sign-up?callbackUrl=${cb}` : `/sign-in?callbackUrl=${cb}`,
    );
  }

  async function attachWhileSignedIn() {
    setLinkActionError(null);
    setAuthBusy(true);
    try {
      const prep = await prepareGuestIntent();
      if (!prep.ok) {
        setLinkActionError(prep.message);
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
      const json = (await res.json()) as ApiErrBody;
      if (json.ok && (json.data?.linked || json.data?.alreadyLinked)) {
        router.replace(buildPostLinkLocation(applicationId));
        return;
      }
      const msg =
        json.error?.message ??
        (res.status === 401
          ? "Your session expired. Sign in again, then use the buttons below."
          : "We could not attach this application. Try again or contact support.");
      setLinkActionError(msg);
    } finally {
      setAuthBusy(false);
    }
  }

  const confirming = app.paymentStatus === "checkout_created";
  const paid = app.paymentStatus === "paid";
  const showGuestLink = paid && app.isGuest;
  const signedIn = Boolean(session?.user?.id);

  return (
    <div className="space-y-10">
      <header className="space-y-6">
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm leading-relaxed" role="status" aria-live="polite">
            Reference{" "}
            <span className="text-foreground font-mono text-xs">{app.referenceNumber ?? app.id.slice(0, 8)}</span>
            {paid ? " · payment confirmed." : confirming && !terminal ? " · confirming payment…" : null}
            {confirming && terminal ? ` · ${pollMsg ?? ""}` : null}
          </p>
        </div>
        <ApplicationClientTracking tracking={app.clientTracking} />
      </header>

      {showGuestLink ? (
        <section className="space-y-5 rounded-[12px] border border-border border-l-[3px] border-l-primary bg-card p-6 shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
          <div className="space-y-2">
            <p className="text-secondary text-[11px] font-bold uppercase tracking-[0.2em]">Stay in control</p>
            <h2 className="font-heading text-xl font-semibold tracking-tight text-[#012031] sm:text-2xl">
              Save this application to your account
            </h2>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {signedIn
              ? "You are signed in. Attach this paid application to your profile on this device so it appears in your portal alongside anything else you start later."
              : "You paid as a guest—great. Creating a free account (or signing in) on this same device lets us attach this paid application to your profile so you can open it from the portal, get updates on any device after linking, and start the next visa without hunting through email."}
          </p>
          {!signedIn ? (
            <ul className="text-muted-foreground list-inside list-disc space-y-1.5 border-y border-border py-4 text-sm leading-relaxed">
              <li>One place for status, documents, and messages</li>
              <li>Pick up on a new phone or laptop after you link once</li>
              <li>Faster checkout the next time you apply</li>
            </ul>
          ) : null}
          {linkActionError ? (
            <p className="text-error text-sm leading-relaxed" role="alert">
              {linkActionError}
            </p>
          ) : null}
          {!sessionPending && signedIn ? (
            <ClientButton
              type="button"
              brand="cta"
              disabled={authBusy}
              onClick={() => void attachWhileSignedIn()}
            >
              {authBusy ? "Attaching…" : "Attach to my account"}
            </ClientButton>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <ClientButton
                type="button"
                brand="cta"
                disabled={authBusy || sessionPending}
                onClick={() => void goAuth("sign-up")}
              >
                {authBusy ? "Working…" : "Create account"}
              </ClientButton>
              <ClientButton
                type="button"
                variant="outline"
                brand="white"
                disabled={authBusy || sessionPending}
                onClick={() => void goAuth("sign-in")}
              >
                {authBusy ? "Working…" : "I already have an account"}
              </ClientButton>
            </div>
          )}
        </section>
      ) : null}

      {app.adminAttentionRequired && paid && (
        <div className="rounded-[12px] border border-border bg-muted/50 p-4 text-sm text-muted-foreground leading-relaxed shadow-sm">
          We&apos;re reviewing your file. You can still continue below; our team may reach out if anything is
          unclear.
        </div>
      )}

      {confirming && terminal && (
        <div className="flex flex-col gap-4 rounded-[12px] border border-border bg-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <p className="text-sm font-medium">We&apos;re still confirming your payment</p>
          <ClientButton
            type="button"
            variant="outline"
            className="self-start font-medium"
            onClick={() => void load()}
          >
            Refresh status
          </ClientButton>
          <Link href="/help" className="text-link text-sm font-medium">
            Contact support
          </Link>
        </div>
      )}

      {paid && !app.isGuest && (
        <section className="rounded-[12px] border border-border bg-card p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <h2 className="font-heading text-lg font-semibold text-[#012031]">Next steps</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Open your workspace to continue with this application.
          </p>
          <ClientButtonLink href="/portal/application-workspace" brand="cta" className="mt-5 inline-flex">
            Open workspace
          </ClientButtonLink>
        </section>
      )}

      <footer className="text-muted-foreground flex flex-wrap items-center justify-center gap-4 border-t border-border pt-8 text-xs sm:justify-start">
        <Link href="/apply/start" className="text-link font-medium transition-colors hover:underline">
          Browse services
        </Link>
        <span aria-hidden className="text-border">
          ·
        </span>
        <Link href="/help" className="text-link font-medium transition-colors hover:underline">
          Help
        </Link>
      </footer>
    </div>
  );
}
