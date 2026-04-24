import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { SubmittedApplicationClient } from "@/components/apply/submitted-application-client";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";
import { toPublicApplication } from "@/lib/applications/public-application";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Submitted ${id.slice(0, 8)}…`,
    robots: { index: false, follow: false },
  };
}

export default async function SubmittedApplicationPage({ params }: Props) {
  const { id } = await params;
  const hdrs = await headers();
  const row = await loadApplicationRowForRequest(id, hdrs.get("cookie"));
  if (!row) {
    notFound();
  }

  return (
    <div className="theme-client-rise mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <SubmittedApplicationClient applicationId={id} initialApplication={toPublicApplication(row)} />
    </div>
  );
}
