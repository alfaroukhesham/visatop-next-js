"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FC } from "react";
import { CatalogServicePriceAllModal } from "@/components/admin/catalog-service-price-all-modal";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ICatalogServicePriceActionsProps {
  serviceId: string;
  canWrite: boolean;
  pricesHref: string;
  fxConfigured: boolean;
  fxAedPerUsd: string | null;
}

export const CatalogServicePriceActions: FC<ICatalogServicePriceActionsProps> = ({
  serviceId,
  canWrite,
  pricesHref,
  fxConfigured,
  fxAedPerUsd,
}) => {
  const router = useRouter();
  const [allModalOpen, setAllModalOpen] = useState(false);

  return (
    <>
      <Card className="border-border overflow-hidden border">
        <CardHeader className="border-border bg-muted/20 border-b">
          <CardTitle className="font-heading text-lg">Pricing</CardTitle>
          <CardDescription>
            Set customer prices for this service. Pricing eligible nationalities also creates
            eligibility links.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 p-4">
          {canWrite ? (
            <>
              <Button type="button" onClick={() => setAllModalOpen(true)}>
                Same price for all
              </Button>
              <Link href={pricesHref} className={cn(buttonVariants({ variant: "secondary" }))}>
                Price by nationality
              </Link>
            </>
          ) : (
            <>
              <Link href={pricesHref} className={cn(buttonVariants({ variant: "secondary" }))}>
                View prices by nationality
              </Link>
            </>
          )}
        </CardContent>
      </Card>

      <CatalogServicePriceAllModal
        open={allModalOpen}
        onOpenChange={setAllModalOpen}
        serviceId={serviceId}
        fxConfigured={fxConfigured}
        fxAedPerUsd={fxAedPerUsd}
        canWrite={canWrite}
        onSuccess={() => router.refresh()}
      />
    </>
  );
};
