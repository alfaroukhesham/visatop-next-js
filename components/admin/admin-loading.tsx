import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminShimmer({ className }: { className?: string }) {
  return <div className={cn("admin-shimmer rounded-md bg-muted", className)} aria-hidden />;
}

export function AdminLoadingMessage({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-muted-foreground admin-rise flex items-center justify-center gap-2 py-8 text-sm",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="admin-loading-spin size-4 shrink-0" aria-hidden />
      {label}
    </p>
  );
}

/** Skeleton for settings panels (label + field blocks). */
export function AdminFormLoadingSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="admin-stagger max-w-md space-y-4" aria-busy="true" aria-label="Loading settings">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          <AdminShimmer className="h-3.5 w-28" />
          <AdminShimmer className="h-10 w-full rounded-none" />
        </div>
      ))}
      <AdminShimmer className="h-10 w-24 rounded-none" />
    </div>
  );
}

export function AdminTableLoadingSkeleton({
  rows = 5,
  columns,
  columnWidths,
}: {
  rows?: number;
  columns: number;
  /** Tailwind width classes per column, e.g. `["w-2/5", "w-24", "w-10"]` */
  columnWidths?: string[];
}) {
  const widths =
    columnWidths ??
    Array.from({ length: columns }, (_, i) => (i === 0 ? "w-2/5" : i === columns - 1 ? "w-16" : "w-28"));

  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row}>
          {widths.map((w, col) => (
            <td key={col} className="px-4 py-3">
              <AdminShimmer className={cn("h-4", w)} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function AdminTableLoadingCell({
  colSpan,
  label = "Loading…",
}: {
  colSpan: number;
  label?: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <AdminLoadingMessage label={label} />
      </td>
    </tr>
  );
}

type AdminTableLoadingFrameProps = {
  loading: boolean;
  hasRows: boolean;
  children: React.ReactNode;
  className?: string;
};

/** Progress bar + dim tbody while refetching (pagination, filters). */
export function AdminTableLoadingFrame({
  loading,
  hasRows,
  children,
  className,
}: AdminTableLoadingFrameProps) {
  const busy = loading && hasRows;

  return (
    <div
      className={cn("relative overflow-hidden rounded-md", busy && "admin-table-busy", className)}
      aria-busy={loading || undefined}
    >
      {busy ? <div className="admin-table-progress" aria-hidden /> : null}
      {children}
    </div>
  );
}

/** Route-level shell skeleton aligned with AdminShell layout. */
export function AdminPageLoadingSkeleton() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-border bg-card border-b">
        <div className="mx-auto max-w-6xl space-y-3 px-6 py-5 admin-rise">
          <AdminShimmer className="h-3 w-20" />
          <AdminShimmer className="h-8 w-48 max-w-full" />
          <AdminShimmer className="h-4 w-72 max-w-full" />
        </div>
        <nav className="border-border bg-muted/25 border-t">
          <div className="admin-stagger mx-auto flex max-w-6xl flex-wrap gap-1 px-4 py-2">
            {Array.from({ length: 5 }, (_, i) => (
              <AdminShimmer key={i} className="h-9 w-24 rounded-md" />
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-10 admin-rise">
        <AdminShimmer className="h-40 w-full rounded-xl border border-border" />
        <AdminShimmer className="h-56 w-full rounded-xl border border-border" />
      </main>
    </div>
  );
}

/** Drop-in replacement for sign-in / auth loading layouts. */
export function AdminAuthLoadingSkeleton() {
  return (
    <div className="bg-background text-foreground flex flex-1 flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4 admin-rise">
          <div className="min-w-0 space-y-2">
            <AdminShimmer className="h-3 w-28" />
            <AdminShimmer className="h-6 w-24" />
          </div>
          <AdminShimmer className="h-8 w-20 rounded-md" />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-6 py-10 lg:grid-cols-2 lg:gap-12 lg:py-16">
        <section className="admin-stagger space-y-6">
          <div className="space-y-3">
            <AdminShimmer className="h-10 max-w-md" />
            <AdminShimmer className="h-16 max-w-lg" />
          </div>
          <div className="border-border bg-card border p-4">
            <AdminShimmer className="mb-2 h-3 w-12" />
            <AdminShimmer className="h-14 w-full" />
          </div>
        </section>

        <aside className="lg:justify-self-end w-full admin-rise">
          <div className="bg-card border-border w-full max-w-md overflow-hidden rounded-lg border">
            <div className="border-b border-border px-6 py-6 space-y-2">
              <AdminShimmer className="h-6 w-24" />
              <AdminShimmer className="h-4 w-full max-w-xs" />
            </div>
            <div className="admin-stagger space-y-4 px-6 py-6">
              <AdminShimmer className="h-10 w-full" />
              <AdminShimmer className="h-10 w-full" />
              <div className="flex gap-2 pt-2">
                <AdminShimmer className="h-10 flex-1" />
                <AdminShimmer className="h-10 flex-1" />
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
