import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Apply",
  description:
    "Choose nationality and visa service to open a draft — works for guests and signed-in applicants.",
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background text-foreground min-h-full">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="bg-primary/10 text-primary flex size-9 items-center justify-center border border-primary/25">
              <FileText className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.2em] uppercase">
                Application
              </p>
              <p className="font-heading text-sm font-semibold tracking-tight group-hover:text-primary transition-colors">
                Visatop
              </p>
            </div>
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link
              href="/apply/start"
              className="text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              Start
            </Link>
            <Link
              href="/sign-in?callbackUrl=%2Fportal"
              className="text-link font-medium hover:underline"
            >
              Sign in
            </Link>
            <Link href="/portal" className="text-muted-foreground hover:text-foreground font-medium">
              Portal
            </Link>
          </nav>
        </div>
      </header>
      <div className="border-primary/30 mx-auto max-w-3xl border-l-2 px-5 py-8 sm:px-8 sm:py-10">
        {children}
      </div>
    </div>
  );
}
