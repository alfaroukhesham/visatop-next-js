"use client";

import { ChevronDown, Loader2, Plus } from "lucide-react";
import type { CatalogNationality, CatalogService } from "@/lib/admin/catalog/catalog-types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type CatalogEligibilityLinkFormProps = {
  services: CatalogService[];
  nationalities: CatalogNationality[];
  serviceId: string;
  nationalityCode: string;
  onServiceIdChange: (value: string) => void;
  onNationalityCodeChange: (value: string) => void;
  sectionBusy: boolean;
  eligBusy: string | null;
  onLink: () => void;
  open?: boolean;
};

export function CatalogEligibilityLinkForm({
  services,
  nationalities,
  serviceId,
  nationalityCode,
  onServiceIdChange,
  onNationalityCodeChange,
  sectionBusy,
  eligBusy,
  onLink,
  open,
}: CatalogEligibilityLinkFormProps) {
  return (
    <details className="group border-border rounded-md border" open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" />
        Link a new service to an existing nationality
      </summary>
      <div className="border-border flex flex-wrap items-end gap-3 border-t p-4">
        <div className="space-y-1">
          <Label htmlFor="elig-link-service">Service</Label>
          <select
            id="elig-link-service"
            className="border-input bg-background h-9 w-56 rounded-md border px-2 text-sm"
            value={serviceId}
            onChange={(e) => onServiceIdChange(e.target.value)}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="elig-link-nationality">Nationality</Label>
          <select
            id="elig-link-nationality"
            className="border-input bg-background h-9 w-40 rounded-md border px-2 font-mono text-sm"
            value={nationalityCode}
            onChange={(e) => onNationalityCodeChange(e.target.value)}
          >
            {nationalities.map((n) => (
              <option key={n.code} value={n.code}>
                {n.code} ,  {n.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          disabled={sectionBusy || !serviceId || !nationalityCode}
          onClick={onLink}
        >
          {eligBusy === "elig-add" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Link
        </Button>
      </div>
    </details>
  );
}
