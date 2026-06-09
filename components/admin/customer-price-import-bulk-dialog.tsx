"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import type { NationalityDraftRow } from "@/components/admin/customer-price-import-types";

export type CustomerPriceImportBulkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  natDrafts: NationalityDraftRow[];
  onNatDraftsChange: (drafts: NationalityDraftRow[]) => void;
  bulkLocalError: string | null;
  bulkSaving: boolean;
  canWrite: boolean;
  onSubmit: () => void;
};

export function CustomerPriceImportBulkDialog({
  open,
  onOpenChange,
  natDrafts,
  onNatDraftsChange,
  bulkLocalError,
  bulkSaving,
  canWrite,
  onSubmit,
}: CustomerPriceImportBulkDialogProps) {
  const prefilled = natDrafts.filter((d) => d.suggestedAlpha2).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(85vh,720px)] flex-col gap-0 p-0 sm:max-w-2xl" showCloseButton>
        <div className="p-4 pb-0">
          <DialogHeader>
            <DialogTitle>Bulk create nationalities</DialogTitle>
            <DialogDescription>
              ISO 3166-1 alpha-2 codes are prefilled from the official English country list (same codes as IBAN
              country prefix) plus a few common abbreviations. Display names start as the sheet cell ,  adjust if you
              want the catalog spelling. Codes and normalised names must be unique; the server rejects names that
              already map to a different code.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto border-y px-4 py-3">
          {bulkLocalError && (
            <Alert variant="destructive" className="mb-3">
              <AlertCircle className="size-4" />
              <AlertTitle>Cannot submit</AlertTitle>
              <AlertDescription>{bulkLocalError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-4">
            {prefilled > 0 && (
              <p className="text-xs text-muted-foreground">
                {prefilled} of {natDrafts.length} ISO code{prefilled === 1 ? "" : "s"} prefilled ,  review especially
                where the sheet label is informal or ambiguous.
              </p>
            )}
            {natDrafts.map((row, idx) => (
              <div
                key={row.normKey}
                className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[auto_1fr_1fr]"
              >
                <div className="text-xs text-muted-foreground sm:pt-2">
                  Sheet row <span className="font-medium text-foreground">{row.exampleRowIdx}</span>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`nat-name-${idx}`}>Display name</Label>
                  <Input
                    id={`nat-name-${idx}`}
                    value={row.name}
                    onChange={(e) => {
                      const v = e.target.value;
                      onNatDraftsChange(
                        natDrafts.map((r, i) => (i === idx ? { ...r, name: v } : r)),
                      );
                    }}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`nat-code-${idx}`}>ISO code (2 letters)</Label>
                  <Input
                    id={`nat-code-${idx}`}
                    value={row.code}
                    onChange={(e) => {
                      const v = e.target.value.slice(0, 2);
                      onNatDraftsChange(
                        natDrafts.map((r, i) => (i === idx ? { ...r, code: v } : r)),
                      );
                    }}
                    maxLength={2}
                    className="uppercase font-mono"
                    autoComplete="off"
                    placeholder={row.suggestedAlpha2 ? row.suggestedAlpha2 : "e.g. AE"}
                  />
                  {row.suggestedAlpha2 ? (
                    <p className="text-xs text-muted-foreground">
                      Suggested: <span className="font-mono text-foreground">{row.suggestedAlpha2}</span>
                      {row.code.trim().toUpperCase() !== row.suggestedAlpha2 ? " (you changed it)" : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No automatic match ,  enter the ISO code manually.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter className="rounded-b-xl border-0 bg-muted/40 p-4 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={bulkSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={bulkSaving || !canWrite}>
            {bulkSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create {natDrafts.length} nationalit{natDrafts.length === 1 ? "y" : "ies"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
