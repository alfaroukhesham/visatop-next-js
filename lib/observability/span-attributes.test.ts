import { describe, expect, it } from "vitest";
import { pickSafeSpanAttributes } from "./span-attributes";

describe("pickSafeSpanAttributes", () => {
  it("keeps ids, provider, status, and error codes", () => {
    expect(
      pickSafeSpanAttributes({
        applicationId: "app_1",
        paymentId: "pay_1",
        provider: "fincra",
        status: "ok",
        errorCode: "http_502",
        "http.status_code": 502,
        requestId: "req_1",
        slot: "15m",
        outcome: "applied",
        attempt: 1,
        operation: "webhook",
      }),
    ).toEqual({
      applicationId: "app_1",
      paymentId: "pay_1",
      provider: "fincra",
      status: "ok",
      errorCode: "http_502",
      "http.status_code": 502,
      requestId: "req_1",
      slot: "15m",
      outcome: "applied",
      attempt: 1,
      operation: "webhook",
    });
  });

  it("drops bodies, headers, emails, names, passport data, and OCR results", () => {
    expect(
      pickSafeSpanAttributes({
        email: "ada@example.com",
        to: "ada@example.com",
        name: "Ada Lovelace",
        fullName: "Ada Lovelace",
        passportNumber: "X1234567",
        ocrText: "MRZ...",
        body: "{\"secret\":true}",
        headers: "Authorization: Bearer",
        authorization: "Bearer x",
        rawText: "bio page",
        payload: "{}",
      }),
    ).toEqual({});
  });
});
