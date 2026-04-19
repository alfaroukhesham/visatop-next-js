import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export type AdminNavKey = "home" | "applications" | "catalog" | "pricing" | "settings";

const NAV: { href: string; key: AdminNavKey; label: string }[] = [
  { href: "/admin", key: "home", label: "Overview" },
  { href: "/admin/applications", key: "applications", label: "Applications" },
  { href: "/admin/catalog", key: "catalog", label: "Catalog" },
  { href: "/admin/pricing", key: "pricing", label: "Pricing" },
  { href: "/admin/settings", key: "settings", label: "Settings" },
];

type AdminShellProps = {
  title: string;
  subtitle?: string;
  active: AdminNavKey;
  children: React.ReactNode;
};

export function AdminShell({ title, subtitle, active, children }: AdminShellProps) {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-border bg-card sticky top-0 z-40 border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-6 py-5">
          <div className="min-w-0 space-y-1 border-l-4 border-primary pl-4">
            <p className="text-muted-foreground font-body text-xs font-medium tracking-widest uppercase">
              Console
            </p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
            {subtitle ? (
              <p className="text-muted-foreground font-body max-w-2xl text-sm leading-relaxed">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground font-body text-sm font-medium underline-offset-4 hover:underline"
            >
              Site home
            </Link>
          </div>
        </div>
        <nav
          className="border-border bg-muted/25 border-t"
          aria-label="Admin sections"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 py-2">
            {NAV.map(({ href, key, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "font-body rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active === key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
    </div>
  );
}
