import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ApplyTwoColumn } from "@/components/apply/apply-two-column";
import { StartApplicationForm } from "@/components/apply/start-application-form";
import { ClientSurface } from "@/components/client/client-surface";
import { nationalityDisplayName } from "@/lib/apply/display-names";
import { listPublicNationalities } from "@/lib/catalog/queries";
import { withSystemDbActor } from "@/lib/db/actor-context";

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

  const nationalities = await withSystemDbActor((tx) => listPublicNationalities(tx));
  const nationalityName = nationalityDisplayName(initialNationalityCode, nationalities);

  return (
    <div className="max-w-6xl pb-8">
      <ApplyTwoColumn currentStep={2} contentClassName="space-y-6">
        <ClientSurface
          preset="highlight"
          className="border-secondary/40 bg-card/95 p-6 shadow-[0_18px_56px_rgba(1,32,49,0.12)] sm:p-8 md:p-10"
        >
          <StartApplicationForm
            key={initialNationalityCode}
            initialNationalityCode={initialNationalityCode}
            nationalityName={nationalityName}
          />
        </ClientSurface>
      </ApplyTwoColumn>
    </div>
  );
}
