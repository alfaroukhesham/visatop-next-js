"use client";

import { useState, type FC } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { apiHref } from "@/lib/app-href";

interface IApplicationActionsProps {
  applicationId: string;
  hasAttention: boolean;
}

export const ApplicationActions: FC<IApplicationActionsProps> = ({
  applicationId,
  hasAttention,
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const clearAttention = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(apiHref(`/admin/applications/${applicationId}/clear-attention`), {
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
  };

  const deleteApp = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(apiHref(`/admin/applications/${applicationId}`), {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg(data?.error?.message ?? "Delete failed.");
        setDeleteOpen(false);
        setLoading(false);
        return;
      }
      setDeleteOpen(false);
      router.push("/admin/applications");
    } catch {
      setMsg("Unexpected error.");
      setLoading(false);
    }
  };

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
          onClick={() => setDeleteOpen(true)}
        >
          Delete Application
        </Button>
      </div>
      {msg && <p className="text-destructive text-xs">{msg}</p>}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this application?"
        description="Delete this application permanently? All documents and payment records will be removed. This cannot be undone."
        confirmLabel="Delete application"
        confirmVariant="destructive"
        confirmBusy={loading}
        onConfirm={() => void deleteApp()}
      />
    </div>
  );
};
