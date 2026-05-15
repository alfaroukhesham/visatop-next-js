"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { ClientButton } from "@/components/client/client-button";

export function DraftPanelError({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-4 rounded-[12px] border border-border bg-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      <p className="text-error text-sm leading-relaxed">{error ?? "Not found."}</p>
      <p className="text-muted-foreground text-sm">
        Guests need the same browser session (resume cookie). Signed-in users must own this draft. Lost the
        cookie?{" "}
        <Link href="/apply/track" className="text-link font-medium hover:underline">
          Look up status with email or phone
        </Link>
        .
      </p>
      <ClientButton type="button" variant="outline" className="rounded-none" onClick={onRetry}>
        <RefreshCw className="mr-2 size-4" aria-hidden />
        Retry
      </ClientButton>
      <Link href="/" className="text-link ml-4 text-sm font-medium">
        Start over
      </Link>
    </div>
  );
}
