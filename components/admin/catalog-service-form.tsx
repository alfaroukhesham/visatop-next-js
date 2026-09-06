"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FC } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import type { CatalogService } from "@/lib/admin/catalog/catalog-types";

interface ICatalogServiceFormProps {
  mode: "create" | "edit";
  service?: CatalogService;
  canWrite: boolean;
}

export const CatalogServiceForm: FC<ICatalogServiceFormProps> = ({ mode, service, canWrite }) => {
  const router = useRouter();
  const [name, setName] = useState(service?.name ?? "");
  const [durationDays, setDurationDays] = useState(
    service?.durationDays === null || service?.durationDays === undefined
      ? ""
      : String(service.durationDays),
  );
  const [entries, setEntries] = useState(service?.entries ?? "");
  const [enabled, setEnabled] = useState(service?.enabled ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const flash = (text: string, err = false) => {
    setBanner({ type: err ? "err" : "ok", text });
    setTimeout(() => setBanner(null), 4000);
  };

  const backHref = "/admin/catalog?tab=services";

  const onSubmit = async () => {
    if (!canWrite) return;
    setBusy(true);
    setError(null);
    try {
      const dRaw = durationDays.trim();
      const d = dRaw === "" ? null : Number.parseInt(dRaw, 10);
      const payload = {
        name: name.trim(),
        enabled,
        durationDays: dRaw === "" ? null : Number.isFinite(d) ? d : null,
        entries: entries.trim() === "" ? null : entries.trim(),
      };
      if (mode === "create") {
        const res = await fetchApiEnvelope<{ service: CatalogService }>(
          apiHref("/admin/catalog/visa-services"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
        flash(`Created ${res.data.service.name}.`);
        router.push(`/admin/catalog/services/${encodeURIComponent(res.data.service.id)}/prices`);
      } else {
        if (!service) return;
        const res = await fetchApiEnvelope<{ service: CatalogService }>(
          apiHref(`/admin/catalog/visa-services/${encodeURIComponent(service.id)}`),
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
        flash("Saved changes.");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        <Link href={backHref} className="underline underline-offset-4">
          Catalog
        </Link>
      </p>
      <Card className="border-border overflow-hidden border">
        <CardHeader className="border-border bg-muted/20 border-b">
          <CardTitle className="font-heading text-lg">
            {mode === "create" ? "Add service" : "Edit service"}
          </CardTitle>
          <CardDescription>
            {mode === "create"
              ? "Create a visa service variant. The identifier is generated server-side."
              : "Update this service’s fields. Eligibility links are managed below."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
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
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onSubmit();
            }}
            className="space-y-4"
          >
          <div
            className={
              mode === "edit"
                ? "grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"
                : "space-y-4"
            }
          >
            <div className="space-y-1">
              <Label htmlFor="svc-name">Name</Label>
              <Input
                id="svc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tourist"
                disabled={!canWrite || busy}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="svc-days">Duration (days)</Label>
              <Input
                id="svc-days"
                inputMode="numeric"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder="30"
                disabled={!canWrite || busy}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="svc-entries">Entries label</Label>
              <Input
                id="svc-entries"
                value={entries}
                onChange={(e) => setEntries(e.target.value)}
                placeholder="single"
                disabled={!canWrite || busy}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="svc-enabled"
              type="checkbox"
              className="accent-primary size-4"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={!canWrite || busy}
              aria-label="Enabled"
            />
            <Label htmlFor="svc-enabled" className="font-normal">
              Enabled
            </Label>
          </div>
          {canWrite ? (
            <Button
              type="submit"
              disabled={busy || !name.trim()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === "create" ? "Continue to prices" : "Save changes"}
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">You can view this service but not edit it.</p>
          )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
