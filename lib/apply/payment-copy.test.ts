import { describe, expect, it } from "vitest";
import {
  customerLooksCompleteForPayCopy,
  initiatePaymentBody,
  PAY_FIRST_COMPLETE_COPY,
  PAY_FIRST_INCOMPLETE_COPY,
} from "./payment-copy";

describe("payment-copy", () => {
  it("uses incomplete copy when required slots are empty", () => {
    expect(
      initiatePaymentBody(
        customerLooksCompleteForPayCopy({
          requiredSlotKeys: ["passport_copy", "personal_photo"],
          uploadedTypes: [],
          hasFullName: true,
          hasDateOfBirth: true,
          hasPassportNumber: true,
        }),
      ),
    ).toBe(PAY_FIRST_INCOMPLETE_COPY);
  });

  it("uses complete copy when all slots and key profile fields are present", () => {
    expect(
      initiatePaymentBody(
        customerLooksCompleteForPayCopy({
          requiredSlotKeys: ["passport_copy", "personal_photo", "bank_statement_6m"],
          uploadedTypes: ["passport_copy", "personal_photo", "bank_statement_6m"],
          hasFullName: true,
          hasDateOfBirth: true,
          hasPassportNumber: true,
        }),
      ),
    ).toBe(PAY_FIRST_COMPLETE_COPY);
  });

  it("uses incomplete copy when slots are uploaded but profile fields are missing", () => {
    expect(
      customerLooksCompleteForPayCopy({
        requiredSlotKeys: ["passport_copy", "personal_photo"],
        uploadedTypes: ["passport_copy", "personal_photo"],
        hasFullName: false,
        hasDateOfBirth: false,
        hasPassportNumber: false,
      }),
    ).toBe(false);
  });
});
