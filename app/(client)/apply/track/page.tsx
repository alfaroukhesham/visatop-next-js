import type { Metadata } from "next";
import Link from "next/link";
import { ApplicationTrackLookupForm } from "@/components/apply/application-track-lookup-form";

export const metadata: Metadata = {
  title: "Track application | Visatop",
};

export default function TrackApplicationPage() {
  return (
    <div className="theme-client-rise mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-10 space-y-3">
        <p className="text-secondary text-xs font-semibold uppercase tracking-[0.2em]">Guests &amp; applicants</p>
        <h1 className="font-heading text-foreground text-[clamp(1.65rem,3.5vw,2.25rem)] font-semibold leading-tight tracking-tight">
          Track your application
        </h1>
        <p className="text-muted-foreground max-w-prose text-base leading-relaxed">
          Enter the email you used as a guest (or your account email after linking), or the phone number saved on your
          application profile. We list every matching application and show high-level progress only — not internal
          processing codes.
        </p>
      </header>
      <ApplicationTrackLookupForm />
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
