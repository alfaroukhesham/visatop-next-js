import type { Metadata } from "next";
import { StartApplicationForm } from "@/components/apply/start-application-form";

export const metadata: Metadata = {
  title: "Start application",
};

export default function ApplyStartPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Open a draft
        </h1>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed sm:text-base">
          Pick your nationality and visa service. We create an application record immediately (Phase 2).
          Guests get a secure resume cookie on this browser; signed-in users attach the draft to their
          account automatically.
        </p>
      </header>
      <StartApplicationForm />
    </div>
  );
}
