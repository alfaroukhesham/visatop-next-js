import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ApplyTwoColumn } from "@/components/apply/apply-two-column";
import { CheckoutOrderRecap } from "@/components/apply/checkout-order-recap";
import { ApplicationDraftPanel } from "@/components/apply/application-draft-panel";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";
import { loadPartyMembers } from "@/lib/applications/load-party-members";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { toPublicApplication } from "@/lib/applications/public-application";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Your application | Visatop" };
}

export default async function ApplyApplicationPage({ params }: Props) {
  const [{ id }, hdrs] = await Promise.all([params, headers()]);
  const row = await loadApplicationRowForRequest(id, hdrs.get("cookie"));
  if (!row) {
    notFound();
  }
  if (row.paymentStatus === "paid") {
    redirect(`/apply/applications/${encodeURIComponent(id)}/submitted`);
  }
  if (row.paymentStatus === "checkout_created") {
    redirect(`/apply/applications/${encodeURIComponent(id)}/payment`);
  }
  const members = await withSystemDbActor((tx) => loadPartyMembers(tx, row));
  return (
    <div className="max-w-6xl">
      <ApplyTwoColumn
        currentStep={3}
        applicationId={id}
        hasSelectedVisa
        visaSummary={<CheckoutOrderRecap application={toPublicApplication(row)} members={members} />}
        contentClassName="theme-client-rise mx-auto w-full max-w-4xl space-y-8"
      >
        <header className="space-y-1.5">
          <h1 className="font-heading text-foreground text-xl! font-semibold leading-snug tracking-tight md:text-[1.75rem]!">
            Documents &amp; details
          </h1>
          <p className="text-muted-foreground max-w-[62ch] text-sm leading-relaxed">
            Passport scan, photo, then check the fields.
          </p>
        </header>
        <ApplicationDraftPanel applicationId={id} />
      </ApplyTwoColumn>
    </div>
  );
}
