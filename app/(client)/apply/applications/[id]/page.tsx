import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ApplicationDraftPanel } from "@/components/apply/application-draft-panel";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(_props: Props): Promise<Metadata> {
  return { title: "Your application | Visatop", robots: { index: false, follow: false } };
}

export default async function ApplyApplicationPage({ params }: Props) {
  const { id } = await params;
  const hdrs = await headers();
  const row = await loadApplicationRowForRequest(id, hdrs.get("cookie"));
  if (!row) {
    notFound();
  }
  if (row.paymentStatus === "paid") {
    redirect(`/apply/applications/${encodeURIComponent(id)}/submitted`);
  }
  return (
    <div className="theme-client-rise mx-auto max-w-4xl space-y-10">
      <header className="space-y-4">
        <p className="text-secondary text-[11px] font-bold uppercase tracking-[0.28em]">Your application</p>
        <h1 className="font-heading text-foreground text-[clamp(1.85rem,3.8vw,2.55rem)] font-semibold leading-tight tracking-tight">
          Documents, details &amp; payment
        </h1>
        <p className="text-muted-foreground max-w-[62ch] text-base leading-relaxed">
          Upload what we ask for, confirm the details we pull from your passport, complete your profile, then pay when
          the checklist shows you are ready. Your price is confirmed at checkout.
        </p>
      </header>
      <ApplicationDraftPanel applicationId={id} />
    </div>
  );
}
