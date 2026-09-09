"use client";

import Link from "next/link";

import { ApplicationTrackLookupForm } from "@/components/apply/application-track-lookup-form";
import { TrackSignInPanel } from "@/components/apply/track-sign-in-panel";
import { AppShimmer } from "@/components/ui/app-loading";
import { ClientTrackListSkeleton } from "@/components/client/client-loading";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { SUPPORT_WHATSAPP_URL } from "@/lib/support-contact";
import { SignedInTrackList } from "@/components/portal/signed-in-track-list";
import { useClientAuthStore } from "@/lib/stores/client-auth-store";

export function TrackPageClient() {
  const t = useCustomerT();
  const storeSession = useClientAuthStore((s) => s.session);
  const storePending = useClientAuthStore((s) => s.isPending);

  const authed = Boolean(storeSession);
  const pending = Boolean(storePending);

  return (
    <div className="theme-client-rise mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-6 space-y-1.5">
        <p className="text-secondary text-[11px] font-bold uppercase tracking-[0.28em]">
          {t("track.eyebrow")}
        </p>
        <h1 className="font-heading text-foreground text-xl! font-semibold leading-snug tracking-tight md:text-[1.75rem]!">
          {t("track.title")}
        </h1>

        {pending && authed ? (
          <AppShimmer className="h-4 w-full max-w-prose" aria-hidden />
        ) : authed ? (
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
            {t("track.signedInSubtitle")}
          </p>
        ) : (
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
            {t("track.guestSubtitle")}
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
        <div className="space-y-8">
          <ApplicationTrackLookupForm />
          <TrackSignInPanel />
        </div>
      )}

      <p className="text-muted-foreground mt-10 text-center text-sm">
        <Link href="/" className="text-link font-medium hover:underline">
          {t("track.startNewApplication")}
        </Link>
        <span className="mx-2 text-border" aria-hidden>
          ·
        </span>
        <Link href={SUPPORT_WHATSAPP_URL} className="text-link font-medium hover:underline">
          {t("track.contactSupport")}
        </Link>
      </p>
    </div>
  );
}
