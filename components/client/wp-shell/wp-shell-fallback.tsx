import Link from "next/link";

export function WpShellFallbackHeader() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex w-full max-w-[calc(1300px+3rem)] items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" className="font-semibold tracking-tight">
          Visatop
        </Link>
        <nav aria-label="Primary">
          <ul className="flex items-center gap-5">
            <li>
              <Link href="/" className="hover:underline">
                Apply
              </Link>
            </li>
            <li>
              <Link href="/portal" className="hover:underline">
                Portal
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

export function WpShellFallbackFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t bg-white py-10 text-center text-sm text-muted-foreground">
      <div className="mx-auto w-full max-w-[calc(1300px+3rem)] px-5 sm:px-8">© {year} Visatop</div>
    </footer>
  );
}

