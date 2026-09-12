import { describe, expect, it } from "vitest";
import { parseZiinaPaymentIntentCreated, ZiinaProviderError } from "./ziina-client";

describe("parseZiinaPaymentIntentCreated", () => {
  it("requires id and embedded_url", () => {
    const created = parseZiinaPaymentIntentCreated(
      {
        id: "pi_1",
        embedded_url: "https://pay.ziina.com/embed/pi_1",
        redirect_url: "https://pay.ziina.com/pi_1",
        operation_id: "op_1",
      },
      "fallback",
    );
    expect(created).toEqual({
      id: "pi_1",
      embeddedUrl: "https://pay.ziina.com/embed/pi_1",
      redirectUrl: "https://pay.ziina.com/pi_1",
      operationId: "op_1",
    });
  });

  it("fails closed when embedded_url is missing", () => {
    expect(() =>
      parseZiinaPaymentIntentCreated(
        { id: "pi_1", redirect_url: "https://pay.ziina.com/pi_1" },
        "fallback",
      ),
    ).toThrow(ZiinaProviderError);
  });
});
