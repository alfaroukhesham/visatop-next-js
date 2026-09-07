import type { TEntryKind, TStayBucket, TTravelerKind } from "@/lib/catalog/guided-choice";

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
  stayBucket: TStayBucket | null;
  entryKind: TEntryKind;
  travelerKind: TTravelerKind;
  showInGuidedChooser: boolean;
};

export type CatalogEligibility = {
  serviceId: string;
  nationalityCode: string;
  serviceName: string;
  nationalityName: string;
  hasPrice: boolean;
};
