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
import { deleteCatalogNationality, deleteCatalogVisaService } from "@/lib/admin/catalog/catalog-entity-mutations";

interface ICatalogEntityDeleteDialogProps {
  entity: { kind: "nationality" | "service"; code?: string; id?: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
  onBlocked?: (message: string) => void;
}

export const CatalogEntityDeleteDialog: FC<ICatalogEntityDeleteDialogProps> = ({
  entity,
  open,
  onOpenChange,
  onDeleted,
  onBlocked,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (next: boolean) => {
    if (busy) return;
    if (!next) setError(null);
    onOpenChange(next);
  };

  const confirm = async () => {
    if (!entity) return;
    setBusy(true);
    setError(null);
    try {
      const res =
        entity.kind === "nationality"
          ? await deleteCatalogNationality(entity.code!)
          : await deleteCatalogVisaService(entity.id!);
      if (!res.ok) {
        setError(res.error.message);
        onBlocked?.(res.error.message);
        onOpenChange(false);
        return;
      }
      onOpenChange(false);
      onDeleted();
    } finally {
      setBusy(false);
    }
  };

  const label = entity?.kind === "nationality" ? "nationality" : "service";

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Delete {entity?.name ?? `this ${label}`}?</DialogTitle>
          <DialogDescription>
            Delete this {label}? This also removes its eligibility links, customer prices, and
            extra document rules. Applications are not deleted. If this {label} is used on an
            application, delete will fail — disable it instead.
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
          <Button type="button" variant="destructive" disabled={!entity || busy} onClick={() => void confirm()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Delete {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
