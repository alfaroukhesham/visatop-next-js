import { beforeEach, describe, expect, it, vi } from "vitest";
import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import { analyticsFunnelEvent } from "@/lib/db/schema";
import { recordFunnelEvent } from "./record-funnel-event";

const input = {
  eventId: "server:app-1:passport_uploaded",
  eventName: APPLY_FUNNEL_EVENTS.passportUploaded,
  sessionId: "server:app-1",
  applicationId: "app-1",
  source: "server" as const,
};

const makeTx = (opts?: {
  onConflictRows?: Array<{ eventId: string }>;
  onConflictThrow?: unknown;
}) => {
  const onConflictDoNothing = vi.fn(() => {
    if (opts?.onConflictThrow) {
      return {
        returning: async () => {
          throw opts.onConflictThrow;
        },
      };
    }
    return {
      returning: async () => opts?.onConflictRows ?? [{ eventId: input.eventId }],
    };
  });

  const valuesResult = {
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve(resolve("awaited-without-on-conflict"));
    },
    onConflictDoNothing,
  };

  const inner = {
    insert: vi.fn(() => ({
      values: vi.fn(() => valuesResult),
    })),
  };

  const transaction = vi.fn(async (fn: (sp: typeof inner) => Promise<unknown>) => fn(inner));

  return {
    tx: { transaction, insert: inner.insert },
    inner,
    onConflictDoNothing,
    transaction,
  };
};

describe("recordFunnelEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onConflictDoNothing even when the insert builder is thenable", async () => {
    const { tx, onConflictDoNothing } = makeTx();
    const result = await recordFunnelEvent(tx as never, input);
    expect(onConflictDoNothing).toHaveBeenCalledWith({
      target: analyticsFunnelEvent.eventId,
    });
    expect(result).toEqual({ stored: true, reason: "stored" });
  });

  it("runs the insert inside a nested transaction (savepoint)", async () => {
    const { tx, transaction } = makeTx();
    await recordFunnelEvent(tx as never, input);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("returns duplicate when onConflictDoNothing inserts no row", async () => {
    const { tx } = makeTx({ onConflictRows: [] });
    const result = await recordFunnelEvent(tx as never, input);
    expect(result).toEqual({ stored: false, reason: "duplicate" });
  });

  it("returns duplicate when the savepoint insert raises unique_violation", async () => {
    const uniqueErr = Object.assign(new Error("duplicate key value"), { code: "23505" });
    const { tx } = makeTx({ onConflictThrow: uniqueErr });
    const result = await recordFunnelEvent(tx as never, input);
    expect(result).toEqual({ stored: false, reason: "duplicate" });
  });

  it("retries with a null applicationId after a foreign-key violation", async () => {
    const fkErr = Object.assign(new Error("fk"), { code: "23503" });
    let attempts = 0;
    const onConflictDoNothing = vi.fn(() => ({
      returning: async () => {
        attempts += 1;
        if (attempts === 1) throw fkErr;
        return [{ eventId: input.eventId }];
      },
    }));
    const valuesResult = {
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve(resolve("awaited-without-on-conflict"));
      },
      onConflictDoNothing,
    };
    const inner = {
      insert: vi.fn(() => ({
        values: vi.fn(() => valuesResult),
      })),
    };
    const tx = {
      transaction: vi.fn(async (fn: (sp: typeof inner) => Promise<unknown>) => fn(inner)),
      insert: inner.insert,
    };
    const result = await recordFunnelEvent(tx as never, input);
    expect(result).toEqual({ stored: true, reason: "invalid_application" });
    expect(attempts).toBe(2);
  });
});
