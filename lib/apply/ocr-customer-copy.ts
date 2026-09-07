export const OCR_READING_COPY = "Reading your passport…";

export const OCR_SUCCEEDED_COPY =
  "Details filled in — please check they are correct.";

export const OCR_NEEDS_REVIEW_COPY =
  "We could not read some details clearly. Review the highlighted fields.";

export const customerFacingOcrMessage = (
  status: string | null | undefined,
): string | null => {
  switch (status) {
    case "running":
      return OCR_READING_COPY;
    case "succeeded":
      return OCR_SUCCEEDED_COPY;
    case "needs_manual":
    case "failed":
      return OCR_NEEDS_REVIEW_COPY;
    default:
      return null;
  }
};
