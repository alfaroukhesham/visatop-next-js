import {
  APPLICATION_STATUSES,
  FULFILLMENT_STATUSES,
  PAYMENT_STATUSES,
} from "@/lib/applications/status";

const ADMIN_APPLICATIONS_DEFAULT_PAGE_SIZE = 20;
const ADMIN_APPLICATIONS_PAGE_SIZES = [10, 20, 50, 100] as const;

export type AdminApplicationsListSearchParams = {
  attention?: string;
  page?: string;
  pageSize?: string;
  q?: string;
  status?: string;
  payment?: string;
  fulfillment?: string;
};

export type ParsedAdminApplicationsListParams = {
  attention: boolean;
  page: number;
  pageSize: number;
  offset: number;
  search?: string;
  status?: (typeof APPLICATION_STATUSES)[number];
  paymentStatus?: (typeof PAYMENT_STATUSES)[number];
  fulfillmentStatus?: (typeof FULFILLMENT_STATUSES)[number];
};

function pickEnum<T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
): T[number] | undefined {
  if (!value) return undefined;
  return (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : undefined;
}

export function parseAdminApplicationsListParams(
  raw: AdminApplicationsListSearchParams,
): ParsedAdminApplicationsListParams {
  const pageSizeRaw = Number(raw.pageSize);
  const pageSize = ADMIN_APPLICATIONS_PAGE_SIZES.includes(
    pageSizeRaw as (typeof ADMIN_APPLICATIONS_PAGE_SIZES)[number],
  )
    ? pageSizeRaw
    : ADMIN_APPLICATIONS_DEFAULT_PAGE_SIZE;

  const page = Math.max(0, Number(raw.page ?? "0") || 0);
  const search = raw.q?.trim() || undefined;

  return {
    attention: raw.attention === "true",
    page,
    pageSize,
    offset: page * pageSize,
    search: search && search.length > 0 ? search : undefined,
    status: pickEnum(raw.status, APPLICATION_STATUSES),
    paymentStatus: pickEnum(raw.payment, PAYMENT_STATUSES),
    fulfillmentStatus: pickEnum(raw.fulfillment, FULFILLMENT_STATUSES),
  };
}

function buildAdminApplicationsListQuery(
  params: AdminApplicationsListSearchParams,
  overrides: Partial<AdminApplicationsListSearchParams> = {},
): string {
  const merged = { ...params, ...overrides };
  const qs = new URLSearchParams();

  if (merged.attention === "true") qs.set("attention", "true");
  if (merged.q?.trim()) qs.set("q", merged.q.trim());
  if (merged.status) qs.set("status", merged.status);
  if (merged.payment) qs.set("payment", merged.payment);
  if (merged.fulfillment) qs.set("fulfillment", merged.fulfillment);
  if (merged.pageSize && merged.pageSize !== String(ADMIN_APPLICATIONS_DEFAULT_PAGE_SIZE)) {
    qs.set("pageSize", merged.pageSize);
  }
  if (merged.page && merged.page !== "0") qs.set("page", merged.page);

  const query = qs.toString();
  return query ? `?${query}` : "";
}

export function adminApplicationsListHref(
  params: AdminApplicationsListSearchParams,
  overrides: Partial<AdminApplicationsListSearchParams> = {},
): string {
  return `/admin/applications${buildAdminApplicationsListQuery(params, overrides)}`;
}
