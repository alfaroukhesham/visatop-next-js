import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { CUSTOMER_LOCALE_COOKIE, parseCustomerLocale } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";

export const generateMetadata = async (): Promise<Metadata> => {
  const cookieStore = await cookies();
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));
  return {
    title: t("auth.linkAfterSignup.pageTitle"),
  };
};

const LinkAfterSignupLayout = ({ children }: { children: ReactNode }) => {
  return children;
};

export default LinkAfterSignupLayout;
