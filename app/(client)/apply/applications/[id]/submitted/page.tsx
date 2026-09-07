import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ApplyTwoColumn } from "@/components/apply/apply-two-column";
import { CheckoutOrderRecap } from "@/components/apply/checkout-order-recap";
import { SubmittedApplicationClient } from "@/components/apply/submitted-application-client";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";
import { loadPartyMembers } from "@/lib/applications/load-party-members";
import { withSystemDbActor } from "@/lib/db/actor-context";
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
  const members = await withSystemDbActor((tx) => loadPartyMembers(tx, row));
  const publicApp = await toPublicApplicationWithCharge(row);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <ApplyTwoColumn
        currentStep={5}
        applicationId={id}
        hasSelectedVisa
        visaSummary={<CheckoutOrderRecap application={publicApp} members={members} />}
        contentClassName="theme-client-rise mx-auto w-full max-w-2xl"
      >
        <SubmittedApplicationClient
          applicationId={id}
          initialApplication={publicApp}
        />
      </ApplyTwoColumn>
    </div>
  );
}
