"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { AdminListFilters } from "@/components/admin/admin-list-filters";
import { CatalogEligibilityLinkForm } from "@/components/admin/catalog-eligibility-link-form";
import { CatalogEligibilityTable } from "@/components/admin/catalog-eligibility-table";
import {
  linkCatalogEligibility,
  removeCatalogEligibility,
} from "@/lib/admin/catalog/eligibility-mutations";
import {
  EMPTY_CATALOG_ELIGIBILITY_FILTERS,
  useCatalogEligibilityPage,
  type CatalogEligibilityFilters,
} from "@/components/admin/use-catalog-eligibility-page";
import type { CatalogNationality, CatalogService } from "@/lib/admin/catalog/catalog-types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type CatalogEligibilitySectionProps = {
  services: CatalogService[];
  nationalities: CatalogNationality[];
  canWrite: boolean;
  busy: string | null;
  flash: (t: string, err?: boolean) => void;
  prefillNationalityCode?: string;
  onPrefillConsumed?: () => void;
  onEligibilityChanged?: () => void;
};

export function CatalogEligibilitySection({
  services,
  nationalities,
  canWrite,
  busy,
  flash,
  prefillNationalityCode,
  onPrefillConsumed,
  onEligibilityChanged,
}: CatalogEligibilitySectionProps) {
  type EligibilityUiState = {
    serviceId: string;
    nationalityCode: string;
    eligBusy: string | null;
    draftFilters: CatalogEligibilityFilters;
    appliedFilters: CatalogEligibilityFilters;
  };
  type EligibilityUiAction =
    | { type: "patch"; patch: Partial<EligibilityUiState> }
    | { type: "clear-filters" };

  const [ui, dispatchUi] = useReducer(
    (state: EligibilityUiState, action: EligibilityUiAction): EligibilityUiState => {
      switch (action.type) {
        case "patch":
          return { ...state, ...action.patch };
        case "clear-filters":
          return {
            ...state,
            draftFilters: EMPTY_CATALOG_ELIGIBILITY_FILTERS,
            appliedFilters: EMPTY_CATALOG_ELIGIBILITY_FILTERS,
          };
        default:
          return state;
      }
    },
    {
      serviceId: services[0]?.id ?? "",
      nationalityCode: nationalities[0]?.code ?? "",
      eligBusy: null,
      draftFilters: EMPTY_CATALOG_ELIGIBILITY_FILTERS,
      appliedFilters: EMPTY_CATALOG_ELIGIBILITY_FILTERS,
    },
  );
  const { serviceId, nationalityCode, eligBusy, draftFilters, appliedFilters } = ui;
  const setServiceId = (value: string) => dispatchUi({ type: "patch", patch: { serviceId: value } });
  const setNationalityCode = (value: string) =>
    dispatchUi({ type: "patch", patch: { nationalityCode: value } });
  const setDraftFilters = (
    updater: CatalogEligibilityFilters | ((prev: CatalogEligibilityFilters) => CatalogEligibilityFilters),
  ) => {
    dispatchUi({
      type: "patch",
      patch: {
        draftFilters: typeof updater === "function" ? updater(draftFilters) : updater,
      },
    });
  };
  const setAppliedFilters = (value: CatalogEligibilityFilters) =>
    dispatchUi({ type: "patch", patch: { appliedFilters: value } });
  const setEligBusy = (value: string | null) => dispatchUi({ type: "patch", patch: { eligBusy: value } });
  const eligPage = useCatalogEligibilityPage(10, appliedFilters);
  const sectionBusy = busy !== null || eligBusy !== null;

  const [linkOpen, setLinkOpen] = useState(false);

  useEffect(() => {
    if (prefillNationalityCode) {
      setNationalityCode(prefillNationalityCode);
      setLinkOpen(true);
      onPrefillConsumed?.();
    }
  }, [prefillNationalityCode, onPrefillConsumed]);

  const serviceFilterOptions = useMemo(
    () => services.map((s) => ({ value: s.id, label: s.name })),
    [services],
  );
  const nationalityFilterOptions = useMemo(
    () => nationalities.map((n) => ({ value: n.code, label: `${n.code} ,  ${n.name}` })),
    [nationalities],
  );
  const filterValues = useMemo(
    () => ({
      q: draftFilters.q,
      serviceId: draftFilters.serviceId,
      nationalityCode: draftFilters.nationalityCode,
    }),
    [draftFilters],
  );
  const hasActiveFilters =
    Boolean(appliedFilters.q.trim()) ||
    Boolean(appliedFilters.serviceId) ||
    Boolean(appliedFilters.nationalityCode);

  async function runElig(key: string, fn: () => Promise<void>) {
    setEligBusy(key);
    try {
      await fn();
      eligPage.reload();
      onEligibilityChanged?.();
    } finally {
      setEligBusy(null);
    }
  }

  return (
    <Card id="catalog-eligibility" className="border-border overflow-hidden border">
      <CardHeader className="border-border bg-muted/20 border-b">
        <CardTitle className="font-heading text-lg">Service ↔ nationality eligibility</CardTitle>
        <CardDescription>
          Loaded in pages from the server ({eligPage.total.toLocaleString()} links). Controls which
          combinations appear in the public services list.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {eligPage.error ? (
          <p className="text-destructive text-sm" role="alert">
            {eligPage.error}
          </p>
        ) : null}
        <AdminListFilters
          fields={[
            {
              kind: "search",
              key: "q",
              label: "Search",
              placeholder: "Service name, id, or nationality code…",
            },
            {
              kind: "select",
              key: "serviceId",
              label: "Service",
              options: serviceFilterOptions,
              allLabel: "All services",
            },
            {
              kind: "select",
              key: "nationalityCode",
              label: "Nationality",
              options: nationalityFilterOptions,
              allLabel: "All nationalities",
            },
          ]}
          values={filterValues}
          onChange={(key, value) => setDraftFilters((prev) => ({ ...prev, [key]: value }))}
          onApply={() => {
            setAppliedFilters({ ...draftFilters });
            eligPage.setPage(0);
          }}
          onClear={() => {
            dispatchUi({ type: "clear-filters" });
            eligPage.setPage(0);
          }}
          canClear={hasActiveFilters}
          applying={eligPage.loading}
          applyLabel="Apply filters"
          className="rounded-md"
        />
        {canWrite ? (
          <CatalogEligibilityLinkForm
            services={services}
            nationalities={nationalities}
            serviceId={serviceId}
            nationalityCode={nationalityCode}
            onServiceIdChange={setServiceId}
            onNationalityCodeChange={setNationalityCode}
            sectionBusy={sectionBusy}
            eligBusy={eligBusy}
            open={linkOpen}
            onLink={() =>
              void runElig("elig-add", () =>
                linkCatalogEligibility({ serviceId, nationalityCode, flash }),
              )
            }
          />
        ) : null}
        <CatalogEligibilityTable
          canWrite={canWrite}
          sectionBusy={sectionBusy}
          eligBusy={eligBusy}
          hasActiveFilters={hasActiveFilters}
          eligPage={eligPage}
          onRemove={(svcId, natCode) =>
            void runElig(`elig-del-${svcId}-${natCode}`, () =>
              removeCatalogEligibility({
                serviceId: svcId,
                nationalityCode: natCode,
                flash,
              }),
            )
          }
        />
      </CardContent>
    </Card>
  );
}
