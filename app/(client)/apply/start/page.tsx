import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ApplyJourneyStepBar } from "@/components/apply/apply-journey-step-bar";
import { ApplyTwoColumn } from "@/components/apply/apply-two-column";
import { StartApplicationForm } from "@/components/apply/start-application-form";
import { ClientSurface } from "@/components/client/client-surface";

export const metadata: Metadata = {
  title: "Start application",
};

function normalizeNationalityParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().toUpperCase();
  if (t.length !== 2 || !/^[A-Z]{2}$/.test(t)) return undefined;
  return t;
}

type PageProps = {
  searchParams?: Promise<{ nationality?: string | string[] }>;
};

export default async function ApplyStartPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const initialNationalityCode = normalizeNationalityParam(sp.nationality);
  if (!initialNationalityCode) {
    redirect("/");
  }

  return (
    <div className="max-w-6xl pb-8">
      <ApplyTwoColumn currentStep={2} contentClassName="space-y-10">
          <header className="space-y-6">
            <div className="space-y-4">
              <h1 className="font-heading text-foreground text-[clamp(2.15rem,4.8vw,3rem)] font-semibold leading-[1.06] tracking-[-0.02em]">
                Choose your visa
              </h1>
              <p className="text-muted-foreground max-w-prose text-base leading-relaxed md:text-lg">
                Nationality <span className="text-foreground font-semibold">{initialNationalityCode}</span> is set from
                the home page. Choose how prices are shown, pick your visa, then continue to your application file.
              </p>
            </div>
          </header>

          <ClientSurface
            preset="highlight"
            className="border-secondary/40 bg-card/95 p-6 shadow-[0_18px_56px_rgba(1,32,49,0.12)] sm:p-8 md:p-10"
          >
            <StartApplicationForm
              key={initialNationalityCode}
              initialNationalityCode={initialNationalityCode}
            />
          </ClientSurface>

          <ApplyJourneyStepBar
            step={2}
            totalSteps={5}
            title="Pick visa type"
            subtitle="Choose pay-in currency, then tap a service card."
          />
      </ApplyTwoColumn>
    </div>
  );
}
