/** Applicant keys the passport reader can leave empty — used only for highlight UI. */
export const OCR_REVIEW_FIELD_KEYS = [
  "fullName",
  "dateOfBirth",
  "nationality",
  "passportNumber",
  "passportExpiryDate",
] as const;

export type TOcrReviewFieldKey = (typeof OCR_REVIEW_FIELD_KEYS)[number];

const isReviewFieldKey = (key: string): key is TOcrReviewFieldKey =>
  (OCR_REVIEW_FIELD_KEYS as readonly string[]).includes(key);

const isEmptyValue = (value: string | null | undefined): boolean =>
  value === null || value === undefined || value.trim() === "";

/**
 * Fields to highlight after OCR: in the reader's missing list and still empty
 * on the form. Does not change which fields were filled.
 */
export const emptyOcrReviewFields = (
  ocrMissingFields: readonly string[] | null | undefined,
  valuesByApplicantKey: Record<string, string | null | undefined>,
): TOcrReviewFieldKey[] => {
  if (!ocrMissingFields?.length) return [];
  const missing = new Set(ocrMissingFields.filter(isReviewFieldKey));
  if (missing.size === 0) return [];
  return OCR_REVIEW_FIELD_KEYS.filter(
    (key) => missing.has(key) && isEmptyValue(valuesByApplicantKey[key]),
  );
};

export type TApplicantFieldMeta = Partial<
  Record<string, { source?: string; needsReview?: boolean }>
>;

const ALL_HIGHLIGHT_KEYS = [
  ...OCR_REVIEW_FIELD_KEYS,
  "placeOfBirth",
  "profession",
  "address",
] as const;

/** Highlight OCR-filled fields and still-empty missing ones, including after reload. */
export const reviewHighlightFields = (input: {
  ocrMissingFields?: readonly string[] | null;
  ocrNeedsReviewFields?: readonly string[] | null;
  fieldMeta?: TApplicantFieldMeta | null;
  valuesByApplicantKey: Record<string, string | null | undefined>;
  locallyEdited?: ReadonlySet<string>;
}): string[] => {
  const keys = new Set<string>();
  for (const key of emptyOcrReviewFields(input.ocrMissingFields, input.valuesByApplicantKey)) {
    keys.add(key);
  }
  for (const key of input.ocrNeedsReviewFields ?? []) {
    if (ALL_HIGHLIGHT_KEYS.includes(key as (typeof ALL_HIGHLIGHT_KEYS)[number])) keys.add(key);
  }
  for (const [key, meta] of Object.entries(input.fieldMeta ?? {})) {
    if (meta?.needsReview || (meta?.source === "ocr" && meta.needsReview !== false)) {
      keys.add(key);
    }
  }
  for (const key of input.locallyEdited ?? []) keys.delete(key);
  return [...keys];
};
