import Link from "next/link";
import { ArrowRight, HelpCircle, Plane, User } from "lucide-react";
import { ClientButtonLink } from "@/components/client/client-button";
import { ClientSurface } from "@/components/client/client-surface";
import { ClientNavLink } from "@/components/client/client-nav-link";

export const metadata = {
  title: "Dashboard | Visatop",
};

export default function ClientDashboardPage() {
  return (
    <div className="text-foreground flex min-h-[calc(100vh-4rem)] flex-1 flex-col">
      <div className="flex w-full flex-1 overflow-hidden">
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-[#224D64]/20 bg-white/95 shadow-[4px_0_28px_rgba(1,32,49,0.06)] md:flex">
          <nav className="flex flex-1 flex-col gap-0.5 py-6" aria-label="Dashboard">
            <Link
              href="/portal/client-dashboard"
              className="text-foreground hover:bg-muted/80 mx-3 flex items-center gap-3 rounded-[5px] px-4 py-3 transition-colors duration-200"
            >
              <User className="text-secondary size-5 shrink-0" aria-hidden />
              <span className="text-sm font-medium">Account</span>
            </Link>
            <Link
              href="/portal"
              className="text-foreground hover:bg-muted/80 mx-3 flex items-center gap-3 rounded-[5px] px-4 py-3 transition-colors duration-200"
            >
              <HelpCircle className="text-secondary size-5 shrink-0" aria-hidden />
              <span className="text-sm font-medium">Overview</span>
            </Link>
          </nav>
        </aside>

        <main className="w-full flex-1 overflow-y-auto p-5 md:p-10">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-12">
            <header className="space-y-4 border-b border-border pb-8">
              <p className="text-secondary text-[11px] font-bold uppercase tracking-[0.28em]">Dashboard</p>
              <h1 className="font-heading text-foreground max-w-[16ch] text-[clamp(2.1rem,4.2vw,3.15rem)] font-semibold leading-[1.08] tracking-tight">
                Your applications in one place
              </h1>
              <p className="text-muted-foreground max-w-[62ch] text-base leading-relaxed md:text-lg">
                Start a new visa from the apply flow, or open an existing file. Sign in to see the same list on any
                device.
              </p>
            </header>

            <section className="flex w-full flex-col gap-4">
              <h2 className="font-heading text-secondary text-[11px] font-bold uppercase tracking-[0.22em]">
                Get started
              </h2>
              <div className="border-secondary/35 from-secondary/8 to-card flex flex-col gap-6 rounded-[12px] border-[3px] border-l-[5px] border-l-primary bg-gradient-to-r p-8 shadow-[0_18px_48px_rgba(1,32,49,0.1)] md:flex-row md:items-center md:justify-between">
                <div className="max-w-[52ch] space-y-2">
                  <p className="text-foreground text-base font-semibold leading-snug">
                    New here? Start your nationality and visa choice in the apply flow.
                  </p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    If you began without signing in, keep using this browser until you pay—then use the email we send
                    to link your file to an account.
                  </p>
                </div>
                <ClientButtonLink href="/apply/start" brand="cta" className="shrink-0 justify-center px-8 py-6 text-base font-bold">
                  Start application
                </ClientButtonLink>
              </div>
            </section>

            <section>
              <ClientSurface
                preset="highlight"
                className="border-secondary/35 from-card to-muted/30 p-8 shadow-[0_16px_44px_rgba(1,32,49,0.09)] md:p-10"
              >
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-10">
                  <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <div className="bg-primary/25 text-secondary flex size-14 shrink-0 items-center justify-center rounded-[12px] border-2 border-primary/35">
                      <Plane className="size-7" aria-hidden />
                    </div>
                    <div>
                      <h2 className="font-heading text-foreground text-2xl font-semibold tracking-tight md:text-3xl">
                        Visa services
                      </h2>
                      <p className="text-muted-foreground mt-3 max-w-[48ch] text-base leading-relaxed">
                        Available visas and prices come from our live catalog. Choose your passport country and service
                        in the apply flow—there is nothing extra to configure here.
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-3 md:pt-2">
                    <ClientButtonLink href="/apply/start" brand="blue" className="justify-center gap-2 px-6 font-semibold">
                      Browse &amp; apply
                      <ArrowRight className="size-4 shrink-0" aria-hidden />
                    </ClientButtonLink>
                    <ClientNavLink
                      href="/apply/track"
                      className="text-link inline-flex items-center justify-center gap-1 text-sm font-semibold"
                    >
                      Track applications
                      <ArrowRight className="size-4 shrink-0" aria-hidden />
                    </ClientNavLink>
                  </div>
                </div>
              </ClientSurface>
            </section>

            <p className="text-muted-foreground text-center text-sm">
              <Link href="/portal" className="text-link font-semibold hover:underline">
                Back to portal overview
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
