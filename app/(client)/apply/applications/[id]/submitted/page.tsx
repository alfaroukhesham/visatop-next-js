import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ApplyTwoColumn } from "@/components/apply/apply-two-column";
import { SubmittedApplicationClient } from "@/components/apply/submitted-application-client";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";
import { toPublicApplicationWithCharge } from "@/lib/applications/load-application-charge";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Thank you | Visatop",
  };
}

export default async function SubmittedApplicationPage({ params }: Props) {
  const [{ id }, hdrs] = await Promise.all([params, headers()]);
  const row = await loadApplicationRowForRequest(id, hdrs.get("cookie"));
  if (!row) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <ApplyTwoColumn
        currentStep={5}
        applicationId={id}
        contentClassName="theme-client-rise mx-auto w-full max-w-2xl"
      >
        <SubmittedApplicationClient
          applicationId={id}
          initialApplication={await toPublicApplicationWithCharge(row)}
        />
      </ApplyTwoColumn>
    </div>
  );
}
