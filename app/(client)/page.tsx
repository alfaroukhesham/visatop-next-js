import type { Metadata } from "next";
import { ApplyJourneyStepBar } from "@/components/apply/apply-journey-step-bar";
import { ApplyTwoColumn } from "@/components/apply/apply-two-column";
import { ClientAppHeader } from "@/components/client/client-app-header";
import { ClientHeroPanel } from "@/components/client/client-surface";
import { HomeDemoVideo } from "@/components/client/home-demo-video";
import { HomeNationalityStart } from "@/components/client/home-nationality-start";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { appHref } from "@/lib/app-href";
import { buildHomePageJsonLd } from "@/lib/seo/home-page-json-ld";
import { cn } from "@/lib/utils";

const HOME_DESCRIPTION =
  "Start your UAE visa from your nationality—upload documents, pay securely, and track your application in one place.";

export const metadata: Metadata = {
  title: "Apply for UAE Tourist Visa Online",
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: appHref("/"),
  },
  openGraph: {
    title: "Apply for UAE Tourist Visa Online | Visatop",
    description: HOME_DESCRIPTION,
    url: appHref("/"),
    type: "website",
  },
};

export default function Home() {
  return (
    <div className="text-foreground flex min-h-0 flex-1 flex-col">
      <JsonLdScript id="visatop-home-jsonld" data={buildHomePageJsonLd()} />
      <ClientAppHeader />

      <div className="relative flex-1 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[min(52vh,520px)] bg-[radial-gradient(ellipse_90%_80%_at_0%_0%,rgba(252,205,100,0.22),transparent_55%)]"
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-[calc(1300px+3rem)] px-5 pb-16 pt-10 sm:px-4 md:pb-24 md:pt-14">
          <ApplyTwoColumn currentStep={1} contentClassName="min-w-0 space-y-12 md:space-y-16">
            <ClientHeroPanel
              className={cn(
                "theme-client-rise border-secondary/40 from-card via-card to-muted/60 relative border-[3px] p-8 shadow-[0_28px_72px_rgba(1,32,49,0.16)] md:p-12 lg:p-14",
              )}
            >
              <p className="text-secondary text-[11px] text-center font-bold uppercase tracking-[0.28em]">
              UAE Tourist Visa
              </p>
              <h1 className="font-heading text-foreground mt-6 text-center text-[2.25rem]! leading-[1.2]! font-semibold md:text-[2.25rem]!">
                Traveling to Dubai?
                <span className="text-secondary mt-3 block font-semibold leading-snug tracking-tight text-center">
                  Apply online for your Dubai visa & UAE
                </span>
              </h1>
              <h2 className="font-heading text-foreground mt-6 text-center text-[1.25rem]! leading-[1.35]! font-semibold">
                Get your visa in 2 working days
              </h2>
              <p className="text-muted-foreground mt-7  text-base text-center leading-relaxed md:text-lg">
                Select the passport you travel on. We show only what you can apply for, then keep your file in one
                workspace until you pay and submit.
              </p>

              <HomeNationalityStart />
            </ClientHeroPanel>

            <HomeDemoVideo />
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
