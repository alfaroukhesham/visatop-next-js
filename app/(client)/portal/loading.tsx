export default function PortalLoading() {
  return (
    <div className="text-foreground flex min-h-[50vh] flex-1 flex-col">
      <div
        className="border-b border-white/10 bg-[#012031]/95 px-5 py-4 shadow-md sm:px-8"
        aria-hidden
      >
        <div className="mx-auto flex max-w-[calc(1300px+3rem)] items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-white/15" />
            <div className="h-6 w-40 rounded bg-white/20" />
          </div>
          <div className="h-9 w-24 rounded-md border border-white/20 bg-white/10" />
        </div>
      </div>
      <main className="mx-auto w-full max-w-[calc(1300px+3rem)] flex-1 px-5 py-12 sm:px-8">
        <div className="mb-10 space-y-3">
          <div className="bg-secondary/20 h-3 w-28 rounded" />
          <div className="bg-foreground/10 h-9 w-full max-w-md rounded-md" />
          <div className="bg-muted-foreground/15 h-4 w-full max-w-lg rounded" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="border-border bg-card h-44 rounded-[12px] border shadow-sm" />
          <div className="border-border bg-card h-44 rounded-[12px] border shadow-sm" />
          <div className="border-border bg-card h-44 rounded-[12px] border shadow-sm sm:col-span-2 lg:col-span-1" />
        </div>
      </main>
    </div>
  );
}
