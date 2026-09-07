export const PAY_FIRST_INCOMPLETE_COPY =
  "Pay now to start processing. You can add remaining details after payment.";

export const PAY_FIRST_COMPLETE_COPY =
  "Review your order and pay securely to begin processing.";

export const PAY_BLOCKED_MISSING_DOCS_COPY =
  "Upload your required documents to pay.";

export type TPayCopyInput = {
  requiredSlotKeys: string[];
  uploadedTypes: string[];
  hasFullName: boolean;
  hasDateOfBirth: boolean;
  hasPassportNumber: boolean;
};

export const customerLooksCompleteForPayCopy = (input: TPayCopyInput): boolean => {
  const uploaded = new Set(input.uploadedTypes);
  const slotsOk = input.requiredSlotKeys.every((k) => uploaded.has(k));
  return slotsOk && input.hasFullName && input.hasDateOfBirth && input.hasPassportNumber;
};

export const initiatePaymentBody = (complete: boolean): string =>
  complete ? PAY_FIRST_COMPLETE_COPY : PAY_FIRST_INCOMPLETE_COPY;
