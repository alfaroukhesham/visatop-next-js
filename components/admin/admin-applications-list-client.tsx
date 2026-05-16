"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  APPLICATION_STATUSES,
  FULFILLMENT_STATUSES,
  PAYMENT_STATUSES,
} from "@/lib/applications/status";
import {
  AdminListFilters,
  type AdminListFilterField,
} from "@/components/admin/admin-list-filters";
import { ListPaginatorBar } from "@/components/admin/list-paginator-bar";
import {
  AdminTableLoadingFrame,
  AdminTableLoadingSkeleton,
} from "@/components/admin/admin-loading";
import {
  EMPTY_APPLICATIONS_FILTERS,
  type ApplicationsListFilters,
} from "@/components/admin/admin-applications-list-types";
import { useAdminApplicationsList } from "@/components/admin/use-admin-applications-list";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";

const TABLE_COLUMNS = 8;
const SKELETON_COLUMN_WIDTHS = [
  "w-24",
  "w-32",
  "w-20",
  "w-24",
  "w-20",
  "w-28",
  "w-12",
  "w-20",
];

const FILTER_FIELDS: AdminListFilterField[] = [
  {
    kind: "search",
    key: "q",
    label: "Search",
    placeholder: "ID, reference, email, name…",
  },
  {
    kind: "select",
    key: "status",
    label: "Application status",
    options: APPLICATION_STATUSES,
  },
  {
    kind: "select",
    key: "payment",
    label: "Payment status",
    options: PAYMENT_STATUSES,
  },
  {
    kind: "select",
    key: "fulfillment",
    label: "Fulfillment status",
    options: FULFILLMENT_STATUSES,
  },
];

type Props = {
  initialAttentionCount: number;
};

function filtersToRecord(filters: DraftFilters): Record<string, string> {
  return {
    q: filters.q,
    status: filters.status,
    payment: filters.payment,
    fulfillment: filters.fulfillment,
  };
}

function recordToFilters(
  record: Record<string, string>,
  attention: boolean,
): ApplicationsListFilters {
  return {
    q: record.q ?? "",
    status: record.status ?? "",
    payment: record.payment ?? "",
    fulfillment: record.fulfillment ?? "",
    attention,
  };
}

function hasActiveFilters(filters: ApplicationsListFilters) {
  return (
    Boolean(filters.q.trim()) ||
    Boolean(filters.status) ||
    Boolean(filters.payment) ||
    Boolean(filters.fulfillment) ||
    filters.attention
  );
}

type DraftFilters = Omit<ApplicationsListFilters, "attention">;

export function AdminApplicationsListClient({ initialAttentionCount }: Props) {
  const router = useRouter();
  const list = useAdminApplicationsList();

  function openApplication(applicationId: string) {
    router.push(`/admin/applications/${applicationId}`);
  }
  const [draft, setDraft] = useState<DraftFilters>({
    q: "",
    status: "",
    payment: "",
    fulfillment: "",
  });
  const [attentionOnly, setAttentionOnly] = useState(false);

  const applied = list.appliedFilters;
  const canClear = hasActiveFilters(applied);
  const filterValues = useMemo(() => filtersToRecord(draft), [draft]);

  function updateDraft(key: string, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleApply() {
    const next = recordToFilters(filterValues, attentionOnly);
    setDraft({
      q: next.q,
      status: next.status,
      payment: next.payment,
      fulfillment: next.fulfillment,
    } satisfies DraftFilters);
    list.applyFilters(next);
  }

  function handleClear() {
    const clearedDraft = { q: "", status: "", payment: "", fulfillment: "" };
    setDraft(clearedDraft);
    list.applyFilters({ ...clearedDraft, attention: attentionOnly });
  }

  function toggleAttentionOnly(next: boolean) {
    setAttentionOnly(next);
    const nextFilters = { ...applied, attention: next };
    setDraft({
      q: nextFilters.q,
      status: nextFilters.status,
      payment: nextFilters.payment,
      fulfillment: nextFilters.fulfillment,
    } satisfies DraftFilters);
    list.applyFilters(nextFilters);
  }

  const attentionCount = list.attentionCount || initialAttentionCount;

  return (
    <div className="space-y-4">
      {attentionCount > 0 && !attentionOnly ? (
        <div className="border-2 border-destructive bg-destructive/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-destructive size-6 shrink-0" />
            <div>
              <p className="font-bold text-destructive">
                {attentionCount} application{attentionCount !== 1 ? "s" : ""} need manual
                intervention
              </p>
              <p className="text-sm text-destructive/80">
                Flagged by webhook handler — payment confirmed but requires human review.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleAttentionOnly(true)}
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "rounded-none border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground shrink-0",
            )}
          >
            Review flagged →
          </button>
        </div>
      ) : null}

      <AdminListFilters
        fields={FILTER_FIELDS}
        values={filterValues}
        onChange={updateDraft}
        onApply={handleApply}
        onClear={handleClear}
        canClear={canClear}
        applying={list.loading}
      />

      {attentionOnly ? (
        <div className="bg-muted px-4 py-2 flex items-center justify-between text-sm">
          <span className="font-medium flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            Showing attention-required only
          </span>
          <button
            type="button"
            onClick={() => toggleAttentionOnly(false)}
            className="text-xs text-primary hover:underline"
          >
            Clear attention filter
          </button>
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground font-mono" aria-live="polite">
        {list.loading && list.items.length === 0 ? (
          <span className="text-muted-foreground/70">Loading applications…</span>
        ) : (
          <>
            {list.total} result{list.total !== 1 ? "s" : ""}
            {hasActiveFilters(applied) ? " (filtered)" : ""}
          </>
        )}
        {list.error ? (
          <span className="text-destructive ml-2">— {list.error}</span>
        ) : null}
      </p>

      <div className="border border-border bg-card overflow-x-auto">
        <AdminTableLoadingFrame loading={list.loading} hasRows={list.items.length > 0}>
          <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-muted border-b border-border">
              <th className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground">ID</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground">
                Applicant
              </th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground">
                Service
              </th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground">
                App Status
              </th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground">
                Payment
              </th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground">
                Fulfillment
              </th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground">Flag</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground">
                Created
              </th>
            </tr>
          </thead>
          <tbody
            className={cn(
              "divide-y divide-border",
              list.loading && list.items.length === 0 && "admin-stagger",
            )}
          >
            {list.loading && list.items.length === 0 ? (
              <AdminTableLoadingSkeleton
                rows={Math.min(list.pageSize, 8)}
                columns={TABLE_COLUMNS}
                columnWidths={SKELETON_COLUMN_WIDTHS}
              />
            ) : null}
            {list.items.map((app) => (
              <tr
                key={app.id}
                role="link"
                tabIndex={0}
                onClick={() => openApplication(app.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openApplication(app.id);
                  }
                }}
                className={cn(
                  "cursor-pointer hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  app.adminAttentionRequired ? "border-l-2 border-l-destructive" : "",
                )}
                aria-label={`Open application ${app.referenceNumber ?? app.id.slice(0, 8)}`}
              >
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {app.referenceNumber ?? `${app.id.slice(0, 8)}…`}
                </td>
                <td className="px-4 py-3 text-xs">
                  {app.fullName ?? app.guestEmail ?? (
                    <span className="text-muted-foreground italic">Unnamed draft</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{app.serviceId}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 font-mono">
                    {app.applicationStatus}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 text-xs font-mono",
                      app.paymentStatus === "paid"
                        ? "bg-success/10 text-success border border-success/20"
                        : "bg-muted text-muted-foreground border border-border",
                    )}
                  >
                    {app.paymentStatus}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono bg-muted text-muted-foreground border border-border">
                    {app.fulfillmentStatus}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {app.adminAttentionRequired ? (
                    <span className="text-destructive text-xs font-bold">⚠️ FLAG</span>
                  ) : (
                    <span className="text-muted-foreground/30 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(app.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {!list.loading && list.items.length === 0 ? (
              <tr>
                <td
                  colSpan={TABLE_COLUMNS}
                  className="px-4 py-10 text-center text-sm text-muted-foreground italic"
                >
                  No applications match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </AdminTableLoadingFrame>

        <ListPaginatorBar
          selectId="admin-applications-page-size"
          page={list.page}
          setPage={list.setPage}
          pageSize={list.pageSize}
          onPageSizeChange={list.onPageSizeChange}
          total={list.total}
          disabled={list.loading}
          loading={list.loading}
        />
      </div>
    </div>
  );
}
