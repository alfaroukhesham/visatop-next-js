export type MissingNationalityEntry = {
  normKey: string;
  exampleRaw: string;
  exampleRowIdx: number;
  suggestedAlpha2?: string | null;
};

export type PreviewResult = {
  headerRowIndex: number;
  missingNationalities: MissingNationalityEntry[];
  errors: { rowIdx: number; countryRaw: string; message: string }[];
  pending: {
    rowIdx: number;
    nationalityCode: string | null;
    serviceId: string | null;
    serviceName: string;
    amountMinor: string;
    rowRef: string;
  }[];
  autoFixPreview: {
    nationalityCode: string | null;
    serviceName: string;
    existingCurrency: "USD" | "AED";
    derivedCurrency: "USD" | "AED";
    fxRate: string | null;
  }[];
  unknownServices: string[];
  stats: {
    dataRows: number;
    pricedCells: number;
    ambiguousCells: number;
    emptyCells: number;
  };
};

export type ApplyResult = {
  batchId: string;
  missingNationalities?: MissingNationalityEntry[];
  committed?: boolean;
  headerRowIndex?: number;
  partialApplied: boolean;
  rowsProcessed: number;
  skippedRows: number;
  skippedCells: number;
  pricesUpserted: number;
  pricesDeleted: number;
  pendingCreated: number;
  eligibilityAdded: number;
  eligibilityRemoved: number;
  autoFix: {
    nationalityCode: string;
    serviceId: string;
    serviceName: string;
    fixedCurrency: "USD" | "AED";
    derivedFrom: "USD" | "AED";
    fxRate: string;
  }[];
  servicesCreated: { id: string; name: string }[];
  errors: { rowIdx: number; countryRaw: string; message: string }[];
  /** merge = cell updates only; replace = sheet is the full catalog source of truth. */
  catalogScope?: "merge" | "replace";
  /** True when apply detected no catalog changes were needed. */
  unchanged?: boolean;
};

export type PendingImportListRow = {
  id: string;
  nationalityCode: string;
  serviceId: string;
  serviceName: string;
  amountMinor: string;
  rowRef: string | null;
  batchId: string;
};

export type NationalityDraftRow = {
  normKey: string;
  exampleRowIdx: number;
  code: string;
  name: string;
  /** Server ISO guess for hint text (unchanged when user edits). */
  suggestedAlpha2: string | null;
};

export type ImportPhase =
  | "idle"
  | "previewing"
  | "previewed"
  | "applying"
  | "applied"
  | "assigning";

export type CustomerPriceImportState = {
  file: File | null;
  preview: PreviewResult | null;
  applyResult: ApplyResult | null;
  pendingCurrency: "USD" | "AED";
  phase: ImportPhase;
  error: string | null;
  showAutoFix: boolean;
  applyMode: "strict" | "partial";
  /** replace clears prices outside the sheet; merge only updates cells present in the sheet. */
  catalogScope: "merge" | "replace";
  bulkModalOpen: boolean;
  natDrafts: NationalityDraftRow[];
  bulkSaving: boolean;
  bulkLocalError: string | null;
  applyElapsedSec: number;
  assignElapsedSec: number;
  pendingListRows: PendingImportListRow[];
  pendingListTotal: number;
  pendingListLoading: boolean;
  pendingPage: number;
  pendingPageSize: number;
  previewListPageSize: number;
  previewPendingPage: number;
  previewErrorsPage: number;
  previewMissingNatPage: number;
  previewAutoFixPage: number;
};

export type CustomerPriceImportAction =
  | { type: "patch"; patch: Partial<CustomerPriceImportState> }
  | { type: "reset_preview_pages" }
  | { type: "reset" };

export const initialCustomerPriceImportState: CustomerPriceImportState = {
  file: null,
  preview: null,
  applyResult: null,
  pendingCurrency: "USD",
  phase: "idle",
  error: null,
  showAutoFix: false,
  applyMode: "strict",
  catalogScope: "replace",
  bulkModalOpen: false,
  natDrafts: [],
  bulkSaving: false,
  bulkLocalError: null,
  applyElapsedSec: 0,
  assignElapsedSec: 0,
  pendingListRows: [],
  pendingListTotal: 0,
  pendingListLoading: false,
  pendingPage: 0,
  pendingPageSize: 25,
  previewListPageSize: 25,
  previewPendingPage: 0,
  previewErrorsPage: 0,
  previewMissingNatPage: 0,
  previewAutoFixPage: 0,
};

export function customerPriceImportReducer(
  state: CustomerPriceImportState,
  action: CustomerPriceImportAction,
): CustomerPriceImportState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "reset_preview_pages":
      return {
        ...state,
        previewPendingPage: 0,
        previewErrorsPage: 0,
        previewMissingNatPage: 0,
        previewAutoFixPage: 0,
      };
    case "reset":
      return {
        ...initialCustomerPriceImportState,
        previewListPageSize: 25,
      };
    default:
      return state;
  }
}

export type PreviewSlices = {
  missing: PreviewResult["missingNationalities"];
  errors: PreviewResult["errors"];
  pending: PreviewResult["pending"];
  autoFix: PreviewResult["autoFixPreview"];
};
