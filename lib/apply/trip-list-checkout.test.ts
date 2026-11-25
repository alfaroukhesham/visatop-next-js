import { describe, expect, it } from "vitest";
import {
  reloadQuoteAfterFailedSpeedPatch,
  speedCommitFromPatch,
  tripListCheckoutMinor,
  tripSpeedErrorMessage,
} from "./trip-list-checkout";

describe("trip list checkout total", () => {
  it("uses the server quote, including insurance times travellers, once an application exists", () => {
    const visa = 81400 * 2;
    const fastTrack = 36800 * 2;
    const insurance = 7900 * 2;
    const local = visa + fastTrack;
    const quote = String(visa + fastTrack + insurance);

    expect(
      tripListCheckoutMinor({ hasApplication: false, quoteTotalAmountMinor: quote, localMinor: local }),
    ).toBe(String(local));
    expect(
      tripListCheckoutMinor({ hasApplication: true, quoteTotalAmountMinor: quote, localMinor: local }),
    ).toBe(quote);
    expect(Number(quote) - local).toBe(insurance);
    expect(
      tripListCheckoutMinor({ hasApplication: true, quoteTotalAmountMinor: null, localMinor: local }),
    ).toBeNull();
  });
});

describe("visa list speed patch", () => {
  it("applies the speed only after success and reverts it on failure, including 409 extras locked", () => {
    expect(speedCommitFromPatch({ previous: "standard", requested: "fast_track", ok: true })).toBe("fast_track");
    expect(speedCommitFromPatch({ previous: "fast_track", requested: "standard", ok: false })).toBe("fast_track");
    expect(reloadQuoteAfterFailedSpeedPatch(false)).toBe(true);
    expect(reloadQuoteAfterFailedSpeedPatch(true)).toBe(false);
    expect(
      tripSpeedErrorMessage({
        status: 409,
        code: "CHECKOUT_FROZEN",
        message: "To change your extras, cancel this payment first.",
        lockedMessage: "locked",
        genericMessage: "generic",
      }),
    ).toBe("To change your extras, cancel this payment first.");
    expect(
      tripSpeedErrorMessage({
        status: 409,
        code: "EXTRAS_LOCKED",
        lockedMessage: "To change your extras, cancel this payment first.",
        genericMessage: "generic",
      }),
    ).toBe("To change your extras, cancel this payment first.");
    expect(
      tripSpeedErrorMessage({
        status: 500,
        code: "INTERNAL_ERROR",
        lockedMessage: "locked",
        genericMessage: "We couldn't update your total. Check your connection and try again.",
      }),
    ).toBe("We couldn't update your total. Check your connection and try again.");
  });
});
