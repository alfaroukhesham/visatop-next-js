import { describe, expect, it } from "vitest";
import { computePaymentEventPayloadHash } from "./payment-event-hash";

describe("computePaymentEventPayloadHash", () => {
  it("is stable for the same provider + body", () => {
    const body = '{"event":"x"}';
    expect(computePaymentEventPayloadHash("paddle", body)).toBe(
      computePaymentEventPayloadHash("paddle", body),
    );
  });

  it("differs when provider changes for the same body", () => {
    const body = '{"event":"x"}';
    const paddle = computePaymentEventPayloadHash("paddle", body);
    const ziina = computePaymentEventPayloadHash("ziina", body);
    expect(paddle).not.toBe(ziina);
  });
});
