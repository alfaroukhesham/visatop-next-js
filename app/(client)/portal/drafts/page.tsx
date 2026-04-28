import Link from "next/link";
import { ArrowLeft, FilePenLine } from "lucide-react";

import { DraftsList } from "@/components/portal/drafts-list";

export const metadata = {
  title: "Draft applications | Visatop",
};

export const dynamic = "force-dynamic";

export default function PortalDraftsPage() {
  return (
    <div className="text-foreground flex min-h-[calc(100vh-4rem)] flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/portal"
            className="text-secondary hover:text-foreground inline-flex items-center gap-2 text-sm font-semibold transition-colors duration-200"
          >
            <ArrowLeft className="size-5 shrink-0" aria-hidden />
            <span>Portal</span>
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <FilePenLine className="text-primary size-5 shrink-0" aria-hidden />
            <h1 className="font-heading truncate text-lg font-semibold text-foreground">
              Draft applications
            </h1>
          </div>
        </div>

        <p className="text-muted-foreground text-sm leading-relaxed">
          These are unpaid drafts on your account. Continue a draft to upload documents and complete your details.
        </p>

        <DraftsList />
      </main>
    </div>
  );
}

