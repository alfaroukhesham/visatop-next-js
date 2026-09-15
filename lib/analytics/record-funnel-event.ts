import { analyticsFunnelEvent } from "@/lib/db/schema";
import type { DbTransaction } from "@/lib/db";
import { isPersistableFunnelEvent, shouldSkipClientFunnelPersist } from "@/lib/analytics/funnel-event-names";
import { isForeignKeyViolation, isUniqueViolation } from "@/lib/db/pg-errors";
import { logger } from "@/lib/logger";

export type TRecordFunnelEventInput = {
  eventId: string;
  eventName: string;
  sessionId: string;
  applicationId?: string | null;
  nationalityCode?: string | null;
  serviceId?: string | null;
  source: "client" | "server";
  occurredAt?: Date;
};

export type TRecordFunnelEventResult = {
  stored: boolean;
  reason: "stored" | "skipped" | "duplicate" | "invalid_application" | "error";
};

const insertRow = async (tx: DbTransaction, input: TRecordFunnelEventInput): Promise<void> => {
  const builder = tx.insert(analyticsFunnelEvent).values({
    eventId: input.eventId,
    eventName: input.eventName,
    sessionId: input.sessionId,
    applicationId: input.applicationId ?? null,
    nationalityCode: input.nationalityCode ?? null,
    serviceId: input.serviceId ?? null,
    source: input.source,
    occurredAt: input.occurredAt ?? new Date(),
  }) as { then?: unknown; onConflictDoNothing?: () => Promise<unknown> } & Promise<unknown>;
  if (typeof builder.then === "function") {
    await builder;
    return;
  }
  if (typeof builder.onConflictDoNothing === "function") {
    await builder.onConflictDoNothing();
  }
};

/** Insert a funnel row. Never throws — parent mutations must not fail on analytics. */
export const recordFunnelEvent = async (
  tx: DbTransaction,
  input: TRecordFunnelEventInput,
): Promise<TRecordFunnelEventResult> => {
  if (!isPersistableFunnelEvent(input.eventName)) {
    return { stored: false, reason: "skipped" };
  }
  if (input.source === "client" && shouldSkipClientFunnelPersist(input.eventName)) {
    return { stored: false, reason: "skipped" };
  }
  try {
    await insertRow(tx, input);
    return { stored: true, reason: "stored" };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { stored: false, reason: "duplicate" };
    }
    if (isForeignKeyViolation(err) && input.applicationId) {
      try {
        await insertRow(tx, { ...input, applicationId: null });
        return { stored: true, reason: "invalid_application" };
      } catch (retryErr) {
        if (isUniqueViolation(retryErr)) {
          return { stored: false, reason: "duplicate" };
        }
        logger.warn({ err: retryErr, eventName: input.eventName }, "funnel event insert failed");
        return { stored: false, reason: "error" };
      }
    }
    logger.warn({ err, eventName: input.eventName }, "funnel event insert failed");
    return { stored: false, reason: "error" };
  }
};
