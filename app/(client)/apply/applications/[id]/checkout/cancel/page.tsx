import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { CUSTOMER_LOCALE_COOKIE, parseCustomerLocale } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";

export const generateMetadata = async (): Promise<Metadata> => {
  const cookieStore = await cookies();
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));
  return {
    title: t("checkout.cancelPageTitle"),
    description: t("checkout.cancelPageDescription"),
  };
};

const CheckoutCancelPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const [{ id }, cookieStore] = await Promise.all([params, cookies()]);
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));
  const enc = encodeURIComponent(id);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-16">
      <h1 className="font-heading text-center text-lg font-semibold">{t("checkout.cancelTitle")}</h1>
      <p className="text-center text-sm leading-relaxed text-muted-foreground">{t("checkout.cancelBody")}</p>
      <Link
        href={`/apply/applications/${enc}/payment`}
        className="text-link text-center text-sm font-medium"
      >
        {t("checkout.backToPayment")}
      </Link>
    </div>
  );
};

export default CheckoutCancelPage;
