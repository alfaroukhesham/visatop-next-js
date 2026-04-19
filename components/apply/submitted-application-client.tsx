"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { GUEST_LINK_EVENTS, trackGuestLinkEvent } from "@/lib/analytics/guest-link-events";
import type { PublicApplication } from "@/lib/applications/public-application";

type Props = {
  applicationId: string;
  initialApplication: PublicApplication;
};

function pollIntervalMs(elapsedMs: number): number {
  if (elapsedMs < 60_000) return 2000;
  return 5000;
}

export function SubmittedApplicationClient({ applicationId, initialApplication }: Props) {
  const [app, setApp] = useState(initialApplication);
  const [pollMsg, setPollMsg] = useState<string | null>(null);
  const [terminal, setTerminal] = useState(false);
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
  const linkAfterUrl = `${origin}/apply/link-after-signup`;

  async function prepareGuestIntent(): Promise<boolean> {
    const res = await fetch(`${origin}/api/apply/prepare-guest-link-intent`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({ applicationId }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      data?: { prepared?: boolean; applicationId?: string };
    };
    if (!json.ok || !json.data?.applicationId) {
      return false;
    }
    const idToStore = json.data.applicationId;
    try {
      sessionStorage.setItem("guest_link_application_id", idToStore);
      if (sessionStorage.getItem("guest_link_application_id") !== idToStore) {
        return false;
      }
    } catch {
      return false;
    }
    trackGuestLinkEvent(GUEST_LINK_EVENTS.guestLinkIntentPrepared, { applicationId });
    return true;
  }

  async function goAuth(target: "sign-up" | "sign-in") {
    const ok = await prepareGuestIntent();
    if (!ok) {
      setPollMsg("We could not start account linking. Try again, or refresh this page.");
      return;
    }
    const cb = encodeURIComponent(linkAfterUrl);
    window.location.href =
      target === "sign-up" ? `/sign-up?callbackUrl=${cb}` : `/sign-in?callbackUrl=${cb}`;
  }

  const confirming = app.paymentStatus === "checkout_created";
  const paid = app.paymentStatus === "paid";
  const showGuestLink = paid && app.isGuest;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl" tabIndex={-1}>
          {paid ? "Payment received" : confirming ? "Confirming payment" : "Application update"}
        </h1>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed" role="status" aria-live="polite">
          {paid && (
            <>
              Your payment is confirmed. Reference{" "}
              <span className="text-foreground font-mono text-xs">
                {app.referenceNumber ?? app.id.slice(0, 8)}
              </span>
              .
            </>
          )}
          {confirming && !terminal && <> We are confirming your payment with our systems…</>}
          {confirming && terminal && <>{pollMsg}</>}
          {!paid && !confirming && (
            <> Current status: {app.applicationStatus.replaceAll("_", " ")} — payment {app.paymentStatus}.</>
          )}
        </p>
      </header>

      {app.adminAttentionRequired && paid && (
        <div className="border-border bg-muted/40 text-muted-foreground rounded-none border p-4 text-sm">
          We&apos;re reviewing your file. You can still continue below; our team may reach out if anything is
          unclear.
        </div>
      )}

      {confirming && terminal && (
        <div className="border-border bg-card flex flex-col gap-3 rounded-none border p-4">
          <p className="text-sm font-medium">We&apos;re still confirming your payment</p>
          <Button type="button" variant="outline" className="rounded-none self-start" onClick={() => void load()}>
            Refresh status
          </Button>
          <Link href="/help" className="text-link text-sm font-medium">
            Contact support
          </Link>
        </div>
      )}

      {showGuestLink && (
        <section className="border-border bg-card space-y-4 rounded-none border p-6">
          <h2 className="font-heading text-lg font-semibold">Save this application to your account</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Create an account or sign in on this device so we can attach this paid application to your profile.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" className="rounded-none" onClick={() => void goAuth("sign-up")}>
              Create account
            </Button>
            <Button type="button" variant="outline" className="rounded-none" onClick={() => void goAuth("sign-in")}>
              I already have an account
            </Button>
          </div>
        </section>
      )}

      {paid && !app.isGuest && (
        <section className="border-border bg-card rounded-none border p-6">
          <h2 className="font-heading text-lg font-semibold">Next steps</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Open your workspace to continue with this application.
          </p>
          <Link
            href="/portal/application-workspace"
            className={cn(buttonVariants({ variant: "default" }), "mt-4 inline-flex rounded-none")}
          >
            Open workspace
          </Link>
        </section>
      )}

      <footer className="text-muted-foreground flex flex-wrap gap-4 text-xs">
        <Link href="/apply/start" className="text-link">
          Browse services
        </Link>
        <span aria-hidden>·</span>
        <Link href="/help" className="text-link">
          Help
        </Link>
      </footer>
    </div>
  );
}
