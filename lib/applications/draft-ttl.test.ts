import { describe, expect, it, vi } from "vitest";
import {
  computeDraftExpiresAt,
  getDraftTtlHoursFromTx,
  parseDraftTtlHoursFromStored,
} from "./draft-ttl";

describe("computeDraftExpiresAt", () => {
  it("adds ttl hours in UTC wall-clock ms", () => {
    const out = computeDraftExpiresAt(new Date("2026-01-01T00:00:00.000Z"), 24);
    expect(out.toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });
});

describe("parseDraftTtlHoursFromStored", () => {
  it("defaults when empty", () => {
    expect(parseDraftTtlHoursFromStored("")).toBe(48);
    expect(parseDraftTtlHoursFromStored(undefined)).toBe(48);
  });

  it("respects valid integer string", () => {
    expect(parseDraftTtlHoursFromStored("72")).toBe(72);
  });

  it("rejects invalid", () => {
    expect(parseDraftTtlHoursFromStored("0")).toBe(48);
    expect(parseDraftTtlHoursFromStored("abc")).toBe(48);
    expect(parseDraftTtlHoursFromStored("9000")).toBe(48);
  });
});

describe("getDraftTtlHoursFromTx", () => {
  it("reads first row value", async () => {
    const tx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ value: "1" }]),
          }),
        }),
      }),
    };
    await expect(getDraftTtlHoursFromTx(tx as never)).resolves.toBe(1);
  });
});
