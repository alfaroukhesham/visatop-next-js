"use client";

import { useId, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiHref } from "@/lib/app-href";
import { cn } from "@/lib/utils";

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="([^"]+)"/i.exec(header);
  return match?.[1] ?? null;
}

export function AdminApplicationCustomerExport({ applicationId }: { applicationId: string }) {
  const includePriceId = useId();
  const [includePrice, setIncludePrice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function downloadExport() {
    setLoading(true);
    setMsg(null);
    try {
      const params = new URLSearchParams();
      if (includePrice) params.set("includePrice", "1");
      const query = params.toString();
      const path = `/admin/applications/${applicationId}/export${query ? `?${query}` : ""}`;
      const res = await fetch(apiHref(path), {
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
      setMsg(
        includePrice
          ? "Export downloaded (includes service type and price paid)."
          : "Export downloaded (includes service type).",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 border-b border-border pb-6">
      <div>
        <h3 className="text-sm font-semibold">Export customer data</h3>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          Download a ZIP with applicant details (email and step 3 profile fields), the visa service type,
          and customer uploads (passport copy, personal photo, and any supporting files). Outcome and
          admin-only documents are not included.
        </p>
      </div>

      <div
        className={cn(
          "border border-border bg-muted/25 p-4 transition-colors",
          includePrice && "border-primary/40 bg-primary/[0.04]",
        )}
      >
        <div className="flex items-start gap-3">
          <input
            id={includePriceId}
            type="checkbox"
            checked={includePrice}
            onChange={(e) => setIncludePrice(e.target.checked)}
            disabled={loading}
            className="border-input text-primary focus-visible:ring-ring mt-0.5 size-4 shrink-0 rounded-sm border shadow-xs focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="min-w-0 space-y-1">
            <Label htmlFor={includePriceId} className="cursor-pointer text-sm font-semibold">
              Include price paid
            </Label>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Adds a <span className="font-medium text-foreground">Price paid</span> row to the CSV from the
              confirmed payment, or the locked checkout quote if payment has not completed yet.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-2 rounded-none"
          disabled={loading}
          onClick={() => void downloadExport()}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Download ZIP
        </Button>
        {includePrice ? (
          <span className="text-muted-foreground text-xs">Price will be included in the export.</span>
        ) : null}
      </div>
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
