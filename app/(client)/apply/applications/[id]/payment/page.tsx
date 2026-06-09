import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ApplyTwoColumn } from "@/components/apply/apply-two-column";
import { ApplicationPaymentPanel } from "@/components/apply/application-payment-panel";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";
import { loadPaymentUploadFlags } from "@/lib/applications/load-payment-upload-flags";
import { paymentPanelMayShow } from "@/lib/applications/payment-panel-may-show";
import { toPublicApplication } from "@/lib/applications/public-application";
import { withSystemDbActor } from "@/lib/db/actor-context";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Secure payment | Visatop" };
}

export default async function ApplyApplicationPaymentPage({ params }: Props) {
  const [{ id }, hdrs] = await Promise.all([params, headers()]);
  const row = await loadApplicationRowForRequest(id, hdrs.get("cookie"));
  if (!row) {
    notFound();
  }
  if (row.paymentStatus === "paid") {
    redirect(`/apply/applications/${encodeURIComponent(id)}/submitted`);
  }

  const uploads = await withSystemDbActor((tx) => loadPaymentUploadFlags(tx, id));
  const publicApp = toPublicApplication(row);
  if (!paymentPanelMayShow(publicApp, uploads)) {
    redirect(`/apply/applications/${encodeURIComponent(id)}`);
  }

  return (
    <div className="max-w-6xl">
      <ApplyTwoColumn
        currentStep={4}
        applicationId={id}
        contentClassName="theme-client-rise mx-auto w-full max-w-4xl space-y-10"
      >
        <header className="space-y-4">
          <h1 className="font-heading text-foreground text-[clamp(1.85rem,3.8vw,2.55rem)] font-semibold leading-tight tracking-tight">
            Secure payment
          </h1>
          <p className="text-muted-foreground max-w-[62ch] text-base leading-relaxed">
            Review your order and pay securely to begin processing. Your price is confirmed at checkout.
          </p>
        </header>
        <ApplicationPaymentPanel applicationId={id} />
      </ApplyTwoColumn>
    </div>
  );
}
