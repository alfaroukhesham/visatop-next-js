"use client";

import { useState, type FC } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TCatalogDocumentType } from "@/lib/admin/catalog/document-type";
import { deleteDocumentType } from "@/lib/admin/catalog/document-type-mutations";

interface IDocumentRulesDeleteDialogProps {
  document: TCatalogDocumentType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (result: { key: string; label: string; deletedRules: number }) => void;
}

export const DocumentRulesDeleteDialog: FC<IDocumentRulesDeleteDialogProps> = ({
  document,
  open,
  onOpenChange,
  onDeleted,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pairCount = document?.pairCount ?? 0;

  const close = (next: boolean) => {
    if (busy) return;
    if (!next) setError(null);
    onOpenChange(next);
  };

  const confirm = async () => {
    if (!document) return;
    setBusy(true);
    setError(null);
    try {
      const res = await deleteDocumentType(document.key);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      onOpenChange(false);
      onDeleted(res.data);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Delete {document?.label ?? "this document"}?</DialogTitle>
          <DialogDescription>
            {pairCount > 0
              ? `This removes the document and all ${pairCount.toLocaleString()} country/service assignments.`
              : "This removes the document. It has no assignments yet."}{" "}
            Eligibility and prices stay. Files already uploaded on applications stay.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={!document || busy} onClick={() => void confirm()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Delete document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
