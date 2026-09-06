"use client";

import { useEffect, useMemo, useState, type FC } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import { BANK_SLOT, slotForDocumentType } from "@/lib/apply/document-slot-catalog";
import {
  assignDocumentRequirements,
  previewDocumentRequirements,
  removeDocumentRequirements,
} from "@/lib/admin/catalog/document-requirement-mutations";

type TPickerCountry = {
  code: string;
  name: string;
  services: Array<{ id: string; name: string; hasPrice: boolean }>;
};

type TPickerResponse = {
  countries: TPickerCountry[];
};

interface ICatalogDocumentRulesAssignFormProps {
  canWrite: boolean;
  busy: boolean;
  flash: (text: string, err?: boolean) => void;
  onChanged: () => void;
  onAddEligibility: (nationalityCode: string) => void;
  pickerRefreshKey: number;
}

const pairKey = (code: string, serviceId: string): string => `${code}:${serviceId}`;

export const CatalogDocumentRulesAssignForm: FC<ICatalogDocumentRulesAssignFormProps> = ({
  canWrite,
  busy,
  flash,
  onChanged,
  onAddEligibility,
  pickerRefreshKey,
}) => {
  const [documentType, setDocumentType] = useState<string>(BANK_SLOT.key);
  const [role, setRole] = useState<"required" | "additional">("required");
  const [countries, setCountries] = useState<TPickerCountry[]>([]);
  const [loadedPickerKey, setLoadedPickerKey] = useState<number | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignBusy, setAssignBusy] = useState<string | null>(null);
  const pickerLoading = loadedPickerKey !== pickerRefreshKey;

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await fetchApiEnvelope<TPickerResponse>(
        apiHref("/admin/catalog/document-requirements?picker=1"),
      );
      if (!active) return;
      if (!res.ok) {
        setPickerError(res.error.message);
        setCountries([]);
      } else {
        setPickerError(null);
        setCountries(res.data.countries);
      }
      setLoadedPickerKey(pickerRefreshKey);
    })();
    return () => {
      active = false;
    };
  }, [pickerRefreshKey]);

  const documentLabel = slotForDocumentType(documentType)?.label ?? documentType;

  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
  }, [countries, search]);

  const togglePair = (code: string, serviceId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = pairKey(code, serviceId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllForCountry = (country: TPickerCountry) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const keys = country.services.map((s) => pairKey(country.code, s.id));
      const allSelected = keys.every((k) => next.has(k));
      for (const k of keys) {
        if (allSelected) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  };

  const buildPairs = () =>
    [...selected].map((key) => {
      const [nationalityCode, serviceId] = key.split(":");
      return { nationalityCode, serviceId };
    });

  const previewAndAssign = async () => {
    const pairs = buildPairs();
    if (pairs.length === 0) return;
    setAssignBusy("assign");
    try {
      const preview = await previewDocumentRequirements({ documentType, role, pairs });
      if (!preview.ok) {
        flash(preview.error.message, true);
        return;
      }
      const { pairCount, willCreateEligibility, pairsWithoutPrice } = preview.data;
      const sentences: string[] = [];
      if (willCreateEligibility > 0) {
        sentences.push(
          `This will also create Eligibility admin links for ${willCreateEligibility} pairs. It does not set prices — products only appear on apply when a catalog price exists.`,
        );
      }
      if (pairsWithoutPrice > 0) {
        sentences.push(
          `${pairsWithoutPrice} of these pairs have no catalog price and stay hidden on apply until you add a price (Pricing or sheet import).`,
        );
      }
      if (sentences.length === 0) {
        sentences.push(`Set this document on ${pairCount} eligible pairs.`);
      }
      const ok = window.confirm(sentences.join("\n\n"));
      if (!ok) return;
      const res = await assignDocumentRequirements({ documentType, role, pairs });
      if (!res.ok) {
        flash(res.error.message, true);
        return;
      }
      flash(`Saved ${documentLabel} on ${res.data.pairCount} pairs.`);
      setSelected(new Set());
      onChanged();
    } finally {
      setAssignBusy(null);
    }
  };

  const previewAndRemove = async () => {
    const pairs = buildPairs();
    if (pairs.length === 0) return;
    setAssignBusy("remove");
    try {
      const ok = window.confirm(
        `Remove this document from ${pairs.length} pairs. Eligibility links stay.`,
      );
      if (!ok) return;
      const res = await removeDocumentRequirements({ documentType, pairs });
      if (!res.ok) {
        flash(res.error.message, true);
        return;
      }
      flash(`Removed ${documentLabel} from ${res.data.deleted} pairs.`);
      setSelected(new Set());
      onChanged();
    } finally {
      setAssignBusy(null);
    }
  };

  const selectionCount = selected.size;
  const canMutate = canWrite && selectionCount > 0 && !busy && assignBusy === null;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Every application always needs passport + personal photo. Those cannot be turned off.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="doc-rules-type">Document</Label>
          <select
            id="doc-rules-type"
            className="border-input bg-background h-9 w-64 rounded-md border px-2 text-sm"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            disabled={!canWrite}
          >
            <option value={BANK_SLOT.key}>{documentLabel}</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="doc-rules-role">Role</Label>
          <select
            id="doc-rules-role"
            className="border-input bg-background h-9 w-40 rounded-md border px-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as "required" | "additional")}
            disabled={!canWrite}
          >
            <option value="required">Required</option>
            <option value="additional">Additional</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="doc-rules-search">Country search</Label>
        <Input
          id="doc-rules-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by code or name…"
          autoComplete="off"
        />
      </div>

      {pickerLoading ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading eligible services…
        </p>
      ) : null}
      {pickerError ? (
        <p className="text-destructive text-sm" role="alert">
          {pickerError}
        </p>
      ) : null}

      {!pickerLoading && !pickerError ? (
        <div className="space-y-3">
          {filteredCountries.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {search.trim() ? "No countries match your search." : "No eligible services yet."}
            </p>
          ) : null}
          {filteredCountries.map((country) => {
            const sortedServices = [...country.services].sort((a, b) =>
              a.name.localeCompare(b.name),
            );
            const allSelected =
              sortedServices.length > 0 &&
              sortedServices.every((s) => selected.has(pairKey(country.code, s.id)));
            return (
              <div key={country.code} className="border-border rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {country.name} <span className="text-muted-foreground font-mono text-xs">({country.code})</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {canWrite ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy || sortedServices.length === 0}
                        onClick={() => toggleAllForCountry(country)}
                      >
                        {allSelected ? "Deselect all" : "Select all eligible"}
                      </Button>
                    ) : null}
                    {canWrite ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => onAddEligibility(country.code)}
                      >
                        Add eligibility
                      </Button>
                    ) : null}
                  </div>
                </div>
                {sortedServices.length === 0 ? (
                  <p className="text-muted-foreground mt-2 text-sm">
                    No eligible services. Add eligibility to offer a product.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {sortedServices.map((service) => (
                      <li key={service.id} className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="accent-primary mt-0.5 size-4"
                          checked={selected.has(pairKey(country.code, service.id))}
                          onChange={() => togglePair(country.code, service.id)}
                          disabled={!canWrite || busy}
                          aria-label={`${service.name} for ${country.name}`}
                        />
                        <span className="text-sm">{service.name}</span>
                        {!service.hasPrice ? (
                          <span className="text-muted-foreground text-sm">
                            No price — hidden on apply.
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={!canMutate}
            onClick={() => void previewAndAssign()}
          >
            {assignBusy === "assign" ? <Loader2 className="size-4 animate-spin" /> : null}
            Preview and assign…
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canMutate}
            onClick={() => void previewAndRemove()}
          >
            {assignBusy === "remove" ? <Loader2 className="size-4 animate-spin" /> : null}
            Preview and remove…
          </Button>
          <span className="text-muted-foreground text-sm">{selectionCount} selected</span>
        </div>
      ) : null}
    </div>
  );
};
