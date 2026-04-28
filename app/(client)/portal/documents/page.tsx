import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

import { VaultList } from "@/components/portal/vault-list";
import { VaultUploader } from "@/components/portal/vault-uploader";

export const metadata = {
  title: "My documents | Visatop",
};

export const dynamic = "force-dynamic";

export default function PortalDocumentsPage() {
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
            <FileText className="text-primary size-5 shrink-0" aria-hidden />
            <h1 className="font-heading truncate text-lg font-semibold text-foreground">My documents</h1>
          </div>
        </div>

        <p className="text-muted-foreground text-sm leading-relaxed">
          Upload your passport, photo, and supporting files once. When you start a new application, you can attach
          them without re-uploading.
        </p>

        <VaultUploader />
        <VaultList />
      </main>
    </div>
  );
}

