"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FC } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { ListPaginatorBar } from "@/components/admin/list-paginator-bar";
import { usePaginatedList } from "@/components/admin/use-paginated-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TDocumentRequirementCountry } from "@/lib/admin/catalog/list-catalog-document-requirement-countries";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";

type TPickerCountry = {
  code: string;
  name: string;
};

interface IDocumentRulesAssignmentCountriesProps {
  documentType: string;
  canWrite: boolean;
}

export const DocumentRulesAssignmentCountries: FC<IDocumentRulesAssignmentCountriesProps> = ({
  documentType,
  canWrite,
}) => {
  const [countries, setCountries] = useState<TDocumentRequirementCountry[]>([]);
  const [pickerCountries, setPickerCountries] = useState<TPickerCountry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const [assignedRes, pickerRes] = await Promise.all([
        fetchApiEnvelope<{ countries: TDocumentRequirementCountry[] }>(
          apiHref(
            `/admin/catalog/document-requirements?group=countries&documentType=${encodeURIComponent(documentType)}`,
          ),
        ),
        fetchApiEnvelope<{ countries: TPickerCountry[] }>(
          apiHref("/admin/catalog/document-requirements?picker=1"),
        ),
      ]);
      if (!active) return;
      if (!assignedRes.ok) {
        setError(assignedRes.error.message);
        setCountries([]);
      } else {
        setError(null);
        setCountries(assignedRes.data.countries);
      }
      if (pickerRes.ok) {
        setPickerCountries(pickerRes.data.countries.map((c) => ({ code: c.code, name: c.name })));
      }
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [documentType]);

  const assignedCodes = useMemo(() => new Set(countries.map((c) => c.code)), [countries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
  }, [countries, search]);

  const addable = useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    return pickerCountries
      .filter((c) => !assignedCodes.has(c.code))
      .filter((c) => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [addSearch, assignedCodes, pickerCountries]);

  const { setPage, ...page } = usePaginatedList(filtered);
  const addPage = usePaginatedList(addable);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="assignment-countries-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search assigned countries…"
            className="pl-9"
            autoComplete="off"
            aria-label="Search assigned countries"
          />
        </div>
        {canWrite ? (
          <Button
            type="button"
            variant={addOpen ? "secondary" : "outline"}
            onClick={() => setAddOpen((open) => !open)}
          >
            <Plus className="size-4" />
            Add country
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {addOpen ? (
        <div className="border-border space-y-3 rounded-md border p-3">
          <p className="text-sm font-medium">Add a country</p>
          <Input
            id="assignment-add-country-search"
            value={addSearch}
            onChange={(e) => {
              setAddSearch(e.target.value);
              addPage.setPage(0);
            }}
            placeholder="Search by code or name…"
            autoComplete="off"
            aria-label="Search countries to add"
          />
          <ul className="divide-border divide-y rounded-md border">
            {addPage.pageItems.length === 0 ? (
              <li className="text-muted-foreground px-4 py-4 text-center text-sm">
                {addSearch.trim() ? "No countries match your search." : "Every country already has this document."}
              </li>
            ) : null}
            {addPage.pageItems.map((country) => (
              <li key={country.code}>
                <Link
                  href={`/admin/document-rules/${encodeURIComponent(documentType)}/${encodeURIComponent(country.code)}`}
                  className="hover:bg-muted/30 flex w-full items-center justify-between gap-3 px-4 py-3"
                >
                  <span>
                    <span className="font-medium">{country.name}</span>{" "}
                    <span className="text-muted-foreground font-mono text-xs">({country.code})</span>
                  </span>
                  <span className="text-muted-foreground text-sm">Assign services</span>
                </Link>
              </li>
            ))}
          </ul>
          <ListPaginatorBar
            selectId="assignment-add-country-page-size"
            page={addPage.page}
            setPage={addPage.setPage}
            pageSize={addPage.pageSize}
            onPageSizeChange={addPage.onPageSizeChange}
            total={addPage.total}
          />
        </div>
      ) : null}

      {!loaded ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading countries…
        </p>
      ) : (
        <>
          <ul className="divide-border divide-y rounded-md border">
            {page.pageItems.length === 0 ? (
              <li className="text-muted-foreground px-4 py-6 text-center text-sm">
                {search.trim()
                  ? "No countries match your search."
                  : "No countries yet. Add a country or use bulk assign."}
              </li>
            ) : null}
            {page.pageItems.map((country) => (
              <li key={country.code}>
                <Link
                  href={`/admin/document-rules/${encodeURIComponent(documentType)}/${encodeURIComponent(country.code)}`}
                  className="hover:bg-muted/30 flex w-full items-center justify-between gap-3 px-4 py-3"
                >
                  <span>
                    <span className="font-medium">{country.name}</span>{" "}
                    <span className="text-muted-foreground font-mono text-xs">({country.code})</span>
                  </span>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {country.serviceCount.toLocaleString()}{" "}
                    {country.serviceCount === 1 ? "service" : "services"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <ListPaginatorBar
            selectId="assignment-countries-page-size"
            page={page.page}
            setPage={setPage}
            pageSize={page.pageSize}
            onPageSizeChange={page.onPageSizeChange}
            total={page.total}
            loading={!loaded}
          />
        </>
      )}
    </div>
  );
};
