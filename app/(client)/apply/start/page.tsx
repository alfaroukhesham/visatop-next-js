import type { Metadata } from "next";
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
    <div className="mx-auto max-w-3xl space-y-12">
      <header className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="bg-secondary text-secondary-foreground inline-flex items-center rounded-[5px] px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest shadow-[0_3px_0_rgba(1,32,49,0.12)]">
            Step 1 of 4
          </span>
          <span className="text-muted-foreground text-sm font-medium">Nationality &amp; visa service</span>
        </div>
        <div className="space-y-4">
          <h1 className="font-heading text-foreground text-[clamp(2rem,4.5vw,2.85rem)] font-semibold leading-[1.08] tracking-tight">
            Start your application
          </h1>
          <p className="text-muted-foreground max-w-prose text-base leading-relaxed md:text-lg">
            {initialNationalityCode ? (
              <>
                Your nationality is already set to{" "}
                <span className="text-foreground font-semibold">{initialNationalityCode}</span> (from home). Choose
                your visa service below—we open your draft as soon as you continue.
              </>
            ) : (
              <>
                Choose your nationality and visa service—we open your draft immediately. Guests keep a secure resume
                cookie in this browser; signed-in users attach the draft to their account automatically.
              </>
            )}
          </p>
        </div>
      </header>

      <ClientSurface
        preset="highlight"
        className="border-secondary/30 bg-card/95 p-6 shadow-[0_12px_48px_rgba(1,32,49,0.1)] sm:p-9"
      >
        <StartApplicationForm initialNationalityCode={initialNationalityCode} />
      </ClientSurface>
    </div>
  );
}
