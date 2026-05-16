import { Loader2 } from "lucide-react";
import { AppLoadingMessage, AppShimmer } from "@/components/ui/app-loading";
import { cn } from "@/lib/utils";

/** Hero nationality combobox placeholder. */
export function ClientComboboxSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("app-rise flex min-h-[3.5rem] items-center", className)}
      aria-busy="true"
      aria-label="Loading countries"
    >
      <AppShimmer className="h-12 w-full rounded-[8px]" />
    </div>
  );
}

/** Home / header auth button placeholders. */
export function ClientButtonRowSkeleton() {
  return (
    <div className="app-stagger flex flex-wrap items-center gap-3" aria-hidden>
      <AppShimmer className="h-10 min-w-[148px] rounded-md" />
      <AppShimmer className="h-10 min-w-[148px] rounded-md" />
    </div>
  );
}

/** Header nav auth actions (on dark bar). */
export function ClientHeaderAuthSkeleton() {
  return (
    <div className="app-stagger flex items-center gap-2" aria-label="Loading account actions">
      <AppShimmer className="h-9 w-[92px] rounded-md bg-white/10" />
      <AppShimmer className="h-9 w-[120px] rounded-md bg-white/10" />
    </div>
  );
}

/** Account card body line. */
export function ClientAccountCardSkeleton() {
  return <AppShimmer className="h-14 w-full rounded-md" aria-hidden />;
}

/** Apply step 2 — currency, visa cards, email (initial catalog load). */
export function ClientStartStepSkeleton() {
  return (
    <div className="app-stagger space-y-6" aria-busy="true" aria-label="Loading visa options">
      <div className="space-y-2">
        <AppShimmer className="h-5 w-36" />
        <AppShimmer className="h-4 w-full max-w-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <AppShimmer className="h-[7.5rem] rounded-[12px] border-2 border-border" />
        <AppShimmer className="h-[7.5rem] rounded-[12px] border-2 border-border" />
      </div>
      <div className="space-y-2 pt-2">
        <AppShimmer className="h-5 w-28" />
        <AppShimmer className="h-4 w-64 max-w-full" />
      </div>
      <ClientServiceCardsSkeleton count={3} />
      <div className="space-y-2 pt-2">
        <AppShimmer className="h-4 w-20" />
        <AppShimmer className="h-10 w-full rounded-[5px]" />
        <AppShimmer className="h-3 w-full max-w-sm" />
      </div>
      <ClientButtonRowSkeleton />
    </div>
  );
}

/** Visa service selection cards on /apply/start. */
export function ClientServiceCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className="app-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-busy="true"
      aria-label="Loading visa options"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="border-border bg-card flex flex-col items-center gap-3 rounded-[12px] border-2 px-4 py-8"
        >
          <AppShimmer className="size-10 rounded-full" />
          <AppShimmer className="h-4 w-[80%] max-w-[12rem]" />
          <AppShimmer className="h-7 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Application draft workspace (documents + review + payment blocks). */
export function ClientDraftPanelSkeleton() {
  return (
    <div className="app-stagger space-y-8" aria-busy="true" aria-label="Loading application">
      <section className="border-border bg-card space-y-4 rounded-[12px] border p-6 shadow-sm">
        <AppShimmer className="h-5 w-40" />
        <div className="grid gap-4 sm:grid-cols-2">
          <AppShimmer className="h-32 w-full rounded-lg" />
          <AppShimmer className="h-32 w-full rounded-lg" />
        </div>
      </section>
      <section className="border-border bg-card space-y-4 rounded-[12px] border p-6 shadow-sm">
        <AppShimmer className="h-5 w-48" />
        <AppShimmer className="h-10 w-full" />
        <AppShimmer className="h-10 w-full" />
        <AppShimmer className="h-10 w-2/3" />
      </section>
      <section className="border-border bg-card space-y-3 rounded-[12px] border p-6 shadow-sm">
        <AppShimmer className="h-5 w-36" />
        <AppShimmer className="h-12 w-full max-w-xs" />
      </section>
    </div>
  );
}

/** Portal / track application card. */
export function ClientTrackCardSkeleton() {
  return (
    <li className="space-y-6 rounded-[12px] border border-border border-l-[3px] border-l-primary bg-card p-6 shadow-[0_4px_24px_rgba(0,0,0,0.07)] sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="app-stagger flex-1 space-y-2">
          <AppShimmer className="h-3 w-20" />
          <AppShimmer className="h-4 w-36" />
          <AppShimmer className="h-3 w-48 max-w-full" />
        </div>
        <AppShimmer className="h-9 w-24 shrink-0 rounded-md" />
      </div>
      <div className="space-y-2">
        <AppShimmer className="h-3 w-full" />
        <AppShimmer className="h-3 w-[85%]" />
        <AppShimmer className="h-2 w-[60%]" />
      </div>
    </li>
  );
}

export function ClientTrackListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <ul className="app-stagger space-y-8" aria-busy="true" aria-label="Loading applications">
      {Array.from({ length: count }, (_, i) => (
        <ClientTrackCardSkeleton key={i} />
      ))}
    </ul>
  );
}

/** Checkout order recap sidebar. */
export function ClientOrderRecapSkeleton() {
  return (
    <div
      className="app-rise space-y-4 rounded-[12px] border border-border bg-card p-4 shadow-sm sm:p-5"
      aria-busy="true"
      aria-label="Loading order summary"
    >
      <div className="flex items-end justify-between gap-4">
        <AppShimmer className="h-6 w-28" />
      </div>
      <div className="flex justify-between gap-4">
        <AppShimmer className="h-3 w-16" />
        <AppShimmer className="h-3 w-16" />
      </div>
      <div className="space-y-3 border-t border-border pt-4">
        <AppShimmer className="h-4 w-full" />
        <AppShimmer className="h-4 w-[85%]" />
        <AppShimmer className="h-8 w-32" />
      </div>
    </div>
  );
}

/** Portal route transition shell. */
export function ClientPortalPageSkeleton() {
  return (
    <div className="text-foreground flex min-h-[50vh] flex-1 flex-col">
      <div
        className="border-b border-white/10 bg-[#012031]/95 px-5 py-4 shadow-md sm:px-8"
        aria-hidden
      >
        <div className="mx-auto flex max-w-[calc(1300px+3rem)] items-center justify-between gap-4 app-rise">
          <div className="space-y-2">
            <AppShimmer className="h-3 w-24 rounded bg-white/15" />
            <AppShimmer className="h-6 w-40 rounded bg-white/20" />
          </div>
          <AppShimmer className="h-9 w-24 rounded-md bg-white/10" />
        </div>
      </div>
      <main className="mx-auto w-full max-w-[calc(1300px+3rem)] flex-1 px-5 py-12 sm:px-8">
        <div className="mb-10 app-stagger space-y-3">
          <AppShimmer className="h-3 w-28" />
          <AppShimmer className="h-9 w-full max-w-md" />
          <AppShimmer className="h-4 w-full max-w-lg" />
        </div>
        <div className="app-stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AppShimmer className="border-border h-44 rounded-[12px] border shadow-sm" />
          <AppShimmer className="border-border h-44 rounded-[12px] border shadow-sm" />
          <AppShimmer className="border-border h-44 rounded-[12px] border shadow-sm sm:col-span-2 lg:col-span-1" />
        </div>
      </main>
    </div>
  );
}

/** Centered status for payment confirm / account linking. */
export function ClientCenteredStatus({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "app-rise flex flex-col items-center justify-center gap-4 px-6 py-16 text-center",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="relative flex size-14 items-center justify-center">
        <span
          className="border-primary/25 absolute inset-0 rounded-full border-2"
          aria-hidden
        />
        <Loader2 className="app-loading-spin text-primary size-8" aria-hidden />
      </div>
      <p className="text-muted-foreground max-w-md text-sm font-medium leading-relaxed">{label}</p>
    </div>
  );
}

export function ClientInlineLoading({ label }: { label: string }) {
  return <AppLoadingMessage label={label} className="py-4" />;
}
