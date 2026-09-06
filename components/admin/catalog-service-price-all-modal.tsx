"use client";

import Link from "next/link";
import { useEffect, useState, type FC } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CatalogServicePriceInputs,
  useDualCurrencyFxFill,
} from "@/components/admin/catalog-service-price-inputs";
import { FX_SETTINGS_HREF } from "@/lib/admin/catalog/apply-service-price-ui-updates";
import { hasValidPriceAmount } from "@/lib/admin/catalog/service-price-fx-fill";
import type { TServicePricingPreview } from "@/lib/admin/catalog/list-service-pricing";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";

interface ICatalogServicePriceAllModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: string;
  fxConfigured: boolean;
  fxAedPerUsd: string | null;
  canWrite: boolean;
  onSuccess?: (applied: { aedMajor: string; usdMajor: string }) => void;
}

export const CatalogServicePriceAllModal: FC<ICatalogServicePriceAllModalProps> = ({
  open,
  onOpenChange,
  serviceId,
  fxConfigured,
  fxAedPerUsd,
  canWrite,
  onSuccess,
}) => {
  const { aedMajor, usdMajor, onAedChange, onUsdChange, reset } = useDualCurrencyFxFill(
    fxConfigured,
    fxAedPerUsd,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<TServicePricingPreview | null>(null);

  useEffect(() => {
    if (!open) {
      reset();
      setError(null);
      setPreviewOpen(false);
      setPreview(null);
    }
  }, [open, reset]);

  const startApply = async () => {
    if (!canWrite) return;
    setError(null);

    if (!fxConfigured) {
      setError("FX is not configured. Open Settings, set AED per 1 USD, then come back.");
      return;
    }

    if (!hasValidPriceAmount(aedMajor, usdMajor)) {
      setError("Enter at least one valid price amount.");
      return;
    }

    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (aedMajor.trim()) params.set("aedMajor", aedMajor.trim());
      if (usdMajor.trim()) params.set("usdMajor", usdMajor.trim());
      const previewRes = await fetchApiEnvelope<TServicePricingPreview>(
        apiHref(
          `/admin/catalog/customer-prices/service/${encodeURIComponent(serviceId)}/preview?${params.toString()}`,
        ),
      );
      if (!previewRes.ok) {
        setError(previewRes.error.message);
        return;
      }
      setPreview(previewRes.data);
      setPreviewOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const confirmApply = async () => {
    if (!canWrite || !preview) return;
    setBusy(true);
    setError(null);
    try {
      const body: { mode: "all"; aedMajor?: string; usdMajor?: string } = { mode: "all" };
      if (aedMajor.trim()) body.aedMajor = aedMajor.trim();
      if (usdMajor.trim()) body.usdMajor = usdMajor.trim();

      const res = await fetchApiEnvelope<{ updated: number }>(
        apiHref(`/admin/catalog/customer-prices/service/${encodeURIComponent(serviceId)}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        setError(res.error.message);
        setPreviewOpen(false);
        return;
      }
      setPreviewOpen(false);
      onOpenChange(false);
      onSuccess?.({
        aedMajor: body.aedMajor ?? "",
        usdMajor: body.usdMajor ?? "",
      });
    } finally {
      setBusy(false);
    }
  };

  const previewDescription = preview
    ? `This will update ${preview.enabledNationalityCount} enabled ${
        preview.enabledNationalityCount === 1 ? "nationality" : "nationalities"
      }. ${preview.differentPriceCount} already ${
        preview.differentPriceCount === 1 ? "has" : "have"
      } a different price.`
    : "";

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
        <DialogContent showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>Same price for all nationalities</DialogTitle>
            <DialogDescription>
              Apply one AED/USD pair to every enabled nationality. Pricing also creates eligibility
              links.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
              {error.includes("FX is not configured") ? (
                <>
                  {" "}
                  <Link href={FX_SETTINGS_HREF} className="underline underline-offset-4">
                    Open Settings
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
          {!fxConfigured ? (
            <p className="text-destructive text-sm leading-relaxed border-b-2 border-destructive/40 pl-3">
              FX is not configured.{" "}
              <Link href={FX_SETTINGS_HREF} className="underline underline-offset-4">
                Open Settings
              </Link>
              , set AED per 1 USD, then come back.
            </p>
          ) : null}
          <CatalogServicePriceInputs
            idPrefix="price-all"
            aedMajor={aedMajor}
            usdMajor={usdMajor}
            onAedChange={onAedChange}
            onUsdChange={onUsdChange}
            fxConfigured={fxConfigured}
            fxAedPerUsd={fxAedPerUsd}
            disabled={!canWrite || busy}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            {canWrite ? (
              <Button
                type="button"
                disabled={busy || !fxConfigured}
                onClick={() => void startApply()}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Apply to all
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={previewOpen}
        onOpenChange={(next) => {
          if (!busy) setPreviewOpen(next);
        }}
        title="Apply this price to all enabled nationalities?"
        description={previewDescription}
        confirmLabel="Apply price"
        confirmBusy={busy}
        onConfirm={() => void confirmApply()}
      />
    </>
  );
};
