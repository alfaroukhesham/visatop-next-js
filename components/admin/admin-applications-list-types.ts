export type AdminApplicationListItem = {
  id: string;
  serviceId: string;
  serviceName: string | null;
  applicationStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  referenceNumber: string | null;
  fullName: string | null;
  guestEmail: string | null;
  adminAttentionRequired: boolean;
  createdAt: string;
};

export type ApplicationsListFilters = {
  q: string;
  status: string;
  payment: string;
  fulfillment: string;
  attention: boolean;
};

export const EMPTY_APPLICATIONS_FILTERS: ApplicationsListFilters = {
  q: "",
  status: "",
  payment: "",
  fulfillment: "",
  attention: false,
};

export type AdminApplicationsListResponse = {
  items: AdminApplicationListItem[];
  total: number;
  page: number;
  pageSize: number;
  attentionCount: number;
};
