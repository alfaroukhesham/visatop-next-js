import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ApplyTwoColumn } from "@/components/apply/apply-two-column";
import { CheckoutOrderRecap } from "@/components/apply/checkout-order-recap";
import { Suspense } from "react";
import { ApplicationDraftPanel } from "@/components/apply/application-draft-panel";
import { CheckoutQuoteProvider } from "@/components/apply/checkout-quote-provider";
import { ClientDraftPanelSkeleton } from "@/components/client/client-loading";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";
import { loadPartyMembers } from "@/lib/applications/load-party-members";
import { settledRecapFromPreview } from "@/lib/apply/charged-recap";
import { previewPartyQuote } from "@/lib/checkout-extras/party-checkout-quote";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { toPublicApplication } from "@/lib/applications/public-application";
import { CUSTOMER_LOCALE_COOKIE, parseCustomerLocale } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";
import {
  applyTripStepHref,
  explicitWizardScreenRequested,
  lastTravellerApplicationId,
} from "@/lib/apply/apply-wizard";
import type { TClientQuotePreview } from "@/lib/apply/checkout-extras-ui";
import { insuranceStepOffered } from "@/lib/checkout-extras/party-insurance";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ screen?: string }>;
};

export const generateMetadata = async (): Promise<Metadata> => {
  const cookieStore = await cookies();
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));
  return { title: t("seo.applicationPageTitle") };
};

const ApplyApplicationPage = async ({ params, searchParams }: Props) => {
  const [{ id }, hdrs, query] = await Promise.all([params, headers(), searchParams]);
  const row = await loadApplicationRowForRequest(id, hdrs.get("cookie"));
  if (!row) {
    notFound();
  }
  if (row.paymentStatus === "paid") {
    redirect(`/apply/applications/${encodeURIComponent(id)}/submitted`);
  }
  if (row.paymentStatus === "checkout_created" && !explicitWizardScreenRequested(query.screen)) {
    redirect(`/apply/applications/${encodeURIComponent(id)}/payment`);
  }
  const { members, settled, quotePreview } = await withSystemDbActor(async (tx) => {
    const members = await loadPartyMembers(tx, row);
    const preview = await previewPartyQuote(tx, id);
    return {
      members,
      quotePreview: preview,
      settled: preview.ok ? settledRecapFromPreview(preview.preview) : null,
    };
  });
  const cookieStore = await cookies();
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));
  const offered = quotePreview.ok && insuranceStepOffered(quotePreview.preview);
  const trip = applyTripStepHref(row.nationalityCode, id);
  return (
    <CheckoutQuoteProvider
      applicationId={id}
      initialPreview={quotePreview.ok ? (quotePreview.preview as TClientQuotePreview) : null}
    >
    <div className="max-w-6xl">
      <ApplyTwoColumn
        currentStep={3}
        phase={query.screen === "details" ? "details" : "documents"}
        includeExtras={offered}
        applicationId={id}
        tripHref={trip && offered ? `${trip}&extras=1` : trip}
        detailsTravellerId={lastTravellerApplicationId(members)}
        hasSelectedVisa
        contentFirstOnMobile
        visaSummary={
          <CheckoutOrderRecap
            application={toPublicApplication(row, undefined, t)}
            members={members}
            settled={settled}
          />
        }
        contentClassName="theme-client-rise mx-auto w-full max-w-4xl space-y-8"
      >
        <Suspense fallback={<ClientDraftPanelSkeleton />}>
          <ApplicationDraftPanel applicationId={id} />
        </Suspense>
      </ApplyTwoColumn>
    </div>
    </CheckoutQuoteProvider>
  );
};

export default ApplyApplicationPage;
