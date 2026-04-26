import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ApplicationDraftPanel } from "@/components/apply/application-draft-panel";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Draft ${id.slice(0, 8)}…` };
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
      <header className="space-y-3">
        <p className="text-secondary text-xs font-semibold uppercase tracking-[0.2em]">Draft workspace</p>
        <h1 className="font-heading text-foreground text-[clamp(1.65rem,3.5vw,2.35rem)] font-semibold leading-tight tracking-tight">
          Documents, extraction &amp; payment
        </h1>
        <p className="text-muted-foreground max-w-[62ch] text-base leading-relaxed">
          Upload required files, run passport extraction, complete your profile, then pay when the checklist
          shows ready. Your catalog quote stays locked server-side.
        </p>
      </header>
      <ApplicationDraftPanel applicationId={id} />
    </div>
  );
}
