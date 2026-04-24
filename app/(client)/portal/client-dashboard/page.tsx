import Link from "next/link";
import {
  ArrowRight,
  FolderOpen,
  HelpCircle,
  MapPin,
  Plus,
  User,
} from "lucide-react";
import { ClientButtonLink } from "@/components/client/client-button";
import { CardContent, ClientCard } from "@/components/client/client-card";
import { ClientNavLink } from "@/components/client/client-nav-link";

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
    <div className="text-foreground flex min-h-[calc(100vh-4rem)] flex-1 flex-col">
      <div className="flex w-full flex-1 overflow-hidden">
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-[#224D64]/15 bg-white/90 shadow-[4px_0_24px_rgba(1,32,49,0.04)] md:flex">
          <nav className="flex flex-1 flex-col gap-0.5 py-6" aria-label="Dashboard">
            <Link
              href="/portal/client-dashboard"
              className="text-foreground hover:bg-muted/80 mx-3 flex items-center gap-3 rounded-[5px] px-4 py-3 transition-colors duration-200"
            >
              <User className="text-secondary size-5 shrink-0" aria-hidden />
              <span className="text-sm font-medium">Account</span>
            </Link>
            <span className="border-primary bg-muted/60 text-foreground mx-3 flex items-center gap-3 rounded-[5px] border-l-[3px] border-l-[#FCCD64] px-4 py-3">
              <FolderOpen className="text-secondary size-5 shrink-0" aria-hidden />
              <span className="text-sm font-bold">My applications</span>
            </span>
            <Link
              href="/portal"
              className="text-foreground hover:bg-muted/80 mx-3 flex items-center gap-3 rounded-[5px] px-4 py-3 transition-colors duration-200"
            >
              <HelpCircle className="text-secondary size-5 shrink-0" aria-hidden />
              <span className="text-sm font-medium">Portal hub</span>
            </Link>
          </nav>
        </aside>

        <main className="w-full flex-1 overflow-y-auto p-5 md:p-10">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-12">
            <header className="space-y-4 border-b border-border pb-8">
              <p className="text-secondary text-xs font-semibold uppercase tracking-[0.22em]">Dashboard</p>
              <h1 className="font-heading text-foreground max-w-[18ch] text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.1] tracking-tight">
                Your applications, one workspace
              </h1>
              <p className="text-muted-foreground max-w-[62ch] text-base leading-relaxed md:text-lg">
                Drafts from the live apply flow land here when you use the same browser—or sign in to sync across
                devices.
              </p>
            </header>

            <section className="flex w-full flex-col gap-4">
              <h2 className="font-heading text-secondary text-xs font-semibold uppercase tracking-[0.22em]">
                Active applications
              </h2>
              <div className="border-secondary/25 from-secondary/5 to-card flex flex-col gap-5 rounded-[12px] border-2 border-l-[4px] border-l-primary bg-gradient-to-r p-7 shadow-[0_14px_40px_rgba(1,32,49,0.08)] md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-2">
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Guests keep the same browser session (resume cookie). Start from{" "}
                    <Link href="/apply/start" className="text-link font-semibold hover:underline">
                      /apply/start
                    </Link>
                    .
                  </p>
                </div>
                <ClientButtonLink href="/apply/start" brand="cta" className="shrink-0 justify-center font-semibold">
                  Create draft
                </ClientButtonLink>
              </div>
            </section>

            <section className="flex w-full flex-col gap-8">
              <div className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-[42ch] space-y-2">
                  <h2 className="font-heading text-foreground text-3xl font-semibold tracking-tight md:text-4xl">
                    Popular destinations
                  </h2>
                  <p className="text-muted-foreground text-sm leading-relaxed md:text-base">
                    Illustrative catalog cards—pick a real destination from the apply flow when live data is wired.
                  </p>
                </div>
                <ClientButtonLink href="/apply/start" brand="blue" className="w-full shrink-0 gap-2 sm:w-auto">
                  <Plus className="size-5 shrink-0" aria-hidden />
                  New application
                </ClientButtonLink>
              </div>
              <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {destinations.map((d, i) => (
                  <ClientCard
                    key={d.title}
                    className={
                      i === 0
                        ? "border-secondary/20 hover:border-secondary/35 transition-all duration-200 hover:-translate-y-0.5"
                        : "border-secondary/10 hover:border-secondary/25 transition-all duration-200 hover:-translate-y-0.5"
                    }
                  >
                    <CardContent
                      className={
                        i === 0
                          ? "pt-8 pb-4 md:flex md:min-h-[200px] md:flex-col md:justify-between"
                          : "pt-6 pb-2"
                      }
                    >
                      <div
                        className={
                          i === 0
                            ? "bg-primary/20 text-secondary mb-5 flex size-14 items-center justify-center rounded-[12px] border-2 border-primary/30"
                            : "bg-primary/15 text-secondary mb-4 flex size-12 items-center justify-center rounded-[10px] border border-primary/25"
                        }
                      >
                        <MapPin className={i === 0 ? "size-7" : "size-6"} aria-hidden />
                      </div>
                      <h3 className="font-heading text-foreground text-xl font-semibold md:text-2xl">{d.title}</h3>
                      <p className="text-muted-foreground mt-2 flex-1 text-sm leading-relaxed">{d.description}</p>
                      <div className="mt-5 border-t border-border pt-4">
                        <ClientNavLink
                          href="/apply/start"
                          className="text-link inline-flex items-center gap-1 text-sm font-semibold"
                        >
                          Open catalog picker
                          <ArrowRight className="size-4 shrink-0" aria-hidden />
                        </ClientNavLink>
                      </div>
                    </CardContent>
                  </ClientCard>
                ))}
              </div>
            </section>

            <p className="text-muted-foreground text-center text-sm">
              <Link href="/portal" className="text-link font-medium hover:underline">
                ← Portal hub
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
