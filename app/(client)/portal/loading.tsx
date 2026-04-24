export default function PortalLoading() {
  return (
    <div className="bg-background text-foreground min-h-screen animate-pulse">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <div className="space-y-2">
            <div className="bg-muted h-7 w-56 rounded-md" />
            <div className="bg-muted h-4 w-72 max-w-full rounded-md" />
          </div>
          <div className="bg-muted h-9 w-9 rounded-md" />
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-4 px-6 py-10 sm:grid-cols-2">
        <div className="bg-card border-border h-32 rounded-xl border" />
        <div className="bg-card border-border h-32 rounded-xl border" />
      </main>
    </div>
  );
}
