"use client";

import type { FC } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ButtonVariantProps } from "@/components/ui/button-variants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface IConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariantProps["variant"];
  confirmBusy?: boolean;
  onConfirm: () => void;
}

export const ConfirmDialog: FC<IConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "default",
  confirmBusy = false,
  onConfirm,
}) => {
  const handleOpenChange = (next: boolean) => {
    if (confirmBusy) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!confirmBusy}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={confirmBusy}
            onClick={() => handleOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button type="button" variant={confirmVariant} disabled={confirmBusy} onClick={onConfirm}>
            {confirmBusy ? <Loader2 className="size-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
