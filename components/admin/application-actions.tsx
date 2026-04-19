"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function ApplicationActions({
  applicationId,
  hasAttention,
}: {
  applicationId: string;
  hasAttention: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function clearAttention() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/clear-attention`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg(data?.error?.message ?? "Failed to clear flag.");
      } else {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function deleteApp() {
    if (
      !confirm(
        "Delete this application permanently? All documents and payment records will be removed. This cannot be undone."
      )
    )
      return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg(data?.error?.message ?? "Delete failed.");
        setLoading(false);
      } else {
        router.push("/admin/applications");
      }
    } catch {
      setMsg("Unexpected error.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {hasAttention && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-none"
            disabled={loading}
            onClick={() => void clearAttention()}
          >
            {loading ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
            Clear Attention Flag
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="rounded-none border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          disabled={loading}
          onClick={() => void deleteApp()}
        >
          Delete Application
        </Button>
      </div>
      {msg && <p className="text-destructive text-xs">{msg}</p>}
    </div>
  );
}
