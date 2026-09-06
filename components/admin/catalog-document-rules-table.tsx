"use client";

import { useMemo, useReducer, type FC } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  AdminTableLoadingFrame,
  AdminTableLoadingSkeleton,
} from "@/components/admin/admin-loading";
import { AdminListFilters } from "@/components/admin/admin-list-filters";
import { ListPaginatorBar } from "@/components/admin/list-paginator-bar";
import {
  EMPTY_CATALOG_DOCUMENT_REQUIREMENT_FILTERS,
  useCatalogDocumentRequirementsPage,
  type CatalogDocumentRequirementFilters,
} from "@/components/admin/use-catalog-document-requirements-page";
import { removeOneDocumentRequirement } from "@/lib/admin/catalog/document-requirement-mutations";
import { humanizeDocumentTypeKey } from "@/lib/admin/catalog/document-type";
import { slotForDocumentType } from "@/lib/apply/document-slot-catalog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

interface ICatalogDocumentRulesTableProps {
  canWrite: boolean;
  busy: boolean;
  flash: (text: string, err?: boolean) => void;
  onChanged: () => void;
  refreshKey: number;
  lockedDocumentType?: string;
}

export const CatalogDocumentRulesTable: FC<ICatalogDocumentRulesTableProps> = ({
  canWrite,
  busy,
  flash,
  onChanged,
  refreshKey,
  lockedDocumentType,
}) => {
  type UiState = {
    draftFilters: CatalogDocumentRequirementFilters;
    appliedFilters: CatalogDocumentRequirementFilters;
    pendingRemoveId: string | null;
    removeBusy: string | null;
  };
  type UiAction =
    | { type: "patch"; patch: Partial<UiState> }
    | { type: "clear-filters" };

  const [ui, dispatchUi] = useReducer(
    (state: UiState, action: UiAction): UiState => {
      switch (action.type) {
        case "patch":
          return { ...state, ...action.patch };
        case "clear-filters":
          return {
            ...state,
            draftFilters: {
              ...EMPTY_CATALOG_DOCUMENT_REQUIREMENT_FILTERS,
              documentType: lockedDocumentType ?? "",
            },
            appliedFilters: {
              ...EMPTY_CATALOG_DOCUMENT_REQUIREMENT_FILTERS,
              documentType: lockedDocumentType ?? "",
            },
          };
        default:
          return state;
      }
    },
    {
      draftFilters: {
        ...EMPTY_CATALOG_DOCUMENT_REQUIREMENT_FILTERS,
        documentType: lockedDocumentType ?? "",
      },
      appliedFilters: {
        ...EMPTY_CATALOG_DOCUMENT_REQUIREMENT_FILTERS,
        documentType: lockedDocumentType ?? "",
      },
      pendingRemoveId: null,
      removeBusy: null,
    },
  );
  const { draftFilters, appliedFilters, pendingRemoveId, removeBusy } = ui;
  const setDraftFilters = (
    updater:
      | CatalogDocumentRequirementFilters
      | ((prev: CatalogDocumentRequirementFilters) => CatalogDocumentRequirementFilters),
  ) => {
    dispatchUi({
      type: "patch",
      patch: {
        draftFilters: typeof updater === "function" ? updater(draftFilters) : updater,
      },
    });
  };
  const setAppliedFilters = (value: CatalogDocumentRequirementFilters) =>
    dispatchUi({ type: "patch", patch: { appliedFilters: value } });
  const setPendingRemoveId = (value: string | null) =>
    dispatchUi({ type: "patch", patch: { pendingRemoveId: value } });
  const setRemoveBusy = (value: string | null) =>
    dispatchUi({ type: "patch", patch: { removeBusy: value } });

  const page = useCatalogDocumentRequirementsPage(10, appliedFilters, refreshKey);
  const sectionBusy = busy || removeBusy !== null;

  const filterValues = useMemo(
    () => ({
      nationalityCode: draftFilters.nationalityCode,
      serviceId: draftFilters.serviceId,
      documentType: draftFilters.documentType,
    }),
    [draftFilters],
  );
  const hasActiveFilters =
    Boolean(appliedFilters.nationalityCode) ||
    Boolean(appliedFilters.serviceId) ||
    (!lockedDocumentType && Boolean(appliedFilters.documentType));
  const showDocumentColumn = !lockedDocumentType;

  const onConfirmRemove = async () => {
    if (!pendingRemoveId) return;
    setRemoveBusy(pendingRemoveId);
    try {
      const res = await removeOneDocumentRequirement(pendingRemoveId);
      if (!res.ok) {
        flash(res.error.message, true);
        setPendingRemoveId(null);
        return;
      }
      flash("Removed document requirement.");
      setPendingRemoveId(null);
      onChanged();
    } finally {
      setRemoveBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {page.error ? (
        <p className="text-destructive text-sm" role="alert">
          {page.error}
        </p>
      ) : null}
      <AdminListFilters
        fields={[
          {
            kind: "search",
            key: "nationalityCode",
            label: "Nationality",
            placeholder: "Code…",
          },
          {
            kind: "search",
            key: "serviceId",
            label: "Service",
            placeholder: "Service name or id…",
          },
          ...(lockedDocumentType
            ? []
            : [
                {
                  kind: "search" as const,
                  key: "documentType",
                  label: "Document",
                  placeholder: "Document key…",
                },
              ]),
        ]}
        values={filterValues}
        onChange={(key, value) => setDraftFilters((prev) => ({ ...prev, [key]: value }))}
        onApply={() => {
          setAppliedFilters({ ...draftFilters });
          page.setPage(0);
        }}
        onClear={() => {
          dispatchUi({ type: "clear-filters" });
          page.setPage(0);
        }}
        canClear={hasActiveFilters}
        applying={page.loading}
        applyLabel="Apply filters"
        className="rounded-md"
      />
      <AdminTableLoadingFrame
        loading={page.loading}
        hasRows={page.items.length > 0}
        className="overflow-x-auto rounded-md border border-border"
      >
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/60 text-muted-foreground text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Nationality</th>
              <th className="px-4 py-2 font-medium">Service</th>
              {showDocumentColumn ? <th className="px-4 py-2 font-medium">Document</th> : null}
              <th className="px-4 py-2 font-medium">Role</th>
              {canWrite ? <th className="px-4 py-2 font-medium">Remove</th> : null}
            </tr>
          </thead>
          <tbody
            className={cn(
              "divide-border divide-y",
              page.loading && page.items.length === 0 && "admin-stagger",
            )}
          >
            {page.loading && page.items.length === 0 ? (
              <AdminTableLoadingSkeleton
                rows={Math.min(page.pageSize, 8)}
                columns={canWrite ? (showDocumentColumn ? 5 : 4) : showDocumentColumn ? 4 : 3}
                columnWidths={
                  canWrite
                    ? showDocumentColumn
                      ? ["w-20", "w-2/5", "w-2/5", "w-20", "w-10"]
                      : ["w-20", "w-2/5", "w-20", "w-10"]
                    : showDocumentColumn
                      ? ["w-20", "w-2/5", "w-2/5", "w-20"]
                      : ["w-20", "w-2/5", "w-20"]
                }
              />
            ) : null}
            {!page.loading && page.items.length === 0 ? (
              <tr>
                <td
                  colSpan={canWrite ? (showDocumentColumn ? 5 : 4) : showDocumentColumn ? 4 : 3}
                  className="text-muted-foreground px-4 py-6 text-center text-sm"
                >
                  {hasActiveFilters
                    ? "No document requirements match your filters."
                    : "No document requirements yet."}
                </td>
              </tr>
            ) : null}
            {page.items.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-4 py-2 font-mono text-xs">{item.nationalityCode}</td>
                <td className="px-4 py-2">
                  <span className="font-medium">{item.serviceName}</span>
                  <div className="text-muted-foreground font-mono text-[10px] break-all">
                    {item.serviceId}
                  </div>
                </td>
                {showDocumentColumn ? (
                  <td className="px-4 py-2">
                    {slotForDocumentType(item.documentType)?.label ??
                      humanizeDocumentTypeKey(item.documentType)}
                  </td>
                ) : null}
                <td className="px-4 py-2 text-xs capitalize">{item.role}</td>
                {canWrite ? (
                  <td className="px-4 py-2">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={sectionBusy}
                      aria-label="Remove document requirement"
                      onClick={() => setPendingRemoveId(item.id)}
                    >
                      {removeBusy === item.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </AdminTableLoadingFrame>
      <ListPaginatorBar
        selectId="catalog-document-rules-page-size"
        page={page.page}
        setPage={page.setPage}
        pageSize={page.pageSize}
        onPageSizeChange={page.onPageSizeChange}
        total={page.total}
        disabled={sectionBusy || page.loading}
        loading={page.loading}
      />
      <ConfirmDialog
        open={pendingRemoveId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoveId(null);
        }}
        title="Remove this document?"
        description="Remove this document from this pair. Eligibility stays."
        confirmLabel="Remove"
        confirmVariant="destructive"
        confirmBusy={removeBusy !== null}
        onConfirm={() => void onConfirmRemove()}
      />
    </div>
  );
};
