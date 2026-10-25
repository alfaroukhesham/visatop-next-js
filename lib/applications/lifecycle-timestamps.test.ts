import { describe, expect, it } from "vitest";
import {
  fulfilledAtForCompletedTransition,
  paidAtForFirstPaidTransition,
} from "./lifecycle-timestamps";

describe("paidAtForFirstPaidTransition", () => {
  it("keeps an existing stamp", () => {
    const existing = new Date("2026-01-01T00:00:00.000Z");
    expect(paidAtForFirstPaidTransition(existing, new Date("2026-02-01T00:00:00.000Z"))).toBe(
      existing,
    );
  });

  it("stamps now on the first paid transition", () => {
    const now = new Date("2026-03-01T00:00:00.000Z");
    expect(paidAtForFirstPaidTransition(null, now)).toBe(now);
  });
});

describe("fulfilledAtForCompletedTransition", () => {
  it("stamps completed and ignores other statuses", () => {
    const now = new Date("2026-04-01T00:00:00.000Z");
    expect(fulfilledAtForCompletedTransition("completed", null, now)).toBe(now);
    expect(fulfilledAtForCompletedTransition("rejection_by_uae_authorities", null, now)).toBeUndefined();
    expect(fulfilledAtForCompletedTransition("in_progress", null, now)).toBeUndefined();
    const existing = new Date("2026-03-01T00:00:00.000Z");
    expect(fulfilledAtForCompletedTransition("completed", existing, now)).toBe(existing);
  });
});
