"use client";

import Link from "next/link";

import { ApplicationTrackLookupForm } from "@/components/apply/application-track-lookup-form";
import { AppShimmer } from "@/components/ui/app-loading";
import { ClientTrackListSkeleton } from "@/components/client/client-loading";
import { SUPPORT_WHATSAPP_URL } from "@/lib/support-contact";
import { SignedInTrackList } from "@/components/portal/signed-in-track-list";
import { useClientAuthStore } from "@/lib/stores/client-auth-store";

export function TrackPageClient() {
  const storeSession = useClientAuthStore((s) => s.session);
  const storePending = useClientAuthStore((s) => s.isPending);

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
          <AppShimmer className="h-4 w-full max-w-prose" aria-hidden />
        ) : authed ? (
          <p className="text-muted-foreground max-w-prose text-base leading-relaxed">
            Every application on this account appears here, drafts waiting for payment, files in progress, and
            completed cases, except drafts that have already expired.
          </p>
        ) : (
          <p className="text-muted-foreground max-w-prose text-base leading-relaxed">
            Enter the email you used when you applied (guest or account), or the phone number on your profile. We list
            every match with a clear, plain-language status for each one.
          </p>
        )}
      </header>

      {pending ? (
        <ClientTrackListSkeleton count={1} />
      ) : authed ? (
        <SignedInTrackList />
      ) : (
        <ApplicationTrackLookupForm />
      )}

      <p className="text-muted-foreground mt-10 text-center text-sm">
        <Link href="/" className="text-link font-medium hover:underline">
          Start a new application
        </Link>
        <span className="mx-2 text-border" aria-hidden>
          ·
        </span>
        <Link href={SUPPORT_WHATSAPP_URL} className="text-link font-medium hover:underline">
          Contact support
        </Link>
      </p>
    </div>
  );
}

