export type CatalogNationality = {
  code: string;
  name: string;
  enabled: boolean;
};

export type CatalogService = {
  id: string;
  name: string;
  enabled: boolean;
  durationDays: number | null;
  entries: string | null;
};

export type CatalogEligibility = {
  serviceId: string;
  nationalityCode: string;
  serviceName: string;
};
