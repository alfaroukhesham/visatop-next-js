import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readChooserDraft, writeChooserDraft } from "./chooser-draft-storage";

describe("chooser draft storage", () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => memory.get(k) ?? null,
        setItem: (k: string, v: string) => memory.set(k, v),
      },
    });
  });

  afterEach(() => {
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  });

  it("round-trips chooser state for a nationality", () => {
    writeChooserDraft("eg", {
      displayCurrency: "AED",
      serviceId: "svc-1",
      stay: "15_30",
      entry: "multiple",
      kind: "adult",
      phase: "results",
      additionalTravelers: [{ key: "t2", kind: "child", serviceId: "svc-2" }],
      email: "a@b.co",
    });
    expect(readChooserDraft("EG")).toEqual({
      displayCurrency: "AED",
      serviceId: "svc-1",
      stay: "15_30",
      entry: "multiple",
      kind: "adult",
      phase: "results",
      additionalTravelers: [{ key: "t2", kind: "child", serviceId: "svc-2" }],
      email: "a@b.co",
    });
  });
});
