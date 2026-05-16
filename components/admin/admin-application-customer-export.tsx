"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiHref } from "@/lib/app-href";

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="([^"]+)"/i.exec(header);
  return match?.[1] ?? null;
}

export function AdminApplicationCustomerExport({ applicationId }: { applicationId: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function downloadExport() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(apiHref(`/admin/applications/${applicationId}/export`), {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg((data as { error?: { message?: string } })?.error?.message ?? "Export failed.");
        return;
      }
      const blob = await res.blob();
      const filename =
        filenameFromContentDisposition(res.headers.get("Content-Disposition")) ??
        `application-${applicationId.slice(0, 8)}-customer-export.zip`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setMsg("Export downloaded.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2 border-b border-border pb-6">
      <h3 className="text-sm font-semibold">Export customer data</h3>
      <p className="text-muted-foreground text-xs">
        Download a ZIP with applicant details (email and step 3 profile fields) and customer uploads
        (passport copy, personal photo, and any supporting files). Outcome and admin-only documents
        are not included.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-none gap-2"
          disabled={loading}
          onClick={() => void downloadExport()}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Download ZIP
        </Button>
      </div>
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
