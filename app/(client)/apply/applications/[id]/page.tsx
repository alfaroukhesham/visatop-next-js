import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ApplyTwoColumn } from "@/components/apply/apply-two-column";
import { ApplicationDraftPanel } from "@/components/apply/application-draft-panel";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";

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
  return (
    <div className="max-w-6xl">
      <ApplyTwoColumn
        currentStep={3}
        applicationId={id}
        contentClassName="theme-client-rise mx-auto w-full max-w-4xl space-y-10"
      >
        <header className="space-y-4">
          <h1 className="font-heading text-foreground text-[clamp(1.85rem,3.8vw,2.55rem)] font-semibold leading-tight tracking-tight">
            Upload documents &amp; confirm details
          </h1>
          <p className="text-muted-foreground max-w-[62ch] text-base leading-relaxed">
            Upload what we ask for and confirm the details we pull from your passport. When you are ready, continue to
            secure payment on the next step.
          </p>
        </header>
        <ApplicationDraftPanel applicationId={id} />
      </ApplyTwoColumn>
    </div>
  );
}
