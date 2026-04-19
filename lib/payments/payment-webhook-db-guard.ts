import { sql } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";

/** Thrown when DB is missing constraints required for Paddle webhook idempotency. */
export class PaymentWebhookSchemaDeploymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentWebhookSchemaDeploymentError";
  }
}

const PAYMENT_EVENT_PAYLOAD_HASH_UNIQUE_INDEX = "payment_event_payload_hash_unique";

let paymentEventDedupeIndexKnownGood = false;

function executeRows(result: unknown): unknown[] {
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown[] }).rows)) {
    return (result as { rows: unknown[] }).rows;
  }
  return [];
}

/**
 * Paddle webhooks use `INSERT ... ON CONFLICT (payload_hash) DO NOTHING` for idempotency.
 * PostgreSQL error 42P10 is raised if that unique index is missing (migrations not applied).
 */
export function isPostgresOnConflictMissingConstraintError(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 8 && current; depth++) {
    if (typeof current === "object" && current !== null) {
      const rec = current as { code?: unknown; message?: unknown; cause?: unknown };
      if (rec.code === "42P10") return true;
      if (typeof rec.message === "string" && rec.message.includes("ON CONFLICT")) return true;
      current = rec.cause;
    } else {
      break;
    }
  }
  return false;
}

/**
 * Ensures the unique index backing `onConflictDoNothing({ target: paymentEvent.payloadHash })` exists.
 * Caches a positive result for the process lifetime to avoid catalog reads on every webhook.
 */
export async function requirePaymentEventPayloadHashDedupeIndex(tx: DbTransaction): Promise<void> {
  if (paymentEventDedupeIndexKnownGood) return;

  const r = await tx.execute(sql`
    select 1 as ok
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_event'
      and indexname = ${PAYMENT_EVENT_PAYLOAD_HASH_UNIQUE_INDEX}
    limit 1
  `);
  const rows = executeRows(r);
  if (rows.length === 0) {
    throw new PaymentWebhookSchemaDeploymentError(
      `Missing unique index "${PAYMENT_EVENT_PAYLOAD_HASH_UNIQUE_INDEX}" on public.payment_event. ` +
        "Webhook idempotency requires this index. Apply pending Drizzle migrations (e.g. pnpm db:migrate).",
    );
  }

  paymentEventDedupeIndexKnownGood = true;
}
