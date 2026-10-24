import { describe, expect, it } from "vitest";
import {
  fincraAttemptReference,
  fincraWebhookLookupIds,
  nextFincraAttemptReference,
  parseFincraAttemptReference,
} from "./fincra-attempt-reference";

describe("fincra attempt references", () => {
  it("builds ${paymentId}-a${n} references", () => {
    expect(fincraAttemptReference("pay_1", 1)).toBe("pay_1-a1");
    expect(fincraAttemptReference("pay_1", 2)).toBe("pay_1-a2");
  });

  it("parses attempt references and ignores bare payment ids", () => {
    expect(parseFincraAttemptReference("pay_1-a2")).toEqual({ paymentId: "pay_1", attempt: 2 });
    expect(parseFincraAttemptReference("pay_1")).toBeNull();
    expect(parseFincraAttemptReference("")).toBeNull();
  });

  it("increments the attempt for the same payment and starts at a1 otherwise", () => {
    expect(nextFincraAttemptReference("pay_1", null)).toBe("pay_1-a1");
    expect(nextFincraAttemptReference("pay_1", "pay_1")).toBe("pay_1-a1");
    expect(nextFincraAttemptReference("pay_1", "pay_1-a1")).toBe("pay_1-a2");
    expect(nextFincraAttemptReference("pay_1", "other-a4")).toBe("pay_1-a1");
  });

  it("collects lookup ids from the attempt reference and metadata.paymentId", () => {
    expect(fincraWebhookLookupIds({ merchantReference: "pay_1-a3", paymentIdFromMetadata: "pay_1" })).toEqual([
      "pay_1-a3",
      "pay_1",
    ]);
    expect(fincraWebhookLookupIds({ merchantReference: "pay_1" })).toEqual(["pay_1"]);
  });
});
