import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { apiHref } from "@/lib/app-href";

export const metadata: Metadata = {
  title: "Resume application | Visatop",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

interface IApplyResumePageProps {
  searchParams: Promise<{ invalid?: string; t?: string }>;
}

export default async function ApplyResumePage({ searchParams }: IApplyResumePageProps) {
  const params = await searchParams;

  if (params.t?.trim() && !params.invalid) {
    const qs = new URLSearchParams({ t: params.t.trim() });
    redirect(apiHref(`apply/resume?${qs.toString()}`));
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-16">
      <h1 className="font-heading text-center text-lg font-semibold">
        This resume link is invalid or expired
      </h1>
      <Link href="/apply/track" className="text-link text-center text-sm font-medium">
        Track your application
      </Link>
    </div>
  );
}
