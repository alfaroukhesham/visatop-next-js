"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FC } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  assignDocumentRequirements,
  removeOneDocumentRequirement,
} from "@/lib/admin/catalog/document-requirement-mutations";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";

type TAssignedService = {
  id: string;
  serviceId: string;
  serviceName: string;
  role: "required" | "additional";
};

type TEligibleService = {
  id: string;
  name: string;
  hasPrice: boolean;
};

interface IDocumentRulesCountryServicesProps {
  documentKey: string;
  documentLabel: string;
  countryCode: string;
  countryName: string;
  canWrite: boolean;
}

export const DocumentRulesCountryServices: FC<IDocumentRulesCountryServicesProps> = ({
  documentKey,
  documentLabel,
  countryCode,
  countryName,
  canWrite,
}) => {
  const router = useRouter();
  const [assigned, setAssigned] = useState<TAssignedService[]>([]);
  const [eligible, setEligible] = useState<TEligibleService[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadedKey, setLoadedKey] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const loading = loadedKey !== refreshKey;

  const flash = (text: string, err = false) => {
    setBanner({ type: err ? "err" : "ok", text });
    setTimeout(() => setBanner(null), 4000);
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      const [assignedRes, pickerRes] = await Promise.all([
        fetchApiEnvelope<{ items: Array<{ id: string; serviceId: string; serviceName: string; role: string }> }>(
          apiHref(
            `/admin/catalog/document-requirements?documentType=${encodeURIComponent(documentKey)}&nationalityCode=${encodeURIComponent(countryCode)}&pageSize=100&page=0`,
          ),
        ),
        fetchApiEnvelope<{ countries: Array<{ code: string; services: TEligibleService[] }> }>(
          apiHref("/admin/catalog/document-requirements?picker=1"),
        ),
      ]);
      if (!active) return;
      if (!assignedRes.ok) {
        setError(assignedRes.error.message);
        setAssigned([]);
        setEligible([]);
        setLoadedKey(refreshKey);
        return;
      }
      if (!pickerRes.ok) {
        setError(pickerRes.error.message);
        setAssigned([]);
        setEligible([]);
        setLoadedKey(refreshKey);
        return;
      }
      setError(null);
      setAssigned(
        assignedRes.data.items.map((item) => ({
          id: item.id,
          serviceId: item.serviceId,
          serviceName: item.serviceName,
          role: item.role === "additional" ? "additional" : "required",
        })),
      );
      setEligible(pickerRes.data.countries.find((c) => c.code === countryCode)?.services ?? []);
      setLoadedKey(refreshKey);
    })();
    return () => {
      active = false;
    };
  }, [countryCode, documentKey, refreshKey]);

  const assignedByService = useMemo(
    () => new Map(assigned.map((row) => [row.serviceId, row])),
    [assigned],
  );
  const rows = useMemo(() => {
    const fromEligible = [...eligible]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((service) => ({
        serviceId: service.id,
        serviceName: service.name,
        hasPrice: service.hasPrice,
        assigned: assignedByService.get(service.id) ?? null,
      }));
    const extra = assigned
      .filter((row) => !eligible.some((s) => s.id === row.serviceId))
      .map((row) => ({
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        hasPrice: true,
        assigned: row,
      }));
    return [...fromEligible, ...extra];
  }, [assigned, assignedByService, eligible]);

  const sectionBusy = rowBusy !== null;

  const setRole = async (serviceId: string, role: "required" | "additional") => {
    setRowBusy(serviceId);
    try {
      const res = await assignDocumentRequirements({
        documentType: documentKey,
        role,
        pairs: [{ nationalityCode: countryCode, serviceId }],
      });
      if (!res.ok) {
        flash(res.error.message, true);
        return;
      }
      flash("Updated service.");
      setRefreshKey((n) => n + 1);
    } finally {
      setRowBusy(null);
    }
  };

  const removeAssigned = async (row: TAssignedService) => {
    setRowBusy(row.serviceId);
    try {
      const res = await removeOneDocumentRequirement(row.id);
      if (!res.ok) {
        flash(res.error.message, true);
        return;
      }
      flash("Removed this document from the service.");
      setRefreshKey((n) => n + 1);
    } finally {
      setRowBusy(null);
    }
  };

  const documentHref = `/admin/document-rules/${encodeURIComponent(documentKey)}`;

  return (
    <div className="space-y-6">
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={documentHref}
          className="text-muted-foreground inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
        >
          <ChevronLeft className="size-4" />
          {documentLabel}
        </Link>
        {canWrite ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              router.push(`/admin/catalog?prefillNat=${encodeURIComponent(countryCode)}#catalog-eligibility`)
            }
          >
            Add eligibility
          </Button>
        ) : null}
      </div>

      <Card className="border-border overflow-hidden border">
        <CardHeader className="border-border bg-muted/20 border-b">
          <CardTitle className="font-heading text-lg">
            {countryName}{" "}
            <span className="text-muted-foreground font-mono text-sm font-normal">({countryCode})</span>
          </CardTitle>
          <CardDescription>
            Services that need {documentLabel}. Passport and personal photo stay required.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          {loading ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> Loading services…
            </p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No eligible services. Add eligibility to offer a product.
            </p>
          ) : (
            <ul className="divide-border divide-y rounded-md border">
              {rows.map((row) => (
                <li key={row.serviceId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{row.serviceName}</p>
                    {!row.hasPrice ? (
                      <p className="text-muted-foreground text-sm">No price — hidden on apply.</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {row.assigned ? (
                      <>
                        <Label className="sr-only" htmlFor={`role-${row.serviceId}`}>
                          Role for {row.serviceName}
                        </Label>
                        <select
                          id={`role-${row.serviceId}`}
                          className="border-input bg-background h-8 rounded-md border px-2 text-sm"
                          value={row.assigned.role}
                          disabled={!canWrite || sectionBusy}
                          onChange={(e) =>
                            void setRole(row.serviceId, e.target.value as "required" | "additional")
                          }
                        >
                          <option value="required">Required</option>
                          <option value="additional">Additional</option>
                        </select>
                        {canWrite ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={sectionBusy}
                            onClick={() => void removeAssigned(row.assigned!)}
                          >
                            {rowBusy === row.serviceId ? <Loader2 className="size-4 animate-spin" /> : "Remove"}
                          </Button>
                        ) : null}
                      </>
                    ) : canWrite ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={sectionBusy}
                        onClick={() => void setRole(row.serviceId, "required")}
                      >
                        {rowBusy === row.serviceId ? <Loader2 className="size-4 animate-spin" /> : "Assign"}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">Not assigned</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
