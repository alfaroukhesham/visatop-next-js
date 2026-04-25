import { eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { platformSetting } from "@/lib/db/schema";

export const PLATFORM_KEY_LAST_WEBHOOK_ZIINA = "last_webhook_received_at_ziina";
export const PLATFORM_KEY_LAST_WEBHOOK_PADDLE = "last_webhook_received_at_paddle";

let warnedWebhookHealthMissing = false;

export async function markWebhookReceivedNow(tx: DbTransaction, key: string): Promise<void> {
  const updated = await tx
    .update(platformSetting)
    .set({ value: new Date().toISOString() })
    .where(eq(platformSetting.key, key))
    .returning({ key: platformSetting.key });

  if (updated.length === 0 && !warnedWebhookHealthMissing) {
    warnedWebhookHealthMissing = true;
    console.error("[payments] webhook health setting missing or not updatable (check migrations/RLS)", { key });
  }
}

export async function getWebhookHealthFromTx(tx: DbTransaction): Promise<{
  lastZiina: string | null;
  lastPaddle: string | null;
}> {
  const ziinaRows = await tx
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, PLATFORM_KEY_LAST_WEBHOOK_ZIINA))
    .limit(1);
  const paddleRows = await tx
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, PLATFORM_KEY_LAST_WEBHOOK_PADDLE))
    .limit(1);

  return {
    lastZiina: ziinaRows[0]?.value ? ziinaRows[0].value : null,
    lastPaddle: paddleRows[0]?.value ? paddleRows[0].value : null,
  };
}

