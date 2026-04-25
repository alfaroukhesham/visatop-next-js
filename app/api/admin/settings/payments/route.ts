import { headers } from "next/headers";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { jsonOk } from "@/lib/api/response";
import { getAppOrigin } from "@/lib/app-url";
import { getActivePaymentProvider, isHttpsOrigin } from "@/lib/payments/resolve-payment-provider";
import { getWebhookHealthFromTx } from "@/lib/payments/webhook-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function present(name: string): boolean {
  const v = process.env[name];
  return Boolean(v && v.trim());
}

function missingEnv(names: string[]): string[] {
  return names.filter((n) => !present(n));
}

export async function GET() {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(requestId, ["settings.read"], async ({ tx }) => {
    const activeProvider = getActivePaymentProvider();
    const appOrigin = getAppOrigin();
    const ziinaMissing = missingEnv(["ZIINA_ACCESS_TOKEN", "ZIINA_WEBHOOK_SECRET"]);
    const paddleMissing = missingEnv(["PADDLE_API_KEY", "PADDLE_WEBHOOK_SECRET"]);

    const webhookUrl = `${appOrigin.replace(/\/$/, "")}/api/webhooks/ziina`;
    const canRegisterZiinaWebhook = isHttpsOrigin(appOrigin);

    const health = await getWebhookHealthFromTx(tx);

    return jsonOk(
      {
        activeProvider,
        appOrigin,
        canRegisterZiinaWebhook,
        derivedZiinaWebhookUrl: webhookUrl,
        ziina: {
          configured: ziinaMissing.length === 0,
          missing: ziinaMissing,
          apiBaseUrl: process.env.ZIINA_API_BASE_URL?.trim() || "https://api-v2.ziina.com/api",
          testMode: process.env.ZIINA_TEST_MODE === "true" || process.env.ZIINA_TEST_MODE === "1",
        },
        paddle: {
          configured: paddleMissing.length === 0,
          missing: paddleMissing,
        },
        webhookHealth: {
          lastZiina: health.lastZiina,
          lastPaddle: health.lastPaddle,
        },
      },
      { requestId },
    );
  });
}

