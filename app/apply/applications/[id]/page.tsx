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
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Draft workspace</h1>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          Load your application, optionally register document metadata after upload, then queue extraction.
          Totals shown at catalog selection remain server-side; this screen is for integration checks.
        </p>
      </header>
      <ApplicationDraftPanel applicationId={id} />
    </div>
  );
}
