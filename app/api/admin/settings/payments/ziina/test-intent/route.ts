import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { jsonError, jsonOk } from "@/lib/api/response";
import { getAppOrigin } from "@/lib/app-url";
import { getZiinaServerConfig, isHttpsOrigin } from "@/lib/payments/resolve-payment-provider";
import { createZiinaPaymentIntent, ZiinaProviderError } from "@/lib/payments/ziina-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(
    requestId,
    ["settings.read", "settings.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const origin = getAppOrigin();
      if (!isHttpsOrigin(origin)) {
        return jsonError(
          "PAYMENT_PROVIDER_ERROR",
          "Test intents require an https app origin so Ziina can redirect back. Set NEXT_PUBLIC_APP_URL/BETTER_AUTH_URL to your tunnel https URL, then retry.",
          { status: 400, requestId },
        );
      }

      let cfg;
      try {
        cfg = getZiinaServerConfig();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "ZIINA_ACCESS_TOKEN missing";
        return jsonError("PAYMENT_PROVIDER_ERROR", msg, { status: 400, requestId });
      }

      const operationId = randomUUID();
      const returnUrl = `${origin.replace(/\/$/, "")}/admin/settings`;

      try {
        const created = await createZiinaPaymentIntent({
          baseUrl: cfg.apiBaseUrl,
          accessToken: cfg.accessToken,
          amountMinor: 200, // 2.00 (base units); keep minimal
          currencyCode: "AED",
          message: "Webhook smoke test (test mode)",
          successUrl: `${returnUrl}?ziinaTest=success&pi={PAYMENT_INTENT_ID}`,
          cancelUrl: `${returnUrl}?ziinaTest=cancel&pi={PAYMENT_INTENT_ID}`,
          failureUrl: `${returnUrl}?ziinaTest=failure&pi={PAYMENT_INTENT_ID}`,
          test: true,
          operationId,
          timeoutMs: 8000,
        });

        await writeAdminAudit(tx, {
          adminUserId,
          action: "payments.ziina.test_intent.create",
          entityType: "platform_setting",
          entityId: "ziina_test_intent",
          afterJson: JSON.stringify({ operationId, intentId: created.id }),
        });

        return jsonOk(
          { redirectUrl: created.redirectUrl, paymentIntentId: created.id, operationId },
          { requestId },
        );
      } catch (e) {
        if (e instanceof ZiinaProviderError) {
          return jsonError("ZIINA_UNAVAILABLE", e.message, { status: e.httpStatus, requestId });
        }
        throw e;
      }
    },
  );
}

