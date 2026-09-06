"use client";

import { useEffect, useMemo, useState, type FC } from "react";
import { Loader2 } from "lucide-react";
import { ListPaginatorBar } from "@/components/admin/list-paginator-bar";
import { usePaginatedList } from "@/components/admin/use-paginated-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";

export type TDocumentRulesPickerCountry = {
  code: string;
  name: string;
  services: Array<{ id: string; name: string; hasPrice: boolean }>;
};

interface IDocumentRulesCountryPickerProps {
  canWrite: boolean;
  busy: boolean;
  selected: Set<string>;
  onTogglePair: (nationalityCode: string, serviceId: string) => void;
  onToggleCountry: (country: TDocumentRulesPickerCountry) => void;
  onAddEligibility: (nationalityCode: string) => void;
  refreshKey: number;
}

export const pairKey = (code: string, serviceId: string): string => `${code}:${serviceId}`;

export const DocumentRulesCountryPicker: FC<IDocumentRulesCountryPickerProps> = ({
  canWrite,
  busy,
  selected,
  onTogglePair,
  onToggleCountry,
  onAddEligibility,
  refreshKey,
}) => {
  const [countries, setCountries] = useState<TDocumentRulesPickerCountry[]>([]);
  const [loadedKey, setLoadedKey] = useState<number | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const pickerLoading = loadedKey !== refreshKey;

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await fetchApiEnvelope<{ countries: TDocumentRulesPickerCountry[] }>(
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
      setLoadedKey(refreshKey);
    })();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
  }, [countries, search]);

  const { setPage, ...countryPage } = usePaginatedList(filteredCountries);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="doc-rules-country-search">Country search</Label>
        <Input
          id="doc-rules-country-search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
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
          {countryPage.pageItems.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {search.trim() ? "No countries match your search." : "No eligible services yet."}
            </p>
          ) : null}
          {countryPage.pageItems.map((country) => {
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
                    {country.name}{" "}
                    <span className="text-muted-foreground font-mono text-xs">({country.code})</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {canWrite ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy || sortedServices.length === 0}
                        onClick={() => onToggleCountry(country)}
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
                          onChange={() => onTogglePair(country.code, service.id)}
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
          <ListPaginatorBar
            selectId="doc-rules-countries-page-size"
            page={countryPage.page}
            setPage={setPage}
            pageSize={countryPage.pageSize}
            onPageSizeChange={countryPage.onPageSizeChange}
            total={countryPage.total}
            disabled={busy}
            loading={pickerLoading}
          />
        </div>
      ) : null}
    </div>
  );
};
