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
