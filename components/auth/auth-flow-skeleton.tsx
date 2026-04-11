/**
 * Loading placeholder for client sign-in / sign-up (two-column + card layout).
 */
export function AuthFlowSkeleton() {
  return (
    <div className="bg-background text-foreground flex flex-1 flex-col animate-pulse">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0 space-y-2">
            <div className="bg-muted h-3 w-40 rounded" />
            <div className="bg-muted h-6 w-28 rounded" />
          </div>
          <div className="bg-muted h-8 w-14 rounded-md" />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-6 py-10 lg:grid-cols-2 lg:gap-12 lg:py-16">
        <section className="space-y-6">
          <div className="space-y-3">
            <div className="bg-muted h-10 max-w-md rounded-md" />
            <div className="bg-muted h-20 max-w-lg rounded-md" />
          </div>
          <div className="border-border bg-card border p-4">
            <div className="bg-muted mb-2 h-3 w-16 rounded" />
            <div className="bg-muted h-12 w-full rounded-md" />
          </div>
        </section>

        <aside className="lg:justify-self-end w-full">
          <div className="bg-card border-border w-full max-w-md overflow-hidden rounded-lg border">
            <div className="border-b border-border px-6 py-6">
              <div className="bg-muted mb-2 h-6 w-28 rounded" />
              <div className="bg-muted h-4 w-full max-w-xs rounded" />
            </div>
            <div className="space-y-4 px-6 py-6">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="bg-muted h-10 rounded-md" />
                <div className="bg-muted h-10 rounded-md" />
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-border h-px flex-1" />
                <div className="bg-muted h-3 w-6 rounded" />
                <div className="bg-border h-px flex-1" />
              </div>
              <div className="bg-muted h-10 w-full rounded-md" />
              <div className="bg-muted h-10 w-full rounded-md" />
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
