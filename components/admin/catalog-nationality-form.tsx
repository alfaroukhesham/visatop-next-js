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
import type { CatalogNationality } from "@/lib/admin/catalog/catalog-types";

interface ICatalogNationalityFormProps {
  mode: "create" | "edit";
  nationality?: CatalogNationality;
  canWrite: boolean;
}

export const CatalogNationalityForm: FC<ICatalogNationalityFormProps> = ({
  mode,
  nationality,
  canWrite,
}) => {
  const router = useRouter();
  const [code, setCode] = useState(nationality?.code ?? "");
  const [name, setName] = useState(nationality?.name ?? "");
  const [enabled, setEnabled] = useState(nationality?.enabled ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const flash = (text: string, err = false) => {
    setBanner({ type: err ? "err" : "ok", text });
    setTimeout(() => setBanner(null), 4000);
  };

  const backHref = "/admin/catalog?tab=nationalities";

  const onSubmit = async () => {
    if (!canWrite) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "create") {
        const res = await fetchApiEnvelope<{ nationality: CatalogNationality }>(
          apiHref("/admin/catalog/nationalities"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: code.trim().toUpperCase(), name: name.trim(), enabled }),
          },
        );
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
        flash(`Created ${res.data.nationality.name}.`);
        router.push(`/admin/catalog/nationalities/${encodeURIComponent(res.data.nationality.code)}`);
      } else {
        if (!nationality) return;
        const res = await fetchApiEnvelope<{ nationality: CatalogNationality }>(
          apiHref(`/admin/catalog/nationalities/${encodeURIComponent(nationality.code)}`),
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim(), enabled }),
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
            {mode === "create" ? "Add nationality" : "Edit nationality"}
          </CardTitle>
          <CardDescription>
            {mode === "create"
              ? "Create a nationality with an ISO alpha-2 code."
              : "Update this nationality’s name and enabled state. The code cannot change."}
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
          <div className="space-y-1">
            <Label htmlFor="nat-code">ISO code</Label>
            <Input
              id="nat-code"
              className="font-mono uppercase"
              maxLength={2}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="US"
              disabled={!canWrite || busy || mode === "edit"}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nat-name">Display name</Label>
            <Input
              id="nat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="United States"
              disabled={!canWrite || busy}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="nat-enabled"
              type="checkbox"
              className="accent-primary size-4"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={!canWrite || busy}
              aria-label="Enabled"
            />
            <Label htmlFor="nat-enabled" className="font-normal">
              Enabled
            </Label>
          </div>
          {canWrite ? (
            <Button
              type="submit"
              disabled={busy || !name.trim() || (mode === "create" && code.length !== 2)}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === "create" ? "Create nationality" : "Save changes"}
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">You can view this nationality but not edit it.</p>
          )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
