import type { Metadata } from "next";
import { headers } from "next/headers";
import { signOutAction } from "@/app/actions/auth";
import { auth } from "@/lib/auth";
import { adminAuth } from "@/lib/admin-auth";
import { ClientAppHeader } from "@/components/client/client-app-header";
import {
  ClientButton,
  ClientButtonLink,
} from "@/components/client/client-button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  ClientCard,
  CardTitle,
} from "@/components/client/client-card";
import { ClientHeroPanel } from "@/components/client/client-surface";
import { HomeNationalityStart } from "@/components/client/home-nationality-start";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Choose your nationality to start a visa draft—upload documents, pay securely, and track progress in one workspace.",
};

export const dynamic = "force-dynamic";

const steps = [
  {
    kicker: "Step 1",
    title: "Nationality & visa service",
    body: "Pick your passport nationality, choose a service, and open a draft—guest or signed-in.",
  },
  {
    kicker: "Step 2",
    title: "Submit documents",
    body: "Keep everything organized in a single workspace.",
  },
  {
    kicker: "Step 3",
    title: "Review & pay",
    body: "Confirm extracted details before submission.",
  },
  {
    kicker: "Step 4",
    title: "Track status",
    body: "See progress updates without back-and-forth.",
  },
] as const;

export default async function Home() {
  const hdrs = await headers();
  const session = await auth.api.getSession({
    headers: hdrs,
  });
  const adminSession = await adminAuth.api.getSession({
    headers: hdrs,
  });

  return (
    <div className="text-foreground flex min-h-0 flex-1 flex-col">
      <ClientAppHeader />

      <div className="relative flex-1 overflow-hidden">
        <div className="relative mx-auto w-full max-w-[calc(1300px+3rem)] px-5 pb-16 pt-10 sm:px-8 md:pb-24 md:pt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(200px,260px)] lg:gap-14">
            <ClientHeroPanel
              className={cn(
                "theme-client-rise border-secondary/30 from-card via-card to-muted/50 relative border-2 p-8 shadow-[0_20px_60px_rgba(1,32,49,0.12)] md:p-12 lg:p-14",
              )}
            >
              <p className="text-secondary text-xs font-semibold uppercase tracking-[0.22em]">
                Visa &amp; residency services
              </p>
              <h2 className="font-heading text-foreground mt-5 max-w-[18ch] text-[clamp(2.35rem,6.2vw,4.25rem)] font-semibold leading-[1.02] tracking-tight">
                Start with your nationality.
                <span className="text-secondary mt-1 block max-w-[22ch] text-[clamp(1.35rem,3.8vw,2.1rem)] leading-snug tracking-tight">
                  We open your draft and carry it into the next step automatically.
                </span>
              </h2>
              <p className="text-muted-foreground mt-6 max-w-[52ch] text-base leading-relaxed md:text-lg">
                Choose the passport you travel on, then pick your visa service on the next screen—same flow as Apply,
                with your nationality already set.
              </p>

              <HomeNationalityStart />

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                {session?.user ? (
                  <>
                    <ClientButtonLink href="/portal" brand="cta" className="min-w-[148px] justify-center">
                      Go to portal
                    </ClientButtonLink>
                    <form action={signOutAction} className="sm:ml-1">
                      <ClientButton
                        type="submit"
                        brand="white"
                        variant="outline"
                        className="w-full min-w-[148px] justify-center sm:w-auto"
                      >
                        Sign out
                      </ClientButton>
                    </form>
                  </>
                ) : null}
                {adminSession?.user ? (
                  <ClientButtonLink
                    href="/admin"
                    variant="outline"
                    className="justify-center border-secondary/40 text-secondary hover:bg-secondary hover:text-white"
                  >
                    Admin console
                  </ClientButtonLink>
                ) : null}
              </div>
            </ClientHeroPanel>

            <aside
              className="theme-client-rise theme-client-rise-delay-2 hidden lg:flex lg:flex-col lg:justify-center"
              aria-label="Application steps overview"
            >
              <p className="text-secondary text-[10px] font-bold uppercase tracking-[0.28em]">At a glance</p>
              <ol className="mt-6 space-y-5">
                {steps.map((s, index) => (
                  <li key={s.kicker} className="flex gap-4">
                    <span
                      className="font-heading text-secondary/35 flex w-10 shrink-0 justify-end text-3xl leading-none tabular-nums"
                      aria-hidden
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 border-l-2 border-primary pl-4">
                      <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                        {s.kicker}
                      </p>
                      <p className="font-heading text-foreground mt-1 text-lg font-semibold leading-snug">{s.title}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </div>

        <section className="relative mx-auto w-full max-w-[calc(1300px+3rem)] px-5 pb-20 sm:px-8">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:items-start">
            <div>
              <h3 className="text-secondary text-xs font-semibold uppercase tracking-[0.22em]">How it works</h3>
              <p className="font-heading text-foreground mt-3 max-w-[20ch] text-3xl font-semibold tracking-tight md:text-4xl">
                Four stages, zero guesswork
              </p>
              <p className="text-muted-foreground mt-4 max-w-[52ch] text-base">
                Same flow you would expect from a modern visa portal—linear, explicit, and easy to resume.
              </p>

              <ol className="relative mt-12 space-y-0">
                {steps.map((s, index) => (
                  <li
                    key={s.kicker}
                    className={cn(
                      "relative flex gap-5 pb-12 pl-2 sm:gap-7 sm:pl-0",
                      index < steps.length - 1 &&
                        "before:absolute before:top-10 before:left-[1.15rem] before:h-[calc(100%-0.5rem)] before:w-0.5 before:bg-secondary/25 sm:before:left-[1.35rem]",
                    )}
                  >
                    <span
                      className="font-heading border-secondary bg-primary text-primary-foreground relative z-[1] flex size-11 shrink-0 items-center justify-center rounded-[5px] border-2 text-sm font-bold shadow-[0_6px_0_rgba(1,32,49,0.12)] sm:size-12 sm:text-base"
                      aria-hidden
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 pt-1">
                      <p className="text-secondary text-[10px] font-bold uppercase tracking-widest">{s.kicker}</p>
                      <p className="font-heading text-foreground mt-1 text-xl font-semibold sm:text-2xl">{s.title}</p>
                      <p className="text-muted-foreground mt-2 max-w-[48ch] text-sm leading-relaxed sm:text-base">
                        {s.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <aside className="lg:sticky lg:top-28">
              <ClientCard className="border-secondary/25 overflow-hidden bg-card shadow-[0_16px_48px_rgba(1,32,49,0.08)] ring-1 ring-foreground/5">
                <CardHeader className="border-secondary/15 from-card via-card to-muted/40 border-b bg-gradient-to-b pb-5">
                  <CardTitle className="font-heading text-foreground text-xl">Account</CardTitle>
                  <CardDescription className="text-muted-foreground text-base leading-relaxed">
                    Customer access. Team members use{" "}
                    <span className="text-secondary font-semibold">Admin</span> in the header.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 py-6">
                  {session?.user ? (
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Signed in as{" "}
                      <span className="text-foreground font-semibold">{session.user.email}</span>
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Start from your nationality above, or use Sign in / Create account in the header or the section
                      at the bottom of this page. Guest drafts stay on this browser until you link after payment.
                    </p>
                  )}
                  {adminSession?.user ? (
                    <p className="text-muted-foreground border-border rounded-[5px] border bg-muted/40 p-3 text-xs leading-relaxed">
                      Admin session:{" "}
                      <span className="text-foreground font-medium">{adminSession.user.email}</span>
                    </p>
                  ) : null}
                  <p className="text-muted-foreground border-t border-border pt-4 text-xs leading-relaxed">
                    Admin signup stays closed. Use admin sign-in when you have credentials.
                  </p>
                </CardContent>
              </ClientCard>
            </aside>
          </div>
        </section>

        {!session?.user ? (
          <section
            className="border-secondary/20 relative mx-auto mt-6 w-full max-w-[calc(1300px+3rem)] border-t px-5 pb-24 pt-14 sm:px-8"
            aria-label="Sign in or create an account"
          >
            <div className="theme-client-rise border-secondary/25 from-card via-card to-muted/40 mx-auto max-w-2xl rounded-[12px] border-2 bg-gradient-to-b p-8 text-center shadow-[0_16px_48px_rgba(1,32,49,0.08)] sm:p-10">
              <p className="text-secondary text-xs font-semibold uppercase tracking-[0.22em]">Returning customer</p>
              <h3 className="font-heading text-foreground mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                Sign in to see every application in one place
              </h3>
              <p className="text-muted-foreground mx-auto mt-3 max-w-[48ch] text-sm leading-relaxed sm:text-base">
                You can still start a guest draft from the top of this page. Accounts make it easier to resume on a new
                device after you have paid and linked your file.
              </p>
              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap">
                <ClientButtonLink href="/sign-in" brand="cta" className="min-w-[160px] justify-center">
                  Sign in
                </ClientButtonLink>
                <ClientButtonLink href="/sign-up" brand="blue" className="min-w-[200px] justify-center">
                  Create account
                </ClientButtonLink>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
