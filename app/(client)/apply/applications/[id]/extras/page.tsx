import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ApplyTwoColumn } from "@/components/apply/apply-two-column";
import { CheckoutQuoteProvider } from "@/components/apply/checkout-quote-provider";
import { ExtrasAside, ExtrasStepSection } from "@/components/apply/extras-step-section";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";
import { loadPartyMembers } from "@/lib/applications/load-party-members";
import { paymentPanelMayShow } from "@/lib/applications/payment-panel-may-show";
import { loadPaymentUploadPresence } from "@/lib/applications/load-payment-upload-presence";
import { toPublicApplication } from "@/lib/applications/public-application";
import { applyTripStepHref, lastTravellerApplicationId } from "@/lib/apply/apply-wizard";
import type { TClientQuotePreview } from "@/lib/apply/checkout-extras-ui";
import { previewPartyQuote } from "@/lib/checkout-extras/party-checkout-quote";
import { insuranceStepOffered } from "@/lib/checkout-extras/party-insurance";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { CUSTOMER_LOCALE_COOKIE, parseCustomerLocale } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";

interface IExtrasPageProps {
  params: Promise<{ id: string }>;
}

export const generateMetadata = async (): Promise<Metadata> => {
  const cookieStore = await cookies();
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));
  return { title: t("extras.title") };
};

const ExtrasPage = async ({ params }: IExtrasPageProps) => {
  const [{ id }, hdrs, cookieStore] = await Promise.all([params, headers(), cookies()]);
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));
  const row = await loadApplicationRowForRequest(id, hdrs.get("cookie"));
  if (!row) notFound();
  if (row.paymentStatus === "paid") {
    redirect(`/apply/applications/${encodeURIComponent(id)}/submitted`);
  }
  const { members, preview, uploads } = await withSystemDbActor(async (tx) => {
    const members = await loadPartyMembers(tx, row);
    const preview = await previewPartyQuote(tx, id);
    const uploads = await loadPaymentUploadPresence(tx, id);
    return { members, preview, uploads };
  });
  const publicApp = toPublicApplication(row, undefined, t);
  if (!paymentPanelMayShow(publicApp, uploads)) {
    redirect(`/apply/applications/${encodeURIComponent(id)}`);
  }
  if (!preview.ok || !insuranceStepOffered(preview.preview)) {
    redirect(`/apply/applications/${encodeURIComponent(id)}/payment`);
  }
  const detailsId = lastTravellerApplicationId(members);
  const backHref = detailsId
    ? `/apply/applications/${encodeURIComponent(id)}?screen=details&traveller=${encodeURIComponent(detailsId)}`
    : `/apply/applications/${encodeURIComponent(id)}?screen=details`;
  const trip = applyTripStepHref(row.nationalityCode, id);
  const visaNames = members.map((member) => ({
    name: member.serviceName,
    durationDays: member.durationDays,
    entries: member.entries,
    travelerKind: member.travelerKind,
  }));

  return (
    <CheckoutQuoteProvider applicationId={id} initialPreview={preview.preview as TClientQuotePreview}>
      <div className="max-w-6xl">
        <ApplyTwoColumn
          currentStep={4}
          phase="extras"
          includeExtras
          summaryFrom="desktop"
          applicationId={id}
          tripHref={trip ? `${trip}&extras=1&from=extras` : null}
          detailsTravellerId={detailsId}
          hasSelectedVisa
          visaSummary={
            <div className="border-border bg-card rounded-[12px] border p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-5">
              <h2 className="font-heading text-foreground mb-3 text-lg font-bold">{t("payment.orderTitle")}</h2>
              <ExtrasAside visaNames={visaNames} />
            </div>
          }
          contentClassName="mx-auto w-full max-w-4xl space-y-8"
        >
          <ExtrasStepSection applicationId={id} visaNames={visaNames} backHref={backHref} />
        </ApplyTwoColumn>
      </div>
    </CheckoutQuoteProvider>
  );
};

export default ExtrasPage;
