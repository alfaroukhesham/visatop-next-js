import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { ApplyTwoColumn } from "@/components/apply/apply-two-column";
import { CheckoutOrderRecap } from "@/components/apply/checkout-order-recap";
import { SubmittedApplicationClient } from "@/components/apply/submitted-application-client";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";
import { loadPartyMembers } from "@/lib/applications/load-party-members";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { toPublicApplicationWithCharge } from "@/lib/applications/load-application-charge";
import { CUSTOMER_LOCALE_COOKIE, parseCustomerLocale } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";

interface ISubmittedApplicationPageProps {
  params: Promise<{ id: string }>;
}

export const generateMetadata = async (): Promise<Metadata> => {
  const cookieStore = await cookies();
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));
  return {
    title: t("submitted.pageTitle"),
  };
};

const SubmittedApplicationPage = async ({ params }: ISubmittedApplicationPageProps) => {
  const [{ id }, hdrs] = await Promise.all([params, headers()]);
  const row = await loadApplicationRowForRequest(id, hdrs.get("cookie"));
  if (!row) {
    notFound();
  }
  const members = await withSystemDbActor((tx) => loadPartyMembers(tx, row));
  const cookieStore = await cookies();
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));
  const publicApp = await toPublicApplicationWithCharge(row, t);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <ApplyTwoColumn
        currentStep={5}
        applicationId={id}
        hasSelectedVisa
        visaSummary={<CheckoutOrderRecap application={publicApp} members={members} />}
        contentClassName="theme-client-rise mx-auto w-full max-w-2xl"
      >
        <SubmittedApplicationClient applicationId={id} initialApplication={publicApp} />
      </ApplyTwoColumn>
    </div>
  );
};

export default SubmittedApplicationPage;
