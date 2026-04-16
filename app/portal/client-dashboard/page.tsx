import Link from "next/link";
import {
  ArrowRight,
  FolderOpen,
  Globe,
  HelpCircle,
  MapPin,
  Plus,
  User,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const destinations = [
  {
    title: "Schengen Area",
    description:
      "Access to 27 European countries for tourism and business purposes.",
  },
  {
    title: "Australia",
    description:
      "Electronic Travel Authority (ETA) for short-term tourism or business visitor activities.",
  },
  {
    title: "United Kingdom",
    description:
      "Standard Visitor visa for tourism, business, study, and other permitted activities.",
  },
] as const;

export const metadata = {
  title: "Client dashboard | Unified Hybrid Portal",
};

export default function ClientDashboardPage() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="bg-foreground text-background z-10 flex h-16 w-full shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-4">
          <Globe className="size-6 shrink-0" aria-hidden />
          <h1 className="font-heading text-lg font-semibold tracking-tight">Unified Hybrid Portal</h1>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle inverse className="rounded-full" />
          <div
            className="border-background/30 flex size-9 shrink-0 items-center justify-center border bg-background/10"
            aria-hidden
          >
            <User className="size-5 opacity-90" />
          </div>
        </div>
      </header>

      <div className="flex w-full flex-1 overflow-hidden">
        <aside className="hidden w-[250px] shrink-0 flex-col border-r border-border bg-card md:flex">
          <nav className="flex flex-1 flex-col gap-1 py-4">
            <Link
              href="/portal/client-dashboard"
              className="text-foreground hover:bg-muted flex items-center gap-3 px-6 py-3 transition-colors"
            >
              <User className="text-muted-foreground size-5" />
              <span className="text-sm font-medium">Account Settings</span>
            </Link>
            <span className="border-primary bg-muted text-foreground flex items-center gap-3 border-l-4 px-6 py-3">
              <FolderOpen className="text-primary size-5" />
              <span className="text-sm font-bold">My Applications</span>
            </span>
            <Link
              href="/portal"
              className="text-foreground hover:bg-muted flex items-center gap-3 px-6 py-3 transition-colors"
            >
              <HelpCircle className="text-muted-foreground size-5" />
              <span className="text-sm font-medium">Portal overview</span>
            </Link>
          </nav>
        </aside>

        <main className="w-full flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8">
            <section className="flex w-full flex-col gap-4">
              <h2 className="font-heading text-xl font-semibold tracking-tight">Active applications</h2>
              <div className="border-border bg-card flex flex-col gap-4 border border-l-4 border-l-primary p-6 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-2">
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Drafts you create from the live flow appear in your account when signed in. Guests use the
                    same browser (resume cookie) — start from{" "}
                    <Link href="/apply/start" className="text-link font-medium">
                      /apply/start
                    </Link>
                    .
                  </p>
                </div>
                <Link
                  href="/apply/start"
                  className={cn(
                    buttonVariants({ variant: "default" }),
                    "rounded-none font-semibold md:inline-flex md:shrink-0",
                  )}
                >
                  Create draft
                </Link>
              </div>
            </section>

            <section className="flex w-full flex-col gap-6">
              <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-heading text-xl font-semibold tracking-tight">Example destinations</h2>
                <Link
                  href="/apply/start"
                  className={cn(
                    buttonVariants({ variant: "default", size: "lg" }),
                    "bg-primary text-primary-foreground hover:bg-primary/90 w-full gap-2 rounded-none font-semibold sm:w-auto",
                  )}
                >
                  <Plus className="size-5" />
                  Start application
                </Link>
              </div>
              <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {destinations.map((d) => (
                  <article
                    key={d.title}
                    className="border-border bg-card flex flex-col border p-5 transition-colors hover:border-foreground"
                  >
                    <div className="bg-accent/40 text-accent-foreground mb-4 flex size-12 items-center justify-center border border-accent/30">
                      <MapPin className="size-6" aria-hidden />
                    </div>
                    <h3 className="text-card-foreground font-heading text-lg font-semibold tracking-tight">
                      {d.title}
                    </h3>
                    <p className="text-muted-foreground mt-2 flex-1 text-sm leading-relaxed">{d.description}</p>
                    <div className="mt-5 border-t border-border pt-4">
                      <Link
                        href="/apply/start"
                        className="text-link inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                      >
                        Open catalog picker
                        <ArrowRight className="size-4" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <p className="text-muted-foreground text-center text-sm">
              <Link href="/portal" className="hover:text-foreground underline">
                All portal screens
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
