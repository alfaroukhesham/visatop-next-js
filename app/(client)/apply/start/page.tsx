import type { Metadata } from "next";
import { ApplyJourneyStepBar } from "@/components/apply/apply-journey-step-bar";
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

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-8">
      <header className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="bg-secondary text-secondary-foreground inline-flex items-center rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest shadow-sm">
            Step 2 of 5
          </span>
          <span className="text-muted-foreground text-sm font-semibold">Currency &amp; visa</span>
        </div>
        <div className="space-y-4">
          <h1 className="font-heading text-foreground text-[clamp(2.15rem,4.8vw,3rem)] font-semibold leading-[1.06] tracking-[-0.02em]">
            Choose your visa
          </h1>
          <p className="text-muted-foreground max-w-prose text-base leading-relaxed md:text-lg">
            {initialNationalityCode ? (
              <>
                Nationality <span className="text-foreground font-semibold">{initialNationalityCode}</span> is already
                set from the home page. Choose how prices are shown, pick your visa, then continue to your application
                file.
              </>
            ) : (
              <>
                Choose nationality, how you want prices shown, and your visa—we create your application file right
                away. Stay on this device to continue as a guest, or sign in so your file follows your account.
              </>
            )}
          </p>
        </div>
      </header>

      <ClientSurface
        preset="highlight"
        className="border-secondary/40 bg-card/95 p-6 shadow-[0_18px_56px_rgba(1,32,49,0.12)] sm:p-8 md:p-10"
      >
        <StartApplicationForm initialNationalityCode={initialNationalityCode} />
      </ClientSurface>

      <ApplyJourneyStepBar
        step={2}
        totalSteps={5}
        title="Pick visa type"
        subtitle="Choose pay-in currency, then tap a service card."
      />
    </div>
  );
}
