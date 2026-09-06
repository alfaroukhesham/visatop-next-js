"use client";

import Link from "next/link";
import { useMemo, useState, type FC } from "react";
import { Loader2, Plus } from "lucide-react";
import { ListPaginatorBar } from "@/components/admin/list-paginator-bar";
import { useCatalogEligibilityPage } from "@/components/admin/use-catalog-eligibility-page";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { removeCatalogEligibility } from "@/lib/admin/catalog/eligibility-mutations";
import type { CatalogEligibility } from "@/lib/admin/catalog/catalog-types";

interface ICatalogEligibilityLinksProps {
  mode: "nationality" | "service";
  nationalityCode?: string;
  serviceId?: string;
  canWrite: boolean;
  addHref: string;
  initialBanner?: string | null;
  priceByNationality?: Record<string, { aedMajor: string; usdMajor: string }>;
}

export const CatalogEligibilityLinks: FC<ICatalogEligibilityLinksProps> = ({
  mode,
  nationalityCode,
  serviceId,
  canWrite,
  addHref,
  initialBanner,
  priceByNationality,
}) => {
  const filters = useMemo(
    () => ({
      q: "",
      serviceId: mode === "service" ? (serviceId ?? "") : "",
      nationalityCode: mode === "nationality" ? (nationalityCode ?? "") : "",
    }),
    [mode, nationalityCode, serviceId],
  );
  const eligPage = useCatalogEligibilityPage(10, filters);
  const [pendingRemove, setPendingRemove] = useState<CatalogEligibility | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(
    initialBanner ? { type: "ok", text: initialBanner } : null,
  );

  const flash = (text: string, err = false) => {
    setBanner({ type: err ? "err" : "ok", text });
    setTimeout(() => setBanner(null), 4000);
  };

  const title = mode === "nationality" ? "Eligible services" : "Eligible nationalities";
  const description =
    mode === "nationality"
      ? "Services offered for this nationality."
      : "Nationalities this service is offered to.";
  const emptyCopy =
    mode === "nationality"
      ? "No eligible services. Add a service to offer a product for this nationality."
      : "No eligible nationalities. Add a nationality to offer this product.";
  const addLabel = mode === "nationality" ? "Add service" : "Add nationality";

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    setRemoveBusy(true);
    try {
      await removeCatalogEligibility({
        serviceId: pendingRemove.serviceId,
        nationalityCode: pendingRemove.nationalityCode,
        flash,
      });
      setPendingRemove(null);
      eligPage.reload();
    } catch {
      // removeCatalogEligibility flashes the error itself.
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <Card className="border-border overflow-hidden border">
      <CardHeader className="border-border bg-muted/20 space-y-4 border-b">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="font-heading text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {canWrite ? (
            <Link href={addHref} className={cn(buttonVariants({ variant: "secondary" }), "gap-2")}>
              <Plus className="size-4" />
              {addLabel}
            </Link>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {banner ? (
          <p
            className={
              banner.type === "err"
                ? "border-destructive/40 bg-destructive/10 text-destructive border-b-2 px-4 py-3 text-sm"
                : "border-success/40 bg-success/10 text-success border-b-2 px-4 py-3 text-sm"
            }
            role="status"
          >
            {banner.text}
          </p>
        ) : null}
        {eligPage.error ? (
          <p className="text-destructive px-4 py-3 text-sm" role="alert">
            {eligPage.error}
          </p>
        ) : null}
        {eligPage.loading ? (
          <p className="text-muted-foreground flex items-center gap-2 px-4 py-6 text-sm">
            <Loader2 className="size-4 animate-spin" /> Loading eligibility…
          </p>
        ) : eligPage.items.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-center text-sm">{emptyCopy}</p>
        ) : (
          <ul className="divide-border divide-y">
            {eligPage.items.map((e) => (
              <li key={`${e.serviceId}-${e.nationalityCode}`} className="flex items-stretch">
                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 px-4 py-4">
                  <div className="min-w-0">
                    {mode === "nationality" ? (
                      <p className="font-medium">{e.serviceName}</p>
                    ) : (
                      <p className="font-medium">
                        {e.nationalityCode}{" "}
                        <span className="text-muted-foreground font-normal">{e.nationalityName}</span>
                      </p>
                    )}
                    {!e.hasPrice ? (
                      <p className="text-foreground text-sm font-medium">No price — hidden on apply.</p>
                    ) : mode === "service" && priceByNationality?.[e.nationalityCode] ? (
                      <p className="text-muted-foreground text-sm tabular-nums">
                        AED {priceByNationality[e.nationalityCode].aedMajor} · USD{" "}
                        {priceByNationality[e.nationalityCode].usdMajor}
                      </p>
                    ) : null}
                  </div>
                  {canWrite ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setPendingRemove(e)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <ListPaginatorBar
          selectId="catalog-eligibility-links-page-size"
          page={eligPage.page}
          setPage={eligPage.setPage}
          pageSize={eligPage.pageSize}
          onPageSizeChange={eligPage.onPageSizeChange}
          total={eligPage.total}
          loading={eligPage.loading}
        />
      </CardContent>
      <ConfirmDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
        title="Remove this eligibility link?"
        description="This removes the service ↔ nationality link. The service and nationality are not deleted."
        confirmLabel="Remove link"
        confirmVariant="destructive"
        confirmBusy={removeBusy}
        onConfirm={() => void confirmRemove()}
      />
    </Card>
  );
};
