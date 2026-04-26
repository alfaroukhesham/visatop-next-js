import type { Metadata } from "next";
import Link from "next/link";
import { ApplicationTrackLookupForm } from "@/components/apply/application-track-lookup-form";

export const metadata: Metadata = {
  title: "Track application | Visatop",
};

export default function TrackApplicationPage() {
  return (
    <div className="theme-client-rise mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-10 space-y-4">
        <p className="text-secondary text-[11px] font-bold uppercase tracking-[0.28em]">Status lookup</p>
        <h1 className="font-heading text-foreground text-[clamp(1.85rem,3.8vw,2.45rem)] font-semibold leading-tight tracking-tight">
          Track your application
        </h1>
        <p className="text-muted-foreground max-w-prose text-base leading-relaxed">
          Enter the email you used when you applied (guest or account), or the phone number on your profile. We list
          every match with a clear, plain-language status for each one.
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
