import { describe, expect, it } from "vitest";
import {
  conversionPctForDimension,
  mergePaymentFailureBreakdown,
  toConversionDimensionRows,
} from "./admin-analytics-conversion";

describe("toConversionDimensionRows", () => {
  it("normalizes blank keys and counts", () => {
    expect(
      toConversionDimensionRows([
        { key: "NG", created: "4", paid: 1 },
        { key: null, created: 2, paid: 0 },
        { key: "  ", created: 1, paid: 1 },
      ]),
    ).toEqual([
      { key: "NG", created: 4, paid: 1 },
      { key: "unknown", created: 2, paid: 0 },
      { key: "unknown", created: 1, paid: 1 },
    ]);
  });
});

describe("conversionPctForDimension", () => {
  it("is paid/created", () => {
    expect(conversionPctForDimension(1, 4)).toBe(25);
    expect(conversionPctForDimension(0, 0)).toBeNull();
  });
});

describe("mergePaymentFailureBreakdown", () => {
  it("counts Fincra payment_event attempts separately from other providers", () => {
    expect(
      mergePaymentFailureBreakdown(
        [
          { type: "charge.expired", count: 3 },
          { type: "charge.failed", count: 1 },
        ],
        [
          { provider: "ziina", code: "failed", count: 2 },
          { provider: "ziina", code: "canceled", count: 1 },
        ],
      ),
    ).toEqual([
      { code: "fincra:expired", count: 3 },
      { code: "ziina:failed", count: 2 },
      { code: "fincra:failed", count: 1 },
      { code: "ziina:canceled", count: 1 },
    ]);
  });
});
