import { headers } from "next/headers";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { jsonError, jsonOk } from "@/lib/api/response";
import { getAppOrigin } from "@/lib/app-url";
import { getZiinaServerConfig, isHttpsOrigin } from "@/lib/payments/resolve-payment-provider";
import { deleteZiinaWebhook, setZiinaWebhook, ZiinaProviderError } from "@/lib/payments/ziina-client";

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
          "Webhook registration requires an https app origin. Set NEXT_PUBLIC_APP_URL/BETTER_AUTH_URL to your tunnel https URL, then retry.",
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

      const secret = process.env.ZIINA_WEBHOOK_SECRET?.trim() ?? "";
      if (!secret) {
        return jsonError("WEBHOOK_SECRET_NOT_CONFIGURED", "ZIINA_WEBHOOK_SECRET is missing", {
          status: 400,
          requestId,
        });
      }

      const url = `${origin.replace(/\/$/, "")}/api/webhooks/ziina`;

      try {
        const res = await setZiinaWebhook({
          baseUrl: cfg.apiBaseUrl,
          accessToken: cfg.accessToken,
          url,
          secret,
          timeoutMs: 8000,
        });

        await writeAdminAudit(tx, {
          adminUserId,
          action: "payments.ziina.webhook.set",
          entityType: "platform_setting",
          entityId: "ziina_webhook",
          afterJson: JSON.stringify({ url, success: res.success, error: res.error }),
        });

        return jsonOk({ success: res.success, error: res.error, url }, { requestId });
      } catch (e) {
        if (e instanceof ZiinaProviderError) {
          return jsonError("ZIINA_UNAVAILABLE", e.message, { status: e.httpStatus, requestId });
        }
        throw e;
      }
    },
  );
}

export async function DELETE() {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(
    requestId,
    ["settings.read", "settings.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      let cfg;
      try {
        cfg = getZiinaServerConfig();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "ZIINA_ACCESS_TOKEN missing";
        return jsonError("PAYMENT_PROVIDER_ERROR", msg, { status: 400, requestId });
      }

      try {
        const res = await deleteZiinaWebhook({
          baseUrl: cfg.apiBaseUrl,
          accessToken: cfg.accessToken,
          timeoutMs: 8000,
        });

        await writeAdminAudit(tx, {
          adminUserId,
          action: "payments.ziina.webhook.delete",
          entityType: "platform_setting",
          entityId: "ziina_webhook",
          afterJson: JSON.stringify({ success: res.success, error: res.error }),
        });

        return jsonOk({ success: res.success, error: res.error }, { requestId });
      } catch (e) {
        if (e instanceof ZiinaProviderError) {
          return jsonError("ZIINA_UNAVAILABLE", e.message, { status: e.httpStatus, requestId });
        }
        throw e;
      }
    },
  );
}

