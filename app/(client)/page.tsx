import type { Metadata } from "next";
import { headers } from "next/headers";
import { signOutAction } from "@/app/actions/auth";
import { auth } from "@/lib/auth";
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
import { ApplyJourneyStepBar } from "@/components/apply/apply-journey-step-bar";
import { HomeNationalityStart } from "@/components/client/home-nationality-start";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Home | Visatop",
  description:
    "Start your UAE visa from your nationality—upload documents, pay securely, and track your application in one place.",
};

export const dynamic = "force-dynamic";

const steps = [
  {
    kicker: "Step 1",
    title: "Nationality",
    body: "Tell us which passport you travel on so we only show eligible visa options.",
  },
  {
    kicker: "Step 2",
    title: "Currency & visa type",
    body: "Choose how prices are shown, pick your visa, and we open your file.",
  },
  {
    kicker: "Step 3",
    title: "Documents",
    body: "Upload what we ask for in one place—clear checklists, fewer mistakes.",
  },
  {
    kicker: "Step 4",
    title: "Review & pay",
    body: "Check your details, pay securely, then submit when you are ready.",
  },
  {
    kicker: "Step 5",
    title: "Status",
    body: "Follow progress here instead of chasing updates by email.",
  },
] as const;

export default async function Home() {
  const hdrs = await headers();
  const session = await auth.api.getSession({
    headers: hdrs,
  });
  return (
    <div className="text-foreground flex min-h-0 flex-1 flex-col">
      <ClientAppHeader />

      <div className="relative flex-1 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[min(52vh,520px)] bg-[radial-gradient(ellipse_90%_80%_at_0%_0%,rgba(252,205,100,0.22),transparent_55%)]"
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-[calc(1300px+3rem)] px-5 pb-16 pt-10 sm:px-8 md:pb-24 md:pt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(200px,260px)] lg:gap-14">
            <ClientHeroPanel
              className={cn(
                "theme-client-rise border-secondary/40 from-card via-card to-muted/60 relative border-[3px] p-8 shadow-[0_28px_72px_rgba(1,32,49,0.16)] md:p-12 lg:p-14",
              )}
            >
              <p className="text-secondary text-[11px] font-bold uppercase tracking-[0.28em]">
                UAE visa &amp; residency
              </p>
              <h2 className="font-heading text-foreground mt-6 max-w-[14ch] text-[clamp(2.5rem,6.8vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.03em]">
                Your nationality first.
                <span className="text-secondary mt-3 block max-w-[20ch] text-[clamp(1.4rem,3.6vw,2.15rem)] font-semibold leading-snug tracking-tight">
                  Then visa, documents, and payment—one guided path.
                </span>
              </h2>
              <p className="text-muted-foreground mt-7 max-w-[52ch] text-base leading-relaxed md:text-lg">
                Select the passport you travel on. We show only what you can apply for, then keep your file in one
                workspace until you pay and submit.
              </p>

              <HomeNationalityStart />

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <ClientButtonLink
                  href="/apply/track"
                  variant="outline"
                  brand="white"
                  className="min-w-[148px] justify-center border-secondary/40 text-secondary hover:bg-secondary/10"
                >
                  Track application
                </ClientButtonLink>
                {session?.user ? (
                  <>
                    <ClientButtonLink href="/portal" brand="cta" className="min-w-[148px] justify-center">
                      My applications
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
              <h3 className="text-secondary text-[11px] font-bold uppercase tracking-[0.28em]">How it works</h3>
              <p className="font-heading text-foreground mt-4 max-w-[18ch] text-[clamp(1.85rem,4vw,2.75rem)] font-semibold leading-[1.08] tracking-tight">
                Five clear steps to submission
              </p>
              <p className="text-muted-foreground mt-4 max-w-[52ch] text-base leading-relaxed">
                No hidden screens—nationality, visa choice, documents, payment, then tracking.
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
                      className="font-heading border-secondary bg-primary text-primary-foreground relative z-[1] flex size-12 shrink-0 items-center justify-center rounded-[5px] border-[2.5px] text-base font-bold shadow-[0_10px_0_rgba(1,32,49,0.14)] sm:size-[3.25rem] sm:text-lg"
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
                <CardHeader className="border-secondary/20 from-card via-card to-muted/40 border-b bg-gradient-to-b pb-5">
                  <CardTitle className="font-heading text-foreground text-xl">Your account</CardTitle>
                  <CardDescription className="text-muted-foreground text-base leading-relaxed">
                    Sign in to see all applications on any device. You can still begin without an account.
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
                      Use the nationality form above to start, or sign in from the header or below. If you begin as a
                      guest, complete payment and follow the email we send to connect this application to an account.
                    </p>
                  )}
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
            <div className="theme-client-rise border-secondary/35 from-card via-card to-muted/50 mx-auto max-w-2xl rounded-[12px] border-[3px] bg-gradient-to-b p-8 text-center shadow-[0_20px_56px_rgba(1,32,49,0.12)] sm:p-10">
              <p className="text-secondary text-[11px] font-bold uppercase tracking-[0.28em]">Returning customer</p>
              <h3 className="font-heading text-foreground mt-4 text-[clamp(1.5rem,3.5vw,2.25rem)] font-semibold leading-tight tracking-tight">
                One sign-in for every application
              </h3>
              <p className="text-muted-foreground mx-auto mt-4 max-w-[48ch] text-sm leading-relaxed sm:text-base">
                You can still start from the top without an account. After payment, signing in lets you open the same
                file on another phone or laptop.
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

      <ApplyJourneyStepBar
        step={1}
        totalSteps={5}
        title="Start your application"
        subtitle="Type your country, pick from the list, then continue to currency and visa options."
      />
    </div>
  );
}
