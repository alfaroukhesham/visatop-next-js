import { describe, expect, it, vi } from "vitest";
import { extractPassport, type CallModelFn } from "./gemini-passport";

const FAKE_BYTES = Buffer.from("fake jpeg bytes");

const SUCCESS_JSON = JSON.stringify({
  fullName: "Ada Lovelace",
  dateOfBirth: "1815-12-10",
  placeOfBirth: "London",
  nationality: "British",
  passportNumber: "X1234567",
  passportExpiryDate: "2030-01-01",
  profession: null,
  address: null,
});

const PARTIAL_JSON = JSON.stringify({
  fullName: "Ada Lovelace",
  dateOfBirth: "1815-12-10",
  nationality: "British",
  passportNumber: "X1234567",
  passportExpiryDate: null,
});

describe("extractPassport", () => {
  it("succeeds on attempt 1 when all required fields returned", async () => {
    const callModel = vi.fn<CallModelFn>(async () => ({ text: SUCCESS_JSON }));
    const out = await extractPassport({
      imageBytes: FAKE_BYTES,
      contentType: "image/jpeg",
      callModel,
    });
    expect(out.status).toBe("succeeded");
    expect(out.attempts).toHaveLength(1);
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(out.finalResult?.fullName).toBe("Ada Lovelace");
    expect(out.missingFields).toEqual([]);
    expect(out.provider).toBe("gemini");
  });

  it("retries on attempt 2 when attempt 1 is missing required fields", async () => {
    const callModel = vi
      .fn<CallModelFn>()
      .mockResolvedValueOnce({ text: PARTIAL_JSON })
      .mockResolvedValueOnce({ text: SUCCESS_JSON });
    const out = await extractPassport({
      imageBytes: FAKE_BYTES,
      contentType: "image/jpeg",
      callModel,
    });
    expect(out.status).toBe("succeeded");
    expect(callModel).toHaveBeenCalledTimes(2);
    expect(out.attempts).toHaveLength(2);
  });

  it("returns needs_manual when both attempts parse but miss required fields", async () => {
    const callModel = vi.fn<CallModelFn>(async () => ({ text: PARTIAL_JSON }));
    const out = await extractPassport({
      imageBytes: FAKE_BYTES,
      contentType: "image/jpeg",
      callModel,
    });
    expect(out.status).toBe("needs_manual");
    expect(out.missingFields).toContain("passportExpiryDate");
    expect(callModel).toHaveBeenCalledTimes(2);
  });

  it("returns failed when both attempts produce non-JSON", async () => {
    const callModel = vi.fn<CallModelFn>(async () => ({
      text: "sorry, I can't read that",
    }));
    const out = await extractPassport({
      imageBytes: FAKE_BYTES,
      contentType: "image/jpeg",
      callModel,
    });
    expect(out.status).toBe("failed");
    expect(out.attempts[0]?.errorCode).toBe("OCR_JSON_PARSE_ERROR");
    expect(callModel).toHaveBeenCalledTimes(2);
  });

  it("returns failed when the provider throws", async () => {
    const callModel = vi.fn<CallModelFn>(async () => {
      throw new Error("network bork");
    });
    const out = await extractPassport({
      imageBytes: FAKE_BYTES,
      contentType: "image/jpeg",
      callModel,
    });
    expect(out.status).toBe("failed");
    expect(out.attempts[0]?.errorCode).toBe("OCR_PROVIDER_ERROR");
  });

  it("strips ```json fences before parsing", async () => {
    const text = "```json\n" + SUCCESS_JSON + "\n```";
    const callModel = vi.fn<CallModelFn>(async () => ({ text }));
    const out = await extractPassport({
      imageBytes: FAKE_BYTES,
      contentType: "image/jpeg",
      callModel,
    });
    expect(out.status).toBe("succeeded");
  });

  it("never touches process.env.GEMINI_API_KEY when callModel is injected", async () => {
    const prev = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const callModel = vi.fn<CallModelFn>(async () => ({ text: SUCCESS_JSON }));
      const out = await extractPassport({
        imageBytes: FAKE_BYTES,
        contentType: "image/jpeg",
        callModel,
      });
      expect(out.status).toBe("succeeded");
    } finally {
      if (prev !== undefined) process.env.GEMINI_API_KEY = prev;
    }
  });
});
