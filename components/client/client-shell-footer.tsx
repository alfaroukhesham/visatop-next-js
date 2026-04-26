"use client";

import Link from "next/link";

/**
 * Shared client footer — subtle, does not compete with primary flows.
 */
export function ClientShellFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-secondary/10 mt-auto border-t bg-white/80 py-8 text-center text-sm text-muted-foreground backdrop-blur-md supports-[backdrop-filter]:bg-white/65">
      <div className="mx-auto flex w-full max-w-[calc(1300px+3rem)] flex-col items-center justify-center gap-3 px-5 sm:flex-row sm:gap-8">
        <span className="tabular-nums">© {year} Visatop</span>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2" aria-label="Footer">
          <Link href="/" className="text-link font-medium transition-colors duration-200 hover:underline">
            Home
          </Link>
          <Link href="/apply/start" className="text-link font-medium transition-colors duration-200 hover:underline">
            Apply
          </Link>
          <Link href="/help" className="text-link font-medium transition-colors duration-200 hover:underline">
            Help
          </Link>
        </nav>
      </div>
    </footer>
  );
}
