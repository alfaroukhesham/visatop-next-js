import { describe, expect, it } from "vitest";
import {
  FINCRA_ATTENTION_AMOUNT_MISMATCH,
  FINCRA_ATTENTION_EXTRA_COLLECTION,
  FINCRA_ATTENTION_PAID_AFTER_CANCEL,
  FINCRA_ATTENTION_VARIANCE_OVERPAYMENT,
  FINCRA_ATTENTION_VARIANCE_UNDERPAYMENT,
  formatFincraAdminAttentionBanner,
  fincraAttentionReasonFromMismatch,
} from "./fincra-admin-attention";

describe("Fincra admin attention copy", () => {
  it("maps mismatch reasons onto hold flags visible to admin", () => {
    expect(fincraAttentionReasonFromMismatch("amount_mismatch")).toBe(FINCRA_ATTENTION_AMOUNT_MISMATCH);
    expect(fincraAttentionReasonFromMismatch("currency_mismatch")).toBe(FINCRA_ATTENTION_AMOUNT_MISMATCH);
    expect(fincraAttentionReasonFromMismatch("variance_underpayment")).toBe(
      FINCRA_ATTENTION_VARIANCE_UNDERPAYMENT,
    );
    expect(fincraAttentionReasonFromMismatch("variance_overpayment")).toBe(
      FINCRA_ATTENTION_VARIANCE_OVERPAYMENT,
    );
  });

  it("surfaces extra collection and paid-after-cancel reasons on the banner", () => {
    expect(
      formatFincraAdminAttentionBanner({
        reason: FINCRA_ATTENTION_EXTRA_COLLECTION,
        details: {
          events: [
            {
              reason: FINCRA_ATTENTION_EXTRA_COLLECTION,
              providerReference: "601227",
              merchantReference: "pay_1-a2",
              amountMinor: "18500000",
              currency: "NGN",
              timestamp: "2026-11-05T10:00:00.000Z",
            },
          ],
        },
      }).title,
    ).toMatch(/extra collection/i);
    expect(
      formatFincraAdminAttentionBanner({
        reason: FINCRA_ATTENTION_PAID_AFTER_CANCEL,
        details: null,
      }).body,
    ).toMatch(/cancelled/i);
  });
});
