"use client";

import Link from "next/link";
import { useEffect } from "react";

import { ApplicationTrackLookupForm } from "@/components/apply/application-track-lookup-form";
import { SignedInTrackList } from "@/components/portal/signed-in-track-list";
import { authClient } from "@/lib/auth-client";
import { type ClientSession, useClientAuthStore } from "@/lib/stores/client-auth-store";

function toClientSession(input: unknown): ClientSession {
  if (!input || typeof input !== "object") return null;
  const maybe = input as { user?: unknown };
  if (!maybe.user || typeof maybe.user !== "object") return null;
  const u = maybe.user as { id?: unknown; name?: unknown; email?: unknown };
  if (typeof u.id !== "string") return null;
  return {
    user: {
      id: u.id,
      name: typeof u.name === "string" ? u.name : u.name == null ? null : null,
      email: typeof u.email === "string" ? u.email : u.email == null ? null : null,
    },
  };
}

export function TrackPageClient() {
  const { data: session, isPending } = authClient.useSession();
  const storeSession = useClientAuthStore((s) => s.session);
  const storePending = useClientAuthStore((s) => s.isPending);
  const setSession = useClientAuthStore((s) => s.setSession);
  const setPending = useClientAuthStore((s) => s.setPending);

  useEffect(() => {
    setPending(isPending);
    setSession(toClientSession(session));
  }, [isPending, session, setPending, setSession]);

  const authed = Boolean(storeSession);
  const pending = Boolean(storePending);

  return (
    <div className="theme-client-rise mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-10 space-y-4">
        <p className="text-secondary text-[11px] font-bold uppercase tracking-[0.28em]">
          Status lookup
        </p>
        <h1 className="font-heading text-foreground text-[clamp(1.85rem,3.8vw,2.45rem)] font-semibold leading-tight tracking-tight">
          Track your application
        </h1>

        {pending ? (
          <p className="text-muted-foreground max-w-prose text-base leading-relaxed">
            Loading…
          </p>
        ) : authed ? (
          <p className="text-muted-foreground max-w-prose text-base leading-relaxed">
            Below are applications that have moved beyond draft status (paid, in progress, or completed). If you want
            to continue an incomplete draft that hasn’t been paid yet, go to{" "}
            <Link href="/portal/drafts" className="text-link font-medium hover:underline">
              Draft applications
            </Link>
            .
          </p>
        ) : (
          <p className="text-muted-foreground max-w-prose text-base leading-relaxed">
            Enter the email you used when you applied (guest or account), or the phone number on your profile. We list
            every match with a clear, plain-language status for each one.
          </p>
        )}
      </header>

      {pending ? null : authed ? <SignedInTrackList /> : <ApplicationTrackLookupForm />}

      <p className="text-muted-foreground mt-10 text-center text-sm">
        <Link href="/apply/start" className="text-link font-medium hover:underline">
          Start a new application
        </Link>
        <span className="mx-2 text-border" aria-hidden>
          ·
        </span>
        <Link href="/help" className="text-link font-medium hover:underline">
          Help
        </Link>
      </p>
    </div>
  );
}

