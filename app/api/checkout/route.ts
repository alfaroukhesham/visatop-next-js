import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { appHref } from "@/lib/app-href";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor, withClientDbActor } from "@/lib/db/actor-context";
import { resolveApplicationAccess } from "@/lib/applications/application-access";
import { resolveCheckoutTotal } from "@/lib/pricing/resolve-customer-catalog-price";
import { FxRateInvalidError, FxRateMissingError } from "@/lib/pricing/fx-usd-aed";
import { minorUnitsToJsonSafeNumber } from "@/lib/pricing/minor-units-json";
import { PaddleProviderError, paddleAdapter } from "@/lib/payments/paddle-adapter";
import {
  assertPaymentsAllowedForOrigin,
  assertPaddleServerConfigured,
  getActivePaymentProvider,
  getZiinaServerConfig,
  requireCheckoutAppOrigin,
} from "@/lib/payments/resolve-payment-provider";
import { createZiinaPaymentIntent, ZiinaProviderError } from "@/lib/payments/ziina-client";
import type { CheckoutSessionData } from "@/lib/payments/checkout-types";
import { diagnoseCheckoutBlock } from "@/lib/payments/diagnose-checkout-block";
import * as schema from "@/lib/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { DbTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  try {
    const { applicationId } = await req.json().catch(() => ({ applicationId: null }));

    if (!applicationId) return jsonError("VALIDATION_ERROR", "Missing applicationId", { status: 400, requestId });

    let origin: string;
    try {
      origin = requireCheckoutAppOrigin();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "App URL not configured";
      return jsonError("PAYMENT_PROVIDER_ERROR", msg, { status: 400, requestId });
    }
    const gate = assertPaymentsAllowedForOrigin(origin);
    if (!gate.ok) {
      return jsonError("PAYMENT_PROVIDER_ERROR", gate.message, {
        status: 400,
        requestId,
        details: { reason: "payments_origin_blocked" },
      });
    }

    const accessRes = await resolveApplicationAccess(req, hdrs, applicationId);
    if (!accessRes.ok) {
      const status = accessRes.failure.kind === "not_found" ? 404 : 403;
      return jsonError("UNAUTHORIZED", "Cannot access application", { status, requestId });
    }

    const provider = getActivePaymentProvider();

    const runTx = async (tx: DbTransaction) => {
      const [lockedApp] = await tx
        .update(schema.application)
        .set({ checkoutState: "pending" })
        .where(
          and(
            eq(schema.application.id, applicationId),
            or(isNull(schema.application.checkoutState), eq(schema.application.checkoutState, "none")),
            eq(schema.application.applicationStatus, "ready_for_payment"),
          ),
        )
        .returning();

      if (!lockedApp) {
        const block = await diagnoseCheckoutBlock(tx, applicationId);
        return jsonError("CONFLICT", "Checkout cannot be started for this application", {
          status: 409,
          requestId,
          details: block,
        });
      }

      if (lockedApp.isGuest && !lockedApp.guestEmail?.trim()) {
        await tx.update(schema.application).set({ checkoutState: "none" }).where(eq(schema.application.id, applicationId));
        return jsonError(
          "VALIDATION_ERROR",
          "Guest email is required on the application before checkout.",
          { status: 400, requestId, details: { reason: "missing_guest_email" } },
        );
      }

      const catalogCurrency =
        lockedApp.catalogCurrency?.trim().toUpperCase() === "AED" ? "AED" : "USD";

      let price;
      try {
        price = await resolveCheckoutTotal(tx, {
          nationalityCode: lockedApp.nationalityCode,
          serviceId: lockedApp.serviceId,
          catalogCurrency,
        });
      } catch (e) {
        await tx.update(schema.application).set({ checkoutState: "none" }).where(eq(schema.application.id, applicationId));
        if (e instanceof FxRateMissingError) {
          return jsonError("SERVICE_UNAVAILABLE", e.message, { status: 503, requestId });
        }
        if (e instanceof FxRateInvalidError) {
          return jsonError("INTERNAL_ERROR", e.message, { status: 500, requestId });
        }
        throw e;
      }

      if (!price) {
        await tx.update(schema.application).set({ checkoutState: "none" }).where(eq(schema.application.id, applicationId));
        return jsonError(
          "VALIDATION_ERROR",
          "Pricing unavailable for this nationality/service/currency combination",
          { status: 400, requestId, details: { reason: "pricing_unavailable" } },
        );
      }

      try {
        minorUnitsToJsonSafeNumber(price.displayMinor);
      } catch (e) {
        await tx.update(schema.application).set({ checkoutState: "none" }).where(eq(schema.application.id, applicationId));
        return jsonError(
          "VALIDATION_ERROR",
          e instanceof Error ? e.message : "Checkout amount is out of supported range.",
          { status: 400, requestId },
        );
      }

      const quoteId = createId();
      await tx.insert(schema.priceQuote).values({
        id: quoteId,
        applicationId,
        totalAmount: price.displayMinor,
        currency: price.currency,
        breakdownJson: JSON.stringify({
          kind: "customer_catalog",
          amountMinor: price.displayMinor.toString(),
          currency: price.currency,
          fxRate: price.fxRateUsed ?? undefined,
          fxLeg: price.fxLeg ?? undefined,
          source: price.source,
        }),
        lockedAt: new Date(),
      });

      const paymentId = createId();
      await tx.insert(schema.payment).values({
        id: paymentId,
        applicationId,
        provider,
        amount: price.displayMinor,
        currency: price.currency,
        status: "checkout_created",
      });

      await tx
        .update(schema.application)
        .set({ paymentStatus: "checkout_created" })
        .where(eq(schema.application.id, applicationId));

      if (provider === "paddle") {
        assertPaddleServerConfigured();
        const result = await paddleAdapter.createCheckout({
          applicationId,
          priceQuoteId: quoteId,
          totalAmount: price.displayMinor,
          currency: price.currency,
          serviceLabel: `Visa Service for ${lockedApp.nationalityCode}`,
          customerEmail: lockedApp.guestEmail,
          metadata: {
            applicationId,
            serviceId: lockedApp.serviceId,
            catalogCurrency,
          },
        });

        await tx
          .update(schema.payment)
          .set({ providerCheckoutId: result.transactionId })
          .where(eq(schema.payment.id, paymentId));

        const data: CheckoutSessionData = {
          provider: "paddle",
          transactionId: result.transactionId,
          clientToken: result.clientToken,
        };
        return jsonOk(data, { requestId });
      }

      let ziinaCfg;
      try {
        ziinaCfg = getZiinaServerConfig();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Ziina is not configured";
        return jsonError("PAYMENT_PROVIDER_ERROR", msg, { status: 503, requestId });
      }

      const operationId = randomUUID();
      await tx
        .update(schema.payment)
        .set({ providerOperationId: operationId })
        .where(eq(schema.payment.id, paymentId));

      const encId = encodeURIComponent(applicationId);
      const successUrl = `${appHref(`/apply/applications/${encId}/checkout/return`)}?pi={PAYMENT_INTENT_ID}`;
      const cancelUrl = `${appHref(`/apply/applications/${encId}/checkout/cancel`)}?pi={PAYMENT_INTENT_ID}`;
      const failureUrl = `${appHref(`/apply/applications/${encId}/checkout/cancel`)}?pi={PAYMENT_INTENT_ID}&reason=failed`;

      try {
        const ziina = await createZiinaPaymentIntent({
          baseUrl: ziinaCfg.apiBaseUrl,
          accessToken: ziinaCfg.accessToken,
          amountMinor: minorUnitsToJsonSafeNumber(price.displayMinor),
          currencyCode: price.currency,
          message: `Visa service — ${lockedApp.nationalityCode}`,
          successUrl,
          cancelUrl,
          failureUrl,
          test: ziinaCfg.testMode,
          operationId,
          timeoutMs: 8000,
        });

        await tx
          .update(schema.payment)
          .set({ providerCheckoutId: ziina.id })
          .where(eq(schema.payment.id, paymentId));

        const data: CheckoutSessionData = { provider: "ziina", redirectUrl: ziina.redirectUrl };
        return jsonOk(data, { requestId });
      } catch (e) {
        if (e instanceof ZiinaProviderError) {
          console.error("[api/checkout] Ziina error", {
            requestId,
            message: e.message,
            httpStatus: e.httpStatus,
            ziinaBody: e.ziinaBody,
          });
          return jsonError("ZIINA_UNAVAILABLE", e.message, {
            status: e.httpStatus >= 500 ? 502 : e.httpStatus,
            requestId,
            details: { reason: "provider_unavailable" },
          });
        }
        throw e;
      }
    };

    if (accessRes.access.kind === "user") {
      return await withClientDbActor(accessRes.access.userId, runTx);
    }
    return await withSystemDbActor(runTx);
  } catch (err) {
    console.error("[api/checkout]", err);
    if (err instanceof PaddleProviderError) {
      return jsonError("INTERNAL_ERROR", err.message, {
        status: err.httpStatus,
        requestId,
        details: { paddleCode: err.paddleCode },
      });
    }
    return jsonError("INTERNAL_ERROR", "Checkout failed unexpectedly", { status: 500, requestId });
  }
}
