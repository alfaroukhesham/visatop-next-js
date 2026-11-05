import { logger } from "@/lib/logger";
import { withSystemDbActor } from "@/lib/db/actor-context";
import {
  CHECKOUT_RECOVERY_BATCH_SIZE,
  CHECKOUT_RECOVERY_LOOKBACK_DAYS,
  getCheckoutRecoveryDelayMs,
  isRecoveryEmailsEnabled,
} from "./config";
import { decideCheckoutRecoveryEmail } from "./decide";
import { loadCheckoutRecoveryCandidates } from "./load-candidates";
import { sendCheckoutRecoveryEmail } from "./send";

export type TCheckoutRecoveryJobResult = {
  enabled: boolean;
  considered: number;
  sent: number;
  skipped: number;
  failed: number;
};

export const runCheckoutRecoveryEmailJob = async (opts?: {
  now?: Date;
  requestId?: string | null;
}): Promise<TCheckoutRecoveryJobResult> => {
  const now = opts?.now ?? new Date();
  const enabled = isRecoveryEmailsEnabled();
  const empty: TCheckoutRecoveryJobResult = {
    enabled,
    considered: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };
  if (!enabled) return empty;

  const delayMs = getCheckoutRecoveryDelayMs();
  const loaded = await withSystemDbActor((tx) =>
    loadCheckoutRecoveryCandidates(tx, now, CHECKOUT_RECOVERY_LOOKBACK_DAYS, CHECKOUT_RECOVERY_BATCH_SIZE),
  );

  const result: TCheckoutRecoveryJobResult = {
    ...empty,
    considered: loaded.length,
  };

  for (const row of loaded) {
    const decision = decideCheckoutRecoveryEmail(row.candidate, delayMs, now);
    if (decision.action === "skip") {
      result.skipped += 1;
      continue;
    }
    const sent = await sendCheckoutRecoveryEmail(row, now);
    if (sent.ok && sent.claimed) result.sent += 1;
    else if (sent.ok && !sent.claimed) result.skipped += 1;
    else {
      result.failed += 1;
      logger.error(
        {
          applicationId: row.applicationId,
          error: "error" in sent ? sent.error : "send_failed",
          requestId: opts?.requestId,
        },
        "[email] checkout recovery send failed",
      );
    }
  }

  return result;
};
