import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";
import { CheckoutReturnClient } from "./checkout-return-client";
import { CUSTOMER_LOCALE_COOKIE, parseCustomerLocale } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";

export const generateMetadata = async (): Promise<Metadata> => {
  const cookieStore = await cookies();
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));
  return {
    title: t("checkout.returnPageTitle"),
    description: t("checkout.returnPageDescription"),
  };
};

const CheckoutReturnPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const [{ id }, hdrs] = await Promise.all([params, headers()]);
  const row = await loadApplicationRowForRequest(id, hdrs.get("cookie"));
  if (row?.paymentStatus === "paid") {
    redirect(`/apply/applications/${encodeURIComponent(id)}/submitted`);
  }
  return <CheckoutReturnClient applicationId={id} />;
};

export default CheckoutReturnPage;
