import type { Metadata } from "next";
import { ClientAppHeader } from "@/components/client/client-app-header";
import { ClientHeroPanel } from "@/components/client/client-surface";
import { ApplyJourneyStepBar } from "@/components/apply/apply-journey-step-bar";
import { ApplyTwoColumn } from "@/components/apply/apply-two-column";
import { HomeNationalityStart } from "@/components/client/home-nationality-start";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Home | Visatop",
  description:
    "Start your UAE visa from your nationality—upload documents, pay securely, and track your application in one place.",
};

export default function Home() {
  return (
    <div className="text-foreground flex min-h-0 flex-1 flex-col">
      <ClientAppHeader />

      <div className="relative flex-1 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[min(52vh,520px)] bg-[radial-gradient(ellipse_90%_80%_at_0%_0%,rgba(252,205,100,0.22),transparent_55%)]"
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-[calc(1300px+3rem)] px-5 pb-16 pt-10 sm:px-4 md:pb-24 md:pt-14">
          <ApplyTwoColumn currentStep={1} contentClassName="min-w-0">
            <ClientHeroPanel
              className={cn(
                "theme-client-rise border-secondary/40 from-card via-card to-muted/60 relative border-[3px] p-8 shadow-[0_28px_72px_rgba(1,32,49,0.16)] md:p-12 lg:p-14",
              )}
            >
              <p className="text-secondary text-[11px] text-center font-bold uppercase tracking-[0.28em]">
              UAE Tourist Visa
              </p>
              <h2 className="font-heading text-foreground mt-6 font-semibold text-center">
                Traveling to Dubai?
                <span className="text-secondary mt-3 block font-semibold leading-snug tracking-tight text-center">
                  Apply online for your Dubai visa & UAE
                </span>
              </h2>
              <h3 className="font-heading text-foreground mt-6 font-semibold text-center">
                Get your visa in 2 working days
              </h3>
              <p className="text-muted-foreground mt-7  text-base text-center leading-relaxed md:text-lg">
                Select the passport you travel on. We show only what you can apply for, then keep your file in one
                workspace until you pay and submit.
              </p>

              <HomeNationalityStart />
            </ClientHeroPanel>
          </ApplyTwoColumn>
        </div>
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
