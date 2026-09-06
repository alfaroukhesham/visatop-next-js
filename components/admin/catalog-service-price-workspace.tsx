"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FC } from "react";
import { Loader2 } from "lucide-react";
import { CatalogServicePriceAllModal } from "@/components/admin/catalog-service-price-all-modal";
import { CatalogServicePriceGroups } from "@/components/admin/catalog-service-price-groups";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TServicePricingList } from "@/lib/admin/catalog/list-service-pricing";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";

interface ICatalogServicePriceWorkspaceProps {
  serviceId: string;
  canWrite: boolean;
  editHref: string;
}

export const CatalogServicePriceWorkspace: FC<ICatalogServicePriceWorkspaceProps> = ({
  serviceId,
  canWrite,
  editHref,
}) => {
  const router = useRouter();
  const [data, setData] = useState<TServicePricingList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [allModalOpen, setAllModalOpen] = useState(false);
  const [groupsKey, setGroupsKey] = useState(0);
  const [seedGroups, setSeedGroups] = useState<TServicePricingList["groups"]>([]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const res = await fetchApiEnvelope<TServicePricingList>(
        apiHref(`/admin/catalog/customer-prices/service/${encodeURIComponent(serviceId)}`),
      );
      if (!active) return;
      if (!res.ok) {
        setError(res.error.message);
        setData(null);
      } else {
        setError(null);
        setData(res.data);
        if (res.data.groups.length > 0) setSeedGroups([]);
        setGroupsKey((k) => k + 1);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [serviceId, refreshToken]);

  const reload = useCallback(() => {
    setLoading(true);
    setRefreshToken((t) => t + 1);
  }, []);

  const onSaved = () => {
    reload();
    router.refresh();
  };

  if (loading && !data) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading prices…
      </p>
    );
  }

  if (error && !data) {
    return (
      <p className="text-destructive text-sm" role="alert">
        {error}
      </p>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        <Link href={editHref} className="underline underline-offset-4">
          Skip to service edit
        </Link>
      </p>

      <Card className="border-border overflow-hidden border">
        <CardHeader className="border-border bg-muted/20 border-b">
          <CardTitle className="font-heading text-lg">Set prices · {data.service.name}</CardTitle>
          <CardDescription>
            Choose one price for all enabled nationalities, or assign prices by nationality group.
            Saving prices also creates eligibility links.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-4">
          {canWrite ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setAllModalOpen(true)}>
                Same price for all
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">You can view prices but not change them.</p>
          )}

          <CatalogServicePriceGroups
            key={groupsKey}
            serviceId={serviceId}
            canWrite={canWrite}
            fxConfigured={data.fxConfigured}
            fxAedPerUsd={data.fxAedPerUsd}
            initialGroups={data.groups.length > 0 ? data.groups : seedGroups}
            nationalities={data.nationalities}
            onSaved={onSaved}
          />
        </CardContent>
      </Card>

      <CatalogServicePriceAllModal
        open={allModalOpen}
        onOpenChange={setAllModalOpen}
        serviceId={serviceId}
        fxConfigured={data.fxConfigured}
        fxAedPerUsd={data.fxAedPerUsd}
        canWrite={canWrite}
        onSuccess={(applied) => {
          setSeedGroups([
            {
              aedMajor: applied.aedMajor,
              usdMajor: applied.usdMajor,
              nationalityCodes: data.nationalities.filter((n) => n.enabled).map((n) => n.code),
              coversAllEnabled: true,
            },
          ]);
          onSaved();
        }}
      />
    </div>
  );
};
