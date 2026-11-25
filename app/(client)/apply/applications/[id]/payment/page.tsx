import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ApplyTwoColumn } from "@/components/apply/apply-two-column";
import { CheckoutOrderRecap } from "@/components/apply/checkout-order-recap";
import { CheckoutQuoteProvider } from "@/components/apply/checkout-quote-provider";
import { PayOrderSummary } from "@/components/apply/pay-order-summary";
import { ApplicationPaymentPanel } from "@/components/apply/application-payment-panel";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";
import { loadPaymentUploadPresence } from "@/lib/applications/load-payment-upload-presence";
import { loadPartyMembers } from "@/lib/applications/load-party-members";
import { paymentPanelMayShow } from "@/lib/applications/payment-panel-may-show";
import { toPublicApplication } from "@/lib/applications/public-application";
import { CUSTOMER_LOCALE_COOKIE, parseCustomerLocale } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";
import { applyTripStepHref, lastTravellerApplicationId } from "@/lib/apply/apply-wizard";
import type { TClientQuotePreview } from "@/lib/apply/checkout-extras-ui";
import { previewPartyQuote } from "@/lib/checkout-extras/party-checkout-quote";
import { insuranceStepOffered } from "@/lib/checkout-extras/party-insurance";
import { withSystemDbActor } from "@/lib/db/actor-context";

interface IApplyApplicationPaymentPageProps {
  params: Promise<{ id: string }>;
}

export const generateMetadata = async (): Promise<Metadata> => {
  const cookieStore = await cookies();
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));
  return { title: t("payment.pageTitle") };
};

const ApplyApplicationPaymentPage = async ({ params }: IApplyApplicationPaymentPageProps) => {
  const [{ id }, hdrs, cookieStore] = await Promise.all([params, headers(), cookies()]);
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));
  const row = await loadApplicationRowForRequest(id, hdrs.get("cookie"));
  if (!row) {
    notFound();
  }
  if (row.paymentStatus === "paid") {
    redirect(`/apply/applications/${encodeURIComponent(id)}/submitted`);
  }

  const { uploads, members, quotePreview } = await withSystemDbActor(async (tx) => {
    const uploads = await loadPaymentUploadPresence(tx, id);
    const members = await loadPartyMembers(tx, row);
    const quotePreview = await previewPartyQuote(tx, id);
    return { uploads, members, quotePreview };
  });
  const publicApp = toPublicApplication(row, undefined, t);
  if (!paymentPanelMayShow(publicApp, uploads)) {
    redirect(`/apply/applications/${encodeURIComponent(id)}`);
  }
  const offered = quotePreview.ok && insuranceStepOffered(quotePreview.preview);
  const trip = applyTripStepHref(row.nationalityCode, id);
  const visaNames = members.map((member) => member.serviceName);

  return (
    <CheckoutQuoteProvider
      applicationId={id}
      initialPreview={quotePreview.ok ? (quotePreview.preview as TClientQuotePreview) : null}
    >
      <div className="max-w-6xl">
        <ApplyTwoColumn
          currentStep={offered ? 5 : 4}
          includeExtras={offered}
          applicationId={id}
          tripHref={trip && offered ? `${trip}&extras=1` : trip}
          detailsTravellerId={lastTravellerApplicationId(members)}
          hasSelectedVisa
          visaSummary={
            <CheckoutOrderRecap
              application={publicApp}
              members={members}
              trackCheckoutViewed
              showProcessingSpeed={false}
            />
          }
          contentClassName="theme-client-rise mx-auto w-full max-w-4xl space-y-8"
        >
          <header className="space-y-1.5">
            <h1 className="font-heading text-foreground text-xl! font-semibold leading-snug tracking-tight md:text-[1.75rem]!">
              {t("payment.title")}
            </h1>
            <p className="text-muted-foreground max-w-[62ch] text-sm leading-relaxed">
              {t("payment.subtitle")}
            </p>
          </header>
          <PayOrderSummary applicationId={id} visaNames={visaNames} />
          <ApplicationPaymentPanel applicationId={id} />
        </ApplyTwoColumn>
      </div>
    </CheckoutQuoteProvider>
  );
};

export default ApplyApplicationPaymentPage;
