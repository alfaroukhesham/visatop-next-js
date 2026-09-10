/** Field keys only — never passport numbers, names, or dates. */
const ALLOWED_OCR_FIELD_KEYS = new Set([
  "fullName",
  "dateOfBirth",
  "nationality",
  "passportNumber",
  "passportExpiryDate",
  "placeOfBirth",
  "profession",
  "address",
]);

export type TOcrReviewParams = {
  application_id: string;
  document_id?: string;
  ocr_status: string;
  uncertain_field_count: number;
  uncertain_fields: string;
};

export const buildOcrReviewParams = (input: {
  applicationId: string;
  documentId?: string | null;
  status: string;
  missingFields: string[];
}): TOcrReviewParams | null => {
  const fields = [
    ...new Set(input.missingFields.filter((key) => ALLOWED_OCR_FIELD_KEYS.has(key))),
  ];
  const needsReview =
    input.status === "needs_manual" || input.status === "failed" || fields.length > 0;
  if (!needsReview) return null;
  return {
    application_id: input.applicationId,
    ...(input.documentId ? { document_id: input.documentId } : {}),
    ocr_status: input.status,
    uncertain_field_count: fields.length,
    uncertain_fields: fields.join(","),
  };
};
