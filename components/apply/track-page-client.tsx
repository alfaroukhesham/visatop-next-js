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
      <header className="mb-6 space-y-1.5">
        <p className="text-secondary text-[11px] font-bold uppercase tracking-[0.28em]">
          Status lookup
        </p>
        <h1 className="font-heading text-foreground text-xl! font-semibold leading-snug tracking-tight md:text-[1.75rem]!">
          Track your application
        </h1>

        {pending && authed ? (
          <AppShimmer className="h-4 w-full max-w-prose" aria-hidden />
        ) : authed ? (
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
            Drafts, in-progress files, and completed cases on this account (expired drafts are hidden).
          </p>
        ) : (
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
            Use the email or phone from your application.
          </p>
        )}
      </header>

      {authed ? (
        pending ? (
          <ClientTrackListSkeleton count={1} />
        ) : (
          <SignedInTrackList />
        )
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
