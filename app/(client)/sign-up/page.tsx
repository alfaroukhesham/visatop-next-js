import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SignUpForm } from "./sign-up-form";
import { isFacebookOAuthConfigured } from "@/lib/social-oauth";
import { CUSTOMER_LOCALE_COOKIE, parseCustomerLocale } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";

export const generateMetadata = async (): Promise<Metadata> => {
  const cookieStore = await cookies();
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));
  return {
    title: t("auth.signUp.pageTitle"),
    description: t("auth.signUp.pageDescription"),
    robots: { index: false, follow: true },
  };
};

const SignUpPage = () => {
  return <SignUpForm facebookEnabled={isFacebookOAuthConfigured()} />;
};

export default SignUpPage;
