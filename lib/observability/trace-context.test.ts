import { describe, expect, it } from "vitest";
import { ensureTraceContext, parseTraceparent } from "./trace-context";

describe("traceparent", () => {
  it("parses a valid W3C header and lowercases hex", () => {
    const parsed = parseTraceparent(
      "00-4BF92F3577B34DA6A3CE929D0E0E4736-00F067AA0BA902B7-01",
    );
    expect(parsed).toMatchObject({
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      parentId: "00f067aa0ba902b7",
      sampled: true,
    });
  });

  it("rejects all-zero ids", () => {
    expect(
      parseTraceparent("00-00000000000000000000000000000000-00f067aa0ba902b7-01"),
    ).toBeNull();
  });

  it("reuses an incoming traceparent so Node parent-based sampling can honor it", () => {
    const incoming = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    const ensured = ensureTraceContext(incoming, 0);
    expect(ensured.traceparent).toBe(incoming);
    expect(ensured.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(ensured.sampled).toBe(true);
  });

  it("mints a new sampled context when none is provided (ratio 1)", () => {
    const minted = ensureTraceContext(null, 1);
    expect(minted.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(minted.traceId).toHaveLength(32);
    expect(minted.sampled).toBe(true);
  });
});
