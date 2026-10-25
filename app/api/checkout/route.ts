import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { appHref } from "@/lib/app-href";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { resolveApplicationAccess } from "@/lib/applications/application-access";
import { resolveCheckoutTotal } from "@/lib/pricing/resolve-customer-catalog-price";
import { FxRateInvalidError, FxRateMissingError } from "@/lib/pricing/fx-usd-aed";
import { minorUnitsToJsonSafeNumber } from "@/lib/pricing/minor-units-json";
import { PaddleProviderError, paddleAdapter } from "@/lib/payments/paddle-adapter";
import {
  assertPaymentsAllowedForOrigin,
  assertPaddleServerConfigured,
  getActivePaymentProvider,
  getFincraServerConfig,
  getZiinaServerConfig,
  requireCheckoutAppOrigin,
} from "@/lib/payments/resolve-payment-provider";
import { createZiinaPaymentIntent, ZiinaProviderError } from "@/lib/payments/ziina-client";
import { isTrustedZiinaEmbeddedUrl } from "@/lib/payments/ziina-embedded";
import { resolveCheckoutOfferDecision } from "@/lib/payments/resolve-checkout-provider";
import { createFincraCheckout, FincraProviderError } from "@/lib/payments/fincra-client";
import { isTrustedFincraCheckoutUrl } from "@/lib/payments/fincra-embedded";
import { fincraMinorToMajorNumber } from "@/lib/payments/fincra-amounts";
import { buildFincraInlineCheckoutData } from "@/lib/payments/fincra-inline";
import {
  abandonFincraCheckoutLock,
  classifyFincraLockedCheckoutRetry,
} from "@/lib/payments/fincra-checkout-lock";
import { loadOpenFincraPayment, rotateOpenFincraInlineAttempt } from "@/lib/payments/fincra-checkout-session";
import { nextFincraAttemptReference } from "@/lib/payments/fincra-attempt-reference";
import type { CheckoutSessionData } from "@/lib/payments/checkout-types";
import { diagnoseCheckoutBlock } from "@/lib/payments/diagnose-checkout-block";
import { loadPaymentUploadPresence } from "@/lib/applications/load-payment-upload-presence";
import { passportsPresentForPayment } from "@/lib/documents/validation-readiness";
import { sumCheckoutTotals, sumPartyLines, type TPartyLine } from "@/lib/payments/party-checkout-total";
import { FUNNEL_CHECKOUT_CREATED, serverFunnelEventId } from "@/lib/analytics/funnel-event-names";
import { recordFunnelEvent } from "@/lib/analytics/record-funnel-event";
import { isCheckoutTermsAccepted } from "@/lib/legal/terms";
import { resolveApplicantEmailTx } from "@/lib/email/resolve-applicant-email";
import * as schema from "@/lib/db/schema";
import { asc, eq, and, or, inArray, isNull } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { DbTransaction } from "@/lib/db";
import { createRequestLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const log = createRequestLogger(requestId);

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const applicationId =
      typeof (body as { applicationId?: unknown }).applicationId === "string"
        ? (body as { applicationId: string }).applicationId
        : null;
    const fincraMode =
      (body as { fincraMode?: unknown }).fincraMode === "hosted" ? "hosted" : "inline";

    if (!applicationId) return jsonError("VALIDATION_ERROR", "Missing applicationId", { status: 400, requestId });

    if (!isCheckoutTermsAccepted(body)) {
      return jsonError(
        "TERMS_NOT_ACCEPTED",
        "Please agree to VisaTop's Terms of Use before paying.",
        { status: 400, requestId, details: { reason: "terms_not_accepted" } },
      );
    }

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

    const defaultProvider = getActivePaymentProvider();

    const runTx = async (tx: DbTransaction) => {
      const [requestedApp] = await tx
        .select()
        .from(schema.application)
        .where(eq(schema.application.id, applicationId))
        .limit(1);

      if (!requestedApp) {
        return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
      }

      const memberIds = requestedApp.partyId
        ? (
            await tx
              .select({ id: schema.application.id })
              .from(schema.application)
              .where(eq(schema.application.partyId, requestedApp.partyId))
              .orderBy(asc(schema.application.travelerIndex))
          ).map((m) => m.id)
        : [applicationId];

      const lockCheckoutRows = async () =>
        tx
          .update(schema.application)
          .set({ checkoutState: "pending" })
          .where(
            and(
              inArray(schema.application.id, memberIds),
              or(isNull(schema.application.checkoutState), eq(schema.application.checkoutState, "none")),
              eq(schema.application.applicationStatus, "ready_for_payment"),
            ),
          )
          .returning();

      const unlockCheckoutRows = async (ids: string[]) => {
        if (ids.length === 0) return;
        await tx
          .update(schema.application)
          .set({ checkoutState: "none" })
          .where(inArray(schema.application.id, ids));
      };

      let lockedRows = await lockCheckoutRows();

      if (lockedRows.length !== memberIds.length) {
        await unlockCheckoutRows(lockedRows.map((r) => r.id));
        const openFincra = await loadOpenFincraPayment(tx, memberIds);
        const memberLocks = await tx
          .select({
            checkoutState: schema.application.checkoutState,
            paymentStatus: schema.application.paymentStatus,
          })
          .from(schema.application)
          .where(inArray(schema.application.id, memberIds));
        const retry = classifyFincraLockedCheckoutRetry({
          fincraMode,
          payRow: openFincra,
          members: memberLocks,
        });
        if (retry === "rotate" && openFincra) {
          const rotated = await rotateOpenFincraInlineAttempt(tx, {
            payRow: openFincra,
            memberIds,
            requestId: requestId ?? null,
          });
          if (rotated) {
            const data: CheckoutSessionData = rotated;
            return jsonOk(data, { requestId });
          }
        }
        if (retry === "self_heal" && openFincra) {
          await abandonFincraCheckoutLock(tx, {
            memberIds,
            paymentId: openFincra.id,
            reason: openFincra.providerCheckoutId?.trim() ? "stale_checkout" : "unprovisioned_checkout",
            requestId,
          });
          lockedRows = await lockCheckoutRows();
        }
      }

      if (lockedRows.length !== memberIds.length) {
        await unlockCheckoutRows(lockedRows.map((r) => r.id));
        const block = await diagnoseCheckoutBlock(tx, applicationId);
        return jsonError("CONFLICT", "Checkout cannot be started for this application", {
          status: 409,
          requestId,
          details: block,
        });
      }

      const primary = lockedRows.find((r) => r.travelerRole === "primary") ?? lockedRows[0];

      if (primary.isGuest && !primary.guestEmail?.trim()) {
        await tx.update(schema.application).set({ checkoutState: "none" }).where(inArray(schema.application.id, memberIds));
        return jsonError(
          "VALIDATION_ERROR",
          "Guest email is required on the application before checkout.",
          { status: 400, requestId, details: { reason: "missing_guest_email" } },
        );
      }

      const uploadPresence = await loadPaymentUploadPresence(tx, primary.id);
      if (!passportsPresentForPayment(uploadPresence)) {
        await tx.update(schema.application).set({ checkoutState: "none" }).where(inArray(schema.application.id, memberIds));
        return jsonError(
          "VALIDATION_ERROR",
          "Upload a passport copy before checkout.",
          { status: 400, requestId, details: { reason: "missing_passport" } },
        );
      }

      const offer = await resolveCheckoutOfferDecision(tx, {
        nationalityCode: primary.nationalityCode,
        selectedCurrency: primary.catalogCurrency,
        members: lockedRows,
        defaultProvider,
      });
      if (!offer.ok) {
        await tx.update(schema.application).set({ checkoutState: "none" }).where(inArray(schema.application.id, memberIds));
        const message =
          offer.reason === "missing_stored_price"
            ? "Pricing unavailable for this nationality/service/currency combination"
            : "This currency is not available for the selected nationality.";
        return jsonError("VALIDATION_ERROR", message, {
          status: 400,
          requestId,
          details: {
            reason: offer.reason === "missing_stored_price" ? "pricing_unavailable" : "currency_not_allowed",
          },
        });
      }
      const provider = offer.decision.provider;
      const catalogCurrency = offer.decision.quoteCurrency;

      if (provider === "fincra") {
        try {
          getFincraServerConfig();
        } catch (e) {
          await tx.update(schema.application).set({ checkoutState: "none" }).where(inArray(schema.application.id, memberIds));
          const msg = e instanceof Error ? e.message : "Fincra is not configured";
          return jsonError("PAYMENT_PROVIDER_ERROR", msg, { status: 503, requestId });
        }
      }

      const prices: Array<Awaited<ReturnType<typeof resolveCheckoutTotal>>> = [];
      for (const member of lockedRows) {
        let price;
        try {
          price = await resolveCheckoutTotal(tx, {
            nationalityCode: member.nationalityCode,
            serviceId: member.serviceId,
            catalogCurrency,
          });
        } catch (e) {
          await tx.update(schema.application).set({ checkoutState: "none" }).where(inArray(schema.application.id, memberIds));
          if (e instanceof FxRateMissingError) {
            return jsonError("SERVICE_UNAVAILABLE", e.message, { status: 503, requestId });
          }
          if (e instanceof FxRateInvalidError) {
            return jsonError("INTERNAL_ERROR", e.message, { status: 500, requestId });
          }
          throw e;
        }
        prices.push(price);
      }

      if (sumCheckoutTotals(prices) === null) {
        await tx.update(schema.application).set({ checkoutState: "none" }).where(inArray(schema.application.id, memberIds));
        return jsonError(
          "VALIDATION_ERROR",
          "Pricing unavailable for this nationality/service/currency combination",
          { status: 400, requestId, details: { reason: "pricing_unavailable" } },
        );
      }

      const lines: TPartyLine[] = lockedRows.map((member, i) => ({
        applicationId: member.id,
        serviceId: member.serviceId,
        amountMinor: prices[i]!.displayMinor,
        currency: prices[i]!.currency,
      }));
      const totalMinor = sumPartyLines(lines);
      const currency = prices[0]!.currency;

      try {
        minorUnitsToJsonSafeNumber(totalMinor);
      } catch (e) {
        await tx.update(schema.application).set({ checkoutState: "none" }).where(inArray(schema.application.id, memberIds));
        return jsonError(
          "VALIDATION_ERROR",
          e instanceof Error ? e.message : "Checkout amount is out of supported range.",
          { status: 400, requestId },
        );
      }

      const quoteId = createId();
      await tx.insert(schema.priceQuote).values({
        id: quoteId,
        applicationId: primary.id,
        totalAmount: totalMinor,
        currency,
        breakdownJson: JSON.stringify({
          kind: "customer_catalog",
          amountMinor: totalMinor.toString(),
          currency,
          fxSource: provider === "fincra" ? "fixed_list" : null,
          lines: prices.map((p, i) => ({
            applicationId: lockedRows[i]!.id,
            serviceId: lockedRows[i]!.serviceId,
            amountMinor: p!.displayMinor.toString(),
            currency: p!.currency,
          })),
        }),
        lockedAt: new Date(),
      });

      const paymentId = createId();
      await tx.insert(schema.payment).values({
        id: paymentId,
        applicationId: primary.id,
        provider,
        amount: totalMinor,
        currency,
        status: "checkout_created",
        fxSource: provider === "fincra" ? "fixed_list" : null,
      });

      await tx
        .update(schema.application)
        .set({ paymentStatus: "checkout_created" })
        .where(inArray(schema.application.id, memberIds));

      log.info({ provider }, "[checkout] checkout_created");

      for (const member of lockedRows) {
        await recordFunnelEvent(tx, {
          eventId: serverFunnelEventId(member.id, FUNNEL_CHECKOUT_CREATED),
          eventName: FUNNEL_CHECKOUT_CREATED,
          sessionId: `server:${member.id}`,
          applicationId: member.id,
          nationalityCode: member.nationalityCode,
          serviceId: member.serviceId,
          source: "server",
        });
      }

      const metadata: Record<string, string> = {
        applicationId: primary.id,
        priceQuoteId: quoteId,
        serviceId: primary.serviceId,
        isGuest: primary.isGuest ? "true" : "false",
      };
      if (requestedApp.partyId) metadata.partyId = requestedApp.partyId;
      if (primary.userId) metadata.userId = primary.userId;

      if (provider === "fincra") {
        const fincraCfg = getFincraServerConfig();
        const attemptRef = nextFincraAttemptReference(paymentId, null);
        await tx
          .update(schema.payment)
          .set({ providerOperationId: attemptRef })
          .where(eq(schema.payment.id, paymentId));

        const encId = encodeURIComponent(primary.id);
        const redirectUrl = appHref(`/apply/applications/${encId}/checkout/return`);
        const customerName = primary.fullName?.trim() || "VisaTop customer";
        const customerEmail = await resolveApplicantEmailTx(tx, primary);
        if (!customerEmail) {
          await tx.update(schema.application).set({ checkoutState: "none" }).where(inArray(schema.application.id, memberIds));
          return jsonError(
            "VALIDATION_ERROR",
            "Email is required on the application before Naira checkout.",
            { status: 400, requestId, details: { reason: "missing_guest_email" } },
          );
        }

        const fincraMetadata = {
          ...metadata,
          paymentId,
        };
        const inlineData = buildFincraInlineCheckoutData({
          publicKey: fincraCfg.publicKey,
          amountMinor: totalMinor,
          customer: {
            name: customerName,
            email: customerEmail,
            phoneNumber: primary.phone,
          },
          reference: attemptRef,
          feeBearer: fincraCfg.feeBearer,
          metadata: fincraMetadata,
        });

        if (fincraMode !== "hosted") {
          const data: CheckoutSessionData = inlineData;
          return jsonOk(data, { requestId });
        }

        try {
          const created = await createFincraCheckout({
            apiBaseUrl: fincraCfg.apiBaseUrl,
            secretKey: fincraCfg.secretKey,
            publicKey: fincraCfg.publicKey,
            amountMajor: fincraMinorToMajorNumber(totalMinor),
            currency: "NGN",
            reference: attemptRef,
            redirectUrl,
            customer: {
              name: customerName,
              email: customerEmail,
              phoneNumber: primary.phone,
            },
            feeBearer: fincraCfg.feeBearer,
            metadata: fincraMetadata,
            paymentMethods: ["card", "bank_transfer"],
            timeoutMs: 8000,
          });

          if (!isTrustedFincraCheckoutUrl(created.link)) {
            throw new FincraProviderError("Fincra checkout link is not a trusted host", 502);
          }

          await tx
            .update(schema.payment)
            .set({ providerCheckoutId: created.payCode })
            .where(eq(schema.payment.id, paymentId));

          const data: CheckoutSessionData = {
            provider: "fincra",
            mode: "hosted",
            redirectUrl: created.link,
          };
          return jsonOk(data, { requestId });
        } catch (e) {
          if (e instanceof FincraProviderError) {
            await abandonFincraCheckoutLock(tx, {
              memberIds,
              paymentId,
              reason: "provider_unavailable",
              requestId,
            });
            log.error(
              { message: e.message, httpStatus: e.httpStatus },
              "[api/checkout] Fincra error",
            );
            return jsonError("FINCRA_UNAVAILABLE", e.message, {
              status: e.httpStatus >= 500 ? 502 : e.httpStatus,
              requestId,
              details: { reason: "provider_unavailable" },
            });
          }
          throw e;
        }
      }

      if (provider === "paddle") {
        assertPaddleServerConfigured();
        const result = await paddleAdapter.createCheckout({
          applicationId: primary.id,
          priceQuoteId: quoteId,
          totalAmount: totalMinor,
          currency,
          serviceLabel: `Visa Service for ${primary.nationalityCode}`,
          customerEmail: primary.guestEmail,
          metadata,
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

      const encId = encodeURIComponent(primary.id);
      const successUrl = `${appHref(`/apply/applications/${encId}/checkout/return`)}?pi={PAYMENT_INTENT_ID}`;
      const cancelUrl = `${appHref(`/apply/applications/${encId}/checkout/cancel`)}?pi={PAYMENT_INTENT_ID}`;
      const failureUrl = `${appHref(`/apply/applications/${encId}/checkout/cancel`)}?pi={PAYMENT_INTENT_ID}&reason=failed`;

      try {
        const ziina = await createZiinaPaymentIntent({
          baseUrl: ziinaCfg.apiBaseUrl,
          accessToken: ziinaCfg.accessToken,
          amountMinor: minorUnitsToJsonSafeNumber(totalMinor),
          currencyCode: currency,
          message: `Visa service — ${primary.nationalityCode}`,
          successUrl,
          cancelUrl,
          failureUrl,
          test: ziinaCfg.testMode,
          operationId,
          timeoutMs: 8000,
        });

        if (!isTrustedZiinaEmbeddedUrl(ziina.embeddedUrl)) {
          throw new ZiinaProviderError("Ziina embedded_url is not a trusted checkout host", 502);
        }

        await tx
          .update(schema.payment)
          .set({ providerCheckoutId: ziina.id })
          .where(eq(schema.payment.id, paymentId));

        const data: CheckoutSessionData = { provider: "ziina", embeddedUrl: ziina.embeddedUrl };
        return jsonOk(data, { requestId });
      } catch (e) {
        if (e instanceof ZiinaProviderError) {
          log.error(
            { message: e.message, httpStatus: e.httpStatus },
            "[api/checkout] Ziina error",
          );
          return jsonError("ZIINA_UNAVAILABLE", e.message, {
            status: e.httpStatus >= 500 ? 502 : e.httpStatus,
            requestId,
            details: { reason: "provider_unavailable" },
          });
        }
        throw e;
      }
    };

    return await withSystemDbActor(runTx);
  } catch (err) {
    log.error({ err }, "[api/checkout] Checkout failed");
    if (err instanceof PaddleProviderError) {
      return jsonError("INTERNAL_ERROR", err.message, {
        status: err.httpStatus,
        requestId,
        details: { paddleCode: err.paddleCode },
      });
    }
    if (err instanceof FincraProviderError) {
      return jsonError("FINCRA_UNAVAILABLE", err.message, {
        status: err.httpStatus >= 500 ? 502 : err.httpStatus,
        requestId,
        details: { reason: "provider_unavailable" },
      });
    }
    return jsonError("INTERNAL_ERROR", "Checkout failed unexpectedly", { status: 500, requestId });
  }
}
