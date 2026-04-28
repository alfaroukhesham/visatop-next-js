import { describe, expect, test } from "vitest";
import { decodeCursor, encodeCursor, parseLimit } from "./cursor";

describe("cursor", () => {
  test("encode/decode roundtrip", () => {
    const raw = encodeCursor({ createdAt: "2026-01-01T00:00:00.000Z", id: "id-1" });
    expect(decodeCursor(raw)).toEqual({ createdAt: "2026-01-01T00:00:00.000Z", id: "id-1" });
  });

  test("decode invalid returns null", () => {
    expect(decodeCursor("not-base64")).toBeNull();
  });

  test("decode invalid timestamp returns null", () => {
    const raw = encodeCursor({ createdAt: "not-a-date", id: "id-1" });
    expect(decodeCursor(raw)).toBeNull();
  });

  test("parseLimit defaults to 5", () => {
    expect(parseLimit(null)).toBe(5);
  });

  test("parseLimit clamps", () => {
    expect(parseLimit("999", { max: 50 })).toBe(50);
    expect(parseLimit("0")).toBe(1);
  });
});

