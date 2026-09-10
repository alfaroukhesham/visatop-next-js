import type { Metadata } from "next";
import { cookies } from "next/headers";
import { TrackPageClient } from "@/components/apply/track-page-client";
import { CUSTOMER_LOCALE_COOKIE, parseCustomerLocale } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";

export const generateMetadata = async (): Promise<Metadata> => {
  const cookieStore = await cookies();
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));
  return {
    title: t("track.pageTitle"),
    robots: { index: false, follow: true },
  };
};

export const dynamic = "force-dynamic";

const TrackApplicationPage = () => {
  return <TrackPageClient />;
};

export default TrackApplicationPage;
