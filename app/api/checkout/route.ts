import { headers } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor, withClientDbActor } from "@/lib/db/actor-context";
import { resolveApplicationAccess } from "@/lib/applications/application-access";
import { resolveAdminPricingBreakdown } from "@/lib/pricing/resolve-catalog-pricing";
import { PaddleProviderError, paddleAdapter } from "@/lib/payments/paddle-adapter";
import * as schema from "@/lib/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  try {
    const { applicationId } = await req.json().catch(() => ({ applicationId: null }));

    if (!applicationId) return jsonError("VALIDATION_ERROR", "Missing applicationId", { status: 400, requestId });

    const accessRes = await resolveApplicationAccess(req, hdrs, applicationId);
    if (!accessRes.ok) {
      const status = accessRes.failure.kind === "not_found" ? 404 : 403;
      return jsonError("UNAUTHORIZED", "Cannot access application", { status, requestId });
    }

    const runTx = async (tx: any) => {
      // 1. Atomic checkout lock guard
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
        return jsonError("CONFLICT", "Application locked, not ready, or checkout already in progress", {
          status: 409,
          requestId,
        });
      }

      // 2. Resolve pricing
      const price = await resolveAdminPricingBreakdown(tx, lockedApp.serviceId);
      if (!price) {
        await tx.update(schema.application).set({ checkoutState: "none" }).where(eq(schema.application.id, applicationId));
        return jsonError("INTERNAL_ERROR", "Pricing unavailable", { status: 400, requestId });
      }

      // 3. Create quote
      const quoteId = createId();
      await tx.insert(schema.priceQuote).values({
        id: quoteId,
        applicationId,
        totalAmount: Number(price.displayMinor),
        currency: price.currency,
        breakdownJson: JSON.stringify({
          referenceMinor: price.referenceMinor.toString(),
          marginMode: price.marginMode,
          marginValue: price.marginValue,
          addonsMinor: price.addonsMinor.toString(),
        }),
        lockedAt: new Date(),
      });

      // 4. Create payment row
      const paymentId = createId();
      await tx.insert(schema.payment).values({
        id: paymentId,
        applicationId,
        provider: "paddle",
        amount: Number(price.displayMinor),
        currency: price.currency,
        status: "checkout_created",
      });

      // 5. Update app
      await tx
        .update(schema.application)
        .set({ paymentStatus: "checkout_created" })
        .where(eq(schema.application.id, applicationId));

      // 6. Call provider
      const result = await paddleAdapter.createCheckout({
        applicationId,
        priceQuoteId: quoteId,
        totalAmount: Number(price.displayMinor),
        currency: price.currency,
        serviceLabel: `Visa Service for ${lockedApp.nationalityCode}`,
        customerEmail: lockedApp.guestEmail,
        metadata: { applicationId, serviceId: lockedApp.serviceId },
      });

      // 7. Store provider ID
      await tx
        .update(schema.payment)
        .set({ providerCheckoutId: result.transactionId })
        .where(eq(schema.payment.id, paymentId));

      return jsonOk(result, { requestId });
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
